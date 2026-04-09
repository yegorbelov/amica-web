import styles from './Profile.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useCallback, useMemo } from 'react';
import { useUser } from '@/contexts/UserContextCore';
import { websocketManager } from '@/utils/websocket-manager';
import ProfileTabDescription from './ProfileTabDescription';
import Button from '../ui/button/Button';
import { useWsActiveSessions } from './useWsActiveSessions';

export default function ProfileTrustedDevices() {
  const { t, locale } = useTranslation();
  const intlLocale = locale === 'ua' ? 'uk' : locale;
  const { user } = useUser();

  const formatDate = useCallback(
    (value: string) =>
      new Date(value).toLocaleString(intlLocale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [intlLocale],
  );

  const { sessions, loading, error } = useWsActiveSessions();

  const trustedSessions = useMemo(
    () => sessions.filter((s) => s.is_trusted),
    [sessions],
  );

  const revokeSession = (jti: string) => {
    websocketManager.sendMessage({
      type: 'revoke_session',
      jti,
    });
  };

  const revokeOtherTrusted = () => {
    const others = trustedSessions.filter((s) => !s.is_current);
    for (const s of others) {
      websocketManager.sendMessage({ type: 'revoke_session', jti: s.jti });
    }
  };

  return (
    <div className={styles.backupCodesBlock}>
      <ProfileTabDescription
        title={t('profile.trustedSessionsTitle')}
        description={t('profile.trustedSessionsDescription')}
      />
      {loading ? (
        <p className={styles.backupCodesDescription}>{t('sessions.loading')}</p>
      ) : null}
      {!loading && error ? (
        <div className={styles.error}>⚠️ {error}</div>
      ) : null}
      {!loading && !error ? (
        !user?.has_trusted_device ? (
          <p className={styles.backupCodesDescription}>
            {t('profile.trustedSessionsNotSet')}
          </p>
        ) : trustedSessions.length === 0 ? (
          <p className={styles.backupCodesDescription}>
            {t('profile.trustedSessionsEmpty')}
          </p>
        ) : (
          <>
            <div className={styles.sessionsList}>
              {trustedSessions.map((session) => (
                <div key={session.jti} className={styles.sessionItem}>
                  <div className={styles.sessionLabels}>
                    {session.is_current ? (
                      <span className={styles.currentLabel}>
                        {t('sessions.thisDevice')}
                      </span>
                    ) : null}
                    <span className={styles.trustedBadge}>
                      {t('sessions.trustedDeviceBadge')}
                    </span>
                  </div>

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
                      {t('sessions.lastActive')}{' '}
                      {formatDate(session.last_active)}
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
                </div>
              ))}
            </div>
            {trustedSessions.length > 1 &&
              trustedSessions.some((s) => !s.is_current) && (
                <Button
                  className={`${styles.revokeBtn} ${styles.revokeAllBtn}`}
                  onClick={revokeOtherTrusted}
                >
                  {t('profile.trustedSessionsTerminateOthers')}
                </Button>
              )}
          </>
        )
      ) : null}
    </div>
  );
}
