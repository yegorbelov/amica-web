import React, {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  startTransition,
} from 'react';
import styles from './Slider.module.scss';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
}

const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const clampValue = useCallback(
    (val: number) => Math.min(Math.max(val, min), max),
    [min, max],
  );
  const [internalValue, setInternalValue] = useState(() => clampValue(value));
  const [trackWidth, setTrackWidth] = useState(0);
  const [isInitial, setIsInitial] = useState(true);

  const thumbWidth = 30;
  const thumbInset = thumbWidth / 3;

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const updateWidth = () => {
      const width = el.getBoundingClientRect().width;
      setTrackWidth(width);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    const raf = requestAnimationFrame(() => setIsInitial(false));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (dragging) return;
    if (value === internalValue) return;
    startTransition(() => {
      setInternalValue(clampValue(value));
    });
  }, [value, dragging, internalValue, clampValue]);

  const calcValueFromPos = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return internalValue;
      const { left, width } = trackRef.current.getBoundingClientRect();
      const fullRange = width - 2 * thumbInset;
      let percent = (clientX - left - thumbInset) / fullRange;
      percent = Math.min(Math.max(percent, 0), 1);
      return min + percent * (max - min);
    },
    [min, max, internalValue, thumbInset],
  );

  const pendingClientXRef = useRef<number | null>(null);
  const rafIdRef = useRef<number>(0);
  const internalValueRef = useRef(internalValue);
  const addedMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const addedUpRef = useRef<(e: PointerEvent) => void>(() => {});

  useLayoutEffect(() => {
    internalValueRef.current = internalValue;
  }, [internalValue]);

  const applyPendingPosition = useCallback(() => {
    const x = pendingClientXRef.current;
    if (x === null) return;
    const val = calcValueFromPos(x);
    setInternalValue(val);
    internalValueRef.current = val;
    onChange(val);
  }, [calcValueFromPos, onChange]);

  const calcThumbLeft = (val: number) => {
    if (!trackWidth) return 0;
    const percent = (val - min) / (max - min);
    const fullRange = trackWidth - 2 * thumbInset;
    return thumbInset + percent * fullRange;
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pendingClientXRef.current = e.clientX;
      if (rafIdRef.current !== 0) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        applyPendingPosition();
      });
    },
    [applyPendingPosition],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = trackRef.current;
      if (el) {
        el.removeEventListener('pointermove', addedMoveRef.current);
        el.removeEventListener('pointerup', addedUpRef.current);
        el.removeEventListener('pointercancel', addedUpRef.current);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          console.error('releasePointerCapture failed:');
        }
      }
      if (rafIdRef.current !== 0) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      setDragging(false);
      const valToRound =
        pendingClientXRef.current !== null
          ? calcValueFromPos(pendingClientXRef.current)
          : internalValueRef.current;
      pendingClientXRef.current = null;
      const rounded = Math.round(valToRound / step) * step;
      const clamped = clampValue(rounded);
      setInternalValue(clamped);
      internalValueRef.current = clamped;
      onChange(clamped);
    },
    [step, clampValue, onChange, calcValueFromPos],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = trackRef.current;
      if (!el) return;
      setDragging(true);
      el.setPointerCapture(e.pointerId);
      const val = calcValueFromPos(e.clientX);
      setInternalValue(val);
      internalValueRef.current = val;
      onChange(val);
      addedMoveRef.current = handlePointerMove;
      addedUpRef.current = handlePointerUp;
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointerup', handlePointerUp);
      el.addEventListener('pointercancel', handlePointerUp);
    },
    [calcValueFromPos, onChange, handlePointerMove, handlePointerUp],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (isNaN(val)) return;
    val = clampValue(Math.round(val / step) * step);
    setInternalValue(val);
    onChange(val);
  };

  const thumbLeft = calcThumbLeft(internalValue);

  const calcFillWidth = useCallback(
    (val: number) => {
      if (!trackWidth) return 0;
      const width = trackWidth;
      const percent = (val - min) / (max - min);
      const edge = 0.1;
      const padding = thumbInset;

      const fullRange = width - 2 * padding;
      const centerThumb = padding + percent * fullRange;

      const edgeEaseStart = (t: number) => Math.pow(t, 0.6);
      const edgeEaseEnd = (t: number) => 1 - Math.pow(1 - t, 0.6);

      if (percent < edge) {
        const start = 0;
        const end = padding + edge * fullRange;
        const t = edgeEaseStart(percent / edge);
        return start + t * (end - start);
      } else if (percent > 1 - edge) {
        const start = padding + (1 - edge) * fullRange;
        const end = width;
        const t = edgeEaseEnd((percent - (1 - edge)) / edge);
        return start + t * (end - start);
      } else {
        return centerThumb;
      }
    },
    [min, max, thumbInset, trackWidth],
  );

  const fillWidth = useMemo(
    () => calcFillWidth(internalValue),
    [calcFillWidth, internalValue],
  );

  return (
    <div className={styles.sliderWrapper}>
      {label && (
        <div className={styles.label}>
          {label}:
          <input
            className={styles.value}
            value={Math.round(internalValue)}
            onChange={handleInputChange}
          />
        </div>
      )}
      <div
        className={`${styles.track} ${dragging ? styles.dragging : ''} ${isInitial ? styles.initial : ''}`}
        ref={trackRef}
        onPointerDown={handlePointerDown}
      >
        <div
          className={styles.fill}
          style={{
            width: `${fillWidth}px`,
          }}
        />
        <div
          className={styles.thumb}
          style={{
            left: `${thumbLeft}px`,
          }}
        />
      </div>
    </div>
  );
};

const propsEqual = (
  prev: Readonly<React.ComponentProps<typeof Slider>>,
  next: Readonly<React.ComponentProps<typeof Slider>>,
) => {
  return (
    prev.value === next.value &&
    prev.min === next.min &&
    prev.max === next.max &&
    prev.step === next.step &&
    prev.label === next.label
  );
};

export default React.memo(Slider, propsEqual);
