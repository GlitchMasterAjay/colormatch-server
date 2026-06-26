const { randomUUID: uuidv4 } = require('crypto');

const COLORS = ['red', 'blue', 'green', 'yellow'];
const CARDS_PER_COLOR = 4;
const PLAYERS_PER_ROOM = 4;
const CARDS_PER_PLAYER = 4;
const WORD_MATCH_MIN_PLAYERS = 3;
const WORD_MATCH_MAX_PLAYERS = 10;
const CONTACT_BLOCK_MIN_PLAYERS = 3;
const CONTACT_BLOCK_MAX_PLAYERS = 10;
const GAME_TYPES = {
  CARD_MATCH: 'card-match',
  WORD_MATCH: 'word-match',
  CONTACT_BLOCK: 'contact-block'
};

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (let i = 0; i < CARDS_PER_COLOR; i++) {
      deck.push({ id: uuidv4(), color });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dealCards(deck, playerIds) {
  const hands = {};
  playerIds.forEach((id, index) => {
    hands[id] = deck.slice(index * CARDS_PER_PLAYER, (index + 1) * CARDS_PER_PLAYER);
  });
  return hands;
}

function checkWinner(hands) {
  for (const [playerId, hand] of Object.entries(hands)) {
    if (hand.length === CARDS_PER_PLAYER) {
      const firstColor = hand[0].color;
      if (hand.every(card => card.color === firstColor)) {
        return { winnerId: playerId, color: firstColor };
      }
    }
  }
  return null;
}

function passCards(hands, playerOrder, selectedCards) {
  // selectedCards: { playerId: cardId }
  const newHands = {};
  
  // Initialize new hands as copies of current hands
  for (const [pid, hand] of Object.entries(hands)) {
    newHands[pid] = [...hand];
  }

  // For each player, remove their selected card and give to right neighbor
  const cardsToReceive = {}; // playerId -> card they will receive

  for (let i = 0; i < playerOrder.length; i++) {
    const currentPlayerId = playerOrder[i];
    const rightPlayerId = playerOrder[(i + 1) % playerOrder.length];
    const selectedCardId = selectedCards[currentPlayerId];

    if (!selectedCardId) continue;

    const cardIndex = newHands[currentPlayerId].findIndex(c => c.id === selectedCardId);
    if (cardIndex === -1) continue;

    const [card] = newHands[currentPlayerId].splice(cardIndex, 1);
    cardsToReceive[rightPlayerId] = card;
  }

  // Give cards to receivers
  for (const [pid, card] of Object.entries(cardsToReceive)) {
    newHands[pid].push(card);
  }

  return newHands;
}

function createRoom(hostId, hostName, gameType = GAME_TYPES.CARD_MATCH) {
  return {
    id: generateRoomCode(),
    gameType,
    hostId,
    players: [{ id: hostId, name: hostName, ready: false, connected: true }],
    chatMessages: [],
    gameState: 'lobby', // lobby | playing | finished
    hands: {},
    playerOrder: [],
    currentPlayerIndex: 0, // whose turn it is
    selectedCards: {}, // playerId -> cardId they selected
    round: 0,
    winner: null,
    deck: [],
    wordMatch: createWordMatchState(),
    contactBlock: createContactBlockState()
  };
}

function createWordMatchState() {
  return {
    totalRounds: 10,
    currentRound: 0,
    phase: 'setup', // setup | host_word | matching | reveal | finished
    hostPlayerId: null,
    startingWord: '',
    hostAnswer: '',
    submissions: {},
    submittedAt: {},
    scores: {},
    leaderboard: [],
    lastResult: null,
    matchEndsAt: null,
    revealEndsAt: null
  };
}

function createContactBlockState() {
  return {
    phase: 'setup', // setup | secret_entry | clue_submission | decision | answer | finished
    timerMinutes: 5,
    requiredMatches: 2,
    activeHostId: null,
    secretWord: '',
    revealedLength: 0,
    currentClue: null,
    clueAuthorId: null,
    contactVotes: [],
    forgetVotes: [],
    answerParticipants: [],
    answers: {},
    usedWords: [],
    blockedWords: [],
    blockHistory: [],
    totalSuccessfulContacts: 0,
    winner: null,
    gameEndsAt: null,
    roundEndedAt: null,
    clueCycle: 0,
    clueSubmittedAt: null,
    lastResolution: null
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function startGame(room) {
  const deck = shuffleDeck(createDeck());
  const playerIds = room.players.map(p => p.id);
  
  // Shuffle player order too
  const playerOrder = [...playerIds].sort(() => Math.random() - 0.5);
  const hands = dealCards(deck, playerOrder);

  room.gameState = 'playing';
  room.hands = hands;
  room.playerOrder = playerOrder;
  room.currentPlayerIndex = 0; // First player starts
  room.selectedCards = {};
  room.winner = null;
  room.deck = deck;

  return room;
}

function getPublicRoomState(room) {
  const wordMatch = room.wordMatch ? {
    totalRounds: room.wordMatch.totalRounds,
    currentRound: room.wordMatch.currentRound,
    phase: room.wordMatch.phase,
    hostPlayerId: room.wordMatch.hostPlayerId,
    startingWord: room.wordMatch.startingWord,
    scores: room.wordMatch.scores,
    leaderboard: room.wordMatch.leaderboard,
    lastResult: room.wordMatch.lastResult,
    matchEndsAt: room.wordMatch.matchEndsAt,
    revealEndsAt: room.wordMatch.revealEndsAt,
    submittedPlayers: Object.keys(room.wordMatch.submissions || {})
  } : null;

  const contactBlock = room.contactBlock ? {
    phase: room.contactBlock.phase,
    timerMinutes: room.contactBlock.timerMinutes,
    requiredMatches: room.contactBlock.requiredMatches,
    activeHostId: room.contactBlock.activeHostId,
    revealedPrefix: room.contactBlock.secretWord.slice(0, room.contactBlock.revealedLength),
    revealedMask: buildRevealedMask(room.contactBlock.secretWord, room.contactBlock.revealedLength),
    currentClue: room.contactBlock.currentClue,
    clueAuthorId: room.contactBlock.clueAuthorId,
    contactVotes: room.contactBlock.contactVotes,
    forgetVotes: room.contactBlock.forgetVotes,
    answerParticipants: room.contactBlock.answerParticipants,
    usedWords: room.contactBlock.usedWords,
    blockedWords: room.contactBlock.blockedWords,
    blockHistory: room.contactBlock.blockHistory,
    totalSuccessfulContacts: room.contactBlock.totalSuccessfulContacts,
    gameEndsAt: room.contactBlock.gameEndsAt,
    roundEndedAt: room.contactBlock.roundEndedAt,
    clueCycle: room.contactBlock.clueCycle,
    lastResolution: room.contactBlock.lastResolution,
    winner: room.contactBlock.winner
  } : null;

  return {
    id: room.id,
    gameType: room.gameType || GAME_TYPES.CARD_MATCH,
    gameState: room.gameState,
    hostId: room.hostId,
    currentPlayerTurn: room.playerOrder[room.currentPlayerIndex] || null,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      connected: p.connected,
      cardCount: room.hands[p.id] ? room.hands[p.id].length : 0,
      isCurrentTurn: p.id === room.playerOrder[room.currentPlayerIndex]
    })),
    playerOrder: room.playerOrder,
    round: room.round,
    winner: room.winner,
    submittedPlayers: Object.keys(room.selectedCards),
    chatMessages: room.chatMessages || [],
    wordMatch,
    contactBlock,
    gameConfig: {
      cardMatchSeats: PLAYERS_PER_ROOM,
      wordMatchMinPlayers: WORD_MATCH_MIN_PLAYERS,
      wordMatchMaxPlayers: WORD_MATCH_MAX_PLAYERS,
      contactBlockMinPlayers: CONTACT_BLOCK_MIN_PLAYERS,
      contactBlockMaxPlayers: CONTACT_BLOCK_MAX_PLAYERS
    }
  };
}

function getPlayerPrivateState(room, playerId) {
  const privateState = {
    hand: room.hands[playerId] || [],
    selectedCardId: room.selectedCards[playerId] || null
  };

  if (room.contactBlock) {
    privateState.contactBlock = {
      secretWord: room.contactBlock.activeHostId === playerId ? room.contactBlock.secretWord : '',
      myAnswerSubmitted: !!room.contactBlock.answers[playerId]
    };
  }

  return privateState;
}

function buildRevealedMask(secretWord, revealedLength) {
  if (!secretWord) return '';
  const prefix = secretWord.slice(0, revealedLength);
  const hidden = Array.from({ length: Math.max(0, secretWord.length - revealedLength) }, () => '_').join(' ');
  return hidden ? `${prefix}${prefix ? ' ' : ''}${hidden}` : prefix;
}

function resetCardMatchState(room) {
  room.hands = {};
  room.playerOrder = [];
  room.currentPlayerIndex = 0;
  room.selectedCards = {};
  room.winner = null;
  room.deck = [];
}

function resetWordMatchState(room) {
  room.wordMatch = createWordMatchState();
}

function resetContactBlockState(room) {
  room.contactBlock = createContactBlockState();
}

function resetAllGameState(room) {
  resetCardMatchState(room);
  resetWordMatchState(room);
  resetContactBlockState(room);
}

module.exports = {
  createRoom,
  startGame,
  passCards,
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
  createContactBlockState,
  buildRevealedMask,
  resetCardMatchState,
  resetWordMatchState,
  resetContactBlockState,
  resetAllGameState
};
