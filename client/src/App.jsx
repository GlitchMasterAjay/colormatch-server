import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameBoard from './components/GameBoard';
import WordMatchBoard from './components/WordMatchBoard';
import ContactBlockBoard from './components/ContactBlockBoard';

const VIEW = {
  LOBBY: 'lobby',
  WAITING_ROOM: 'waitingRoom',
  GAME: 'game'
};

export default function App() {
  const { emit, on, off, connected } = useSocket();

  const [view, setView] = useState(VIEW.LOBBY);
  const [myId, setMyId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState(null);
  const [disconnectMsg, setDisconnectMsg] = useState('');

  // Track if selection is pending server confirmation
  const pendingSelect = useRef(false);

  useEffect(() => {
    const cleanup = [];

    cleanup.push(on('room:joined', ({ roomCode, playerId }) => {
      setMyId(playerId);
      setError('');
      setView(VIEW.WAITING_ROOM);
    }));

    cleanup.push(on('room:state', (state) => {
      setRoomState(state);
      // Transition view based on game state
      if (state.gameState === 'playing' || state.gameState === 'finished') {
        setView(VIEW.GAME);
      } else if (state.gameState === 'lobby') {
        setView(VIEW.WAITING_ROOM);
        setGameOver(null);
      }
    }));

    cleanup.push(on('player:state', (state) => {
      setPlayerState(state);
      pendingSelect.current = false;
    }));

    cleanup.push(on('game:started', () => {
      setView(VIEW.GAME);
      setGameOver(null);
      setDisconnectMsg('');
    }));

    cleanup.push(on('game:over', (data) => {
      setGameOver(data);
    }));

    cleanup.push(on('game:restarted', () => {
      setGameOver(null);
      setPlayerState(null);
      setView(VIEW.WAITING_ROOM);
    }));

    cleanup.push(on('round:complete', () => {
      // Room state will update, no extra action needed
    }));

    cleanup.push(on('player:disconnected', ({ playerName }) => {
      setDisconnectMsg(`${playerName} disconnected from the game.`);
      setTimeout(() => setDisconnectMsg(''), 5000);
    }));

    cleanup.push(on('player:left', ({ message }) => {
      setDisconnectMsg(message);
      setGameOver(null);
      setView(VIEW.WAITING_ROOM);
    }));

    cleanup.push(on('host:changed', ({ newHostId }) => {
      if (newHostId === myId) {
        setDisconnectMsg('You are now the host.');
        setTimeout(() => setDisconnectMsg(''), 3000);
      }
    }));

    cleanup.push(on('error:message', ({ message }) => {
      setError(message);
    }));

    return () => cleanup.forEach(fn => typeof fn === 'function' && fn());
  }, [on, myId]);

  const handleCreateRoom = useCallback((playerName, gameType) => {
    setError('');
    emit('room:create', { playerName, gameType });
  }, [emit]);

  const handleJoinRoom = useCallback((roomCode, playerName) => {
    setError('');
    emit('room:join', { roomCode, playerName });
  }, [emit]);

  const handleReady = useCallback((ready) => {
    emit('player:ready', { ready });
  }, [emit]);

  const handleStart = useCallback((options = {}) => {
    emit('game:start', options);
  }, [emit]);

  const handleSelectCard = useCallback((cardId) => {
    if (pendingSelect.current) return;

    // Toggle: if already selected same card, deselect isn't needed server-side,
    // but we optimistically update UI. Server only acts on submission.
    const currentSelected = playerState?.selectedCardId;

    if (currentSelected === cardId) {
      // Deselect (optimistic only — server doesn't have a deselect event,
      // the card just won't be submitted)
      setPlayerState(prev => prev ? { ...prev, selectedCardId: null } : prev);
      return;
    }

    pendingSelect.current = true;
    // Optimistically update
    setPlayerState(prev => prev ? { ...prev, selectedCardId: cardId } : prev);
    emit('card:select', { cardId });
  }, [emit, playerState]);

  const handleRestart = useCallback(() => {
    emit('game:restart');
  }, [emit]);

  const handleHostWord = useCallback((startingWord) => {
    emit('word:hostWord', { startingWord });
  }, [emit]);

  const handleSubmitWord = useCallback((answer) => {
    emit('word:submit', { answer });
  }, [emit]);

  const handleLeave = useCallback(() => {
    // Refresh page to reset state
    window.location.reload();
  }, []);

  const handleContactSecretWord = useCallback((secretWord) => {
    emit('contact:secretWord', { secretWord });
  }, [emit]);

  const handleContactClue = useCallback((clue) => {
    emit('contact:clue', { clue });
  }, [emit]);

  const handleContactVote = useCallback((choice) => {
    emit('contact:vote', { choice });
  }, [emit]);

  const handleContactAnswer = useCallback((answer) => {
    emit('contact:answer', { answer });
  }, [emit]);

  const handleContactBlockWord = useCallback((blockWord) => {
    emit('contact:blockWord', { blockWord });
  }, [emit]);

  const handleContactEnd = useCallback(() => {
    emit('contact:end');
  }, [emit]);

  const handleSendChat = useCallback((message) => {
    emit('chat:send', { message });
  }, [emit]);

 // REPLACE THIS OLD LINE:
// const isHost = roomState?.players?.find(p => p.id === myId)?.id === roomState?.hostId || myId === roomState?.hostId;

// WITH THIS BULLETPROOF CHECK:
const isHost = roomState && myId && String(roomState.hostId) === String(myId);

  if (view === VIEW.LOBBY) {
    return <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} error={error} connected={connected} />;
  }

  if (view === VIEW.WAITING_ROOM) {
    return (
      <WaitingRoom
        roomState={roomState}
        myId={myId}
        isHost={isHost}
        onReady={handleReady}
        onStart={handleStart}
        onSendChat={handleSendChat}
        onLeave={handleLeave}
      />
    );
  }

  if (view === VIEW.GAME) {
    if (roomState?.gameType === 'word-match') {
      return (
        <WordMatchBoard
          roomState={roomState}
          myId={myId}
          isHost={isHost}
          onHostWord={handleHostWord}
          onSubmitWord={handleSubmitWord}
          onRestart={handleRestart}
          gameOver={gameOver}
          disconnectMsg={disconnectMsg}
          onSendChat={handleSendChat}
        />
      );
    }

    if (roomState?.gameType === 'contact-block') {
      return (
        <ContactBlockBoard
          roomState={roomState}
          playerState={playerState}
          myId={myId}
          isHost={isHost}
          onSecretWord={handleContactSecretWord}
          onClue={handleContactClue}
          onVote={handleContactVote}
          onAnswer={handleContactAnswer}
          onBlockWord={handleContactBlockWord}
          onEndGame={handleContactEnd}
          onRestart={handleRestart}
          gameOver={gameOver}
          disconnectMsg={disconnectMsg}
          onSendChat={handleSendChat}
        />
      );
    }

    return (
      <GameBoard
        roomState={roomState}
        playerState={playerState}
        myId={myId}
        isHost={isHost}
        onSelectCard={handleSelectCard}
        onRestart={handleRestart}
        gameOver={gameOver}
        disconnectMsg={disconnectMsg}
        onSendChat={handleSendChat}
      />
    );
  }

  return null;
}
