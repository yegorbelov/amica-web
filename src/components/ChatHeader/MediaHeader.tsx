import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './ChatHeader.module.scss';
import { useAudio } from '@/contexts/audioContext';
import { Icon } from '../Icons/AutoIcons';
import AudioEqualizer from './AudioEqualizer';
import Button from '../ui/button/Button';
import { MediaHeaderTitle } from './MediaHeaderTitle';

const pauseIcon = <Icon name='Pause' />;
const playIcon = <Icon name='Play' />;
const crossIcon = <Icon name='Cross' className={styles.close} />;
const prevIcon = (
  <Icon name='Arrow' className={styles['media-header__navIcon--prev']} />
);
const nextIcon = (
  <Icon name='Arrow' className={styles['media-header__navIcon']} />
);

const PLAYLIST_SWIPE_THRESHOLD = 8;

function formatTime(time = 0) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getClientX(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
) {
  return 'touches' in e ? e.touches?.[0]?.clientX || 0 : e.clientX || 0;
}

function stopSeekPropagation(e: React.MouseEvent | React.TouchEvent) {
  e.stopPropagation();
}

function readPlaylistSnapIndex(viewport: HTMLDivElement) {
  const pageWidth = viewport.clientWidth;
  if (!pageWidth) return 0;
  return Math.round(viewport.scrollLeft / pageWidth);
}

export const MediaHeader: React.FC = () => {
  const {
    isPlaying,
    currentMediaId,
    mediaType,
    playlist,
    togglePlay,
    playPrev,
    playNext,
    coverUrl,
    currentTime,
    duration,
    setCurrentTime,
    setScrubbing,
    closeMedia,
    isMuted,
    setMuted,
    playbackSpeed,
    cyclePlaybackSpeed,
  } = useAudio();

  const progressRef = useRef<HTMLDivElement>(null);
  const playlistScrollRef = useRef<HTMLDivElement>(null);
  const prevPlaylistIndexRef = useRef(-1);
  const animatedScrollTargetRef = useRef<number | null>(null);

  const currentTrack = currentMediaId
    ? playlist?.find((f) => f.id === currentMediaId)
    : undefined;

  const safeDuration = duration || currentTrack?.duration || 1;
  const isVideo = mediaType === 'video';

  const seekToClientX = useCallback(
    (clientX: number) => {
      if (!safeDuration) return;

      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;

      const percent = (clientX - rect.left) / rect.width;
      const clampedPercent = Math.max(0, Math.min(1, percent));
      setCurrentTime(clampedPercent * safeDuration);
    },
    [safeDuration, setCurrentTime],
  );

  const startSeek = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!safeDuration) return;

      setScrubbing(true);
      seekToClientX(getClientX(e));

      const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        seekToClientX(getClientX(moveEvent));
      };

      const onMouseUp = () => {
        setScrubbing(false);
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
    },
    [safeDuration, seekToClientX, setScrubbing],
  );

  const handlePlaylistPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let mode: 'pending' | 'scroll' | 'seek' = 'pending';
      const target = e.currentTarget;

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (mode === 'pending') {
          if (
            Math.abs(dx) >= PLAYLIST_SWIPE_THRESHOLD &&
            Math.abs(dx) > Math.abs(dy)
          ) {
            mode = 'scroll';
            return;
          }

          if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
            mode = 'seek';
            setScrubbing(true);
            seekToClientX(ev.clientX);
          }
          return;
        }

        if (mode === 'seek') {
          ev.preventDefault();
          seekToClientX(ev.clientX);
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (mode === 'pending') {
          seekToClientX(ev.clientX);
        } else if (mode === 'seek') {
          setScrubbing(false);
        }

        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointercancel', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
      target.addEventListener('pointercancel', onPointerUp);
    },
    [seekToClientX, setScrubbing],
  );

  const currentIndex =
    playlist?.findIndex((file) => file.id === currentMediaId) ?? -1;
  const hasPlaylist = !!playlist && playlist.length > 1;
  const playlistKey = playlist?.map((file) => file.id).join(',') ?? '';

  const scrollPlaylistToIndex = useCallback(
    (index: number, animated = false) => {
      const viewport = playlistScrollRef.current;
      if (!viewport || !playlist?.length) return;

      const go = () => {
        const pageWidth = viewport.clientWidth;
        if (!pageWidth) return;

        const clamped = Math.max(0, Math.min(index, playlist.length - 1));
        const targetLeft = clamped * pageWidth;

        if (Math.abs(viewport.scrollLeft - targetLeft) < 1) {
          animatedScrollTargetRef.current = null;
          return;
        }

        if (animated) {
          animatedScrollTargetRef.current = clamped;
          viewport.scrollTo({ left: targetLeft, behavior: 'smooth' });
          return;
        }

        animatedScrollTargetRef.current = null;
        viewport.scrollLeft = targetLeft;
      };

      if (viewport.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      go();
    },
    [playlist],
  );

  const syncPlaylistFromScroll = useCallback(() => {
    const viewport = playlistScrollRef.current;
    if (!viewport || !hasPlaylist || !playlist?.length) return;

    requestAnimationFrame(() => {
      if (!viewport) return;
      animatedScrollTargetRef.current = null;
      const next = readPlaylistSnapIndex(viewport);
      const track = playlist[next];
      if (!track?.id || next === currentIndex) return;
      void togglePlay(track.id);
    });
  }, [currentIndex, hasPlaylist, playlist, togglePlay]);

  useLayoutEffect(() => {
    if (!hasPlaylist || currentIndex < 0) return;
    prevPlaylistIndexRef.current = currentIndex;
    scrollPlaylistToIndex(currentIndex, false);
  }, [hasPlaylist, playlistKey, scrollPlaylistToIndex, currentIndex]);

  useEffect(() => {
    if (!hasPlaylist || currentIndex < 0) return;
    if (animatedScrollTargetRef.current === currentIndex) return;

    const prev = prevPlaylistIndexRef.current;
    prevPlaylistIndexRef.current = currentIndex;
    const isAdjacent = prev >= 0 && Math.abs(currentIndex - prev) === 1;
    scrollPlaylistToIndex(currentIndex, isAdjacent);
  }, [currentIndex, hasPlaylist, scrollPlaylistToIndex]);

  useEffect(() => {
    const viewport = playlistScrollRef.current;
    if (!viewport || !hasPlaylist) return;

    viewport.addEventListener('scrollend', syncPlaylistFromScroll, {
      passive: true,
    });
    viewport.addEventListener('touchend', syncPlaylistFromScroll, {
      passive: true,
    });

    return () => {
      viewport.removeEventListener('scrollend', syncPlaylistFromScroll);
      viewport.removeEventListener('touchend', syncPlaylistFromScroll);
    };
  }, [syncPlaylistFromScroll, hasPlaylist]);

  useEffect(() => {
    const viewport = playlistScrollRef.current;
    if (!viewport || !hasPlaylist || currentIndex < 0) return;

    const observer = new ResizeObserver(() => {
      scrollPlaylistToIndex(currentIndex, false);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [currentIndex, hasPlaylist, scrollPlaylistToIndex]);

  if (!currentMediaId) return null;

  const progressPercent = (currentTime / safeDuration) * 100;
  const canGoNext =
    hasPlaylist && currentIndex >= 0 && currentIndex < playlist.length - 1;

  return (
    <div ref={progressRef} className={styles['media-header']}>
      <div
        className={styles['media-header__seekHit']}
        onMouseDown={startSeek}
        onTouchStart={startSeek}
        aria-hidden
      />
      <div className={styles['media-header__clip']} aria-hidden>
        <div className={styles['media-header__progressBg']}>
          <div
            className={styles['media-header__progressFill']}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className={styles['media-header__progressBar']}>
          <div className={styles['media-header__progressBarTrack']}>
            <div
              className={styles['media-header__progressBarFill']}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className={styles['media-header__content']}>
        <div className={styles['media-header__leftside']}>
          <button
            type='button'
            onClick={() => togglePlay(currentMediaId)}
            onMouseDown={stopSeekPropagation}
            onTouchStart={stopSeekPropagation}
            className={styles['media-header__toggle']}
          >
            {coverUrl && (
              <img
                src={coverUrl}
                className={styles['media-header__cover']}
                alt=''
              />
            )}

            {isPlaying ? pauseIcon : playIcon}
          </button>

          {hasPlaylist && (
            <div className={styles['media-header__nav']}>
              <button
                type='button'
                className={styles['media-header__navButton']}
                onClick={() => void playPrev()}
                onMouseDown={stopSeekPropagation}
                onTouchStart={stopSeekPropagation}
                aria-label='Previous track'
              >
                {prevIcon}
              </button>
              <button
                type='button'
                className={styles['media-header__navButton']}
                onClick={() => void playNext()}
                onMouseDown={stopSeekPropagation}
                onTouchStart={stopSeekPropagation}
                disabled={!canGoNext}
                aria-label='Next track'
              >
                {nextIcon}
              </button>
            </div>
          )}

          {hasPlaylist ? (
            <div className={styles['media-header__playlist-mask']}>
              <div
                ref={playlistScrollRef}
                className={styles['media-header__playlist']}
                onPointerDown={handlePlaylistPointerDown}
              >
                <div className={styles['media-header__playlist-track']}>
                  {playlist!.map((track) => {
                    const isActive = track.id === currentMediaId;
                    const trackDuration = track.duration || safeDuration;

                    return (
                      <div
                        key={track.id}
                        className={styles['media-header__playlist-slide']}
                      >
                        <div className={styles['media-header__current']}>
                          <MediaHeaderTitle
                            text={track.original_name}
                            active={isActive}
                          />
                        </div>
                        <div className={styles['media-header__time']}>
                          {isActive
                            ? `${formatTime(currentTime)} / ${formatTime(safeDuration)}`
                            : formatTime(trackDuration)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            currentTrack && (
              <div className={styles['media-header__info']}>
                <div className={styles['media-header__current']}>
                  <MediaHeaderTitle text={currentTrack.original_name} />
                </div>
                <div className={styles['media-header__time']}>
                  {formatTime(currentTime)} / {formatTime(safeDuration)}
                </div>
              </div>
            )
          )}
        </div>

        <div
          className={styles['media-header__rightside']}
          onMouseDown={stopSeekPropagation}
          onTouchStart={stopSeekPropagation}
        >
          {isVideo && currentTrack?.has_audio && (
            <Button
              key='media-header-mute-button'
              onClick={() => setMuted(!isMuted)}
              className={styles['media-header__mute']}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              <Icon name={isMuted ? 'SoundMuteFill' : 'SoundMaxFill'} />
            </Button>
          )}
          {!isVideo && (
            <>
              <button
                type='button'
                className={styles['media-header__speed']}
                onClick={cyclePlaybackSpeed}
                onMouseDown={stopSeekPropagation}
                onTouchStart={stopSeekPropagation}
                aria-label={`Playback speed ${playbackSpeed}x`}
              >
                {playbackSpeed}×
              </button>
              <AudioEqualizer />
            </>
          )}
          <Button
            key={'media-header-close-button'}
            onClick={closeMedia}
            className={styles['media-header__close']}
          >
            {crossIcon}
          </Button>
        </div>
      </div>
    </div>
  );
};
