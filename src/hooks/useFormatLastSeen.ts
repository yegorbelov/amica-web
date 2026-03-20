import { useCallback } from 'react';
import { useTranslation } from '@/contexts/languageCore';

const LOCALE_MAP: Record<string, string> = { ua: 'uk' };

export function useFormatLastSeen() {
  const { t, locale } = useTranslation();
  const intlLocale = LOCALE_MAP[locale] ?? locale;

  const formatLastSeen = useCallback(
    (lastSeenString: string | null): string => {
      if (!lastSeenString) return t('lastSeen.longTimeAgo');

      try {
        const lastSeen = new Date(lastSeenString);
        const now = new Date();
        const diffMs = now.getTime() - lastSeen.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins <= 2) return t('lastSeen.online');

        const timeStr = lastSeen.toLocaleTimeString(intlLocale, {
          hour: '2-digit',
          minute: '2-digit',
        });

        if (lastSeen.toDateString() === now.toDateString()) {
          if (diffMins < 60) {
            return `${diffMins} ${t('lastSeen.minutesAgo')}`;
          }
          return `${t('lastSeen.todayAt')} ${timeStr}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastSeen.toDateString() === yesterday.toDateString()) {
          return `${t('lastSeen.yesterdayAt')} ${timeStr}`;
        }

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        if (lastSeen >= startOfWeek) {
          const weekday = lastSeen.toLocaleDateString(intlLocale, {
            weekday: 'long',
          });
          return `${weekday} ${timeStr}`;
        }

        if (lastSeen.getFullYear() === now.getFullYear()) {
          const dateStr = lastSeen.toLocaleDateString(intlLocale, {
            month: 'short',
            day: 'numeric',
          });
          return `${dateStr} ${timeStr}`;
        }

        return lastSeen.toLocaleDateString(intlLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return t('lastSeen.longTimeAgo');
      }
    },
    [t, intlLocale],
  );

  const formatLastSeenShort = useCallback(
    (lastSeenString: string | null): string => {
      if (!lastSeenString) return t('lastSeen.longAgo');

      try {
        const lastSeen = new Date(lastSeenString);
        const now = new Date();
        const diffMs = now.getTime() - lastSeen.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins <= 2) return t('lastSeen.online');
        if (diffMins < 60) return `${diffMins}${t('lastSeen.mAgo')}`;
        if (diffHours < 24) return `${diffHours}${t('lastSeen.hAgo')}`;
        if (diffDays === 1) return t('lastSeen.yesterday');
        if (diffDays < 7) return `${diffDays}${t('lastSeen.dAgo')}`;
        if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          return `${weeks}${t('lastSeen.wAgo')}`;
        }
        if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          return `${months}${t('lastSeen.moAgo')}`;
        }
        const years = Math.floor(diffDays / 365);
        return `${years}${t('lastSeen.yAgo')}`;
      } catch {
        return t('lastSeen.longAgo');
      }
    },
    [t],
  );

  return { formatLastSeen, formatLastSeenShort };
}
