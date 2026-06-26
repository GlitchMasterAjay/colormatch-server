import React, { useEffect, useMemo, useState } from 'react';
import Confetti from './Confetti';
import ChatPanel from './ChatPanel';

function useCountdown(targetTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetTime) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (!targetTime) return null;
  return Math.max(0, Math.ceil((targetTime - now) / 1000));
}

function Leaderboard({ players, leaderboard = [], myId }) {
  const fallback = players.map((player, index) => ({ id: player.id, name: player.name, score: 0, rank: index + 1 }));
  const rows = leaderboard.length ? leaderboard : fallback;

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-white">Leaderboard</h2>
        <span className="text-xs text-slate-400">Live</span>
      </div>
      <div className="space-y-2">
        {rows.map(row => (
          <div
            key={row.id}
            className={`grid grid-cols-[42px_1fr_58px] items-center gap-2 px-3 py-2 rounded-xl ${
              row.id === myId ? 'bg-indigo-500/20 border border-indigo-400/30' : 'bg-slate-800/70'
            }`}
          >
            <div className="text-slate-300 font-bold">#{row.rank}</div>
            <div className="min-w-0">
              <div className="text-white font-medium truncate">{row.name}</div>
              {row.id === myId && <div className="text-xs text-indigo-300">You</div>}
            </div>
            <div className="text-right text-xl font-bold text-white">{row.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Podium({ winners = [] }) {
  const medals = ['1st Place', '2nd Place', '3rd Place'];

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {winners.map((winner, index) => (
        <div key={winner.id} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-sm text-slate-400 mb-1">{medals[index]}</div>
          <div className="text-xl font-bold text-white truncate">{winner.name}</div>
          <div className="text-fuchsia-300 font-semibold">{winner.score} pts</div>
        </div>
      ))}
    </div>
  );
}

export default function WordMatchBoard({
  roomState,
  myId,
  isHost,
  onHostWord,
  onSubmitWord,
  onRestart,
  gameOver,
  disconnectMsg,
  onSendChat
}) {
  const [startingWord, setStartingWord] = useState('');
  const [answer, setAnswer] = useState('');
  const word = roomState?.wordMatch || {};
  const players = roomState?.players || [];
  const roundHost = players.find(p => p.id === word.hostPlayerId);
  const roundTimer = useCountdown(word.matchEndsAt);
  const revealTimer = useCountdown(word.revealEndsAt);
  const isRoundHost = word.hostPlayerId === myId;
  const submittedPlayers = word.submittedPlayers || [];
  const hasSubmitted = submittedPlayers.includes(myId);
  const finished = roomState?.gameState === 'finished' || word.phase === 'finished';

  const submittedCount = submittedPlayers.length;
  const connectedCount = players.filter(p => p.connected).length;
  const sortedWinners = useMemo(() => {
    if (gameOver?.winners) return gameOver.winners;
    return (word.leaderboard || []).slice(0, 3);
  }, [gameOver, word.leaderboard]);

  useEffect(() => {
    setStartingWord('');
    setAnswer('');
  }, [word.currentRound, word.phase]);

  const submitStartingWord = (e) => {
    e.preventDefault();
    if (startingWord.trim()) onHostWord(startingWord.trim());
  };

  const submitAnswer = (e) => {
    e.preventDefault();
    if (answer.trim()) onSubmitWord(answer.trim());
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 20%, #3b1749 0%, #0F172A 68%)' }}>
      <Confetti active={finished} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm">Room</div>
          <div className="room-code text-white font-bold">{roomState?.id}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-200">
            Round {word.currentRound || 0}/{word.totalRounds || 10}
          </span>
          {!finished && (
            <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-300">
              {submittedCount}/{connectedCount} submitted
            </span>
          )}
        </div>
      </div>

      {disconnectMsg && (
        <div className="mx-4 mt-3 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm text-center">
          {disconnectMsg}
        </div>
      )}

      <div className="flex-1 w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_300px] gap-5 px-4 py-6">
        <main className="min-w-0">
          {finished ? (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 text-center win-animate">
              <div className="text-sm uppercase tracking-[0.2em] text-fuchsia-300 mb-3">Final Results</div>
              <h1 className="text-4xl font-bold text-white mb-6">
                {sortedWinners[0]?.name || 'Winner'} wins Word Match
              </h1>
              <Podium winners={sortedWinners} />
              {isHost ? (
                <button
                  onClick={onRestart}
                  className="mt-6 w-full max-w-sm py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95"
                >
                  Play Again
                </button>
              ) : (
                <p className="mt-6 text-slate-400">Waiting for the room host to restart...</p>
              )}
            </div>
          ) : word.phase === 'host_word' ? (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 min-h-[420px] flex flex-col justify-center">
              <div className="text-center mb-8">
                <div className="text-sm text-fuchsia-300 font-semibold mb-2">Round Host</div>
                <h1 className="text-4xl font-bold text-white">{roundHost?.name || 'Host'} is choosing a word</h1>
                <p className="text-slate-400 mt-3">Once it appears, everyone gets 10 seconds to match the host's answer.</p>
              </div>

              {isRoundHost ? (
                <form onSubmit={submitStartingWord} className="max-w-md mx-auto w-full space-y-4">
                  <input
                    value={startingWord}
                    onChange={e => setStartingWord(e.target.value)}
                    maxLength={32}
                    autoFocus
                    placeholder="Starting word, e.g. Rain"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors text-center text-xl"
                  />
                  <button
                    disabled={!startingWord.trim()}
                    className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                  >
                    Reveal Word
                  </button>
                </form>
              ) : (
                <div className="max-w-md mx-auto w-full py-5 text-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300">
                  Waiting for {roundHost?.name || 'the host'}...
                </div>
              )}
            </div>
          ) : word.phase === 'matching' ? (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 min-h-[420px] flex flex-col justify-center">
              <div className="text-center mb-8">
                <div className="mx-auto mb-5 w-28 h-28 rounded-full border-8 border-fuchsia-500/30 flex items-center justify-center countdown-pop">
                  <span className="text-5xl font-bold text-white">{roundTimer}</span>
                </div>
                <p className="text-slate-400 mb-2">Starting word</p>
                <h1 className="text-5xl font-bold text-white break-words">{word.startingWord}</h1>
              </div>

              {hasSubmitted ? (
                <div className="max-w-md mx-auto w-full py-5 text-center rounded-2xl bg-green-500/10 border border-green-500/30 text-green-300">
                  Answer locked. Waiting for everyone else...
                </div>
              ) : (
                <form onSubmit={submitAnswer} className="max-w-md mx-auto w-full space-y-4">
                  <input
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    maxLength={32}
                    autoFocus
                    placeholder={isRoundHost ? 'Your secret matching word' : 'Try to match the host'}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors text-center text-xl"
                  />
                  <button
                    disabled={!answer.trim()}
                    className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all pulse-glow"
                  >
                    Submit Word
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 min-h-[420px]">
              <div className="text-center mb-6">
                <p className="text-slate-400">Host answer</p>
                <h1 className="text-5xl font-bold text-white break-words">{word.lastResult?.hostAnswer || '-'}</h1>
                <p className="text-fuchsia-300 mt-2">
                  {roundHost?.name || 'Host'} earned {word.lastResult?.hostPoints || 0} point{word.lastResult?.hostPoints === 1 ? '' : 's'}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {(word.lastResult?.answers || []).map(result => (
                  <div
                    key={result.playerId}
                    className={`p-4 rounded-2xl border ${
                      result.isHost
                        ? 'bg-yellow-500/10 border-yellow-400/30'
                        : result.matched
                          ? 'bg-green-500/10 border-green-400/30'
                          : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-semibold text-white truncate">{result.playerName}</span>
                      <span className="text-xs text-slate-400">{result.isHost ? 'Host' : result.matched ? '+1' : 'No match'}</span>
                    </div>
                    <div className="text-2xl text-slate-100 break-words">{result.answer || 'No answer'}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center text-slate-400">
                Next round in {revealTimer ?? 0}s
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <Leaderboard players={players} leaderboard={word.leaderboard} myId={myId} />
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Players</h2>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-800/70">
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {player.name}{player.id === myId ? ' (You)' : ''}
                    </div>
                    <div className="text-xs text-slate-400">{player.id === word.hostPlayerId ? 'Round host' : 'Player'}</div>
                  </div>
                  {word.phase === 'matching' && (
                    <span className={`w-3 h-3 rounded-full ${submittedPlayers.includes(player.id) ? 'bg-green-400' : 'bg-slate-600'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <ChatPanel
            messages={roomState?.chatMessages || []}
            myId={myId}
            onSend={onSendChat}
            compact
          />
        </aside>
      </div>
    </div>
  );
}
