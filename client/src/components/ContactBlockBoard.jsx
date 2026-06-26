import React, { useEffect, useState } from 'react';
import Confetti from './Confetti';
import ChatPanel from './ChatPanel';

function useCountdown(targetTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetTime) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (!targetTime) return null;
  return Math.max(0, Math.ceil((targetTime - now) / 1000));
}

export default function ContactBlockBoard({
  roomState,
  playerState,
  myId,
  isHost,
  onSecretWord,
  onClue,
  onVote,
  onAnswer,
  onBlockWord,
  onEndGame,
  onRestart,
  gameOver,
  disconnectMsg,
  onSendChat
}) {
  const [secretWord, setSecretWord] = useState('');
  const [clue, setClue] = useState('');
  const [answer, setAnswer] = useState('');
  const [blockWord, setBlockWord] = useState('');

  const game = roomState?.contactBlock || {};
  const players = roomState?.players || [];
  const activeHost = players.find(player => player.id === game.activeHostId);
  const mainHost = players.find(player => player.id === roomState?.hostId);
  const isActiveHost = game.activeHostId === myId;
  const isGuesser = myId && myId !== game.activeHostId;
  const isAnswerParticipant = (game.answerParticipants || []).includes(myId);
  const clueAuthor = players.find(player => player.id === game.clueAuthorId);
  const timerSeconds = useCountdown(game.gameEndsAt);
  const connectedCount = players.filter(player => player.connected).length;
  const myContactSubmitted = playerState?.contactBlock?.myAnswerSubmitted;
  const secretPreview = playerState?.contactBlock?.secretWord;
  const finished = roomState?.gameState === 'finished';

  useEffect(() => {
    setClue('');
    setAnswer('');
  }, [game.clueCycle, game.phase]);

  const submitSecretWord = (e) => {
    e.preventDefault();
    if (secretWord.trim()) {
      onSecretWord(secretWord.trim());
      setSecretWord('');
    }
  };

  const submitClue = (e) => {
    e.preventDefault();
    if (clue.trim()) {
      onClue(clue.trim());
      setClue('');
    }
  };

  const submitAnswer = (e) => {
    e.preventDefault();
    if (answer.trim()) {
      onAnswer(answer.trim());
      setAnswer('');
    }
  };

  const submitBlockWord = (e) => {
    e.preventDefault();
    if (blockWord.trim()) {
      onBlockWord(blockWord.trim());
      setBlockWord('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 18%, #12372b 0%, #0F172A 70%)' }}>
      <Confetti active={finished} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm">Room</div>
          <div className="room-code text-white font-bold">{roomState?.id}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200">
            Prefix {game.revealedMask || '_'}
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200">
            {timerSeconds ?? 0}s left
          </span>
        </div>
      </div>

      {disconnectMsg && (
        <div className="mx-4 mt-3 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm text-center">
          {disconnectMsg}
        </div>
      )}

      <div className="flex-1 w-full max-w-7xl mx-auto grid xl:grid-cols-[260px_1fr_320px] gap-5 px-4 py-6">
        <aside className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-4">Scoreboard</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-400">Main Host</span><span className="text-white">{mainHost?.name || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Active Host</span><span className="text-white">{activeHost?.name || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Successful Contacts</span><span className="text-white">{game.totalSuccessfulContacts || 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Used Words</span><span className="text-white">{game.usedWords?.length || 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Blocked Words</span><span className="text-white">{game.blockedWords?.length || 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Connected</span><span className="text-white">{connectedCount}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Required Match</span><span className="text-white">{game.requiredMatches || 2}</span></div>
            </div>
          </div>

          {isHost && !finished && (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
              <h2 className="font-bold text-white mb-3">Main Host Panel</h2>
              <p className="text-sm text-slate-400 mb-4">Use restart after a finished round, or end the game early and return everyone to the lobby.</p>
              <button
                onClick={onEndGame}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all"
              >
                End Game
              </button>
            </div>
          )}

          {isActiveHost && !finished && (
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4">
              <h2 className="font-bold text-white mb-3">Host Panel</h2>
              <div className="text-sm text-slate-400 mb-4">
                Secret Word: <span className="text-white font-semibold">{secretPreview || 'Hidden'}</span>
              </div>

              {game.phase === 'secret_entry' && (
                <form onSubmit={submitSecretWord} className="space-y-3">
                  <input
                    value={secretWord}
                    onChange={e => setSecretWord(e.target.value)}
                    maxLength={48}
                    autoFocus
                    placeholder="Enter Secret Word"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    disabled={!secretWord.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                  >
                    Lock Secret Word
                  </button>
                </form>
              )}

              {['decision', 'answer'].includes(game.phase) && (
                <form onSubmit={submitBlockWord} className="space-y-3">
                  <input
                    value={blockWord}
                    onChange={e => setBlockWord(e.target.value)}
                    maxLength={32}
                    placeholder="Block Word"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    disabled={!blockWord.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                  >
                    Add Block
                  </button>
                </form>
              )}
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {finished ? (
            <div className="bg-slate-900/85 border border-slate-700 rounded-2xl p-6 text-center win-animate">
              <div className="text-sm uppercase tracking-[0.2em] text-emerald-300 mb-3">Round Complete</div>
              <h1 className="text-4xl font-bold text-white mb-4">
                {gameOver?.winnerType === 'players' ? 'Players Win' : 'Host Wins'}
              </h1>
              <p className="text-slate-300 text-lg mb-2">Secret word: <span className="text-white font-semibold">{gameOver?.secretWord || secretPreview || '-'}</span></p>
              <p className="text-slate-400 mb-6">Active host: {gameOver?.activeHostName || activeHost?.name || 'Host'}</p>
              {isHost ? (
                <button
                  onClick={onRestart}
                  className="w-full max-w-sm py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
                >
                  Start Next Round
                </button>
              ) : (
                <p className="text-slate-400">Waiting for the main host to restart...</p>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 min-h-[620px]">
              <div className="text-center mb-8">
                <div className="text-sm text-emerald-300 font-semibold mb-2">Contact and Block</div>
                <h1 className="text-5xl font-bold text-white tracking-tight break-words">{game.revealedMask || '_'}</h1>
                <p className="text-slate-400 mt-3">
                  {game.phase === 'secret_entry'
                    ? `${activeHost?.name || 'Active host'} is setting the secret word.`
                    : game.phase === 'clue_submission'
                      ? 'Any non-host player can submit the next clue.'
                      : game.phase === 'decision'
                        ? 'Decide whether to call Contact or drop this clue.'
                        : game.phase === 'answer'
                          ? 'Contact players are submitting secret answers.'
                          : 'Waiting for the next phase.'}
                </p>
              </div>

              {game.currentClue && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Current Clue</div>
                  <div className="text-2xl text-white break-words">{game.currentClue}</div>
                  <div className="text-sm text-slate-400 mt-2">Submitted by {clueAuthor?.name || 'a player'}</div>
                </div>
              )}

              {game.lastResolution?.result && !['clue_submission', 'secret_entry'].includes(game.phase) && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 text-sm text-slate-300">
                  {game.lastResolution.result === 'success' && `Successful contact on "${game.lastResolution.matchedWord}" (${game.lastResolution.matchCount} matches).`}
                  {game.lastResolution.result === 'forgot' && 'Everyone chose Forget This Clue. Starting a new clue.'}
                  {game.lastResolution.result === 'not-enough-contact' && 'Not enough players chose Contact. Starting a new clue.'}
                  {game.lastResolution.result === 'miss' && 'Answers did not match enough times. Starting a new clue.'}
                </div>
              )}

              {game.phase === 'clue_submission' && isGuesser && (
                <form onSubmit={submitClue} className="max-w-xl mx-auto space-y-4">
                  <input
                    value={clue}
                    onChange={e => setClue(e.target.value)}
                    maxLength={120}
                    autoFocus
                    placeholder="Submit a clue for the current prefix"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-center text-lg"
                  />
                  <button
                    disabled={!clue.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                  >
                    Submit Clue
                  </button>
                </form>
              )}

              {game.phase === 'decision' && isGuesser && (
                <div className="max-w-xl mx-auto space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => onVote('contact')}
                      className={`py-4 rounded-xl font-semibold transition-all ${
                        game.contactVotes?.includes(myId)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                      }`}
                    >
                      Contact
                    </button>
                    <button
                      onClick={() => onVote('forget')}
                      className={`py-4 rounded-xl font-semibold transition-all ${
                        game.forgetVotes?.includes(myId)
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                      }`}
                    >
                      Forget This Clue
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-400">
                    <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-3">
                      Contact votes: <span className="text-white font-semibold">{game.contactVotes?.length || 0}</span>
                    </div>
                    <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-3">
                      Forget votes: <span className="text-white font-semibold">{game.forgetVotes?.length || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {game.phase === 'answer' && isAnswerParticipant && (
                <form onSubmit={submitAnswer} className="max-w-xl mx-auto space-y-4">
                  {myContactSubmitted ? (
                    <div className="py-5 text-center rounded-2xl bg-green-500/10 border border-green-500/30 text-green-300">
                      Answer locked. Waiting for the other Contact players...
                    </div>
                  ) : (
                    <>
                      <input
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        maxLength={32}
                        autoFocus
                        placeholder="Your answer must begin with the prefix"
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-center text-lg"
                      />
                      <button
                        disabled={!answer.trim()}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                      >
                        Submit Answer
                      </button>
                    </>
                  )}
                </form>
              )}

              {(game.phase === 'answer' && !isAnswerParticipant && isGuesser) && (
                <div className="max-w-xl mx-auto py-5 text-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300">
                  Contact is in progress. Waiting for the selected players to answer.
                </div>
              )}

              {(game.phase === 'secret_entry' && !isActiveHost) && (
                <div className="max-w-xl mx-auto py-5 text-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300">
                  Waiting for {activeHost?.name || 'the active host'} to enter the secret word.
                </div>
              )}

              {(game.phase === 'clue_submission' && !isGuesser) && (
                <div className="max-w-xl mx-auto py-5 text-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300">
                  Guessers are choosing the next clue.
                </div>
              )}

              {(game.phase === 'decision' && !isGuesser) && (
                <div className="max-w-xl mx-auto py-5 text-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300">
                  Watch the room decide while you keep blocking possible words.
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Used Words</h2>
            <div className="max-h-52 overflow-y-auto space-y-2">
              {(game.usedWords || []).length ? game.usedWords.map(word => (
                <div key={word} className="px-3 py-2 rounded-xl bg-slate-800/70 text-slate-200 break-words">{word}</div>
              )) : <div className="text-sm text-slate-500">No used words yet.</div>}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Blocked Words</h2>
            <div className="max-h-52 overflow-y-auto space-y-2">
              {(game.blockedWords || []).length ? game.blockedWords.map(word => (
                <div key={word} className="px-3 py-2 rounded-xl bg-slate-800/70 text-slate-200 break-words">{word}</div>
              )) : <div className="text-sm text-slate-500">No blocked words yet.</div>}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Players</h2>
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-800/70">
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {player.name}{player.id === myId ? ' (You)' : ''}
                    </div>
                    <div className="text-xs text-slate-400">
                      {player.id === roomState?.hostId ? 'Main host' : player.id === game.activeHostId ? 'Active host' : 'Player'}
                    </div>
                  </div>
                  {game.phase === 'answer' && game.answerParticipants?.includes(player.id) && (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">Contact</span>
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
