import React, { useState } from 'react';

const SEATS = 4;

export default function WaitingRoom({ roomState, myId, isHost, onReady, onStart, onLeave }) {
  const [copied, setCopied] = useState(false);

  const players = roomState?.players || [];
  const allReady = players.length === SEATS && players.every(p => p.connected && p.ready);
  const me = players.find(p => p.id === myId);

  const copyCode = () => {
    navigator.clipboard.writeText(roomState.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at center top, #1e3a5f 0%, #0F172A 60%)' }}>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Game Lobby</h1>
          <p className="text-slate-400">Waiting for players…</p>
        </div>

        {/* Room code */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 mb-4 text-center">
          <p className="text-slate-400 text-sm mb-2">Room Code</p>
          <div className="room-code text-4xl font-bold text-white tracking-[0.2em] mb-3">
            {roomState?.id}
          </div>
          <button
            onClick={copyCode}
            className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>

        {/* Player list */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-white">Players</h2>
            <span className="text-slate-400 text-sm">{players.length}/{SEATS}</span>
          </div>

          <div className="space-y-2">
            {Array.from({ length: SEATS }).map((_, i) => {
              const player = players[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    player ? 'bg-slate-700/60' : 'bg-slate-700/20 border border-dashed border-slate-600'
                  }`}
                >
                  {player ? (
                    <>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        player.ready ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'
                      }`}>
                        {player.name[0].toUpperCase()}
                      </div>
                      <span className="flex-1 font-medium text-white">
                        {player.name}
                        {player.id === myId && <span className="ml-2 text-xs text-indigo-400">(You)</span>}
                        {player.id === roomState?.hostId && <span className="ml-2 text-xs text-yellow-400">👑</span>}
                      </span>
                      {!player.connected && (
                        <span className="text-xs text-red-400">Disconnected</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        player.ready ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
                      }`}>
                        {player.ready ? 'Ready' : 'Not ready'}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 text-sm w-full text-center">Waiting for player…</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {me && (
            <button
              onClick={() => onReady(!me.ready)}
              className={`w-full py-3 font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                me.ready
                  ? 'bg-slate-600 hover:bg-slate-500 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {me.ready ? 'Cancel Ready' : '✓ Ready'}
            </button>
          )}

          {isHost && (
            <button
              onClick={onStart}
              disabled={!allReady}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {players.length < SEATS
                ? `Need ${SEATS - players.length} more player${SEATS - players.length > 1 ? 's' : ''}`
                : !allReady
                  ? 'Waiting for all to ready up…'
                  : '🚀 Start Game'}
            </button>
          )}

          <button
            onClick={onLeave}
            className="w-full py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
