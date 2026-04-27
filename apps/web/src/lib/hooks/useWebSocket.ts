// src/lib/hooks/useWebSocket.ts
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

type EventHandler = (data: any) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3000';

let socket: Socket | null = null;

export function useWebSocket() {
  const { data: session } = useSession();
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  useEffect(() => {
    const token = (session as any)?.accessToken;
    if (!token || socket?.connected) return;

    socket = io(WS_URL, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[WS] Conectado:', socket?.id);
    });

    // Registrar handlers globais
    const events = ['occurrence:created', 'occurrence:updated', 'alert:new', 'alert:cancelled'];
    events.forEach(event => {
      socket!.on(event, (data: any) => {
        const handlers = handlersRef.current.get(event);
        handlers?.forEach(h => h(data));
      });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [(session as any)?.accessToken]);

  const on = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const joinRegion = useCallback((regionCode: string) => {
    socket?.emit('join:region', { regionCode });
  }, []);

  const leaveRegion = useCallback((regionCode: string) => {
    socket?.emit('leave:region', { regionCode });
  }, []);

  const isConnected = socket?.connected ?? false;

  return { on, joinRegion, leaveRegion, isConnected };
}
