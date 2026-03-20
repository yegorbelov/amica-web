import styles from './Profile.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/utils/apiFetch';
import { useUser } from '@/contexts/UserContextCore';
import { Dropdown } from '../Dropdown/Dropdown';
import {
  websocketManager,
  type WebSocketMessage,
} from '@/utils/websocket-manager';
import type { Session } from '@/types';
import ProfileTabDescription from './ProfileTabDescription';
import Button from '../ui/button/Button';

const SESSION_LIFETIME_KEYS: Record<number, string> = {
  7: 'sessions.week',
  14: 'sessions.weeks2',
  30: 'sessions.month',
  60: 'sessions.months2',
  90: 'sessions.months3',
  180: 'sessions.months6',
};

export default function ProfileSessions() {
  const { t, locale } = useTranslation();
  const intlLocale = locale === 'ua' ? 'uk' : locale;

  const formatDate = useCallback(
    (value: string) =>
      new Date(value).toLocaleString(intlLocale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [intlLocale],
  );

  const sessionLifetimeOptions = [
    { value: 7 },
    { value: 14 },
    { value: 30 },
    { value: 60 },
    { value: 90 },
    { value: 180 },
  ];
  const { user, setUser } = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionLifetime, setSessionLifetime] = useState<number>(
    user?.preferred_session_lifetime_days || 0,
  );
  const [savingLifetime, setSavingLifetime] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/active-sessions/');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Session[] = await res.json();
      setSessions(data.sort((a) => (a.is_current ? -1 : 1)));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(t('sessions.loadError'));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleWSMessage = useCallback(
    (data: WebSocketMessage) => {
      if (!data.type) return;
      switch (data.type) {
        case 'session_created':
          setSessions((prev) => [
            ...prev.filter((s) => s.jti !== data.session.jti),
            data.session,
          ]);
          break;
        case 'session_updated':
          setSessions((prev) =>
            prev.map((s) => (s.jti === data.session.jti ? data.session : s)),
          );
          break;
        case 'session_deleted':
          setSessions((prev) => prev.filter((s) => s.jti !== data.session.jti));
          break;
        case 'session_lifetime_updated':
          setSessionLifetime(data.days);
          if (user)
            setUser({ ...user, preferred_session_lifetime_days: data.days });
          break;
      }
    },
    [user, setUser],
  );

  useEffect(() => {
    websocketManager.on('message', handleWSMessage);
    if (!websocketManager.isConnected()) {
      websocketManager.connect();
    }
    return () => websocketManager.off('message', handleWSMessage);
  }, [handleWSMessage]);

  useEffect(() => {
    loadSessions();
    // const interval = setInterval(loadSessions, 30_000);
    // return () => clearInterval(interval);
  }, [loadSessions]);

  const updateSessionLifetime = async (value: number) => {
    setSavingLifetime(true);
    setSessionLifetime(value);
    if (user) setUser({ ...user, preferred_session_lifetime_days: value });

    websocketManager.sendMessage({
      type: 'set_session_lifetime',
      days: value,
    });

    setSavingLifetime(false);
  };

  const revokeSession = async (jti: string) => {
    try {
      const res = await apiFetch(`/api/active-sessions/${jti}/`, {
        method: 'DELETE',
      });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.jti !== jti));
    } catch (err) {
      console.error('Failed to revoke session', err);
    }
  };

  const revokeOtherSessions = async () => {
    try {
      await apiFetch('/api/active-sessions/others/', { method: 'DELETE' });
      loadSessions();
    } catch (err) {
      console.error('Failed to revoke other sessions', err);
    }
  };
  if (loading) {
    return (
      <div className={styles.section}>
        <h3>{t('sessions.title')}</h3>
        <p>{t('sessions.loading')}</p>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <ProfileTabDescription
        title={t('sessions.title')}
        description={t('sessions.description')}
        iconName='Sessions'
        backgroundColor='#ff6600'
      />
      {error && <div className={styles.error}>⚠️ {error}</div>}
      <div className={styles.sessionLifetime}>
        <label>{t('sessions.sessionLifetime')} </label>
        {user && (
          <Dropdown
            items={sessionLifetimeOptions.map((opt) => ({
              label: t(SESSION_LIFETIME_KEYS[opt.value] ?? 'sessions.week'),
              value: opt.value,
            }))}
            value={sessionLifetime}
            onChange={updateSessionLifetime}
            placeholder={t('sessions.selectLifetime')}
            buttonStyles={styles.sessionLifetimeDropdown}
          />
        )}
        {savingLifetime && <span>{t('sessions.saving')}</span>}
      </div>

      {sessions.length === 0 ? (
        <p>{t('sessions.noSessions')}</p>
      ) : (
        <div className={styles.sessionsList}>
          {sessions.map((session) => (
            <div key={session.jti} className={styles.sessionItem}>
              <span>
                {session.is_current && (
                  <span className={styles.currentLabel}>
                    {t('sessions.thisDevice')}
                  </span>
                )}
              </span>

              <div
                className={`${styles.sessionInfo} ${
                  session.is_current ? styles.currentSession : ''
                }`}
              >
                <span className={styles.device}>{session.device}</span>

                <span className={styles.subInfo}>
                  {t('sessions.ipAddress')} {session.ip_address}
                </span>

                <span className={styles.subInfo}>
                  {session.city ? `${session.city}, ` : ''}
                  {session.country ? session.country : ''}
                </span>

                <span className={styles.subInfo}>
                  {t('sessions.created')} {formatDate(session.created_at)}
                </span>

                <span className={styles.subInfo}>
                  {t('sessions.expires')} {formatDate(session.expires_at)}
                </span>

                <span className={styles.subInfo}>
                  {t('sessions.lastActive')} {formatDate(session.last_active)}
                </span>
              </div>

              {!session.is_current && (
                <Button
                  className={styles.revokeBtn}
                  onClick={() => revokeSession(session.jti)}
                >
                  {t('sessions.terminate')}
                </Button>
              )}
              {session.is_current && sessions.length > 1 && (
                <Button
                  className={`${styles.revokeBtn} ${styles.revokeAllBtn}`}
                  onClick={revokeOtherSessions}
                >
                  {t('sessions.terminateOthers')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
