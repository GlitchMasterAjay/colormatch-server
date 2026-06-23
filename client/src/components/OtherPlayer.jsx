import React from 'react';
import PlayingCard from './PlayingCard';

export default function OtherPlayer({ player, submitted, position, isCurrentTurn }) {
  // position: 'top' | 'left' | 'right'
  const isTop = position === 'top';
  const isLeft = position === 'left';
  const isRight = position === 'right';

  const rotationClasses = {
    top: '',
    left: '',
    right: ''
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${isLeft ? 'flex-col' : isRight ? 'flex-col' : ''}`}>
      {/* Name badge */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          isCurrentTurn ? 'bg-yellow-500 text-white' : player?.connected ? 'bg-slate-600' : 'bg-red-900/50'
        }`}>
          {isCurrentTurn ? '🎯' : player?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <div className={`text-sm font-medium leading-tight ${isCurrentTurn ? 'text-yellow-300' : 'text-white'}`}>
            {player?.name || 'Empty'}
            {isCurrentTurn && <span className="ml-1 text-xs text-yellow-300">← Turn</span>}
            {!player?.connected && <span className="ml-1 text-red-400 text-xs">✗</span>}
          </div>
          {submitted && (
            <div className="text-green-400 text-xs">Card submitted ✓</div>
          )}
        </div>
      </div>

      {/* Hidden cards */}
      <div className="flex gap-1">
        {Array.from({ length: player?.cardCount || 4 }).map((_, i) => (
          <PlayingCard key={i} hidden size="sm" />
        ))}
      </div>
    </div>
  );
}
