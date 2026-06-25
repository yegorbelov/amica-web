import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
} from 'react';
import { usePrivateMedia } from '@/hooks/usePrivateMedia';
import styles from './SmartMediaLayout.module.scss';
import { Icon } from '../Icons/AutoIcons';
import { useAudio } from '@/contexts/audioContext';
import { useSelectedChat, useChatMessages } from '@/contexts/ChatContextCore';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

interface AudioLayoutProps {
  name: string | null;
  waveform: number[] | null;
  duration: number | null;
  id: number;
  cover_url: string | null;
}

export default function AudioLayout({
  // name,
  waveform,
  duration,
  id,
  cover_url,
}: AudioLayoutProps) {
  const {
    setPlaylist,
    currentChatId,
    togglePlay: toggleAudio,
    isPlaying: isAudioPlaying,
    currentAudioId,
    mediaType,
    setCurrentTime,
    audioRef,
  } = useAudio();
  const { selectedChat } = useSelectedChat();
  const { messages } = useChatMessages();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { objectUrl: cover } = usePrivateMedia(isVisible ? cover_url : null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '50px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const progressRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeRef = useRef(0);
  const [visualTime, setVisualTime] = useState(0);
  const isActiveTrack = currentAudioId === id;

  const [durationState] = useState(duration ?? 0);

  const safeDuration = durationState || 1;

  const getClientX = (
    e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  ) => ('touches' in e ? e.touches?.[0]?.clientX || 0 : e.clientX || 0);

  useEffect(() => {
    if (!isActiveTrack) return;

    const audio = audioRef?.current;
    if (!audio) return;

    let animationFrameId: number;

    const animate = () => {
      setVisualTime((prev) => prev + (audio.currentTime - prev) * 0.2);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActiveTrack, audioRef]);

  const togglePlay = useCallback(() => {
    const coverOpt = cover ?? undefined;
    if (currentChatId !== selectedChat?.id || mediaType !== 'audio') {
      const newPlaylist = messages.flatMap((message) =>
        (message.files ?? []).filter((file) => file.category === 'audio'),
      );
      setPlaylist(newPlaylist, selectedChat?.id || 0, {
        autoPlayId: id,
        mediaType: 'audio',
      });
    } else {
      toggleAudio(id, { coverUrl: coverOpt });
    }
  }, [
    messages,
    selectedChat?.id,
    currentChatId,
    mediaType,
    id,
    setPlaylist,
    toggleAudio,
    cover,
  ]);

  const startSeek = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    const updateTime = (clientX: number) => {
      const rect = progressRef.current!.getBoundingClientRect();
      const percent = (clientX - rect!.left) / rect!.width;
      const clampedPercent = Math.max(0, Math.min(1, percent));
      const time = clampedPercent * durationState;

      currentTimeRef.current = time;
      setVisualTime(time);
      setCurrentTime(time);
    };

    updateTime(getClientX(e));
    const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      updateTime(getClientX(moveEvent));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove as EventListener);
      document.removeEventListener('touchend', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove, { passive: false });
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onMouseMove as EventListener, {
      passive: false,
    });
    document.addEventListener('touchend', onMouseUp);
  };

  const formatTime = (time = 0) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const pauseIcon = useMemo(() => <Icon name='Pause' />, []);
  const playIcon = useMemo(() => <Icon name='Play' />, []);

  const barWidth = 3;
  const gap = 1;
  const totalBars = waveform?.length || 0;
  const height = 40;
  const padding = 5;
  const center = (height - 2 * padding) / 2 + padding;

  const [canvasWidth, setCanvasWidth] = useState(0);

  const drawWaveform = useCallback(
    (width: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !waveform?.length || width <= 0) return;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const progressX = (visualTime / safeDuration) * width;

      for (let i = 0; i < waveform.length; i++) {
        const value = waveform[i];
        const lineHeight = value * (height - 2 * padding);
        const x =
          waveform.length > 1
            ? (i / (waveform.length - 1)) * width
            : width / 2 - barWidth / 2;
        const y = center - lineHeight / 2;

        const barLeft = x;
        const barRight = x + barWidth;

        if (progressX <= barLeft) {
          ctx.fillStyle = '#c7d2fe';
          roundRect(ctx, barLeft, y, barWidth, lineHeight, barWidth / 2);
          ctx.fill();
        } else if (progressX >= barRight) {
          ctx.fillStyle = '#ffffffff';
          roundRect(ctx, barLeft, y, barWidth, lineHeight, barWidth / 2);
          ctx.fill();
        } else {
          const playedWidth = progressX - barLeft;
          const unplayedWidth = barRight - progressX;
          ctx.fillStyle = '#ffffffff';
          roundRect(ctx, barLeft, y, playedWidth, lineHeight, barWidth / 2);
          ctx.fill();
          ctx.fillStyle = '#c7d2fe';
          roundRect(ctx, progressX, y, unplayedWidth, lineHeight, barWidth / 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
    [waveform, visualTime, safeDuration, center],
  );

  useLayoutEffect(() => {
    const el = progressRef.current;
    const fallback = totalBars * (barWidth + gap);

    const update = () => {
      const w = el ? el.clientWidth : fallback;
      setCanvasWidth(w);
      drawWaveform(w);
    };

    update();

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [progressRef, totalBars, barWidth, gap, drawWaveform]);

  return (
    <>
      {/* <span className={styles.audio_name}>{name}</span> */}
      <div ref={wrapperRef} className={styles.player}>
        {cover && <img src={cover} alt='' className={styles.cover} />}
        <button onClick={togglePlay} className={styles.play}>
          {isAudioPlaying && currentAudioId === id ? pauseIcon : playIcon}
        </button>
        <div className={styles.timeline}>
          <div
            ref={progressRef}
            className={styles.progress}
            onMouseDown={startSeek}
            onTouchStart={startSeek}
          >
            {!waveform && (
              <div className={styles.progressFillWrapper}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${(visualTime / safeDuration) * (canvasWidth || 1)}px`,
                  }}
                />
              </div>
            )}
            {waveform && (
              <canvas
                ref={canvasRef}
                className={styles.waveformCanvas}
                style={{
                  width: '100%',
                  height: `${height}px`,
                  display: 'block',
                }}
              />
            )}
          </div>
        </div>
        <div className={styles.controlsWrapper}>
          <div className={styles.time}>
            {formatTime(visualTime)} / {formatTime(durationState)}
          </div>
        </div>
      </div>
    </>
  );
}
