import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from 'react';
import { Icon } from '../Icons/AutoIcons';
import { JWTVideo } from './JWTVideo';
import { useSettings } from '@/contexts/settings/context';
import { useAudio } from '@/contexts/audioContext';
import { useSelectedChat, useChatMessages } from '@/contexts/ChatContextCore';
import { isLikelyVideoFile } from '@/utils/mediaAttachmentKind';
import {
  getScrollRoot,
  getVisibleAreaRatio,
  resolveInlineVisibility,
} from '@/utils/videoPip';
import type { File } from '@/types';
import styles from './SmartMediaLayout.module.scss';

export default function VideoLayout({ file }: { file: File }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [playIconVisible, setPlayIconVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);

  const { autoplayVideos } = useSettings();
  const [playing, setPlaying] = useState(autoplayVideos);
  const [muted, setMutedLocal] = useState(autoplayVideos);

  const {
    currentMediaId,
    mediaType,
    isPlaying,
    currentChatId,
    currentTime,
    duration,
    setPlaylist,
    togglePlay,
    registerInlineVideo,
    detachInlineVideo,
    setCurrentTime,
    setScrubbing,
    setInlineVideoVisible,
    setVideoResumeTime,
    showVideoPiP,
  } = useAudio();
  const { selectedChat } = useSelectedChat();
  const { messages } = useChatMessages();

  const isActiveInHeader = mediaType === 'video' && currentMediaId === file.id;
  const isHeaderVideoActive = mediaType === 'video' && currentMediaId != null;
  const mountVideoElement = isActiveInHeader || !isHeaderVideoActive;
  const posterUrl =
    file.thumbnail_medium_url || file.thumbnail_small_url || file.cover_url;
  const hasAudio = file.has_audio || false;

  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const wasPlayingBeforeDrag = useRef(false);

  const soundIcon = useMemo(
    () => <Icon name={muted ? 'SoundMuteFill' : 'SoundMaxFill'} />,
    [muted],
  );

  const videoPlaylist = useMemo(
    () =>
      messages.flatMap((m) =>
        (m.files ?? []).filter((item) => isLikelyVideoFile(item)),
      ),
    [messages],
  );

  const blockedByHeader = isHeaderVideoActive && !isActiveInHeader;

  const effectivePlaying = blockedByHeader
    ? false
    : isHeaderVideoActive
      ? isActiveInHeader && isPlaying
      : playing;

  useLayoutEffect(() => {
    if (!blockedByHeader) return;
    localVideoRef.current?.pause();
  }, [blockedByHeader]);

  const activateInHeader = () => {
    setPlaying(false);
    setVideoResumeTime(localVideoRef.current?.currentTime ?? 0);
    localVideoRef.current?.pause();

    if (currentChatId !== selectedChat?.id || mediaType !== 'video') {
      setPlaylist(videoPlaylist, selectedChat?.id ?? null, {
        autoPlayId: file.id,
        mediaType: 'video',
      });
      return;
    }

    void togglePlay(file.id!);
  };

  const effectiveDuration = duration || file.duration || 0;

  const headerProgress =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  const seekHeaderToClientX = useCallback(
    (clientX: number) => {
      if (!effectiveDuration) return;

      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;

      const percent = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, percent));
      setCurrentTime(clamped * effectiveDuration);
    },
    [effectiveDuration, setCurrentTime],
  );

  const seekByClientX = (clientX: number) => {
    const bar = progressRef.current;
    const trackDuration =
      isActiveInHeader && effectiveDuration > 0
        ? effectiveDuration
        : localVideoRef.current?.duration;
    if (!bar || !trackDuration) return;

    const rect = bar.getBoundingClientRect();
    const pos = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(pos, 1));
    const time = clamped * trackDuration;

    if (isActiveInHeader) {
      setCurrentTime(time);
    } else if (localVideoRef.current) {
      localVideoRef.current.currentTime = time;
      setProgress(clamped * 100);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();

    if (isActiveInHeader) {
      if (!effectiveDuration) return;
      e.preventDefault();

      setScrubbing(true);
      seekHeaderToClientX(e.clientX);

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        moveEvent.preventDefault();
        const x =
          'touches' in moveEvent
            ? moveEvent.touches[0]?.clientX ?? 0
            : moveEvent.clientX;
        seekHeaderToClientX(x);
      };

      const onUp = () => {
        setScrubbing(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove as EventListener);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove, { passive: false });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove as EventListener, {
        passive: false,
      });
      document.addEventListener('touchend', onUp);
      return;
    }

    if (!localVideoRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    wasPlayingBeforeDrag.current = effectivePlaying;
    setPlaying(false);
    isDragging.current = true;
    seekByClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    seekByClientX(e.clientX);
  };

  const finishDrag = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!wasPlayingBeforeDrag.current) return;
    setPlaying(true);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    finishDrag();
  };

  const handlePointerCancel = () => {
    finishDrag();
  };

  useLayoutEffect(() => {
    if (!isActiveInHeader) return;
    const video = localVideoRef.current;
    if (video) registerInlineVideo(video, file.id);
    return () => detachInlineVideo();
  }, [isActiveInHeader, file.id, registerInlineVideo, detachInlineVideo]);

  useEffect(() => {
    if (!isActiveInHeader) return;

    const layout = layoutRef.current;
    if (!layout) return;

    setInlineVideoVisible(true);

    const scrollRoot = getScrollRoot(layout);

    const updateVisibility = () => {
      const decision = resolveInlineVisibility(
        getVisibleAreaRatio(layout, scrollRoot),
        true,
      );
      if (decision === 'inline') setInlineVideoVisible(true);
      else if (decision === 'pip') setInlineVideoVisible(false);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const decision = resolveInlineVisibility(
          entry.intersectionRatio,
          entry.isIntersecting,
        );
        if (decision === 'inline') setInlineVideoVisible(true);
        else if (decision === 'pip') setInlineVideoVisible(false);
      },
      {
        root: scrollRoot,
        threshold: [0, 0.12, 0.35, 0.6, 1],
        rootMargin: '0px',
      },
    );
    observer.observe(layout);

    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(updateVisibility);
    });

    scrollRoot?.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      scrollRoot?.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [isActiveInHeader, setInlineVideoVisible]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video || isActiveInHeader) return;

    const update = () => {
      if (video.duration > 0 && video.buffered.length > 0) {
        let end = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime) {
            end = video.buffered.end(i);
          }
        }
        setBuffered(Math.min((end / video.duration) * 100, 100));
      }
    };

    video.addEventListener('progress', update);
    return () => video.removeEventListener('progress', update);
  }, [isActiveInHeader]);

  useEffect(() => {
    if (isActiveInHeader) return;
    const video = localVideoRef.current;
    if (!video) return;

    let rafId: number;
    const tick = () => {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActiveInHeader]);

  useEffect(() => {
    const show = window.setTimeout(() => setPlayIconVisible(true), 0);
    const hide = window.setTimeout(() => setPlayIconVisible(false), 700);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [effectivePlaying]);

  const handleClick = () => {
    if (isDragging.current) return;
    if (isActiveInHeader) {
      void togglePlay(file.id!);
      return;
    }
    activateInHeader();
  };

  const jwtVideo = (
    <JWTVideo
      ref={localVideoRef}
      url={file.file_url ?? ''}
      muted={isActiveInHeader ? true : muted}
      autoPlay={autoplayVideos && !isHeaderVideoActive && !isActiveInHeader}
      playing={isActiveInHeader ? false : playing}
      loop={!isActiveInHeader}
      externallyControlled={isActiveInHeader}
      playbackFromContext={isActiveInHeader}
    />
  );

  const shellContent = mountVideoElement
    ? jwtVideo
    : posterUrl
      ? <img src={posterUrl} className={styles['video-layout__poster']} alt='' />
      : <div className={styles['video-layout__posterFallback']} />;

  return (
    <div
      ref={layoutRef}
      onClick={handleClick}
      className={[
        styles['video-layout'],
        isActiveInHeader && styles['video-layout--playerActive'],
        isActiveInHeader && showVideoPiP && styles['video-layout--floating'],
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles['video-shell-slot']}>
        {isActiveInHeader && showVideoPiP && (
          <div className={styles['video-shell-placeholder']} aria-hidden />
        )}

        <div className={styles['video-shell']}>{shellContent}</div>
      </div>

      <div
        ref={progressRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={(e) => e.stopPropagation()}
        className={styles['progress-bar-container']}
      >
        <div className={styles['progress-bar']}>
          <div
            style={{
              width: `${buffered}%`,
              height: '100%',
              background: 'rgba(255, 255, 255, 0.5)',
              position: 'absolute',
              top: 0,
              left: 0,
              transition: 'width 0.3s ease-in-out',
            }}
          />
          <div
            style={{
              width: `${isActiveInHeader ? headerProgress : progress}%`,
              height: '100%',
              background: '#fff',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        </div>
      </div>

      <Icon
        name={effectivePlaying ? 'Pause' : 'Play'}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 50,
          height: 50,
          opacity: playIconVisible || !effectivePlaying ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none',
        }}
      />

      {hasAudio && !isActiveInHeader && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setMutedLocal((prev) => !prev);
          }}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 25,
            height: 25,
            cursor: 'pointer',
          }}
        >
          {soundIcon}
        </div>
      )}
    </div>
  );
}
