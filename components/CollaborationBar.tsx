import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollaborativeUser {
  socketId: string;
  id: string;
  name: string;
  color: string;
}

interface CollaborationBarProps {
  roomId: string;
  user: { id: string, name: string };
  onRemoteUpdate: (data: any) => void;
  onSocketReady: (socket: Socket) => void;
}

const CollaborationBar: React.FC<CollaborationBarProps> = ({ roomId, user, onRemoteUpdate, onSocketReady }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<CollaborativeUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io({
      path: '/socket.io',
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', { 
        roomId, 
        user: { 
          id: user.id, 
          name: user.name,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`
        } 
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('presence-update', (users: CollaborativeUser[]) => {
      setActiveUsers(users);
    });

    newSocket.on('sheet-remote-update', (data: any) => {
      onRemoteUpdate(data);
    });

    setSocket(newSocket);
    onSocketReady(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user.id, user.name]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wifi size={14} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Live Sync Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400">
              <WifiOff size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Disconnected</span>
            </div>
          )}
        </div>
        
        <div className="h-4 w-px bg-slate-700 mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            <AnimatePresence>
              {activeUsers.map((u) => (
                <motion.div
                  key={u.socketId}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-black uppercase"
                  style={{ color: u.color, border: `1px solid ${u.color}40` }}
                  title={u.name}
                >
                  {u.name.substring(0, 2)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="text-[11px] font-bold text-slate-400">
            {activeUsers.length} active {activeUsers.length === 1 ? 'accountant' : 'accountants'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg">
        <Users size={14} className="text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Collaborative Workspace</span>
      </div>
    </div>
  );
};

export default CollaborationBar;
