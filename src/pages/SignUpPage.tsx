import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContextCore';
import { useTranslation } from '@/contexts/languageCore';
import { Icon } from '@/components/Icons/AutoIcons';
import styles from './LoginPage.module.scss';
import Button from '@/components/ui/button/Button';

interface SignUpPageProps {
  onShowLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onShowLogin }) => {
  const { t } = useTranslation();
  const { signupWithCredentials, ingestSuccessfulAuthPayload } = useUser();
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmailSent, setVerifyEmailSent] = useState<string | null>(null);
  const [verifyOtpId, setVerifyOtpId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const stateKey =
        name === 'profile_name'
          ? 'username'
          : name === 'profile_email'
            ? 'email'
            : name;
      const next = stateKey === 'email' ? value.trim().toLowerCase() : value;
      setForm((prev) => ({ ...prev, [stateKey]: next }));
      if (error) setError(null);
    },
    [error],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setVerifyEmailSent(null);
      setVerifyOtpId(null);
      setOtpCode('');

      try {
        const result = await signupWithCredentials(
          form.username,
          form.email,
          form.password,
        );
        if (result.needsEmailVerification) {
          setVerifyEmailSent(result.email ?? form.email);
          setVerifyOtpId(result.emailVerificationOtpId ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [form, signupWithCredentials],
  );

  const handleKeyPress = useCallback(
    (
      e: React.KeyboardEvent,
      nextRef?: React.RefObject<HTMLInputElement | null>,
    ) => {
      if (e.key === 'Enter') {
        if (nextRef?.current) {
          nextRef.current.focus();
        }
      }
    },
    [],
  );

  const handleLoginClick = useCallback(() => onShowLogin(), [onShowLogin]);

  const handleVerifyOtp = useCallback(async () => {
    const digits = otpCode.replace(/\D/g, '');
    if (digits.length !== 6) return;
    if (!verifyOtpId) {
      setError(t('signUp.missingOtpId'));
      return;
    }
    setOtpSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/verify-email-otp/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp_id: verifyOtpId,
          code: digits,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(String(data.error || 'Verification failed'));
        return;
      }
      ingestSuccessfulAuthPayload(data, 'Verification failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setOtpSubmitting(false);
    }
  }, [verifyOtpId, otpCode, t, ingestSuccessfulAuthPayload]);

  return (
    <div className={styles['login-wrapper']}>
      <div className={styles['login-top-fill']} />
      <form
        className={styles['login-form']}
        onSubmit={handleSubmit}
        noValidate
        autoComplete='off'
      >
        <Button
          aria-label={t('login.backToLogin')}
          onClick={handleLoginClick}
          className={styles['form-back']}
        >
          <Icon
            name='Arrow'
            style={{ transform: 'rotate(180deg)', height: 24, width: 24 }}
          />
        </Button>
        <h4 className={styles['login-title']}>
          {verifyEmailSent ? t('signUp.signUpDoneTitle') : t('signUp.title')}
        </h4>
        {verifyEmailSent ? (
          <>
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 14,
                lineHeight: 1.45,
                opacity: 0.9,
              }}
              role='status'
            >
              {t('signUp.checkEmail')} <strong>{verifyEmailSent}</strong>
            </p>
            <fieldset className={styles['form']}>
              <input
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                maxLength={8}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={otpSubmitting}
                placeholder={t('signUp.otpPlaceholder')}
                aria-label={t('signUp.otpPlaceholder')}
              />
            </fieldset>
            {error && verifyEmailSent ? (
              <div style={{ color: 'red', margin: '8px 0 0', fontSize: 14 }}>
                {error}
              </div>
            ) : null}
            <button
              type='button'
              className={styles['next-button']}
              disabled={
                otpSubmitting || otpCode.replace(/\D/g, '').length !== 6
              }
              onClick={() => void handleVerifyOtp()}
            >
              {otpSubmitting ? '…' : t('signUp.verifyCode')}
            </button>
          </>
        ) : null}

        <fieldset className={styles['form']} hidden={!!verifyEmailSent}>
          <input
            ref={emailRef}
            name='profile_email'
            type='email'
            value={form.email}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyPress(e, passwordRef)}
            disabled={loading || !!verifyEmailSent}
            autoComplete='off'
            data-1p-ignore
            data-lpignore='true'
            spellCheck={false}
            inputMode='email'
            autoCapitalize='none'
            aria-autocomplete='none'
            role='textbox'
            required
            placeholder={t('signUp.email')}
          />
        </fieldset>
        <fieldset className={styles['form']} hidden={!!verifyEmailSent}>
          <input
            ref={passwordRef}
            name='password'
            type='password'
            value={form.password}
            onChange={handleChange}
            disabled={loading || !!verifyEmailSent}
            autoComplete='new-password'
            data-1p-ignore
            data-lpignore='true'
            spellCheck={false}
            aria-autocomplete='none'
            role='textbox'
            required
            placeholder={t('signUp.password')}
          />
        </fieldset>
        {error && !verifyEmailSent ? (
          <div style={{ color: 'red', margin: '8px 0' }}>{error}</div>
        ) : null}
        <button
          type='submit'
          className={styles['next-button']}
          style={{
            display: verifyEmailSent ? 'none' : undefined,
          }}
          disabled={
            loading || !!verifyEmailSent || !form.email || !form.password
          }
        >
          {loading ? t('signUp.creatingAccount') : t('signUp.title')}
        </button>
        <div className={styles['need-account']}>
          <span>{t('signUp.alreadyHaveAccount')}</span>
          <a onClick={handleLoginClick}>{t('signUp.logIn')}</a>
        </div>
      </form>
      <div className={styles['login-bottom-fill']} />
    </div>
  );
};

export default React.memo(SignUpPage);
