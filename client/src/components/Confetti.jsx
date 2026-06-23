import React, { useEffect, useState } from 'react';

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function Confetti({ active }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) { setPieces([]); return; }

    const newPieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: randomBetween(0, 100),
      delay: randomBetween(0, 1500),
      duration: randomBetween(2000, 4000),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(6, 14),
      rotation: randomBetween(0, 360),
      shape: Math.random() > 0.5 ? 'rect' : 'circle'
    }));
    setPieces(newPieces);

    const timeout = setTimeout(() => setPieces([]), 5000);
    return () => clearTimeout(timeout);
  }, [active]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
            transform: `rotate(${p.rotation}deg)`
          }}
        />
      ))}
    </div>
  );
}
