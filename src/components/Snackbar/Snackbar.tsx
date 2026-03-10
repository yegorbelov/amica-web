import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './Snackbar.module.scss';

const Snackbar = ({
  message,
  actionLabel,
  duration,
  onAction,
  open,
  onExited,
}: {
  message: string;
  actionLabel?: string;
  duration: number;
  onAction?: () => void;
  open: boolean;
  onExited: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;

    const handleEnd = (e: AnimationEvent) => {
      if (e.target !== el) return;
      if (e.animationName !== 'snackbar-exit') return;
      onExited?.();
    };

    el.addEventListener('animationend', handleEnd);

    return () => {
      el.removeEventListener('animationend', handleEnd);
    };
  }, [open, onExited]);

  useEffect(() => {
    if (!open) return;

    const endAt = Date.now() + duration;
    const updateSecondsLeft = () => {
      const remainingMs = Math.max(0, endAt - Date.now());
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    updateSecondsLeft();
    const intervalId = window.setInterval(updateSecondsLeft, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [duration, open]);

  return (
    <div
      ref={ref}
      className={`${styles.snackbar} ${open ? styles.show : styles.hide}`}
    >
      <div className={styles.content}>
        <span className={styles.message}>{message}</span>
        <span
          className={styles.timer}
          aria-hidden
          style={{ '--snackbar-duration': `${duration}ms` } as CSSProperties}
        >
          <svg
            className={styles['timer-svg']}
            viewBox='0 0 24 24'
            width='20'
            height='20'
          >
            <circle className={styles['timer-track']} cx='12' cy='12' r='9' />
            <circle
              className={styles['timer-progress']}
              cx='12'
              cy='12'
              r='9'
            />
          </svg>
          <span className={styles['timer-label']}>{secondsLeft}</span>
        </span>
      </div>

      {actionLabel && onAction && (
        <button type='button' className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default Snackbar;
