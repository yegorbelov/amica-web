import React, {
  memo,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './DatePickerModal.module.scss';

import type { DateKey } from './DateSeparator';
import { Icon } from '../Icons/AutoIcons';
import Button from '../ui/button/Button';
import { useTranslation } from '@/contexts/languageCore';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDates: DateKey[];
  initialDateKey?: DateKey | null;
  onSelectDate: (dateKey: DateKey) => void;
}

const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 0] as const;

function getWeekdayLabels(locale: string): string[] {
  return WEEKDAY_KEYS.map((d) => {
    const date = new Date(2024, 0, d);
    return date.toLocaleDateString(locale, { weekday: 'short' });
  });
}

const toDateKey = (d: Date): DateKey =>
  d.getFullYear() +
  '-' +
  String(d.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(d.getDate()).padStart(2, '0');

const getCalendarDays = (year: number, month: number): (DateKey | null)[] => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstWeekday = first.getDay();
  const startPad = WEEKDAY_KEYS.indexOf(
    firstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
  );
  const daysInMonth = last.getDate();
  const result: (DateKey | null)[] = [];
  for (let i = 0; i < startPad; i++) result.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    result.push(toDateKey(new Date(year, month, day)));
  }
  return result;
};

/** YYYY-MM from (year, monthIndex). */
const toMonthKey = (year: number, month: number) => `${year}-${month}`;

/** Find in availableDates the date nearest to dateKey (by calendar days). */
const findNearestDate = (
  dateKey: DateKey,
  availableDates: DateKey[],
): DateKey | null => {
  if (availableDates.length === 0) return null;
  const target = new Date(dateKey + 'T12:00:00').getTime();
  let best = availableDates[0];
  let bestDiff = Infinity;
  for (const d of availableDates) {
    const diff = Math.abs(new Date(d + 'T12:00:00').getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
};

const LOCALE_MAP: Record<string, string> = { ua: 'uk' };

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  availableDates,
  initialDateKey,
  onSelectDate,
}) => {
  const { t, locale } = useTranslation();
  const intlLocale = LOCALE_MAP[locale] ?? locale;
  const weekdayLabels = useMemo(
    () => getWeekdayLabels(intlLocale),
    [intlLocale],
  );
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const monthList = useMemo(() => {
    if (availableDates.length === 0) {
      const now = new Date();
      return [{ year: now.getFullYear(), month: now.getMonth() }];
    }
    const sorted = [...availableDates].sort((a, b) => a.localeCompare(b));
    const first = new Date(sorted[0] + 'T12:00:00');
    const last = new Date(sorted[sorted.length - 1] + 'T12:00:00');
    const list: { year: number; month: number }[] = [];
    const startYear = first.getFullYear();
    const startMonth = first.getMonth();
    const endYear = last.getFullYear();
    const endMonth = last.getMonth();
    for (let y = startYear; y <= endYear; y++) {
      const mStart = y === startYear ? startMonth : 0;
      const mEnd = y === endYear ? endMonth : 11;
      for (let m = mStart; m <= mEnd; m++) {
        list.push({ year: y, month: m });
      }
    }
    return list;
  }, [availableDates]);

  const monthOrder = useMemo(
    () => monthList.map(({ year, month }) => toMonthKey(year, month)),
    [monthList],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  const setMonthRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) monthRefsMap.current.set(key, el);
  }, []);

  const getCurrentMonthIndex = useCallback((): number => {
    const container = scrollRef.current;
    if (!container || monthOrder.length === 0) return 0;
    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;
    for (let i = 0; i < monthOrder.length; i++) {
      const div = monthRefsMap.current.get(monthOrder[i]);
      if (!div) continue;
      const rect = div.getBoundingClientRect();
      if (rect.top <= viewportTop && viewportTop < rect.bottom) return i;
    }
    for (let i = 0; i < monthOrder.length; i++) {
      const div = monthRefsMap.current.get(monthOrder[i]);
      if (!div) continue;
      const rect = div.getBoundingClientRect();
      if (rect.bottom > viewportTop) return i;
    }
    return monthOrder.length - 1;
  }, [monthOrder]);

  const goPrevMonth = useCallback(() => {
    const i = getCurrentMonthIndex();
    if (i <= 0) return;
    const key = monthOrder[i - 1];
    monthRefsMap.current
      .get(key)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [monthOrder, getCurrentMonthIndex]);

  const goNextMonth = useCallback(() => {
    const i = getCurrentMonthIndex();
    if (i >= monthOrder.length - 1) return;
    const key = monthOrder[i + 1];
    monthRefsMap.current
      .get(key)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [monthOrder, getCurrentMonthIndex]);

  const updateVisibleMonth = useCallback(() => {
    const i = getCurrentMonthIndex();
    setCurrentMonthIndex(i);
  }, [getCurrentMonthIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateVisibleMonth();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isOpen, updateVisibleMonth]);

  const visibleMonthLabel = useMemo(() => {
    const safeIndex = Math.max(
      0,
      Math.min(currentMonthIndex, monthList.length - 1),
    );
    const item = monthList[safeIndex];
    if (!item) return '';
    return new Date(item.year, item.month).toLocaleDateString(intlLocale, {
      month: 'long',
      year: 'numeric',
    });
  }, [monthList, currentMonthIndex, intlLocale]);

  const handleSelect = useCallback(
    (dateKey: DateKey) => {
      const target = availableSet.has(dateKey)
        ? dateKey
        : findNearestDate(dateKey, availableDates);
      if (target) {
        onSelectDate(target);
        onClose();
      }
    },
    [availableDates, availableSet, onSelectDate, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      if (initialDateKey && scrollRef.current) {
        const [y, m] = initialDateKey.split('-').map(Number);
        const key = toMonthKey(y, m - 1);
        const idx = monthOrder.indexOf(key);
        if (idx >= 0) setCurrentMonthIndex(idx);
        const el = monthRefsMap.current.get(key);
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        setCurrentMonthIndex(0);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, initialDateKey, monthOrder]);

  if (!isOpen) return null;

  const content = (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label={t('datePicker.chooseDate')}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{t('datePicker.jumpToDate')}</h3>
          <Button className={styles.close} onClick={onClose} aria-label={t('buttons.close')}>
            <Icon name='Cross' />
          </Button>
        </div>
        <div className={styles.calendar}>
          <div className={styles.nav}>
            <button
              type='button'
              className={styles.navBtn}
              onClick={goPrevMonth}
              aria-label={t('datePicker.previousMonth')}
            >
              <Icon
                name='Arrow'
                rotate={180}
                className={styles.navBtnIconPrev}
              />
            </button>
            <span className={styles.monthLabel}>{visibleMonthLabel}</span>
            <button
              type='button'
              className={styles.navBtn}
              onClick={goNextMonth}
              aria-label={t('datePicker.nextMonth')}
            >
              <Icon name='Arrow' className={styles.navBtnIconNext} />
            </button>
          </div>
          <div className={styles.scrollWrap}>
            <div className={styles.scrollContainer} ref={scrollRef}>
              {monthList.map(({ year, month }) => {
                const monthKey = toMonthKey(year, month);
                const calendarDays = getCalendarDays(year, month);
                const monthLabel = new Date(year, month).toLocaleDateString(
                  intlLocale,
                  {
                    month: 'long',
                    year: 'numeric',
                  },
                );
                return (
                  <div
                    key={monthKey}
                    ref={(el) => setMonthRef(monthKey, el!)}
                    className={styles.monthBlock}
                    data-month={monthKey}
                  >
                    <div className={styles.monthBlockTitle}>{monthLabel}</div>
                    <div className={styles.weekdays}>
                      {weekdayLabels.map((label, i) => (
                        <span key={i} className={styles.weekday}>
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className={styles.days}>
                      {calendarDays.map((dateKey, i) => {
                        if (dateKey === null) {
                          return (
                            <span
                              key={`empty-${i}`}
                              className={styles.dayEmpty}
                            />
                          );
                        }
                        const hasMessages = availableSet.has(dateKey);
                        const active = initialDateKey === dateKey;
                        return (
                          <button
                            key={dateKey}
                            type='button'
                            className={`${styles.day} ${active ? styles.dayActive : ''} ${!hasMessages ? styles.dayNoMessages : ''}`}
                            onClick={() => handleSelect(dateKey)}
                            data-date-key={dateKey}
                          >
                            {new Date(dateKey + 'T12:00:00').getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default memo(DatePickerModal);
