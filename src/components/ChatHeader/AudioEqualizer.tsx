import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ChatHeader.module.scss';
import { useAudio } from '@/contexts/audioContext';
import Button from '../ui/button/Button';

const BARS_COUNT = 6;
const MIN_HEIGHT_PERCENT = 0;
const SMOOTHING = 0.65;
const SENSITIVITY = 2;
const MAX_FREQ_HZ = 8000;
const VOLUME_TRACK_HEIGHT = 72;
const VOLUME_TRANSITION_MS = 250;

let sharedElement: HTMLAudioElement | null = null;
let sharedContext: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;

function getClientY(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
) {
  return 'touches' in e ? e.touches?.[0]?.clientY || 0 : e.clientY || 0;
}

const AudioEqualizer = () => {
  const { audioRef, currentAudioId, mediaType, volume, setVolume, canChangeVolume } =
    useAudio();
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const smoothedRef = useRef<number[]>(
    Array(BARS_COUNT).fill(MIN_HEIGHT_PERCENT),
  );
  const animationRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [slotWidth, setSlotWidth] = useState<number>();

  const assignButtonRef = useCallback((node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (!node) return;

    const nextWidth = node.offsetWidth;
    setSlotWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const closeVolume = useCallback(() => {
    setIsVolumeOpen(false);

    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, VOLUME_TRANSITION_MS);
  }, []);

  useEffect(() => {
    if (!isVolumeOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        closeVolume();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [isVolumeOpen, closeVolume]);

  useEffect(() => {
    if (!audioRef?.current) return;

    const audio = audioRef.current;
    let audioContext: AudioContext;
    let analyser: AnalyserNode;

    if (
      sharedElement === audio &&
      sharedContext?.state !== 'closed' &&
      sharedAnalyser
    ) {
      audioContext = sharedContext;
      analyser = sharedAnalyser;
    } else {
      if (sharedContext?.state !== 'closed') {
        sharedContext?.close();
      }
      sharedElement = audio;
      audioContext = new AudioContext();
      sharedContext = audioContext;
      analyser = audioContext.createAnalyser();
      sharedAnalyser = analyser;
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      analyser.minDecibels = -70;
      analyser.maxDecibels = 0;

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const smoothed = smoothedRef.current;
    const binCount = dataArray.length;
    const maxBin = Math.min(
      binCount - 1,
      Math.floor((MAX_FREQ_HZ * analyser.fftSize) / audioContext.sampleRate),
    );
    const effectiveBins = maxBin + 1;
    const step = Math.floor(effectiveBins / BARS_COUNT);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < BARS_COUNT; i++) {
        const start = i * step;
        const end = i < BARS_COUNT - 1 ? (i + 1) * step : effectiveBins;
        let sum = 0;
        let maxV = 0;
        for (let j = start; j < end; j++) {
          sum += dataArray[j];
          if (dataArray[j] > maxV) maxV = dataArray[j];
        }
        const average = end > start ? sum / (end - start) : 0;
        const value = i >= 4 ? maxV : average;
        const rawPercent = (value / 255) * 100;
        const target = Math.max(
          MIN_HEIGHT_PERCENT,
          Math.min(100, rawPercent * SENSITIVITY),
        );
        smoothed[i] = smoothed[i] * SMOOTHING + target * (1 - SMOOTHING);

        const el = barRefs.current[i];
        if (el) el.style.height = `${Math.round(smoothed[i])}%`;
      }

      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioRef]);

  const openVolume = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsExpanded(true);
    setIsVolumeOpen(true);
  }, []);

  const setVolumeByClientY = useCallback(
    (clientY: number) => {
      const rect = volumeRef.current?.getBoundingClientRect();
      if (!rect) return;

      const percent = 1 - (clientY - rect.top) / rect.height;
      setVolume(Math.max(0, Math.min(1, percent)));
    },
    [setVolume],
  );

  const startVolumeDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setVolumeByClientY(getClientY(e));

      const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        setVolumeByClientY(getClientY(moveEvent));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onMouseMove);
        document.removeEventListener('touchend', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove, { passive: false });
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onMouseMove, { passive: false });
      document.addEventListener('touchend', onMouseUp);
    },
    [setVolumeByClientY],
  );

  const handleEqualizerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!canChangeVolume) return;

      if (isVolumeOpen) closeVolume();
      else openVolume();
    },
    [canChangeVolume, isVolumeOpen, closeVolume, openVolume],
  );

  const stopPropagation = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
    },
    [],
  );

  if (!currentAudioId || mediaType !== 'audio') return null;

  const volumePercent = volume * 100;

  return (
    <div
      key={currentAudioId ?? 'none'}
      ref={wrapperRef}
      className={styles['audio-equalizer-control']}
      style={slotWidth ? { width: slotWidth } : undefined}
    >
      <Button
        ref={assignButtonRef}
        key={'audio-equalizer-button'}
        blurOnContentChange={false}
        onClick={handleEqualizerClick}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        style={slotWidth ? { width: '100%' } : undefined}
        className={`${styles['audio-equalizer-control__button']} ${
          isExpanded ? styles['audio-equalizer-control__button--open'] : ''
        }`}
      >
        <div className={styles['audio-equalizer-control__inner']}>
          <div className={styles['audio-equalizer-control__head']}>
            <div className={styles['audio-equalizer']}>
              {Array.from({ length: BARS_COUNT }, (_, i) => (
                <div key={i} className={styles['audio-equalizer__bar']}>
                  <div
                    ref={(el) => {
                      barRefs.current[i] = el;
                    }}
                    className={styles['audio-equalizer__bar__inner']}
                    style={{ height: `${MIN_HEIGHT_PERCENT}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {canChangeVolume && (
            <div
              className={`${styles['audio-equalizer-control__volume']} ${
                isVolumeOpen
                  ? styles['audio-equalizer-control__volume--open']
                  : ''
              }`}
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
            >
              <div
                ref={volumeRef}
                className={styles['audio-equalizer-control__volumeHit']}
                style={{ height: VOLUME_TRACK_HEIGHT }}
                onMouseDown={startVolumeDrag}
                onTouchStart={startVolumeDrag}
              >
                <div className={styles['audio-equalizer-control__volumeTrack']}>
                  <div
                    className={styles['audio-equalizer-control__volumeFill']}
                    style={{ height: `${volumePercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Button>
    </div>
  );
};

export default AudioEqualizer;
