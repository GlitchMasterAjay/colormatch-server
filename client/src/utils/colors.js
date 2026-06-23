export const COLOR_CONFIG = {
  red: {
    label: 'Red',
    emoji: '🔴',
    cardClass: 'card-red',
    bgClass: 'bg-red-500',
    textClass: 'text-red-400',
    borderClass: 'border-red-500',
    hex: '#EF4444',
    symbol: '♥'
  },
  blue: {
    label: 'Blue',
    emoji: '🔵',
    cardClass: 'card-blue',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500',
    hex: '#3B82F6',
    symbol: '◆'
  },
  green: {
    label: 'Green',
    emoji: '🟢',
    cardClass: 'card-green',
    bgClass: 'bg-green-500',
    textClass: 'text-green-400',
    borderClass: 'border-green-500',
    hex: '#22C55E',
    symbol: '♣'
  },
  yellow: {
    label: 'Yellow',
    emoji: '🟡',
    cardClass: 'card-yellow',
    bgClass: 'bg-yellow-400',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-400',
    hex: '#EAB308',
    symbol: '★'
  }
};

export function getColorConfig(color) {
  return COLOR_CONFIG[color] || { label: color, emoji: '⬜', cardClass: 'card-hidden', symbol: '?' };
}
