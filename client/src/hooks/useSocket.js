import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://colormatch-server.onrender.com";

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Change this block inside client/src/hooks/useSocket.js
useEffect(() => {
  const socket = io(SERVER_URL, { 
    autoConnect: true, 
    reconnection: true,
    transports: ['websocket'] // 👈 Add this line to force pure websockets
  });
  socketRef.current = socket;

  socket.on('connect', () => setConnected(true));
  socket.on('disconnect', () => setConnected(false));

  return () => { socket.disconnect(); };
}, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { emit, on, off, connected, socketId: socketRef.current?.id };
}
