import React, { useState } from 'react';

const GAMES = {
  CARD_MATCH: 'card-match',
  WORD_MATCH: 'word-match'
};

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected }) {
  const [view, setView] = useState('home');
  const [selectedGame, setSelectedGame] = useState(GAMES.CARD_MATCH);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (playerName.trim()) onCreateRoom(playerName.trim(), selectedGame);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
  };

  const selectedGameName = selectedGame === GAMES.WORD_MATCH ? 'Word Match' : 'Color Match';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at center top, #1e3a5f 0%, #0F172A 60%)' }}
    >
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
          Game<span className="text-indigo-400">Room</span>
        </h1>
        <p className="text-slate-400 text-lg">Pick a multiplayer game and invite your friends</p>
        <div className={`mt-3 inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          {connected ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      <div className="w-full max-w-3xl bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {view === 'home' && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedGame(GAMES.CARD_MATCH)}
                className={`text-left p-5 rounded-xl border transition-all duration-200 ${
                  selectedGame === GAMES.CARD_MATCH
                    ? 'bg-indigo-600/20 border-indigo-400 shadow-lg shadow-indigo-950/30'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-400'
                }`}
              >
                <div className="text-sm text-slate-400 mb-2">4 players</div>
                <div className="text-2xl font-bold text-white mb-2">Color Match</div>
                <p className="text-sm text-slate-300">Pass color cards around the table and collect 4 of a kind.</p>
              </button>

              <button
                onClick={() => setSelectedGame(GAMES.WORD_MATCH)}
                className={`text-left p-5 rounded-xl border transition-all duration-200 ${
                  selectedGame === GAMES.WORD_MATCH
                    ? 'bg-fuchsia-600/20 border-fuchsia-400 shadow-lg shadow-fuchsia-950/30'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-400'
                }`}
              >
                <div className="text-sm text-slate-400 mb-2">3-10 players</div>
                <div className="text-2xl font-bold text-white mb-2">Word Match</div>
                <p className="text-sm text-slate-300">Rotate hosts, reveal a starting word, and match answers in 10 seconds.</p>
              </button>
            </div>

            <button
              onClick={() => setView('create')}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Create {selectedGameName} Room
            </button>
            <button
              onClick={() => setView('join')}
              className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Join Room
            </button>
          </div>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4 max-w-sm mx-auto">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoFocus
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!playerName.trim() || !connected}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Create {selectedGameName} Room
            </button>
            <button type="button" onClick={() => setView('home')} className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Back
            </button>
          </form>
        )}

        {view === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4 max-w-sm mx-auto">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoFocus
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono tracking-widest text-center"
              />
            </div>
            <button
              type="submit"
              disabled={!playerName.trim() || !roomCode.trim() || !connected}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Join Room
            </button>
            <button type="button" onClick={() => setView('home')} className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Back
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 max-w-sm text-center text-slate-500 text-sm space-y-1">
        <p>Real-time rooms powered by Socket.IO</p>
        <p>Join rooms inherit the host's selected game.</p>
      </div>
    </div>
  );
}
