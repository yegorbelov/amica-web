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
  const { signupWithCredentials } = useUser();
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
      setForm((prev) => ({ ...prev, [stateKey]: value }));
      if (error) setError(null);
    },
    [error],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        await signupWithCredentials(form.username, form.email, form.password);
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
        <h4 className={styles['login-title']}>{t('signUp.title')}</h4>
        <fieldset className={styles['form']}>
          {/* <legend className={styles['form-label']}>Username</legend> */}
          {/* <legend className={styles['form-label-placeholder']}>Username</legend> */}
          <input
            ref={usernameRef}
            name='profile_name'
            value={form.username}
            onChange={handleChange}
            onKeyPress={(e) => handleKeyPress(e, emailRef)}
            disabled={loading}
            autoComplete='off'
            data-1p-ignore
            data-lpignore='true'
            spellCheck={false}
            inputMode='text'
            aria-autocomplete='none'
            role='textbox'
            required
            placeholder={t('signUp.username')}
          />
        </fieldset>
        <fieldset className={styles['form']}>
          {/* <legend className={styles['form-label']}>Email</legend> */}
          {/* <legend className={styles['form-label-placeholder']}>Email</legend> */}
          <input
            ref={emailRef}
            name='profile_email'
            type='email'
            value={form.email}
            onChange={handleChange}
            onKeyPress={(e) => handleKeyPress(e, passwordRef)}
            disabled={loading}
            autoComplete='off'
            data-1p-ignore
            data-lpignore='true'
            spellCheck={false}
            inputMode='email'
            aria-autocomplete='none'
            role='textbox'
            required
            placeholder={t('signUp.email')}
          />
        </fieldset>
        <fieldset className={styles['form']}>
          {/* <legend className={styles['form-label']}>Password</legend> */}
          {/* <legend className={styles['form-label-placeholder']}>Password</legend> */}
          <input
            ref={passwordRef}
            name='password'
            type='password'
            value={form.password}
            onChange={handleChange}
            disabled={loading}
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
        {error && <div style={{ color: 'red', margin: '8px 0' }}>{error}</div>}
        <button
          type='submit'
          className={styles['next-button']}
          disabled={loading || !form.username || !form.email || !form.password}
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
