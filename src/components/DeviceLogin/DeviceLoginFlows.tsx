import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation, tSync } from '@/contexts/languageCore';
import warningStyles from '@/components/Warning/Warning.module.scss';
import { CopyTextButton } from '@/components/ui/CopyTextButton';
import {
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  trustedDeviceMapsQuery,
} from '@/utils/googleMapsLinks';
import styles from './DeviceLoginFlows.module.scss';

function TrustedDeviceLocationMap({
  requestCity,
  requestCountry,
  requestIp,
}: {
  requestCity?: string;
  requestCountry?: string;
  requestIp?: string;
}) {
  const query = useMemo(
    () => trustedDeviceMapsQuery(requestCity, requestCountry, requestIp),
    [requestCity, requestCountry, requestIp],
  );
  if (!query) return null;
  const embedSrc = googleMapsEmbedUrl(query);
  const openHref = googleMapsSearchUrl(query);
  return (
    <div className={styles.mapsBlock}>
      <div className={styles.mapsFrameWrap}>
        <iframe
          title={tSync('login.trustedDeviceMapFrameTitle')}
          src={embedSrc}
          className={styles.mapsFrame}
          loading='lazy'
          referrerPolicy='no-referrer-when-downgrade'
          allowFullScreen
        />
      </div>
      <a
        href={openHref}
        target='_blank'
        rel='noopener noreferrer'
        className={styles.mapsOpenLink}
      >
        {tSync('login.trustedDeviceOpenInGoogleMaps')}
      </a>
    </div>
  );
}

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
      <TrustedDeviceLocationMap
        requestCity={requestCity}
        requestCountry={requestCountry}
        requestIp={requestIp}
      />
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
  const codeDigits = code.replace(/\D/g, '');
  return (
    <>
      <p style={{ margin: '0 0 8px' }}>
        {tSync('login.trustedDeviceWarningIntro')}
      </p>
      <div className={warningStyles.codeBlockWrap}>
        <div className={warningStyles.codeBlock}>{code}</div>
        <CopyTextButton
          text={codeDigits}
          label={tSync('login.copySignInCode')}
          copiedLabel={tSync('buttons.copied')}
          className={warningStyles.copySignInCode}
          disabled={codeDigits.length !== 6}
        />
      </div>
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
      <TrustedDeviceLocationMap
        requestCity={requestCity}
        requestCountry={requestCountry}
        requestIp={requestIp}
      />
      <p style={{ margin: '12px 0 0', fontSize: '0.875rem' }}>
        {tSync('login.trustedDeviceWarningFoot')}
      </p>
    </>
  );
}

export function DeviceLoginPendingOverlay({
  // trustedDeviceLabel,
  delivery = 'trusted_device',
  onCancel,
  onSubmitOtp,
  otpBusy,
  otpError,
  onResend,
  resendBusy,
  resendError,
}: {
  trustedDeviceLabel?: string;
  delivery?: 'trusted_device' | 'email';
  onCancel: () => void;
  onSubmitOtp: (sixDigits: string) => void | Promise<void>;
  otpBusy?: boolean;
  otpError?: string | null;
  onResend?: () => void | Promise<void>;
  resendBusy?: boolean;
  resendError?: string | null;
}) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  /** Safari: read-only until first focus so Keychain does not attach “use saved login” to this field. */
  const [otpAutofillGuard, setOtpAutofillGuard] = useState(true);

  const submitOtp = useCallback(() => {
    const d = otp.replace(/\D/g, '');
    if (d.length !== 6) return;
    void onSubmitOtp(d);
  }, [otp, onSubmitOtp]);

  const otpOk = otp.replace(/\D/g, '').length === 6;
  const isEmailDelivery = delivery === 'email';

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-live='polite'
    >
      <div className={styles.modal}>
        <div className={styles.body}>
          <h2 className={styles.title}>
            {isEmailDelivery
              ? t('login.deviceLoginEmailTitle')
              : t('login.deviceLoginTitle')}
          </h2>
          {isEmailDelivery ? (
            <>
              <p className={styles.hint}>{t('login.deviceLoginEmailIntro')}</p>
              <p className={styles.hint}>{t('login.deviceLoginEmailHint')}</p>
            </>
          ) : (
            <>
              <p className={styles.hint}>
                {t('login.deviceLoginTrustedWhereHint')}
              </p>
              <p className={styles.hint}>{t('login.deviceLoginHint')}</p>
            </>
          )}
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
          {/* <p className={styles.waiting}>{t('login.deviceLoginWaiting')}</p> */}
          {onResend ? (
            <>
              {resendError ? (
                <p className={styles.error}>{resendError}</p>
              ) : null}
              <button
                type='button'
                disabled={Boolean(resendBusy) || Boolean(otpBusy)}
                onClick={() => void onResend()}
                className={`${styles.btn} ${styles.btnBlock} ${styles.btnLink}`}
              >
                {resendBusy
                  ? '…'
                  : isEmailDelivery
                    ? t('login.deviceLoginResendEmail')
                    : t('login.deviceLoginResend')}
              </button>
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
