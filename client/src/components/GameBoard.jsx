import React, { useState, useEffect } from 'react';
import PlayingCard from './PlayingCard';
import OtherPlayer from './OtherPlayer';
import Confetti from './Confetti';
import { getColorConfig } from '../utils/colors';

export default function GameBoard({
  roomState,
  playerState,
  myId,
  isHost,
  onSelectCard,
  onRestart,
  gameOver,
  disconnectMsg
}) {
  const [dealAnimate, setDealAnimate] = useState(false);
  const [passAnimate, setPassAnimate] = useState(false);
  const [prevRound, setPrevRound] = useState(0);
  const [showRoundFlash, setShowRoundFlash] = useState(false);

  const players = roomState?.players || [];
  const hand = playerState?.hand || [];
  const selectedCardId = playerState?.selectedCardId || null;
  const round = roomState?.round || 1;
  const submittedPlayers = roomState?.submittedPlayers || [];
  const isFinished = roomState?.gameState === 'finished';
  const isMyTurn = roomState?.currentPlayerTurn === myId;
  const currentPlayer = players.find(p => p.id === roomState?.currentPlayerTurn);

  // Find other players relative to me
  const myIndex = roomState?.playerOrder?.indexOf(myId) ?? -1;
  const orderedOthers = [];
  if (roomState?.playerOrder) {
    const order = roomState.playerOrder;
    for (let offset = 1; offset <= 3; offset++) {
      const idx = (myIndex + offset) % order.length;
      const pid = order[idx];
      const p = players.find(pl => pl.id === pid);
      orderedOthers.push(p);
    }
  }
  // positions: right, top, left
  const positions = ['right', 'top', 'left'];

  useEffect(() => {
    setDealAnimate(true);
    const t = setTimeout(() => setDealAnimate(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (round > prevRound && prevRound !== 0) {
      setPassAnimate(true);
      setShowRoundFlash(true);
      const t1 = setTimeout(() => setPassAnimate(false), 700);
      const t2 = setTimeout(() => setShowRoundFlash(false), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    setPrevRound(round);
  }, [round]);

  const me = players.find(p => p.id === myId);
  const mySubmitted = submittedPlayers.includes(myId);
  const allCount = players.filter(p => p.connected).length;
  const submittedCount = submittedPlayers.length;

  const winnerConfig = gameOver?.winner?.color ? getColorConfig(gameOver.winner.color) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a2a4a 0%, #0F172A 70%)' }}>
      <Confetti active={isFinished} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm">Room</div>
          <div className="room-code text-white font-bold">{roomState?.id}</div>
        </div>
        <div className="flex items-center gap-3">
          {!isFinished && (
            <div className="text-slate-400 text-sm">
              Round <span className="text-white font-bold">{round}</span>
            </div>
          )}
          {!isFinished && (
            <div className="text-sm px-3 py-1 bg-slate-700 rounded-full text-slate-300">
              {submittedCount}/{allCount} submitted
            </div>
          )}
        </div>
      </div>

      {/* Disconnect warning */}
      {disconnectMsg && (
        <div className="mx-4 mt-3 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm text-center">
          ⚠ {disconnectMsg}
        </div>
      )}

      {/* Round flash */}
      {showRoundFlash && !isFinished && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="text-5xl font-bold text-white/80 win-animate">Round {round}</div>
        </div>
      )}

      {/* Game Over overlay */}
      {isFinished && gameOver && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-lg bg-slate-800/90 border border-slate-600 rounded-2xl p-8 text-center win-animate shadow-2xl">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {gameOver.winner.playerName} wins!
            </h2>
            {winnerConfig && (
              <p className="text-lg mb-6" style={{ color: winnerConfig.hex }}>
                Collected all 4 {winnerConfig.label} cards {winnerConfig.emoji}
              </p>
            )}

            {/* Reveal all hands */}
            {gameOver.allHands && (
              <div className="mb-6 space-y-3 text-left">
                <h3 className="text-slate-400 text-sm text-center mb-3">Final Hands</h3>
                {players.map(p => {
                  const pHand = gameOver.allHands[p.id] || [];
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${p.id === gameOver.winner.playerId ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-700/50'}`}>
                      <span className="text-sm font-medium text-white w-24 truncate">
                        {p.name} {p.id === myId ? '(You)' : ''} {p.id === gameOver.winner.playerId ? '👑' : ''}
                      </span>
                      <div className="flex gap-1.5">
                        {pHand.map(card => (
                          <PlayingCard key={card.id} card={card} size="sm" />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isHost ? (
              <button
                onClick={onRestart}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95"
              >
                Play Again
              </button>
            ) : (
              <p className="text-slate-400 text-sm">Waiting for host to restart…</p>
            )}
          </div>
        </div>
      )}

      {/* Active game board */}
      {!isFinished && (
        <div className="flex-1 flex flex-col">
          {/* Table area */}
          <div className="flex-1 relative flex flex-col items-center justify-between py-6 px-4 gap-4">

            {/* Top player */}
            <div className="flex justify-center">
              {orderedOthers[1] && (
                <OtherPlayer
                  player={orderedOthers[1]}
                  submitted={submittedPlayers.includes(orderedOthers[1]?.id)}
                  position="top"
                  isCurrentTurn={orderedOthers[1]?.isCurrentTurn}
                />
              )}
            </div>

            {/* Middle row: left + table + right */}
            <div className="flex items-center justify-between w-full max-w-2xl">
              {/* Left player */}
              <div>
                {orderedOthers[2] && (
                  <OtherPlayer
                    player={orderedOthers[2]}
                    submitted={submittedPlayers.includes(orderedOthers[2]?.id)}
                    position="left"
                    isCurrentTurn={orderedOthers[2]?.isCurrentTurn}
                  />
                )}
              </div>

              {/* Center table */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-full bg-slate-700/40 border-2 border-slate-600/50 flex flex-col items-center justify-center shadow-inner">
                  <div className="text-slate-500 text-xs">Pass →</div>
                  <div className="text-white text-lg font-bold">{submittedCount}/{allCount}</div>
                  <div className="text-slate-500 text-xs">ready</div>
                </div>
                <div className="flex gap-1 text-lg">
                  {['🔴','🔵','🟢','🟡'].map((e, i) => (
                    <span key={i} className="opacity-60">{e}</span>
                  ))}
                </div>
              </div>

              {/* Right player */}
              <div>
                {orderedOthers[0] && (
                  <OtherPlayer
                    player={orderedOthers[0]}
                    submitted={submittedPlayers.includes(orderedOthers[0]?.id)}
                    position="right"
                    isCurrentTurn={orderedOthers[0]?.isCurrentTurn}
                  />
                )}
              </div>
            </div>

            {/* Direction indicator */}
            <div className="text-slate-500 text-xs text-center">
              Cards pass to the right →
            </div>
          </div>

          {/* My hand area */}
          <div className="border-t border-slate-700/50 bg-slate-800/40 backdrop-blur px-4 py-5">
            <div className="max-w-lg mx-auto">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-white font-semibold">Your hand</div>
                  <div className="text-slate-400 text-sm">{me?.name}</div>
                </div>
                <div className="text-right">
                  {!isMyTurn ? (
                    <span className="text-slate-400 text-sm">
                      Waiting for {currentPlayer?.name || 'another player'}…
                    </span>
                  ) : isMyTurn && selectedCardId ? (
                    <span className="text-indigo-300 text-sm">Selected — tap again to deselect</span>
                  ) : isMyTurn ? (
                    <span className="text-yellow-300 text-sm font-medium">🎯 It's your turn! Pick a card</span>
                  ) : null}
                </div>
              </div>

              {/* Cards */}
              <div className="flex justify-center gap-3 mb-4">
                {hand.map((card, i) => (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    selected={selectedCardId === card.id}
                    onClick={isMyTurn ? () => onSelectCard(card.id) : undefined}
                    disabled={!isMyTurn}
                    size="xl"
                    dealDelay={dealAnimate ? i * 120 : 0}
                    passing={passAnimate}
                  />
                ))}
              </div>

              {/* Submit button */}
              {!mySubmitted && (
                <button
                  onClick={() => selectedCardId && onSelectCard(selectedCardId)}
                  disabled={!selectedCardId}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 pulse-glow"
                >
                  {selectedCardId ? 'Confirm & Pass Card →' : 'Select a card first'}
                </button>
              )}

              {mySubmitted && (
                <div className="w-full py-3 text-center text-green-400 font-medium">
                  Waiting for other players… ({submittedCount}/{allCount})
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
