import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/contexts/languageCore';
import { useWarning } from '@/contexts/warning/WarningContextCore';
import styles from './DeviceLoginFlows.module.scss';

export function BackupCodesSavedModal({
  codes,
  onDismiss,
}: {
  codes: string[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { showWarning } = useWarning();

  const requestClose = useCallback(() => {
    showWarning({
      title: t('login.backupCodesCloseWarningTitle'),
      body: (
        <p style={{ margin: 0, lineHeight: 1.45 }}>
          {t('login.backupCodesCloseWarningBody')}
        </p>
      ),
      dismissLabel: t('login.backupCodesCloseWarningGoBack'),
      confirmLabel: t('login.backupCodesCloseWarningConfirm'),
      onConfirm: () => {
        onDismiss();
      },
    });
  }, [showWarning, t, onDismiss]);

  const modal = (
    <div className={styles.overlay} role='dialog' aria-modal='true'>
      <div className={styles.modal}>
        <div className={styles.body}>
          <h2 className={styles.title}>{t('login.backupCodesTitle')}</h2>
          <p className={styles.hint}>{t('login.backupCodesBody')}</p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type='button'
            onClick={requestClose}
            className={`${styles.btn} ${styles.btnBlock} ${styles.btnPrimary}`}
          >
            {t('login.backupCodesSaved')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
