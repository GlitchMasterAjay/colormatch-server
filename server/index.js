const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, startGame, passCards, checkWinner,
  getPublicRoomState, getPlayerPrivateState, PLAYERS_PER_ROOM
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

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // --- CREATE ROOM ---
  socket.on('room:create', ({ playerName }) => {
    if (!playerName || playerName.trim().length < 1) {
      return emitError(socket, 'Player name is required.');
    }
    const name = playerName.trim().slice(0, 20);
    const room = createRoom(socket.id, name);
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
    if (connectedCount >= PLAYERS_PER_ROOM || room.players.length >= PLAYERS_PER_ROOM) {
      return emitError(socket, 'Room is full (4 players max).');
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
  socket.on('game:start', () => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can start the game.');
    if (room.gameState !== 'lobby') return;

    // Only count connected players
    const connectedPlayers = room.players.filter(p => p.connected);
    if (connectedPlayers.length !== PLAYERS_PER_ROOM) {
      return emitError(socket, `Need exactly ${PLAYERS_PER_ROOM} connected players to start.`);
    }
    // Only check connected players are ready
    if (!connectedPlayers.every(p => p.ready)) {
      return emitError(socket, 'All players must be ready.');
    }

    // Remove ghost disconnected players before starting
    room.players = connectedPlayers;

    startGame(room);
    io.to(roomCode).emit('game:started', { round: room.round });
    emitRoomState(roomCode);
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

    // If player was in game, end game
    if (room.gameState === 'playing') {
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
    }

    // If host left, reassign host from remaining players
    if (room.hostId === socket.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
      console.log(`Host reassigned to ${room.players[0].name}`);
    }

    // If room is empty, delete it
    if (room.players.length === 0) {
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
