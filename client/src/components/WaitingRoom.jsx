import React, { useState } from 'react';
import ChatPanel from './ChatPanel';

export default function WaitingRoom({ roomState, myId, isHost, onReady, onStart, onSendChat, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [rounds, setRounds] = useState(10);
  const [activeHostId, setActiveHostId] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [requiredMatches, setRequiredMatches] = useState(2);

  const players = roomState?.players || [];
  const isWordMatch = roomState?.gameType === 'word-match';
  const isContactBlock = roomState?.gameType === 'contact-block';
  const minPlayers = isWordMatch
    ? roomState?.gameConfig?.wordMatchMinPlayers || 3
    : isContactBlock
      ? roomState?.gameConfig?.contactBlockMinPlayers || 3
      : roomState?.gameConfig?.cardMatchSeats || 4;
  const maxPlayers = isWordMatch
    ? roomState?.gameConfig?.wordMatchMaxPlayers || 10
    : isContactBlock
      ? roomState?.gameConfig?.contactBlockMaxPlayers || 10
      : roomState?.gameConfig?.cardMatchSeats || 4;
  const seats = maxPlayers;
  const readyPlayers = players.filter(p => p.id === roomState?.hostId || (p.connected && p.ready));
  const hasEnoughPlayers = isWordMatch || isContactBlock ? players.length >= minPlayers : players.length === maxPlayers;
  const allReady = hasEnoughPlayers && players.every(p => p.id === roomState?.hostId || (p.connected && p.ready));
  const me = players.find(p => p.id === myId);
  const gameName = isWordMatch ? 'Word Match' : isContactBlock ? 'Contact and Block' : 'Color Match';

  React.useEffect(() => {
    if (!activeHostId && players.length) {
      setActiveHostId(players[0].id);
    }
    if (requiredMatches > players.length) {
      setRequiredMatches(Math.max(2, players.length));
    }
  }, [players, activeHostId, requiredMatches]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomState.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at center top, #1e3a5f 0%, #0F172A 60%)' }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <p className="text-indigo-300 font-semibold mb-1">{gameName}</p>
          <h1 className="text-3xl font-bold text-white mb-1">Game Lobby</h1>
          <p className="text-slate-400">Waiting for players...</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 mb-4 text-center">
          <p className="text-slate-400 text-sm mb-2">Room Code</p>
          <div className="room-code text-4xl font-bold text-white tracking-[0.2em] mb-3">
            {roomState?.id}
          </div>
          <button
            onClick={copyCode}
            className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>

        <div className="grid xl:grid-cols-[1fr_240px_320px] gap-4 mb-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-white">Players</h2>
              <span className="text-slate-400 text-sm">
                {players.length}/{maxPlayers} {isWordMatch && `min ${minPlayers}`}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {Array.from({ length: seats }).map((_, i) => {
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
                          player.id === roomState?.hostId
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : player.ready
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-600 text-slate-300'
                        }`}>
                          {player.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">
                            {player.name}
                            {player.id === myId && <span className="ml-1 text-xs text-indigo-400">(You)</span>}
                          </div>
                          <div className="text-xs text-slate-400">
                            {player.id === roomState?.hostId ? 'Host' : player.ready ? 'Ready' : 'Not ready'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 text-sm w-full text-center">Open seat</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
            <h2 className="font-semibold text-white mb-4">Setup</h2>
            {isWordMatch ? (
              <label className="block">
                <span className="block text-sm text-slate-400 mb-2">Rounds</span>
                <input
                  type="number"
                  min="10"
                  max="30"
                  value={rounds}
                  disabled={!isHost}
                  onChange={e => setRounds(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 transition-colors"
                />
                <span className="block text-xs text-slate-500 mt-2">Choose 10-30 before starting.</span>
              </label>
            ) : isContactBlock ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm text-slate-400 mb-2">Active Host</span>
                  <select
                    value={activeHostId}
                    disabled={!isHost}
                    onChange={e => setActiveHostId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {players.map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm text-slate-400 mb-2">Game Timer</span>
                  <select
                    value={timerMinutes}
                    disabled={!isHost}
                    onChange={e => setTimerMinutes(Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {[2, 5, 10, 15].map(value => (
                      <option key={value} value={value}>{value} minutes</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm text-slate-400 mb-2">Required Contact Matches</span>
                  <select
                    value={requiredMatches}
                    disabled={!isHost}
                    onChange={e => setRequiredMatches(Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {Array.from({ length: Math.max(0, players.length - 1) }, (_, index) => index + 2)
                      .filter(value => value <= players.length)
                      .map(value => (
                        <option key={value} value={value}>{value} players</option>
                      ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="text-sm text-slate-400 space-y-2">
                <p>Exactly 4 players.</p>
                <p>Collect 4 matching color cards to win.</p>
              </div>
            )}
            <div className="mt-5 text-sm text-slate-400">
              Ready: <span className="text-white font-semibold">{readyPlayers.length}/{players.length}</span>
            </div>
          </div>

          <ChatPanel
            messages={roomState?.chatMessages || []}
            myId={myId}
            onSend={onSendChat}
            title="Lobby Chat"
          />
        </div>

        <div className="space-y-3">
          {me && me.id !== roomState?.hostId && (
            <button
              onClick={() => onReady(!me.ready)}
              className={`w-full py-3 font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                me.ready
                  ? 'bg-slate-600 hover:bg-slate-500 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {me.ready ? 'Cancel Ready' : 'Ready'}
            </button>
          )}

          {isHost && (
            <button
              onClick={() => onStart(
                isWordMatch
                  ? { rounds }
                  : isContactBlock
                    ? { activeHostId, timerMinutes, requiredMatches }
                    : {}
              )}
              disabled={!allReady}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {!hasEnoughPlayers
                ? `Need ${Math.max(0, minPlayers - players.length)} more player${Math.max(0, minPlayers - players.length) === 1 ? '' : 's'}`
                : !allReady
                  ? 'Waiting for players to ready up...'
                  : `Start ${gameName}`}
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
