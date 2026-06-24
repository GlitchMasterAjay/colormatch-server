const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, startGame, passCards, checkWinner,
  getPublicRoomState, getPlayerPrivateState, PLAYERS_PER_ROOM,
  WORD_MATCH_MIN_PLAYERS, WORD_MATCH_MAX_PLAYERS, GAME_TYPES, createWordMatchState
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ["https://client-nu-pink.vercel.app/", "*"],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const rooms = {};
const playerRooms = {};
const wordTimers = {};

function emitRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const publicState = getPublicRoomState(room);
  io.to(roomCode).emit('room:state', publicState);
  room.players.forEach(player => {
    if (player.connected) {
      const privateState = getPlayerPrivateState(room, player.id);
      io.to(player.socketId).emit('player:state', privateState);
    }
  });
}

function emitError(socket, message) {
  socket.emit('error:message', { message });
}

function normalizeWord(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function sanitizeRounds(value) {
  const rounds = Number(value);
  if (!Number.isFinite(rounds)) return 10;
  return Math.max(10, Math.min(30, Math.floor(rounds)));
}

function getConnectedPlayers(room) {
  return room.players.filter(p => p.connected);
}

function clearWordTimers(roomCode) {
  const timers = wordTimers[roomCode];
  if (!timers) return;
  Object.values(timers).forEach(timer => clearTimeout(timer));
  delete wordTimers[roomCode];
}

function rankPlayers(players, scores) {
  return players
    .map(player => ({ id: player.id, name: player.name, score: scores[player.id] || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

function beginWordRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== GAME_TYPES.WORD_MATCH) return;

  clearWordTimers(roomCode);
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers.length < WORD_MATCH_MIN_PLAYERS) {
    room.gameState = 'lobby';
    room.wordMatch = createWordMatchState();
    room.players.forEach(p => { p.ready = false; });
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
  const hostStillHere = connectedPlayers.some(p => p.id === currentHostId);
  if (!hostStillHere) {
    room.playerOrder = connectedPlayers.map(p => p.id);
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
  const connectedIds = getConnectedPlayers(room).map(p => p.id);
  if (connectedIds.every(id => room.wordMatch.submissions[id])) {
    revealWordRound(roomCode);
  }
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // --- CREATE ROOM ---
  socket.on('room:create', ({ playerName, gameType }) => {
    if (!playerName || playerName.trim().length < 1) {
      return emitError(socket, 'Player name is required.');
    }
    const name = playerName.trim().slice(0, 20);
    const selectedGameType = gameType === GAME_TYPES.WORD_MATCH ? GAME_TYPES.WORD_MATCH : GAME_TYPES.CARD_MATCH;
    const room = createRoom(socket.id, name, selectedGameType);
    room.players[0].socketId = socket.id;
    rooms[room.id] = room;
    playerRooms[socket.id] = room.id;
    socket.join(room.id);
    socket.emit('room:joined', { roomCode: room.id, playerId: socket.id });
    emitRoomState(room.id);
  });

  // --- JOIN ROOM ---
  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length < 1) {
      return emitError(socket, 'Player name is required.');
    }

    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms[code];

    if (!room) return emitError(socket, 'Room not found. Check the code and try again.');
    if (room.gameState !== 'lobby') return emitError(socket, 'Game already in progress.');

    const name = playerName.trim().slice(0, 20);

    // Allow reconnect with same name if previously disconnected
    const existingPlayer = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingPlayer) {
      if (existingPlayer.connected) {
        return emitError(socket, 'That name is already taken in this room.');
      }
      // Reconnect: update socket ID
      existingPlayer.id = socket.id;
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      playerRooms[socket.id] = code;
      socket.join(code);
      socket.emit('room:joined', { roomCode: code, playerId: socket.id });
      emitRoomState(code);
      return;
    }

    // Only count connected players for room full check
    const connectedCount = room.players.filter(p => p.connected).length;
    const maxPlayers = room.gameType === GAME_TYPES.WORD_MATCH ? WORD_MATCH_MAX_PLAYERS : PLAYERS_PER_ROOM;
    if (connectedCount >= maxPlayers || room.players.length >= maxPlayers) {
      return emitError(socket, `Room is full (${maxPlayers} players max).`);
    }

    room.players.push({ id: socket.id, socketId: socket.id, name, ready: false, connected: true });
    playerRooms[socket.id] = code;
    socket.join(code);
    socket.emit('room:joined', { roomCode: code, playerId: socket.id });
    emitRoomState(code);
  });

  // --- PLAYER READY ---
  socket.on('player:ready', ({ ready }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'lobby') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.ready = !!ready;
    emitRoomState(roomCode);
  });

  // --- START GAME ---
  socket.on('game:start', ({ rounds } = {}) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can start the game.');
    if (room.gameState !== 'lobby') return;

    const connectedPlayers = room.players.filter(p => p.connected);
    if (room.gameType === GAME_TYPES.WORD_MATCH) {
      if (connectedPlayers.length < WORD_MATCH_MIN_PLAYERS || connectedPlayers.length > WORD_MATCH_MAX_PLAYERS) {
        return emitError(socket, `Need ${WORD_MATCH_MIN_PLAYERS}-${WORD_MATCH_MAX_PLAYERS} connected players to start.`);
      }
      if (!connectedPlayers.every(p => p.id === room.hostId || p.ready)) {
        return emitError(socket, 'All non-host players must be ready.');
      }

      room.players = connectedPlayers;
      room.playerOrder = connectedPlayers.map(p => p.id);
      room.wordMatch = createWordMatchState();
      room.wordMatch.totalRounds = sanitizeRounds(rounds);
      room.wordMatch.scores = Object.fromEntries(room.players.map(p => [p.id, 0]));
      room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);
      room.gameState = 'playing';
      io.to(roomCode).emit('game:started', { round: 1 });
      beginWordRound(roomCode);
      return;
    }

    if (connectedPlayers.length !== PLAYERS_PER_ROOM) {
      return emitError(socket, `Need exactly ${PLAYERS_PER_ROOM} connected players to start.`);
    }
    if (!connectedPlayers.every(p => p.id === room.hostId || p.ready)) {
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

  // --- SELECT CARD ---
  socket.on('card:select', ({ cardId }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'playing') return;
    
    // Check if it's this player's turn
    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (socket.id !== currentPlayerId) {
      return emitError(socket, 'It\'s not your turn!');
    }

    const hand = room.hands[socket.id];
    if (!hand) return;
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return emitError(socket, 'Invalid card selection.');

    // Remove the card from current player
    const [selectedCard] = hand.splice(cardIndex, 1);
    
    // Move to next player in circle
    const nextPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;
    const nextPlayerId = room.playerOrder[nextPlayerIndex];
    
    // Give card to next player
    room.hands[nextPlayerId].push(selectedCard);
    
    // Check if next player won
    const result = checkWinner(room.hands);
    if (result) {
      room.gameState = 'finished';
      const winner = room.players.find(p => p.id === result.winnerId);
      room.winner = {
        playerId: result.winnerId,
        playerName: winner ? winner.name : 'Unknown',
        color: result.color
      };
      const allHands = {};
      room.players.forEach(p => { allHands[p.id] = room.hands[p.id] || []; });
      io.to(roomCode).emit('game:over', { winner: room.winner, allHands });
      emitRoomState(roomCode);
    } else {
      // Move to next player's turn
      room.currentPlayerIndex = nextPlayerIndex;
      emitRoomState(roomCode);
    }
  });

  // --- RESTART GAME ---
  socket.on('game:restart', () => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can restart.');
    room.gameState = 'lobby';
    room.hands = {};
    room.playerOrder = [];
    room.currentPlayerIndex = 0;
    room.selectedCards = {};
    room.winner = null;
    room.deck = [];
    clearWordTimers(roomCode);
    room.wordMatch = createWordMatchState();
    room.players.forEach(p => { p.ready = false; });
    emitRoomState(roomCode);
    io.to(roomCode).emit('game:restarted');
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const roomCode = playerRooms[socket.id];
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const disconnectedPlayer = room.players[playerIndex];
    console.log(`Player ${disconnectedPlayer.name} left room ${roomCode}`);

    // Remove player completely from room
    room.players.splice(playerIndex, 1);

    // If player was in game, return card games to the lobby. Word Match can continue with 3+ players.
    if (room.gameState === 'playing' && room.gameType !== GAME_TYPES.WORD_MATCH) {
      room.gameState = 'lobby';
      room.hands = {};
      room.playerOrder = [];
      room.currentPlayerIndex = 0;
      room.selectedCards = {};
      room.winner = null;
      room.deck = [];
      room.players.forEach(p => { p.ready = false; });
      io.to(roomCode).emit('player:left', {
        playerName: disconnectedPlayer.name,
        message: `${disconnectedPlayer.name} left the game. Returning to lobby...`
      });
    } else if (room.gameState === 'playing' && room.gameType === GAME_TYPES.WORD_MATCH) {
      room.playerOrder = room.playerOrder.filter(id => id !== socket.id);
      delete room.wordMatch.submissions[socket.id];
      delete room.wordMatch.scores[socket.id];
      room.wordMatch.leaderboard = rankPlayers(room.players, room.wordMatch.scores);

      if (getConnectedPlayers(room).length < WORD_MATCH_MIN_PLAYERS) {
        clearWordTimers(roomCode);
        room.gameState = 'lobby';
        room.wordMatch = createWordMatchState();
        room.players.forEach(p => { p.ready = false; });
        io.to(roomCode).emit('player:left', {
          playerName: disconnectedPlayer.name,
          message: `${disconnectedPlayer.name} left. Need at least ${WORD_MATCH_MIN_PLAYERS} players, returning to lobby...`
        });
      } else if (room.wordMatch.hostPlayerId === socket.id) {
        beginWordRound(roomCode);
      } else {
        maybeRevealIfAllSubmitted(roomCode);
      }
    }

    // If host left, reassign host from remaining players
    if (room.hostId === socket.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
      console.log(`Host reassigned to ${room.players[0].name}`);
    }

    // If room is empty, delete it
    if (room.players.length === 0) {
      clearWordTimers(roomCode);
      delete rooms[roomCode];
      console.log(`Room ${roomCode} deleted (no players left).`);
    } else {
      // Update all remaining players
      emitRoomState(roomCode);
    }

    delete playerRooms[socket.id];
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
