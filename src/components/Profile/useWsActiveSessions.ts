import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/contexts/languageCore';
import {
  websocketManager,
  type WebSocketMessage,
} from '@/utils/websocket-manager';
import type { Session } from '@/types';

const SESSIONS_LOAD_TIMEOUT_MS = 20_000;

export type UseWsActiveSessionsOptions = {
  onSessionLifetimeUpdated?: (days: number) => void;
};

export function useWsActiveSessions(options?: UseWsActiveSessionsOptions) {
  const { t } = useTranslation();
  const onLifetimeRef = useRef(options?.onSessionLifetimeUpdated);
  onLifetimeRef.current = options?.onSessionLifetimeUpdated;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionsRequestIdRef = useRef(0);
  const loadSessionsTimeoutRef = useRef<number | null>(null);

  const clearLoadSessionsTimeout = useCallback(() => {
    if (loadSessionsTimeoutRef.current != null) {
      window.clearTimeout(loadSessionsTimeoutRef.current);
      loadSessionsTimeoutRef.current = null;
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await websocketManager.connect();
      await websocketManager.waitForConnection();

      const requestId = ++sessionsRequestIdRef.current;
      clearLoadSessionsTimeout();
      loadSessionsTimeoutRef.current = window.setTimeout(() => {
        loadSessionsTimeoutRef.current = null;
        if (sessionsRequestIdRef.current === requestId) {
          setLoading(false);
          setError(t('sessions.loadError'));
          setSessions([]);
        }
      }, SESSIONS_LOAD_TIMEOUT_MS);

      const sent = websocketManager.sendMessage({
        type: 'get_active_sessions',
        request_id: requestId,
      });
      if (!sent) {
        clearLoadSessionsTimeout();
        throw new Error('WebSocket not ready');
      }
    } catch (err) {
      console.error(err);
      clearLoadSessionsTimeout();
      setError(t('sessions.loadError'));
      setSessions([]);
      setLoading(false);
    }
  }, [t, clearLoadSessionsTimeout]);

  const handleWSMessage = useCallback(
    (data: WebSocketMessage) => {
      if (!data.type) return;
      switch (data.type) {
        case 'active_sessions': {
          if (data.request_id !== sessionsRequestIdRef.current) return;
          clearLoadSessionsTimeout();
          const list = (data.sessions ?? []) as Session[];
          setSessions(list.sort((a) => (a.is_current ? -1 : 1)));
          setError(null);
          setLoading(false);
          break;
        }
        case 'error':
          if (
            data.code === 'active_sessions' &&
            data.request_id === sessionsRequestIdRef.current
          ) {
            clearLoadSessionsTimeout();
            setError(t('sessions.loadError'));
            setSessions([]);
            setLoading(false);
          }
          break;
        case 'session_created': {
          const sess = data.session;
          if (!sess?.jti) break;
          setSessions((prev) => [
            ...prev.filter((s) => s.jti !== sess.jti),
            sess as Session,
          ]);
          break;
        }
        case 'session_updated': {
          const sess = data.session;
          if (!sess?.jti) break;
          setSessions((prev) =>
            prev.map((s) => (s.jti === sess.jti ? (sess as Session) : s)),
          );
          break;
        }
        case 'session_deleted': {
          const jti = data.session?.jti;
          if (!jti) break;
          setSessions((prev) => prev.filter((s) => s.jti !== jti));
          break;
        }
        case 'session_lifetime_updated':
          onLifetimeRef.current?.(data.days!);
          break;
      }
    },
    [t, clearLoadSessionsTimeout],
  );

  useEffect(() => {
    websocketManager.on('message', handleWSMessage);
    if (!websocketManager.isConnected()) {
      websocketManager.connect();
    }
    return () => {
      websocketManager.off('message', handleWSMessage);
      clearLoadSessionsTimeout();
    };
  }, [handleWSMessage, clearLoadSessionsTimeout]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return { sessions, loading, error, loadSessions };
}
