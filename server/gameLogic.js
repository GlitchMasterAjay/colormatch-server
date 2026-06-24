const { randomUUID: uuidv4 } = require('crypto');

const COLORS = ['red', 'blue', 'green', 'yellow'];
const CARDS_PER_COLOR = 4;
const PLAYERS_PER_ROOM = 4;
const CARDS_PER_PLAYER = 4;
const WORD_MATCH_MIN_PLAYERS = 3;
const WORD_MATCH_MAX_PLAYERS = 10;
const GAME_TYPES = {
  CARD_MATCH: 'card-match',
  WORD_MATCH: 'word-match'
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
    gameState: 'lobby', // lobby | playing | finished
    hands: {},
    playerOrder: [],
    currentPlayerIndex: 0, // whose turn it is
    selectedCards: {}, // playerId -> cardId they selected
    round: 0,
    winner: null,
    deck: [],
    wordMatch: createWordMatchState()
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
    wordMatch,
    gameConfig: {
      cardMatchSeats: PLAYERS_PER_ROOM,
      wordMatchMinPlayers: WORD_MATCH_MIN_PLAYERS,
      wordMatchMaxPlayers: WORD_MATCH_MAX_PLAYERS
    }
  };
}

function getPlayerPrivateState(room, playerId) {
  return {
    hand: room.hands[playerId] || [],
    selectedCardId: room.selectedCards[playerId] || null
  };
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
  GAME_TYPES,
  createWordMatchState
};
