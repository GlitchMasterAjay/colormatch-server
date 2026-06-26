const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom,
  startGame,
  checkWinner,
  getPublicRoomState,
  getPlayerPrivateState,
  PLAYERS_PER_ROOM,
  WORD_MATCH_MIN_PLAYERS,
  WORD_MATCH_MAX_PLAYERS,
  CONTACT_BLOCK_MIN_PLAYERS,
  CONTACT_BLOCK_MAX_PLAYERS,
  GAME_TYPES,
  createWordMatchState,
  resetAllGameState
} = require('./gameLogic');

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || true;
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const rooms = {};
const playerRooms = {};
const wordTimers = {};
const contactTimers = {};

function emitRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const publicState = getPublicRoomState(room);
  io.to(roomCode).emit('room:state', publicState);
  room.players.forEach(player => {
    if (player.connected) {
      io.to(player.socketId).emit('player:state', getPlayerPrivateState(room, player.id));
    }
  });
}

function emitError(socket, message) {
  socket.emit('error:message', { message });
}

function normalizeWord(value, limit = 32) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function sanitizeRounds(value) {
  const rounds = Number(value);
  if (!Number.isFinite(rounds)) return 10;
  return Math.max(10, Math.min(30, Math.floor(rounds)));
}

function sanitizeTimerMinutes(value) {
  const minutes = Number(value);
  if (![2, 5, 10, 15].includes(minutes)) return 5;
  return minutes;
}

function getConnectedPlayers(room) {
  return room.players.filter(player => player.connected);
}

function rankPlayers(players, scores) {
  return players
    .map(player => ({ id: player.id, name: player.name, score: scores[player.id] || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

function clearWordTimers(roomCode) {
  const timers = wordTimers[roomCode];
  if (!timers) return;
  Object.values(timers).forEach(timer => clearTimeout(timer));
  delete wordTimers[roomCode];
}

function clearContactTimers(roomCode) {
  const timers = contactTimers[roomCode];
  if (!timers) return;
  Object.values(timers).forEach(timer => clearTimeout(timer));
  delete contactTimers[roomCode];
}

function resetRoomToLobby(room, roomCode) {
  clearWordTimers(roomCode);
  clearContactTimers(roomCode);
  room.gameState = 'lobby';
  resetAllGameState(room);
  room.players.forEach(player => {
    player.ready = false;
  });
}

function beginWordRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.WORD_MATCH) return;

  clearWordTimers(roomCode);
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers.length < WORD_MATCH_MIN_PLAYERS) {
    resetRoomToLobby(room, roomCode);
    io.to(roomCode).emit('player:left', {
      message: `Need at least ${WORD_MATCH_MIN_PLAYERS} players. Returning to lobby...`
    });
    emitRoomState(roomCode);
    return;
  }

  if (room.wordMatch.currentRound >= room.wordMatch.totalRounds) {
    finishWordGame(roomCode);
    return;
  }

  const currentHostId = room.playerOrder[room.wordMatch.currentRound % room.playerOrder.length];
  if (!connectedPlayers.some(player => player.id === currentHostId)) {
    room.playerOrder = connectedPlayers.map(player => player.id);
  }

  room.wordMatch.currentRound += 1;
  room.wordMatch.phase = 'host_word';
  room.wordMatch.hostPlayerId = room.playerOrder[(room.wordMatch.currentRound - 1) % room.playerOrder.length];
  room.wordMatch.startingWord = '';
  room.wordMatch.hostAnswer = '';
  room.wordMatch.submissions = {};
  room.wordMatch.submittedAt = {};
  room.wordMatch.lastResult = null;
  room.wordMatch.matchEndsAt = null;
  room.wordMatch.revealEndsAt = null;
  room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);
  emitRoomState(roomCode);
}

function revealWordRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.WORD_MATCH || room.wordMatch.phase !== 'matching') return;

  clearWordTimers(roomCode);
  const hostId = room.wordMatch.hostPlayerId;
  const hostAnswer = normalizeWord(room.wordMatch.submissions[hostId] || room.wordMatch.hostAnswer);
  room.wordMatch.hostAnswer = hostAnswer;

  const connectedPlayers = getConnectedPlayers(room);
  const matches = [];
  const answers = connectedPlayers.map(player => {
    const answer = normalizeWord(room.wordMatch.submissions[player.id]);
    const matched = player.id !== hostId && answer && hostAnswer && answer.toLowerCase() === hostAnswer.toLowerCase();
    if (matched) {
      matches.push(player.id);
      room.wordMatch.scores[player.id] = (room.wordMatch.scores[player.id] || 0) + 1;
    }
    return { playerId: player.id, playerName: player.name, answer, matched, isHost: player.id === hostId };
  });

  room.wordMatch.scores[hostId] = (room.wordMatch.scores[hostId] || 0) + matches.length;
  room.wordMatch.phase = 'reveal';
  room.wordMatch.matchEndsAt = null;
  room.wordMatch.revealEndsAt = Date.now() + 6000;
  room.wordMatch.lastResult = {
    round: room.wordMatch.currentRound,
    hostPlayerId: hostId,
    hostAnswer,
    matches,
    answers,
    hostPoints: matches.length
  };
  room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);
  emitRoomState(roomCode);

  wordTimers[roomCode] = {
    reveal: setTimeout(() => beginWordRound(roomCode), 6000)
  };
}

function finishWordGame(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.WORD_MATCH) return;
  clearWordTimers(roomCode);
  room.gameState = 'finished';
  room.wordMatch.phase = 'finished';
  room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);
  io.to(roomCode).emit('game:over', {
    leaderboard: room.wordMatch.leaderboard,
    winners: room.wordMatch.leaderboard.slice(0, 3)
  });
  emitRoomState(roomCode);
}

function maybeRevealIfAllSubmitted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.WORD_MATCH || room.wordMatch.phase !== 'matching') return;
  const connectedIds = getConnectedPlayers(room).map(player => player.id);
  if (connectedIds.every(id => room.wordMatch.submissions[id])) {
    revealWordRound(roomCode);
  }
}

function getGuesserIds(room) {
  return getConnectedPlayers(room)
    .filter(player => player.id !== room.contactBlock.activeHostId)
    .map(player => player.id);
}

function startContactCluePhase(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
  if (room.contactBlock.winner) return;

  room.contactBlock.phase = 'clue_submission';
  room.contactBlock.currentClue = null;
  room.contactBlock.clueAuthorId = null;
  room.contactBlock.contactVotes = [];
  room.contactBlock.forgetVotes = [];
  room.contactBlock.answerParticipants = [];
  room.contactBlock.answers = {};
  room.contactBlock.lastResolution = null;
  room.contactBlock.roundEndedAt = null;
  room.contactBlock.clueCycle += 1;
  room.contactBlock.clueSubmittedAt = null;
  emitRoomState(roomCode);
}

function finishContactGame(roomCode, winnerType) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK) return;
  clearContactTimers(roomCode);
  room.gameState = 'finished';
  room.contactBlock.phase = 'finished';
  room.contactBlock.winner = winnerType;
  room.contactBlock.roundEndedAt = Date.now();

  const activeHost = room.players.find(player => player.id === room.contactBlock.activeHostId);
  io.to(roomCode).emit('game:over', {
    winnerType,
    secretWord: room.contactBlock.secretWord,
    activeHostName: activeHost ? activeHost.name : 'Host'
  });
  emitRoomState(roomCode);
}

function revealNextContactLetter(roomCode, matchedWord, count) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK) return;

  room.contactBlock.revealedLength = Math.min(
    room.contactBlock.secretWord.length,
    room.contactBlock.revealedLength + 1
  );
  room.contactBlock.totalSuccessfulContacts += 1;
  room.contactBlock.lastResolution = {
    result: 'success',
    matchedWord,
    matchCount: count
  };

  if (room.contactBlock.revealedLength >= room.contactBlock.secretWord.length) {
    finishContactGame(roomCode, 'players');
    return;
  }

  startContactCluePhase(roomCode);
}

function resolveContactAnswers(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.contactBlock.phase !== 'answer') return;

  const normalizedAnswers = Object.values(room.contactBlock.answers);
  const counts = {};
  normalizedAnswers.forEach(answer => {
    counts[answer] = (counts[answer] || 0) + 1;
  });

  Object.keys(room.contactBlock.answers).forEach(playerId => {
    const answer = room.contactBlock.answers[playerId];
    if (!room.contactBlock.usedWords.includes(answer)) {
      room.contactBlock.usedWords.push(answer);
    }
  });

  let winnerWord = '';
  let winnerCount = 0;
  Object.entries(counts).forEach(([word, count]) => {
    if (count >= room.contactBlock.requiredMatches && count > winnerCount) {
      winnerWord = word;
      winnerCount = count;
    }
  });

  if (winnerWord) {
    revealNextContactLetter(roomCode, winnerWord, winnerCount);
    return;
  }

  room.contactBlock.lastResolution = {
    result: 'miss',
    submittedAnswers: room.contactBlock.answerParticipants.map(playerId => {
      const player = room.players.find(entry => entry.id === playerId);
      return {
        playerId,
        playerName: player ? player.name : 'Player',
        answer: room.contactBlock.answers[playerId] || ''
      };
    })
  };
  startContactCluePhase(roomCode);
}

function maybeResolveContactDecision(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.contactBlock.phase !== 'decision') return;

  const guesserIds = getGuesserIds(room);
  if (room.contactBlock.contactVotes.length >= room.contactBlock.requiredMatches) {
    room.contactBlock.phase = 'answer';
    room.contactBlock.answerParticipants = [...room.contactBlock.contactVotes];
    room.contactBlock.answers = {};
    room.contactBlock.lastResolution = null;
    emitRoomState(roomCode);
    return;
  }

  if (room.contactBlock.forgetVotes.length === guesserIds.length && guesserIds.length > 0) {
    room.contactBlock.lastResolution = { result: 'forgot' };
    startContactCluePhase(roomCode);
    return;
  }

  const totalVotes = new Set([
    ...room.contactBlock.contactVotes,
    ...room.contactBlock.forgetVotes
  ]);

  if (totalVotes.size === guesserIds.length) {
    room.contactBlock.lastResolution = { result: 'not-enough-contact' };
    startContactCluePhase(roomCode);
  }
}

function startContactGame(roomCode, options) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK) return;

  clearContactTimers(roomCode);
  room.gameState = 'playing';
  room.contactBlock.timerMinutes = sanitizeTimerMinutes(options.timerMinutes);
  room.contactBlock.requiredMatches = Math.max(
    2,
    Math.min(getConnectedPlayers(room).length, Number(options.requiredMatches) || 2)
  );
  room.contactBlock.activeHostId = options.activeHostId;
  room.contactBlock.secretWord = '';
  room.contactBlock.revealedLength = 0;
  room.contactBlock.currentClue = null;
  room.contactBlock.clueAuthorId = null;
  room.contactBlock.contactVotes = [];
  room.contactBlock.forgetVotes = [];
  room.contactBlock.answerParticipants = [];
  room.contactBlock.answers = {};
  room.contactBlock.usedWords = [];
  room.contactBlock.blockedWords = [];
  room.contactBlock.blockHistory = [];
  room.contactBlock.totalSuccessfulContacts = 0;
  room.contactBlock.gameEndsAt = Date.now() + room.contactBlock.timerMinutes * 60 * 1000;
  room.contactBlock.roundEndedAt = null;
  room.contactBlock.clueCycle = 0;
  room.contactBlock.clueSubmittedAt = null;
  room.contactBlock.lastResolution = null;
  room.contactBlock.winner = null;
  room.contactBlock.phase = 'secret_entry';

  contactTimers[roomCode] = {
    game: setTimeout(() => finishContactGame(roomCode, 'host'), room.contactBlock.timerMinutes * 60 * 1000)
  };

  io.to(roomCode).emit('game:started', { round: 1 });
  emitRoomState(roomCode);
}

io.on('connection', socket => {
  console.log(`[+] Connected: ${socket.id}`);

  socket.on('room:create', ({ playerName, gameType }) => {
    if (!playerName || playerName.trim().length < 1) {
      return emitError(socket, 'Player name is required.');
    }

    const name = playerName.trim().slice(0, 20);
    const selectedGameType = Object.values(GAME_TYPES).includes(gameType) ? gameType : GAME_TYPES.CARD_MATCH;
    const room = createRoom(socket.id, name, selectedGameType);
    room.players[0].socketId = socket.id;
    rooms[room.id] = room;
    playerRooms[socket.id] = room.id;
    socket.join(room.id);
    socket.emit('room:joined', { roomCode: room.id, playerId: socket.id });
    emitRoomState(room.id);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length < 1) {
      return emitError(socket, 'Player name is required.');
    }

    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms[code];

    if (!room) return emitError(socket, 'Room not found. Check the code and try again.');
    if (room.gameState !== 'lobby') return emitError(socket, 'Game already in progress.');

    const name = playerName.trim().slice(0, 20);
    const existingPlayer = room.players.find(player => player.name.toLowerCase() === name.toLowerCase());
    if (existingPlayer) {
      if (existingPlayer.connected) {
        return emitError(socket, 'That name is already taken in this room.');
      }
      existingPlayer.id = socket.id;
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      playerRooms[socket.id] = code;
      socket.join(code);
      socket.emit('room:joined', { roomCode: code, playerId: socket.id });
      emitRoomState(code);
      return;
    }

    const maxPlayers =
      room.gameType === GAME_TYPES.CARD_MATCH ? PLAYERS_PER_ROOM : CONTACT_BLOCK_MAX_PLAYERS;
    const connectedCount = getConnectedPlayers(room).length;
    if (connectedCount >= maxPlayers || room.players.length >= maxPlayers) {
      return emitError(socket, `Room is full (${maxPlayers} players max).`);
    }

    room.players.push({ id: socket.id, socketId: socket.id, name, ready: false, connected: true });
    playerRooms[socket.id] = code;
    socket.join(code);
    socket.emit('room:joined', { roomCode: code, playerId: socket.id });
    emitRoomState(code);
  });

  socket.on('player:ready', ({ ready }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'lobby') return;
    const player = room.players.find(entry => entry.id === socket.id);
    if (!player) return;
    player.ready = !!ready;
    emitRoomState(roomCode);
  });

  socket.on('game:start', (payload = {}) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can start the game.');
    if (room.gameState !== 'lobby') return;

    const connectedPlayers = getConnectedPlayers(room);
    if (room.gameType === GAME_TYPES.WORD_MATCH) {
      if (connectedPlayers.length < WORD_MATCH_MIN_PLAYERS || connectedPlayers.length > WORD_MATCH_MAX_PLAYERS) {
        return emitError(socket, `Need ${WORD_MATCH_MIN_PLAYERS}-${WORD_MATCH_MAX_PLAYERS} connected players to start.`);
      }
      if (!connectedPlayers.every(player => player.id === room.hostId || player.ready)) {
        return emitError(socket, 'All non-host players must be ready.');
      }

      room.players = connectedPlayers;
      room.playerOrder = connectedPlayers.map(player => player.id);
      room.wordMatch = createWordMatchState();
      room.wordMatch.totalRounds = sanitizeRounds(payload.rounds);
      room.wordMatch.scores = Object.fromEntries(room.players.map(player => [player.id, 0]));
      room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);
      room.gameState = 'playing';
      io.to(roomCode).emit('game:started', { round: 1 });
      beginWordRound(roomCode);
      return;
    }

    if (room.gameType === GAME_TYPES.CONTACT_BLOCK) {
      if (connectedPlayers.length < CONTACT_BLOCK_MIN_PLAYERS || connectedPlayers.length > CONTACT_BLOCK_MAX_PLAYERS) {
        return emitError(socket, `Need ${CONTACT_BLOCK_MIN_PLAYERS}-${CONTACT_BLOCK_MAX_PLAYERS} connected players to start.`);
      }
      if (!connectedPlayers.every(player => player.id === room.hostId || player.ready)) {
        return emitError(socket, 'All non-host players must be ready.');
      }

      const activeHostId = payload.activeHostId || connectedPlayers[0]?.id;
      if (!connectedPlayers.some(player => player.id === activeHostId)) {
        return emitError(socket, 'Choose a valid active host.');
      }

      room.players = connectedPlayers;
      startContactGame(roomCode, {
        activeHostId,
        timerMinutes: payload.timerMinutes,
        requiredMatches: payload.requiredMatches
      });
      return;
    }

    if (connectedPlayers.length !== PLAYERS_PER_ROOM) {
      return emitError(socket, `Need exactly ${PLAYERS_PER_ROOM} connected players to start.`);
    }
    if (!connectedPlayers.every(player => player.id === room.hostId || player.ready)) {
      return emitError(socket, 'All non-host players must be ready.');
    }

    room.players = connectedPlayers;
    startGame(room);
    io.to(roomCode).emit('game:started', { round: room.round });
    emitRoomState(roomCode);
  });

  socket.on('word:hostWord', ({ startingWord }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.WORD_MATCH || room.gameState !== 'playing') return;
    if (room.wordMatch.phase !== 'host_word') return emitError(socket, 'It is not time to set the starting word.');
    if (room.wordMatch.hostPlayerId !== socket.id) return emitError(socket, 'Only the round host can set the word.');

    const cleanWord = normalizeWord(startingWord);
    if (!cleanWord) return emitError(socket, 'Starting word is required.');

    room.wordMatch.startingWord = cleanWord;
    room.wordMatch.phase = 'matching';
    room.wordMatch.matchEndsAt = Date.now() + 10000;
    room.wordMatch.submissions = {};
    room.wordMatch.submittedAt = {};
    emitRoomState(roomCode);

    clearWordTimers(roomCode);
    wordTimers[roomCode] = {
      matching: setTimeout(() => revealWordRound(roomCode), 10000)
    };
  });

  socket.on('word:submit', ({ answer }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.WORD_MATCH || room.gameState !== 'playing') return;
    if (room.wordMatch.phase !== 'matching') return emitError(socket, 'Submissions are closed.');
    if (Date.now() > room.wordMatch.matchEndsAt) return revealWordRound(roomCode);

    const cleanAnswer = normalizeWord(answer);
    if (!cleanAnswer) return emitError(socket, 'Enter a matching word.');

    room.wordMatch.submissions[socket.id] = cleanAnswer;
    room.wordMatch.submittedAt[socket.id] = Date.now();
    if (socket.id === room.wordMatch.hostPlayerId) {
      room.wordMatch.hostAnswer = cleanAnswer;
    }
    emitRoomState(roomCode);
    maybeRevealIfAllSubmitted(roomCode);
  });

  socket.on('contact:secretWord', ({ secretWord }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
    if (room.contactBlock.phase !== 'secret_entry') return emitError(socket, 'The secret word has already been set.');
    if (room.contactBlock.activeHostId !== socket.id) return emitError(socket, 'Only the active host can set the secret word.');

    const cleanWord = normalizeWord(secretWord, 48);
    if (!cleanWord || cleanWord.length < 2) return emitError(socket, 'Enter a secret word with at least 2 letters.');

    room.contactBlock.secretWord = cleanWord;
    room.contactBlock.revealedLength = 1;
    startContactCluePhase(roomCode);
  });

  socket.on('contact:clue', ({ clue }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
    if (room.contactBlock.phase !== 'clue_submission') return emitError(socket, 'Wait for the next clue window.');
    if (socket.id === room.contactBlock.activeHostId) return emitError(socket, 'The active host cannot submit a clue.');

    const cleanClue = normalizeWord(clue, 120);
    if (!cleanClue) return emitError(socket, 'Enter a clue.');

    room.contactBlock.currentClue = cleanClue;
    room.contactBlock.clueAuthorId = socket.id;
    room.contactBlock.clueSubmittedAt = Date.now();
    room.contactBlock.phase = 'decision';
    room.contactBlock.contactVotes = [];
    room.contactBlock.forgetVotes = [];
    room.contactBlock.answerParticipants = [];
    room.contactBlock.answers = {};
    emitRoomState(roomCode);
  });

  socket.on('contact:blockWord', ({ blockWord }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
    if (room.contactBlock.activeHostId !== socket.id) return emitError(socket, 'Only the active host can block words.');
    if (!['decision', 'answer'].includes(room.contactBlock.phase)) return emitError(socket, 'Block words are only allowed during clue resolution.');

    const cleanWord = normalizeWord(blockWord);
    if (!cleanWord) return emitError(socket, 'Enter a word to block.');
    if (room.contactBlock.blockedWords.includes(cleanWord)) return emitError(socket, 'That word is already blocked.');

    room.contactBlock.blockedWords.push(cleanWord);
    room.contactBlock.blockHistory.push({
      word: cleanWord,
      at: Date.now()
    });
    emitRoomState(roomCode);
  });

  socket.on('contact:vote', ({ choice }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
    if (room.contactBlock.phase !== 'decision') return emitError(socket, 'Voting is not open.');
    if (socket.id === room.contactBlock.activeHostId) return emitError(socket, 'The active host does not vote.');

    room.contactBlock.contactVotes = room.contactBlock.contactVotes.filter(id => id !== socket.id);
    room.contactBlock.forgetVotes = room.contactBlock.forgetVotes.filter(id => id !== socket.id);

    if (choice === 'contact') {
      room.contactBlock.contactVotes.push(socket.id);
    } else if (choice === 'forget') {
      room.contactBlock.forgetVotes.push(socket.id);
    } else {
      return emitError(socket, 'Invalid vote choice.');
    }

    emitRoomState(roomCode);
    maybeResolveContactDecision(roomCode);
  });

  socket.on('contact:answer', ({ answer }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK || room.gameState !== 'playing') return;
    if (room.contactBlock.phase !== 'answer') return emitError(socket, 'Answering is not open.');
    if (!room.contactBlock.answerParticipants.includes(socket.id)) return emitError(socket, 'You are not part of this contact.');

    const cleanAnswer = normalizeWord(answer);
    const prefix = room.contactBlock.secretWord.slice(0, room.contactBlock.revealedLength).toLowerCase();
    if (!cleanAnswer) return emitError(socket, 'Enter your answer.');
    if (!cleanAnswer.toLowerCase().startsWith(prefix)) {
      return emitError(socket, 'Answer must begin with the revealed prefix.');
    }
    if (room.contactBlock.usedWords.includes(cleanAnswer)) {
      return emitError(socket, 'That word has already been used.');
    }
    if (room.contactBlock.blockedWords.includes(cleanAnswer)) {
      return emitError(socket, 'That word has already been blocked.');
    }

    room.contactBlock.answers[socket.id] = cleanAnswer;
    emitRoomState(roomCode);

    if (room.contactBlock.answerParticipants.every(playerId => room.contactBlock.answers[playerId])) {
      resolveContactAnswers(roomCode);
    }
  });

  socket.on('contact:end', () => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameType !== GAME_TYPES.CONTACT_BLOCK) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the main host can end the game.');

    resetRoomToLobby(room, roomCode);
    io.to(roomCode).emit('game:restarted');
    emitRoomState(roomCode);
  });

  socket.on('card:select', ({ cardId }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'playing') return;

    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (socket.id !== currentPlayerId) {
      return emitError(socket, 'It is not your turn.');
    }

    const hand = room.hands[socket.id];
    if (!hand) return;
    const cardIndex = hand.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return emitError(socket, 'Invalid card selection.');

    const [selectedCard] = hand.splice(cardIndex, 1);
    const nextPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;
    const nextPlayerId = room.playerOrder[nextPlayerIndex];
    room.hands[nextPlayerId].push(selectedCard);

    const result = checkWinner(room.hands);
    if (result) {
      room.gameState = 'finished';
      const winner = room.players.find(player => player.id === result.winnerId);
      room.winner = {
        playerId: result.winnerId,
        playerName: winner ? winner.name : 'Unknown',
        color: result.color
      };
      const allHands = {};
      room.players.forEach(player => {
        allHands[player.id] = room.hands[player.id] || [];
      });
      io.to(roomCode).emit('game:over', { winner: room.winner, allHands });
      emitRoomState(roomCode);
    } else {
      room.currentPlayerIndex = nextPlayerIndex;
      emitRoomState(roomCode);
    }
  });

  socket.on('game:restart', () => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can restart.');

    resetRoomToLobby(room, roomCode);
    emitRoomState(roomCode);
    io.to(roomCode).emit('game:restarted');
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const roomCode = playerRooms[socket.id];
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    const playerIndex = room.players.findIndex(player => player.id === socket.id);
    if (playerIndex === -1) return;

    const disconnectedPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    if (room.gameState === 'playing') {
      if (room.gameType === GAME_TYPES.WORD_MATCH) {
        room.playerOrder = room.playerOrder.filter(id => id !== socket.id);
        delete room.wordMatch.submissions[socket.id];
        delete room.wordMatch.scores[socket.id];
        room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);

        if (getConnectedPlayers(room).length < WORD_MATCH_MIN_PLAYERS) {
          resetRoomToLobby(room, roomCode);
          io.to(roomCode).emit('player:left', {
            playerName: disconnectedPlayer.name,
            message: `${disconnectedPlayer.name} left. Need at least ${WORD_MATCH_MIN_PLAYERS} players, returning to lobby...`
          });
        } else if (room.wordMatch.hostPlayerId === socket.id) {
          beginWordRound(roomCode);
        } else {
          maybeRevealIfAllSubmitted(roomCode);
        }
      } else {
        const minPlayers = room.gameType === GAME_TYPES.CONTACT_BLOCK ? CONTACT_BLOCK_MIN_PLAYERS : PLAYERS_PER_ROOM;
        resetRoomToLobby(room, roomCode);
        io.to(roomCode).emit('player:left', {
          playerName: disconnectedPlayer.name,
          message: `${disconnectedPlayer.name} left the game. Need at least ${minPlayers} players, returning to lobby...`
        });
      }
    }

    if (room.hostId === socket.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    if (room.players.length === 0) {
      clearWordTimers(roomCode);
      clearContactTimers(roomCode);
      delete rooms[roomCode];
    } else {
      emitRoomState(roomCode);
    }

    delete playerRooms[socket.id];
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
