import React, { useCallback, useState } from 'react';
import { useTranslation, tSync } from '@/contexts/languageCore';
import warningStyles from '@/components/Warning/Warning.module.scss';
import styles from './DeviceLoginFlows.module.scss';

/** Trusted device: sign-in attempt — browser/OS with versions, IP, approximate location. */
export function TrustedDeviceLoginRequestBody({
  device,
  requestIp,
  requestCity,
  requestCountry,
}: {
  device: string;
  requestIp?: string;
  requestCity?: string;
  requestCountry?: string;
}) {
  const loc = [requestCity, requestCountry].filter(Boolean).join(', ');
  const hasMeta = Boolean(device || requestIp || loc);
  return (
    <>
      <p style={{ margin: '0 0 12px', lineHeight: 1.45 }}>
        {tSync('login.trustedDeviceRequestIntro')}
      </p>
      {hasMeta ? (
        <div className={warningStyles.meta}>
          {device ? (
            <span className={warningStyles.deviceLine}>{device}</span>
          ) : null}
          {requestIp ? (
            <span className={warningStyles.subInfo}>
              {tSync('login.trustedDeviceIpLabel')}: {requestIp}
            </span>
          ) : null}
          {loc ? (
            <span className={warningStyles.subInfo}>
              {tSync('login.trustedDeviceLocationLabel')}: {loc}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function TrustedDeviceLoginWarningBody({
  code,
  device,
  requestIp,
  requestCity,
  requestCountry,
}: {
  code: string;
  device: string;
  requestIp?: string;
  requestCity?: string;
  requestCountry?: string;
}) {
  const loc = [requestCity, requestCountry].filter(Boolean).join(', ');
  const hasMeta = Boolean(device || requestIp || loc);
  return (
    <>
      <p style={{ margin: '0 0 8px' }}>
        {tSync('login.trustedDeviceWarningIntro')}
      </p>
      <div className={warningStyles.codeBlock}>{code}</div>
      {hasMeta ? (
        <div className={warningStyles.meta}>
          {device ? (
            <span className={warningStyles.deviceLine}>{device}</span>
          ) : null}
          {requestIp ? (
            <span className={warningStyles.subInfo}>
              {tSync('login.trustedDeviceIpLabel')}: {requestIp}
            </span>
          ) : null}
          {loc ? (
            <span className={warningStyles.subInfo}>
              {tSync('login.trustedDeviceLocationLabel')}: {loc}
            </span>
          ) : null}
        </div>
      ) : null}
      <p style={{ margin: '12px 0 0', fontSize: '0.875rem' }}>
        {tSync('login.trustedDeviceWarningFoot')}
      </p>
    </>
  );
}

export function DeviceLoginPendingOverlay({
  trustedDeviceLabel,
  onCancel,
  onSubmitOtp,
  otpBusy,
  otpError,
  onSubmitBackupCode,
  backupCodeBusy,
  backupCodeError,
}: {
  /** Trusted session’s browser/OS (no versions), from server; empty if unknown. */
  trustedDeviceLabel?: string;
  onCancel: () => void;
  onSubmitOtp: (sixDigits: string) => void | Promise<void>;
  otpBusy?: boolean;
  otpError?: string | null;
  onSubmitBackupCode?: (rawCode: string) => void | Promise<void>;
  backupCodeBusy?: boolean;
  backupCodeError?: string | null;
}) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [backupInput, setBackupInput] = useState('');
  const [showBackupRecovery, setShowBackupRecovery] = useState(false);
  /** Safari: read-only until first focus so Keychain does not attach “use saved login” to this field. */
  const [otpAutofillGuard, setOtpAutofillGuard] = useState(true);

  const submitOtp = useCallback(() => {
    const d = otp.replace(/\D/g, '');
    if (d.length !== 6) return;
    void onSubmitOtp(d);
  }, [otp, onSubmitOtp]);

  const submitBackup = useCallback(() => {
    const raw = backupInput.trim();
    if (!raw || !onSubmitBackupCode) return;
    void onSubmitBackupCode(raw);
  }, [backupInput, onSubmitBackupCode]);

  const otpOk = otp.replace(/\D/g, '').length === 6;

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-live='polite'
    >
      <div className={styles.modal}>
        <div className={styles.body}>
          <h2 className={styles.title}>{t('login.deviceLoginTitle')}</h2>
          <p className={styles.hint}>
            {t('login.deviceLoginTrustedWhereHint')}
          </p>
          <div className={styles.requestDeviceBlock}>
            {trustedDeviceLabel ? (
              <>
                <p className={styles.requestDeviceIntro}>
                  {t('login.deviceLoginTrustedDeviceIntro')}
                </p>
                <p className={styles.requestDeviceName}>{trustedDeviceLabel}</p>
              </>
            ) : (
              <p className={styles.requestDeviceIntro}>
                {t('login.deviceLoginTrustedDeviceUnknown')}
              </p>
            )}
          </div>
          <p className={styles.hint}>{t('login.deviceLoginHint')}</p>
          <form
            className={styles.otpIsolationForm}
            autoComplete='off'
            noValidate
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type='text'
              name='amica_otp_entry'
              id='amica-device-login-otp'
              inputMode='numeric'
              pattern='[0-9]*'
              autoComplete='off'
              autoCorrect='off'
              autoCapitalize='off'
              spellCheck={false}
              maxLength={6}
              value={otp}
              disabled={otpBusy}
              readOnly={otpAutofillGuard}
              onFocus={() => setOtpAutofillGuard(false)}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder='000000'
              className={styles.otpInput}
              aria-label={t('login.deviceLoginOtpLabel')}
            />
          </form>
          {otpError ? <p className={styles.error}>{otpError}</p> : null}
          <button
            type='button'
            disabled={otpBusy || !otpOk}
            onClick={submitOtp}
            className={`${styles.btn} ${styles.btnBlock} ${styles.btnPrimary}`}
          >
            {otpBusy ? '…' : t('login.deviceLoginSubmitCode')}
          </button>
          <p className={styles.waiting}>{t('login.deviceLoginWaiting')}</p>
          {onSubmitBackupCode ? (
            <>
              {!showBackupRecovery ? (
                <button
                  type='button'
                  onClick={() => setShowBackupRecovery(true)}
                  className={`${styles.btn} ${styles.btnBlock} ${styles.btnLink}`}
                >
                  {t('login.useRecoveryCodeButton')}
                </button>
              ) : (
                <>
                  <p className={styles.hint} style={{ marginTop: 16 }}>
                    {t('login.useBackupCodeHint')}
                  </p>
                  <input
                    type='text'
                    autoComplete='off'
                    spellCheck={false}
                    value={backupInput}
                    disabled={backupCodeBusy}
                    onChange={(e) =>
                      setBackupInput(e.target.value.toUpperCase())
                    }
                    placeholder={t('login.backupCodePlaceholder')}
                    className={styles.otpInput}
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  />
                  {backupCodeError ? (
                    <p className={styles.error}>{backupCodeError}</p>
                  ) : null}
                  <button
                    type='button'
                    disabled={backupCodeBusy || !backupInput.trim()}
                    onClick={submitBackup}
                    className={`${styles.btn} ${styles.btnBlock} ${styles.btnSecondary}`}
                  >
                    {t('login.backupCodeSubmit')}
                  </button>
                </>
              )}
            </>
          ) : null}
          <button
            type='button'
            onClick={onCancel}
            className={`${styles.btn} ${styles.btnBlock} ${styles.btnSecondary}`}
          >
            {t('login.deviceLoginCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
