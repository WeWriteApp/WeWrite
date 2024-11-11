import { useRoom } from '@/hooks/useRoom';

export function Room({ roomId }: { roomId: string }) {
  const {
    room,
    messages,
    members,
    presence,
    loading,
    error
  } = useRoom(roomId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!room) return <div>Room not found</div>;

  return (
    <div>
      <h1>{room.name}</h1>
      
      {/* Members list */}
      <div className="members-list">
        {members.map(member => (
          <div key={member.id}>
            {member.name} 
            {presence[member.id]?.status === 'online' && '🟢'}
          </div>
        ))}
      </div>

      {/* Messages list */}
      <div className="messages-list">
        {messages.map(message => (
          <div key={message.id}>
            <strong>{message.author}</strong>: {message.content}
          </div>
        ))}
      </div>
    </div>
  );
} 