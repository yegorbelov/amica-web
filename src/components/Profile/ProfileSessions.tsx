import styles from './Profile.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useState, useCallback } from 'react';
import { useUser } from '@/contexts/UserContextCore';
import { useWarning } from '@/contexts/warning/WarningContextCore';
import { Dropdown } from '../Dropdown/Dropdown';
import { websocketManager } from '@/utils/websocket-manager';
import ProfileTabDescription from './ProfileTabDescription';
import { useWsActiveSessions } from './useWsActiveSessions';
import Button from '../ui/button/Button';
import { isPcSessionFormFactor } from '@/utils/sessionFormFactor';
import pcSessionImg from '@/assets/images/sessions/pc.webp';
import phoneSessionImg from '@/assets/images/sessions/phone.webp';

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
  const [sessionLifetime, setSessionLifetime] = useState<number>(
    user?.preferred_session_lifetime_days || 0,
  );
  const { showWarning } = useWarning();

  const onSessionLifetimeUpdated = useCallback(
    (days: number) => {
      setSessionLifetime(days);
      if (user) setUser({ ...user, preferred_session_lifetime_days: days });
    },
    [user, setUser],
  );

  const { sessions, loading, error } = useWsActiveSessions({
    onSessionLifetimeUpdated,
  });

  const updateSessionLifetime = async (value: number) => {
    setSessionLifetime(value);
    if (user) setUser({ ...user, preferred_session_lifetime_days: value });

    websocketManager.sendMessage({
      type: 'set_session_lifetime',
      days: value,
    });
  };

  const revokeSession = useCallback((jti: string) => {
    websocketManager.sendMessage({
      type: 'revoke_session',
      jti,
    });
  }, []);

  const sendRevokeOtherSessions = useCallback(() => {
    websocketManager.sendMessage({ type: 'revoke_other_sessions' });
  }, []);

  const confirmRevokeOtherSessions = useCallback(() => {
    showWarning({
      title: t('sessions.terminateOthersConfirmTitle'),
      body: (
        <p style={{ margin: 0, lineHeight: 1.45 }}>
          {t('sessions.terminateOthersConfirmBody')}
        </p>
      ),
      dismissLabel: t('buttons.cancel'),
      confirmLabel: t('sessions.terminate'),
      onConfirm: sendRevokeOtherSessions,
    });
  }, [sendRevokeOtherSessions, showWarning, t]);

  const openSessionDetails = useCallback(
    (session: (typeof sessions)[number]) => {
      const location =
        [session.city, session.country].filter(Boolean).join(', ') || 'Unknown';
      const sessionImg = isPcSessionFormFactor(session)
        ? pcSessionImg
        : phoneSessionImg;
      showWarning({
        title: session.device,
        body: (
          <div className={styles.warning__info}>
            <div className={styles.warning__sessionIllustration} aria-hidden>
              <img src={sessionImg} alt='' />
            </div>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.device')}
              </span>
              <span className={styles.subInfoValue}>{session.device}</span>
            </p>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.ipAddress')}
              </span>
              <span className={styles.subInfoValue}>{session.ip_address}</span>
            </p>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.location')}
              </span>
              <span className={styles.subInfoValue}>{location}</span>
            </p>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.created')}
              </span>
              <span className={styles.subInfoValue}>
                {formatDate(session.created_at)}
              </span>
            </p>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.expires')}
              </span>
              <span className={styles.subInfoValue}>
                {formatDate(session.expires_at)}
              </span>
            </p>
            <p className={styles['warning__info-item']}>
              <span className={styles.subInfoLabel}>
                {t('sessions.lastActive')}
              </span>
              <span className={styles.subInfoValue}>
                {formatDate(session.last_active)}
              </span>
            </p>
          </div>
        ),
        dismissLabel: t('buttons.close'),
        ...(session.is_current
          ? {
              confirmLabel: t('buttons.ok'),
              onConfirm: () => {},
            }
          : !session.is_current
            ? {
                confirmLabel: t('sessions.terminate'),
                onConfirm: () => revokeSession(session.jti),
              }
            : {}),
      });
    },
    [formatDate, revokeSession, showWarning, t],
  );

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
        backgroundColor='#020202'
      />
      {error && <div className={styles.error}>⚠️ {error}</div>}
      <div className={styles['options-group']}>
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
        </div>

        {sessions.length === 0 ? (
          <p>{t('sessions.noSessions')}</p>
        ) : (
          <div className={styles.sessionsList}>
            {sessions.map((session) => (
              <div key={session.jti} className={styles.sessionItem}>
                <div
                  className={`${styles.sessionPreviewBtn} ${
                    session.is_current ? styles.currentSession : ''
                  }`}
                  onClick={() => openSessionDetails(session)}
                >
                  {session.is_current ? (
                    <div className={styles.sessionLabels}>
                      <span className={styles.currentLabel}>
                        {t('sessions.thisDevice')}
                      </span>
                    </div>
                  ) : null}
                  <span className={styles.device}>{session.device}</span>
                  {(session.city || session.country) && (
                    <span className={styles.subInfo}>
                      {[session.city, session.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                  <span className={styles.subInfo}>
                    {t('sessions.lastActive')} {formatDate(session.last_active)}
                  </span>
                </div>
                {session.is_current && sessions.length > 1 ? (
                  <Button
                    className={styles.revokeBtn}
                    onClick={() => confirmRevokeOtherSessions()}
                  >
                    {t('sessions.terminateOthers')}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
