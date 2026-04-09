import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/contexts/languageCore';
import warnStyles from '@/components/Warning/Warning.module.scss';

type Props = {
  open: boolean;
  onDismiss: () => void;
  /** Return true if the code was wrong (modal stays open). */
  onSubmitCode: (code: string) => Promise<boolean>;
};

export function LoginTotpModal({ open, onDismiss, onSubmitCode }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setCode('');
      setError('');
    }
    prevOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const runSubmit = useCallback(async () => {
    const digits = code.trim();
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const invalid = await onSubmitCode(digits);
      if (invalid) setError(t('login.invalidTotp'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }, [busy, code, onSubmitCode, t]);

  if (!open || typeof document === 'undefined') return null;

  const modal = (
    <div
      className={warnStyles.backdrop}
      role='alertdialog'
      aria-modal='true'
      aria-labelledby='login-totp-title'
    >
      <div className={warnStyles.panel}>
        <div className={warnStyles.inner}>
          <h2 id='login-totp-title' className={warnStyles.title}>
            {t('login.totpModalTitle')}
          </h2>
          <p className={warnStyles.body} style={{ marginTop: 0 }}>
            {t('login.totpModalBody')}
          </p>
          <input
            ref={inputRef}
            inputMode='numeric'
            autoComplete='one-time-code'
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSubmit();
            }}
            disabled={busy}
            placeholder={t('login.totpLabel')}
            aria-label={t('login.totpLabel')}
            aria-invalid={Boolean(error)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 16,
              border: '1px solid var(--surface-border, rgba(127,127,127,0.35))',
              background: 'transparent',
              color: 'var(--messageMainColor, #fff)',
              fontSize: '1.125rem',
              letterSpacing: '0.2em',
              textAlign: 'center',
            }}
          />
          {error ? (
            <p
              role='alert'
              style={{
                color: '#f87171',
                fontSize: '0.875rem',
                margin: '10px 0 0',
              }}
            >
              {error}
            </p>
          ) : null}
          <div className={warnStyles.actionsRow}>
            <button
              type='button'
              className={warnStyles.dismiss}
              disabled={busy}
              onClick={onDismiss}
            >
              {t('buttons.cancel')}
            </button>
            <button
              type='button'
              className={warnStyles.confirm}
              disabled={busy || code.length !== 6}
              onClick={() => void runSubmit()}
            >
              {busy ? t('login.loggingIn') : t('buttons.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
