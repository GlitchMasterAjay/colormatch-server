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
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// In-memory store
const rooms = {}; // roomCode -> room
const playerRooms = {}; // socketId -> roomCode

function emitRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const publicState = getPublicRoomState(room);

  // Emit public state to all in room
  io.to(roomCode).emit('room:state', publicState);

  // Emit private hand to each player
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
    if (room.players.length >= PLAYERS_PER_ROOM) return emitError(socket, 'Room is full (4 players max).');

    const name = playerName.trim().slice(0, 20);
    const duplicate = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return emitError(socket, 'That name is already taken in this room.');

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
    if (room.players.length !== PLAYERS_PER_ROOM) return emitError(socket, `Need exactly ${PLAYERS_PER_ROOM} players to start.`);
    if (!room.players.every(p => p.ready)) return emitError(socket, 'All players must be ready.');
    if (room.gameState !== 'lobby') return;

    startGame(room);
    io.to(roomCode).emit('game:started', { round: room.round });
    emitRoomState(roomCode);
  });

  // --- SELECT CARD ---
  socket.on('card:select', ({ cardId }) => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'playing') return;

    const hand = room.hands[socket.id];
    if (!hand) return;

    // Validate card belongs to player
    const card = hand.find(c => c.id === cardId);
    if (!card) return emitError(socket, 'Invalid card selection.');

    room.selectedCards[socket.id] = cardId;

    // Notify just this player their selection is recorded
    socket.emit('player:state', getPlayerPrivateState(room, socket.id));

    // Broadcast who has submitted (without revealing card choice)
    const publicState = getPublicRoomState(room);
    io.to(roomCode).emit('room:state', publicState);

    // Check if all players have submitted
    const connectedPlayers = room.players.filter(p => p.connected);
    const allSubmitted = connectedPlayers.every(p => room.selectedCards[p.id]);

    if (allSubmitted) {
      // Execute pass
      room.hands = passCards(room.hands, room.playerOrder, room.selectedCards);
      room.selectedCards = {};
      room.round++;

      // Check winner
      const result = checkWinner(room.hands);

      if (result) {
        room.gameState = 'finished';
        const winner = room.players.find(p => p.id === result.winnerId);
        room.winner = {
          playerId: result.winnerId,
          playerName: winner ? winner.name : 'Unknown',
          color: result.color
        };

        // Reveal all hands
        const allHands = {};
        room.players.forEach(p => { allHands[p.id] = room.hands[p.id] || []; });

        io.to(roomCode).emit('game:over', { winner: room.winner, allHands });
        emitRoomState(roomCode);
      } else {
        io.to(roomCode).emit('round:complete', { round: room.round });
        emitRoomState(roomCode);
      }
    }
  });

  // --- RESTART GAME ---
  socket.on('game:restart', () => {
    const roomCode = playerRooms[socket.id];
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return emitError(socket, 'Only the host can restart.');

    // Reset to lobby
    room.gameState = 'lobby';
    room.hands = {};
    room.playerOrder = [];
    room.selectedCards = {};
    room.round = 0;
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

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.connected = false;
      console.log(`Player ${player.name} disconnected from room ${roomCode}`);
    }

    // If game in progress and disconnected, check if we should pause
    if (room.gameState === 'playing') {
      io.to(roomCode).emit('player:disconnected', {
        playerName: player ? player.name : 'A player'
      });
    }

    // If host left in lobby, assign new host
    if (room.gameState === 'lobby' && room.hostId === socket.id) {
      const nextConnected = room.players.find(p => p.connected && p.id !== socket.id);
      if (nextConnected) {
        room.hostId = nextConnected.id;
        io.to(roomCode).emit('host:changed', { newHostId: nextConnected.id });
      }
    }

    // If all players disconnected, clean up room after delay
    const anyConnected = room.players.some(p => p.connected);
    if (!anyConnected) {
      setTimeout(() => {
        if (rooms[roomCode] && !rooms[roomCode].players.some(p => p.connected)) {
          delete rooms[roomCode];
          console.log(`Room ${roomCode} cleaned up.`);
        }
      }, 30000);
    }

    emitRoomState(roomCode);
    delete playerRooms[socket.id];
  });
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
