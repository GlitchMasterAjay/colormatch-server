# 🎴 ColorMatch — Real-time Multiplayer Card Game

A real-time multiplayer card-matching game built with React, Node.js, Express, and Socket.IO.

## How to Play

- **4 players** join a room
- Each player receives **4 cards** from a deck of 16 (4 colors × 4 cards each)
- Every round, each player secretly selects one card to **pass to the right**
- All passes happen **simultaneously** — no one knows what others are passing
- **Goal:** Collect all 4 cards of the same color (e.g., 🔴🔴🔴🔴)
- First player to do so wins!

## Tech Stack

| Layer    | Tech                     |
|----------|--------------------------|
| Frontend | React 18, Tailwind CSS   |
| Backend  | Node.js, Express         |
| Realtime | Socket.IO v4             |
| State    | Server-authoritative     |

## Project Structure

```
card-match-game/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── gameLogic.js      # Pure game logic (deck, dealing, passing, win check)
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx              # Root component + socket event wiring
│   │   ├── hooks/
│   │   │   └── useSocket.js     # Socket.IO hook
│   │   ├── components/
│   │   │   ├── Lobby.jsx        # Create/Join room UI
│   │   │   ├── WaitingRoom.jsx  # Pre-game lobby with ready system
│   │   │   ├── GameBoard.jsx    # Main game UI
│   │   │   ├── PlayingCard.jsx  # Visual card component
│   │   │   ├── OtherPlayer.jsx  # Hidden opponent display
│   │   │   └── Confetti.jsx     # Win celebration
│   │   └── utils/
│   │       └── colors.js        # Color config & helpers
│   └── package.json
└── README.md
```

## Setup & Running

### Prerequisites
- Node.js v16+
- npm v7+

### Step 1: Install dependencies

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Step 2: Start the server

```bash
# From the server/ directory:
npm run dev        # development (with nodemon auto-reload)
# or
npm start          # production
```

Server runs on **http://localhost:3001**

### Step 3: Start the client

```bash
# From the client/ directory:
npm start
```

Client runs on **http://localhost:3000**

### Step 4: Play

1. Open **http://localhost:3000** in 4 browser tabs (or different devices)
2. One player clicks **Create Room**
3. Others click **Join Room** and enter the 6-character room code
4. All players click **Ready**
5. Host clicks **Start Game**

## Anti-Cheat & Security

- **Server-authoritative state**: All game logic runs on the server
- **Hand privacy**: Each player only receives their own 4 cards via private Socket.IO emissions
- **Move validation**: Every card selection is validated server-side (card must exist in player's hand)
- **Win detection**: Happens only on the server after each round
- **No trusting the frontend**: Room code, player ID, and card ownership are all server-validated

## Socket.IO Event Reference

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:create` | `{ playerName }` | Create a new room |
| `room:join` | `{ roomCode, playerName }` | Join existing room |
| `player:ready` | `{ ready: bool }` | Toggle ready state |
| `game:start` | — | Host starts the game |
| `card:select` | `{ cardId }` | Submit card to pass |
| `game:restart` | — | Host restarts to lobby |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room:joined` | `{ roomCode, playerId }` | Confirmed join |
| `room:state` | Public room state | Broadcast to all |
| `player:state` | `{ hand, selectedCardId }` | Private, per-player |
| `game:started` | `{ round }` | Game began |
| `round:complete` | `{ round }` | New round started |
| `game:over` | `{ winner, allHands }` | Game finished, hands revealed |
| `game:restarted` | — | Back to lobby |
| `player:disconnected` | `{ playerName }` | Player left mid-game |
| `error:message` | `{ message }` | Error feedback |

## Deployment

### Environment Variables

**Client** (`.env`):
```
REACT_APP_SERVER_URL=https://your-server.com
```

**Server** (env or `.env`):
```
PORT=3001
```

### Build for Production

```bash
# Build the React app
cd client && npm run build

# Serve build/ as static files from the Express server,
# or deploy to a static host (Vercel, Netlify, etc.)
# and the server to Railway, Render, Fly.io, etc.
```

## License

MIT
