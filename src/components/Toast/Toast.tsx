import { useEffect, useRef } from 'react';
import styles from './Toast.module.scss';
import { Icon } from '../Icons/AutoIcons';

const unreadIcon = <Icon name='Unread' className={styles.icon} />;

const Toast = ({
  message,
  open,
  onExited,
}: {
  message: string;
  open: boolean;
  onExited: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;

    const handleEnd = (e: AnimationEvent) => {
      if (e.target !== el) return;
      if (e.animationName !== 'toast-exit') return;
      onExited?.();
    };

    el.addEventListener('animationend', handleEnd);

    return () => {
      el.removeEventListener('animationend', handleEnd);
    };
  }, [open, onExited]);

  return (
    <div ref={ref} className={`${styles.toast} ${open ? styles.show : styles.hide}`}>
      {unreadIcon}
      {message}
    </div>
  );
};

export default Toast;
