import React from 'react';
import { getColorConfig } from '../utils/colors';

export default function PlayingCard({ card, selected, onClick, size = 'md', hidden = false, dealDelay = 0, passing = false }) {
  const config = hidden ? null : getColorConfig(card?.color);

  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-16 h-24',
    lg: 'w-20 h-28',
    xl: 'w-24 h-32'
  };

  const symbolSizes = {
    sm: 'text-xs',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const animStyle = dealDelay > 0 ? {
    animationDelay: `${dealDelay}ms`,
    opacity: 0,
    animationFillMode: 'forwards'
  } : {};

  if (hidden) {
    return (
      <div
        className={`card card-hidden ${sizeClasses[size]} flex items-center justify-center`}
        style={animStyle}
      >
        <div className="text-slate-500 text-2xl select-none">🂠</div>
      </div>
    );
  }

  return (
    <div
      className={`card ${config.cardClass} ${sizeClasses[size]} ${selected ? 'selected' : ''} ${dealDelay > 0 ? 'deal-animate' : ''} ${passing ? 'pass-animate' : ''} flex flex-col justify-between p-1.5`}
      style={animStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`${config.label} card${selected ? ' (selected)' : ''}`}
      aria-pressed={selected}
    >
      {/* Top corner */}
      <div className="text-white font-bold leading-none">
        <div className={`${symbolSizes[size]} drop-shadow`}>{config.symbol}</div>
      </div>

      {/* Center symbol */}
      <div className="flex items-center justify-center">
        <span className="text-white text-opacity-90 text-2xl drop-shadow-md select-none">
          {config.symbol}
        </span>
      </div>

      {/* Bottom corner (rotated) */}
      <div className="text-white font-bold leading-none self-end rotate-180">
        <div className={`${symbolSizes[size]} drop-shadow`}>{config.symbol}</div>
      </div>

      {/* Shine overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
    </div>
  );
}
