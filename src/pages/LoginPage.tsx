import React, { useState, useEffect, useRef, useCallback } from 'react';
import GoogleLoginButton from '../components/GoogleLoginButton/GoogleLoginButton';
import { PasskeyLoginButton } from '../components/PasskeyButton/PasskeyLoginButton';
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

const LoginPage: React.FC<LoginPageProps> = ({ onShowSignup }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { loginWithPassword, loading } = useUser();

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (error) setError('');
    },
    [error],
  );

  const handleLogin = useCallback(async () => {
    try {
      await loginWithPassword(formData.username, formData.password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }, [formData.username, formData.password, loginWithPassword]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleLogin();
    },
    [handleLogin],
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.currentTarget === passwordRef.current) handleLogin();
        else if (e.currentTarget === usernameRef.current)
          passwordRef.current?.focus();
      }
    },
    [handleLogin],
  );

  const handleSignUp = useCallback(() => onShowSignup(), [onShowSignup]);

  return (
    <div className={styles['login-wrapper']}>
      <div className={styles['login-top-fill']} />
      <form className={styles['login-form']} onSubmit={handleSubmit} noValidate>
        <img
          src='Images/512-transparent.png'
          alt='Amica'
          className={styles['login-logo']}
        />
        <h4 className={styles['login-title']}>{t('login.signIn')}</h4>

        <fieldset className={styles['form']}>
          {/* <legend className={styles['form-label']}>Email</legend> */}
          <input
            ref={usernameRef}
            name='username'
            value={formData.username}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={loading}
            autoComplete='email'
            required
            placeholder={t('login.email')}
          />
        </fieldset>
        <fieldset className={styles['form']}>
          {/* <legend className={styles['form-label']}>Password</legend> */}
          <input
            ref={passwordRef}
            type='password'
            name='password'
            value={formData.password}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={loading}
            autoComplete='current-password'
            required
            placeholder={t('login.password')}
          />
        </fieldset>
        {error && <div style={{ color: 'red', margin: '8px 0' }}>{error}</div>}
        <button
          type='submit'
          className={styles['next-button']}
          disabled={loading || !formData.username || !formData.password}
        >
          {loading ? t('login.loggingIn') : t('buttons.next')}
        </button>
        <GoogleLoginButton className={styles['google-login-button']} />
        <PasskeyLoginButton styles={styles} />
        <div className={styles['need-account']}>
          <span>{t('login.needAccount')}</span>
          <a onClick={handleSignUp}>{t('login.signUp')}</a>
        </div>
      </form>
      <div className={styles['login-bottom-fill']} />
    </div>
  );
};

export default React.memo(LoginPage);
