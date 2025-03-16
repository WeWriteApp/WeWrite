import { useState, useEffect } from 'react';

interface Member {
  id: string;
  name: string;
}

interface Message {
  id: string;
  author: string;
  content: string;
}

interface Room {
  name: string;
}

interface RoomState {
  room: Room | null;
  messages: Message[];
  members: Member[];
  presence: Record<string, { status: 'online' | 'offline' }>;
  loading: boolean;
  error: Error | null;
}

export function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState>({
    room: null,
    messages: [],
    members: [],
    presence: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Here you would typically implement your room connection logic
    // For now, we'll just simulate loading some data
    const timer = setTimeout(() => {
      setState(prev => ({
        ...prev,
        loading: false,
        room: { name: `Room ${roomId}` },
        members: [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' },
        ],
        presence: {
          '1': { status: 'online' },
          '2': { status: 'offline' },
        },
        messages: [
          { id: '1', author: 'User 1', content: 'Hello!' },
          { id: '2', author: 'User 2', content: 'Hi there!' },
        ],
      }));
    }, 1000);

    return () => {
      clearTimeout(timer);
      setState(prev => ({ ...prev, loading: true, room: null }));
    };
  }, [roomId]);

  return {
    room: state.room,
    messages: state.messages,
    members: state.members,
    presence: state.presence,
    loading: state.loading,
    error: state.error,
  };
} 