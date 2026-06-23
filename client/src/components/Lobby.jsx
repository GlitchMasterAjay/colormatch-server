import React, { useState } from 'react';

export default function Lobby({ onCreateRoom, onJoinRoom, error, connected }) {
  const [view, setView] = useState('home'); // home | create | join
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (playerName.trim()) onCreateRoom(playerName.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at center top, #1e3a5f 0%, #0F172A 60%)' }}>

      {/* Title */}
      <div className="mb-10 text-center">
        <div className="flex justify-center gap-3 mb-4 text-4xl">
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>🔴</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>🔵</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>🟢</span>
          <span className="animate-bounce" style={{ animationDelay: '450ms' }}>🟡</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
          Color<span className="text-indigo-400">Match</span>
        </h1>
        <p className="text-slate-400 text-lg">Collect 4 of a kind to win</p>
        <div className={`mt-3 inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          {connected ? 'Connected' : 'Connecting…'}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {view === 'home' && (
          <div className="space-y-3">
            <button
              onClick={() => setView('create')}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Create Room
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
          <form onSubmit={handleCreate} className="space-y-4">
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
              Create Room
            </button>
            <button type="button" onClick={() => setView('home')} className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              ← Back
            </button>
          </form>
        )}

        {view === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
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
                placeholder="E.g. ABC123"
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
              ← Back
            </button>
          </form>
        )}
      </div>

      {/* Rules */}
      <div className="mt-8 max-w-sm text-center text-slate-500 text-sm space-y-1">
        <p>4 players · 16 cards · 4 colors</p>
        <p>Pass cards, collect 4 of a kind to win!</p>
      </div>
    </div>
  );
}
