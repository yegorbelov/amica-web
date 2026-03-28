import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import styles from './Profile.module.scss';
import { useSettings } from '@/contexts/settings/context';
import { useTranslation } from '@/contexts/languageCore';
import Input from '../SideBarMedia/Input';
import ColorPreview from './ColorPreview';
import type { GradientSuggested as GradientSuggestedType } from '@/contexts/settings/types';
import Button from '../ui/button/Button';

const suggestedColors = [
  '#007AFF',
  '#0091ff',
  '#2c77d1',
  '#5AC8FA',
  '#5856D6',
  '#6A5ACD',
  '#30B0C7',
  '#20B2AA',
  '#34C759',
  '#FF3B30',
  '#FF2D55',
  '#FF375F',
  // '#FFB07C',
  // '#FF9E7B',
  '#8E8E93',
  '#392828',
  '#000000',
];

const suggestedGradients: GradientSuggestedType[] = [
  {
    name: 'Sunset Candy',
    degree: '90deg',
    colors: [
      {
        color: '#ff0f7b',
        stop: '0%',
      },
      {
        color: '#f89b29',
        stop: '100%',
      },
    ],
  },
  {
    name: 'Midnight Calm',
    degree: '90deg',
    colors: [
      {
        color: '#9bafd9',
        stop: '0%',
      },
      {
        color: '#103783',
        stop: '100%',
      },
    ],
  },
  {
    name: 'Purple Shift',
    degree: '180deg',
    colors: [
      {
        color: '#d397fa',
        stop: '0%',
      },
      {
        color: '#8364e8',
        stop: '100%',
      },
    ],
  },
  {
    name: 'Deep Sea',
    degree: '168deg',
    colors: [
      {
        color: '#E57C00',
        stop: '0%',
      },
      {
        color: '#5e0000',
        stop: '100%',
      },
    ],
  },
  {
    name: 'Midnight Mist',
    degree: '270deg',
    colors: [
      {
        color: '#211F2F',
        stop: '0%',
      },
      {
        color: '#918ca9',
        stop: '100%',
      },
    ],
  },
  {
    name: 'Blue Abyss',
    degree: '180deg',
    colors: [
      {
        color: '#0968e5',
        stop: '0%',
      },
      {
        color: '#091970',
        stop: '100%',
      },
    ],
  },
  // {
  //   name: 'Plum Glow',
  //   degree: '168deg',
  //   colors: [
  //     { color: '#3e196e', stop: '0%' },
  //     { color: '#d46c76', stop: '50%' },
  //     { color: '#ffc07c', stop: '100%' },
  //   ],
  // },
  {
    name: 'Rust Furnace',
    degree: '0deg',
    colors: [
      { color: '#8c1105', stop: '0%' },
      { color: '#25221e', stop: '100%' },
    ],
  },
  {
    name: 'Dust & Ember',
    degree: '225deg',
    colors: [
      { color: '#1f140d', stop: '0%' },
      { color: '#9b8074', stop: '100%' },
    ],
  },
  {
    name: 'Steel & Flame',
    degree: '0deg',
    colors: [
      { color: '#5a6776', stop: '0%' },
      { color: '#ff7b74', stop: '100%' },
    ],
  },
  {
    name: 'Deep Abyss',
    degree: '270deg',
    colors: [
      { color: '#0e1c26', stop: '0%' },
      { color: '#2a454b', stop: '50%' },
      { color: '#294861', stop: '100%' },
    ],
  },
  {
    name: 'Tropical Mist',
    degree: '12deg',
    colors: [
      { color: '#239eab', stop: '0%' },
      { color: '#74deee', stop: '100%' },
    ],
  },
  {
    name: 'Blue Abyss',
    degree: '90deg',
    colors: [
      { color: '#08203e', stop: '0%' },
      { color: '#557c93', stop: '100%' },
    ],
  },
];

const MAX_CUSTOM_GRADIENT_COLORS = 5;
const DEFAULT_CUSTOM_GRADIENT = {
  degree: 168,
  colors: ['#ff0f7b', '#f89b29', '#8364e8', '#239eab', '#091970'],
};

const parseToHSL = (inputColor: string) => {
  const temp = document.createElement('div');
  temp.style.color = inputColor;
  document.body.appendChild(temp);

  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  const match = computed.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (!match) return null;

  const r = Number(match[1]) / 255;
  const g = Number(match[2]) / 255;
  const b = Number(match[3]) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const normalizeDegree = (value: number) => {
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const buildGradientFromEditor = (
  degree: number,
  colors: string[],
): GradientSuggestedType => {
  const activeColors = colors.slice(0, MAX_CUSTOM_GRADIENT_COLORS);
  const gradientColors =
    activeColors.length <= 1
      ? [
          { color: activeColors[0] ?? '#000000', stop: '0%' },
          { color: activeColors[0] ?? '#000000', stop: '100%' },
        ]
      : activeColors.map((color, index) => ({
          color,
          stop: `${Math.round((index / (activeColors.length - 1)) * 100)}%`,
        }));

  return {
    name: 'Custom',
    degree: `${normalizeDegree(degree)}deg`,
    colors: gradientColors,
  };
};

const parseGradientForEditor = (
  gradient: GradientSuggestedType | null,
  accentColor: string,
) => {
  if (!gradient?.colors?.length) {
    return {
      degree: DEFAULT_CUSTOM_GRADIENT.degree,
      colors: [accentColor, accentColor],
    };
  }

  const parsedDegree = Number.parseInt(gradient.degree, 10);
  const baseColors = gradient.colors.map((item) => item.color);
  const allSame = baseColors.every((item) => item === baseColors[0]);
  const colorCount = allSame
    ? 1
    : Math.min(Math.max(baseColors.length, 2), MAX_CUSTOM_GRADIENT_COLORS);

  return {
    degree: Number.isFinite(parsedDegree)
      ? normalizeDegree(parsedDegree)
      : DEFAULT_CUSTOM_GRADIENT.degree,
    colors: baseColors.slice(0, colorCount),
  };
};

const ColorPicker = () => {
  const { t } = useTranslation();
  const { setColor, color, gradient, setGradient } = useSettings();

  const hueRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const angleDialRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseToHSL(color), [color]);
  const hue = parsed?.h ?? 210;
  const saturation = parsed?.s ?? 100;
  const lightness = parsed?.l ?? 50;

  const animationFrameRef = useRef<number | null>(null);
  const targetColorRef = useRef({ h: hue, s: saturation, l: lightness });
  const initialGradientEditor = useMemo(
    () => parseGradientForEditor(gradient, color),
    [gradient, color],
  );
  const [customGradientDegree, setCustomGradientDegree] = useState(
    initialGradientEditor.degree,
  );
  const [customGradientColors, setCustomGradientColors] = useState<string[]>(
    initialGradientEditor.colors,
  );

  useEffect(() => {
    setCustomGradientDegree(initialGradientEditor.degree);
    setCustomGradientColors(initialGradientEditor.colors);
  }, [initialGradientEditor]);

  const customGradientPreview = useMemo(
    () => buildGradientFromEditor(customGradientDegree, customGradientColors),
    [customGradientDegree, customGradientColors],
  );

  const updateColor = useCallback(
    (h: number, s: number, l: number) => {
      targetColorRef.current = { h, s, l };
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const { h, s, l } = targetColorRef.current;
          setColor(`hsl(${h}, ${s}%, ${l}%)`);
          animationFrameRef.current = null;
        });
      }
    },
    [setColor],
  );

  const handleHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const newHue = Math.round((x / rect.width) * 360);

      updateColor(newHue, saturation, lightness);
    },
    [saturation, lightness, updateColor],
  );

  const handleArea = useCallback(
    (clientX: number, clientY: number) => {
      const el = areaRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);

      const newS = Math.round((x / rect.width) * 100);
      const newL = Math.round(100 - (y / rect.height) * 100);

      updateColor(hue, newS, newL);
    },
    [hue, updateColor],
  );

  const handleSuggestedColorClick = useCallback(
    (color: string) => {
      setColor(color);
    },
    [setColor],
  );

  const handleCustomGradientColorCount = useCallback(
    (count: number) => {
      setCustomGradientColors((prev) => {
        if (count <= prev.length) return prev.slice(0, count);
        const next = [...prev];
        while (next.length < count) {
          next.push(next[next.length - 1] ?? color);
        }
        return next;
      });
    },
    [color],
  );

  const handleCustomGradientColorChange = useCallback(
    (index: number, value: string) => {
      setCustomGradientColors((prev) =>
        prev.map((item, itemIndex) => (itemIndex === index ? value : item)),
      );
    },
    [],
  );

  const handleAngleDial = useCallback((clientX: number, clientY: number) => {
    const el = angleDialRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radians = Math.atan2(clientY - centerY, clientX - centerX);
    const degrees = normalizeDegree((radians * 180) / Math.PI + 90);
    setCustomGradientDegree(degrees);
  }, []);

  const handleApplyCustomGradient = useCallback(() => {
    setGradient(customGradientPreview);
  }, [customGradientPreview, setGradient]);

  return (
    <div className={styles.colorPickerContainer}>
      <div className={styles.suggestedColors}>
        <div className={styles.suggestedColorsTitle}>Suggestions</div>
        <div className={styles.suggestedColorsSubtitle}>Accent</div>
        <div className={styles.suggestedColorsContainer}>
          {suggestedColors.map((color) => (
            <ColorPreview
              onClick={() => handleSuggestedColorClick(color)}
              key={color}
              color={color}
            />
          ))}
        </div>
        <div className={styles.suggestedColorsSubtitle}>
          {t('colorPicker.messageBackground')}
        </div>

        <div className={styles.suggestedColorsContainer}>
          {suggestedGradients.map((g) => (
            <ColorPreview
              onClick={() => setGradient(g)}
              key={g.name}
              gradient={g}
            />
          ))}
        </div>
        <Button
          key={'color-picker-set-same-as-accent-button'}
          className={styles.setSameAsAccentButton}
          onClick={() =>
            setGradient({
              name: t('colorPicker.accent'),
              degree: '168deg',
              colors: [
                { color, stop: '0%' },
                { color, stop: '100%' },
              ],
            })
          }
        >
          {t('colorPicker.setSameAsAccent')}
        </Button>
      </div>

      <div className={styles.customGradientSection}>
        <div className={styles.suggestedColorsTitle}>
          {t('colorPicker.customGradient')}
        </div>
        <div className={styles.customGradientPreviewWrapper}>
          <button
            type='button'
            className={styles.customGradientPreviewButton}
            style={{
              background: `linear-gradient(${customGradientPreview.degree}, ${customGradientPreview.colors.map((item) => `${item.color} ${item.stop}`).join(', ')})`,
            }}
            onClick={handleApplyCustomGradient}
            aria-label={t('colorPicker.useCustomGradientAria')}
          />
          <div className={styles.customGradientPreviewInfo}>
            <div>
              {customGradientColors.length} {t('colorPicker.colorCount')}
            </div>
            <div>{customGradientDegree}deg</div>
          </div>
        </div>
        <div className={styles.customGradientCountRow}>
          {[1, 2, 3, 4, 5].map((count) => (
            <Button
              key={`custom-gradient-count-${count}`}
              type='button'
              className={`${styles.customGradientCountButton} ${
                customGradientColors.length === count ? styles.active : ''
              }`}
              onClick={() => handleCustomGradientColorCount(count)}
            >
              {count}
            </Button>
          ))}
        </div>
        <div className={styles.customGradientColorsGrid}>
          {customGradientColors.map((customColor, index) => (
            <label
              key={`custom-gradient-color-${index}`}
              className={styles.customGradientColorCard}
            >
              <span className={styles.customGradientColorLabel}>
                {t('colorPicker.gradientColor')} {index + 1}
              </span>
              <input
                className={styles.customGradientColorInput}
                type='color'
                value={customColor}
                onChange={(e) =>
                  handleCustomGradientColorChange(index, e.target.value)
                }
                aria-label={`${t('colorPicker.gradientColor')} ${index + 1}`}
              />
              <span className={styles.customGradientColorValue}>
                {customColor.toUpperCase()}
              </span>
            </label>
          ))}
        </div>
        <div className={styles.customGradientAngleSection}>
          <div className={styles.customGradientAngleHeader}>
            <span>{t('colorPicker.angle')}</span>
            <span>{customGradientDegree}deg</span>
          </div>
          <div
            ref={angleDialRef}
            className={styles.customGradientAngleDial}
            onPointerDown={(e) => handleAngleDial(e.clientX, e.clientY)}
            onPointerMove={(e) =>
              e.buttons === 1 && handleAngleDial(e.clientX, e.clientY)
            }
          >
            <div className={styles.customGradientAngleDialInner} />
            <div
              className={styles.customGradientAngleIndicator}
              style={{ rotate: `${customGradientDegree}deg` }}
            />
          </div>
          <input
            className={styles.customGradientAngleSlider}
            type='range'
            min='0'
            max='359'
            value={customGradientDegree}
            onChange={(e) => setCustomGradientDegree(Number(e.target.value))}
            aria-label={t('colorPicker.gradientAngle')}
          />
        </div>
        <Button
          key='color-picker-apply-custom-gradient-button'
          className={styles.setSameAsAccentButton}
          onClick={handleApplyCustomGradient}
        >
          {t('colorPicker.useCustomGradient')}
        </Button>
      </div>

      <div className={styles.colorInfo}>
        <div className={styles.colorPickerPreview} />
        <Input
          placeholder={t('colorPicker.color')}
          value={color}
          onChange={(value) => setColor(value)}
        />
      </div>
      <div
        ref={areaRef}
        className={styles.colorArea}
        style={{ background: `hsl(${hue}, 100%, 50%)` }}
        onPointerDown={(e) => handleArea(e.clientX, e.clientY)}
        onPointerMove={(e) =>
          e.buttons === 1 && handleArea(e.clientX, e.clientY)
        }
      >
        <div className={styles.colorAreaOverlayWhite} />
        <div className={styles.colorAreaOverlayBlack} />

        <div
          className={styles.colorThumb}
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`,
          }}
        />
      </div>
      <div
        ref={hueRef}
        className={styles.colorPickerBar}
        onPointerDown={(e) => handleHue(e.clientX)}
        onPointerMove={(e) => e.buttons === 1 && handleHue(e.clientX)}
      >
        <div
          className={styles.hueThumb}
          style={{
            left: `${(hue / 360) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default ColorPicker;
