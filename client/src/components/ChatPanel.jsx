import React, { useEffect, useRef, useState } from 'react';

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ChatPanel({ messages = [], myId, onSend, title = 'Room Chat', compact = false }) {
  const [message, setMessage] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage('');
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
      <h2 className="font-bold text-white mb-3">{title}</h2>
      <div
        ref={listRef}
        className={`overflow-y-auto space-y-2 pr-1 ${compact ? 'max-h-52' : 'max-h-72 min-h-[220px]'}`}
      >
        {messages.length ? messages.map(entry => (
          <div
            key={entry.id}
            className={`px-3 py-2 rounded-xl ${
              entry.playerId === myId
                ? 'bg-indigo-500/20 border border-indigo-400/20'
                : 'bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-sm font-semibold text-white truncate">
                {entry.playerName}{entry.playerId === myId ? ' (You)' : ''}
              </span>
              <span className="text-[11px] text-slate-500">{formatTime(entry.sentAt)}</span>
            </div>
            <div className="text-sm text-slate-200 break-words">{entry.message}</div>
          </div>
        )) : (
          <div className="text-sm text-slate-500">No messages yet.</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={240}
          placeholder="Type a message"
          className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}
