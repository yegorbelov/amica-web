import { useLayoutEffect, useRef, useState } from 'react';
import { decodeDisplayFileName } from '@/utils/decodeDisplayFileName';
import styles from './ChatHeader.module.scss';

type MediaHeaderTitleProps = {
  text: string;
  active?: boolean;
};

export function MediaHeaderTitle({ text, active = true }: MediaHeaderTitleProps) {
  const displayText = decodeDisplayFileName(text);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState<{
    distance: number;
    duration: number;
  } | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const textEl = textRef.current;
    if (!viewport || !textEl) return;

    const measure = () => {
      if (!active) {
        setMarquee(null);
        return;
      }

      const overflow = textEl.scrollWidth - viewport.clientWidth;
      if (overflow <= 1) {
        setMarquee(null);
        return;
      }

      setMarquee({
        distance: overflow,
        duration: Math.min(16, Math.max(5, overflow / 28)),
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [displayText, active]);

  return (
    <div ref={viewportRef} className={styles['media-header__titleViewport']}>
      <span
        ref={textRef}
        className={`${styles['media-header__titleText']} ${
          marquee ? styles['media-header__titleText--scroll'] : ''
        }`}
        style={
          marquee
            ? ({
                ['--title-scroll-distance' as string]: `-${marquee.distance}px`,
                ['--title-scroll-duration' as string]: `${marquee.duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {displayText}
      </span>
    </div>
  );
}
