import React, { useState, useEffect, useRef, useCallback } from 'react';
import GoogleLoginButton from '../components/GoogleLoginButton/GoogleLoginButton';
import { PasskeyLoginButton } from '../components/PasskeyButton/PasskeyLoginButton';
import { LoginTotpModal } from '@/components/Login/LoginTotpModal';
import { useUser } from '../contexts/UserContextCore';
import { useTranslation } from '@/contexts/languageCore';
import styles from './LoginPage.module.scss';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginPageProps {
  onShowSignup: () => void;
}

/** Match Django's normalize_email: lowercase domain only (local part unchanged). */
function normalizeLoginIdentifier(value: string): string {
  const t = value.trim();
  const at = t.lastIndexOf('@');
  if (at < 0) return t;
  return `${t.slice(0, at + 1)}${t.slice(at + 1).toLowerCase()}`;
}

const LoginPage: React.FC<LoginPageProps> = ({ onShowSignup }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  const [oauthTotp, setOauthTotp] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [oauthTotpBusy, setOauthTotpBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [emailVerifiedNotice] = useState(() => {
    try {
      return (
        new URLSearchParams(window.location.search).get('verified') === '1'
      );
    } catch {
      return false;
    }
  });
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const {
    loginWithPassword,
    loading,
    error: contextError,
    dismissAuthError,
    pendingTotpSecondFactor,
    submitTotpSecondFactor,
    dismissPendingTotpSecondFactor,
    passwordLoginNeedsTotp,
    dismissPasswordLoginTotp,
  } = useUser();

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!emailVerifiedNotice) return;
    try {
      const path = window.location.pathname || '/';
      window.history.replaceState({}, '', path);
    } catch {
      /* ignore */
    }
  }, [emailVerifiedNotice]);

  useEffect(() => {
    if (!pendingTotpSecondFactor) setOauthTotp('');
  }, [pendingTotpSecondFactor]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      if (name === 'username' || name === 'password') {
        dismissPasswordLoginTotp();
      }
      const next =
        name === 'password' ? value : normalizeLoginIdentifier(value);

      setFormData((prev) => ({
        ...prev,
        [name]: next,
      }));

      if (error) setError('');
      if (contextError) dismissAuthError();
    },
    [error, contextError, dismissAuthError, dismissPasswordLoginTotp],
  );

  const handleLogin = useCallback(async () => {
    setLoginBusy(true);
    try {
      await loginWithPassword(formData.username, formData.password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoginBusy(false);
    }
  }, [formData.username, formData.password, loginWithPassword]);

  const handleTotpModalSubmit = useCallback(
    async (code: string) => {
      const r = await loginWithPassword(
        formData.username,
        formData.password,
        undefined,
        code,
      );
      return r === 'invalid_totp';
    },
    [formData.username, formData.password, loginWithPassword],
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.currentTarget === usernameRef.current) {
        passwordRef.current?.focus();
        return;
      }
      if (e.currentTarget === passwordRef.current) void handleLogin();
    },
    [handleLogin],
  );

  const handleSignUp = useCallback(() => onShowSignup(), [onShowSignup]);

  const formDisabled = loading || loginBusy;
  const oauthBusy = loading || oauthTotpBusy;

  return (
    <div className={styles['login-wrapper']}>
      <div className={styles['login-top-fill']} />
      <div className={styles['login-form']}>
        <h4 className={styles['login-title']}>{t('login.signIn')}</h4>
        {emailVerifiedNotice ? (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(34,197,94,0.15)',
              color: 'var(--color-text-primary, #fff)',
              fontSize: 14,
              lineHeight: 1.4,
            }}
            role='status'
          >
            {t('login.emailVerifiedBanner')}
          </div>
        ) : null}

        <fieldset className={styles['form']}>
          <input
            ref={usernameRef}
            name='username'
            value={formData.username}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={formDisabled}
            autoComplete='email'
            required
            placeholder={t('login.email')}
            inputMode='email'
          />
        </fieldset>
        <fieldset className={styles['form']}>
          <input
            ref={passwordRef}
            type='password'
            name='password'
            value={formData.password}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={formDisabled}
            autoComplete='current-password'
            required
            placeholder={t('login.password')}
          />
        </fieldset>
        {(error || contextError) && (
          <div style={{ color: 'red', margin: '8px 0' }}>
            {error || contextError}
          </div>
        )}
        <button
          type='button'
          className={styles['next-button']}
          disabled={
            formDisabled || !formData.username || !formData.password
          }
          onClick={() => void handleLogin()}
        >
          {loginBusy ? t('login.loggingIn') : t('buttons.next')}
        </button>

        {pendingTotpSecondFactor ? (
          <div
            style={{
              marginTop: 16,
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.45 }}>
              {t('login.totpOAuthHint')}
            </p>
            <input
              inputMode='numeric'
              autoComplete='one-time-code'
              value={oauthTotp}
              onChange={(e) =>
                setOauthTotp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              disabled={oauthBusy}
              placeholder={t('login.totpLabel')}
              aria-label={t('login.totpLabel')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                marginBottom: 10,
                borderRadius: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type='button'
                className={styles['next-button']}
                disabled={oauthBusy || oauthTotp.length !== 6}
                onClick={() => {
                  setOauthTotpBusy(true);
                  void submitTotpSecondFactor(oauthTotp).finally(() =>
                    setOauthTotpBusy(false),
                  );
                }}
              >
                {oauthTotpBusy ? t('login.loggingIn') : t('login.totpContinueOAuth')}
              </button>
              <button
                type='button'
                disabled={oauthBusy}
                onClick={() => {
                  dismissPendingTotpSecondFactor();
                  setOauthTotp('');
                }}
              >
                {t('buttons.cancel')}
              </button>
            </div>
          </div>
        ) : null}

        <GoogleLoginButton className={styles['google-login-button']} />
        <PasskeyLoginButton styles={styles} />
        <div className={styles['need-account']}>
          <span>{t('login.needAccount')}</span>
          <a onClick={handleSignUp}>{t('login.signUp')}</a>
        </div>
      </div>
      <div className={styles['login-bottom-fill']} />

      <LoginTotpModal
        open={passwordLoginNeedsTotp}
        onDismiss={dismissPasswordLoginTotp}
        onSubmitCode={handleTotpModalSubmit}
      />
    </div>
  );
};

export default React.memo(LoginPage);
