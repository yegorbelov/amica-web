import { useEffect, useRef, useState } from 'react';
import { usePrivateMedia } from '@/hooks/usePrivateMedia';
import styles from './SmartMediaLayout.module.scss';

interface ProgressiveImageProps {
  small: string | null;
  full: string;
  dominant_color?: string;
  onClick?: () => void;
}

export default function ProgressiveImage({
  small,
  full,
  onClick = () => {},
  dominant_color,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const {
    objectUrl: smallUrl,
    loading: smallLoading,
    error: smallError,
  } = usePrivateMedia(isVisible ? small : null);
  const {
    objectUrl: fullUrl,
    loading: fullLoading,
    error: fullError,
  } = usePrivateMedia(isVisible ? full : null);

  const isValid = !smallError && !fullError;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: '50px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullUrl || !isValid) return;

    const img = new Image();
    img.src = fullUrl;
    img.onload = () => setLoaded(true);
  }, [fullUrl, isValid]);

  return (
    <div
      ref={wrapperRef}
      style={{ background: dominant_color }}
      className={styles.wrapper}
    >
      {isValid && smallUrl && !loaded && (
        <img
          src={smallUrl}
          className={`${styles['mes_img']} ${styles['progressive-image']}`}
          alt='Attachment placeholder'
          decoding='async'
          draggable={false}
        />
      )}

      {isValid && fullUrl && (
        <img
          src={fullUrl}
          className={`${styles['mes_img']} ${styles['progressive-image']} ${loaded ? styles['loaded'] : ''}`}
          onClick={onClick}
          alt='Attachment'
          decoding='async'
          draggable={false}
        />
      )}

      {isVisible && (smallLoading || fullLoading || !loaded) && (
        <div className={styles.loading}>
          <div className={styles['loading__background']} />
          <span className={styles.spinner} role='status' aria-label='Loading' />
        </div>
      )}
    </div>
  );
}
