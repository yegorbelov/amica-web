import type { SubTab } from '@/contexts/settings/types';
import type { SettingSearchItem } from './globalSearchTypes';

const PROFILE_TAB_KEYWORDS: { id: NonNullable<SubTab>; keywords: string[] }[] =
  [
    { id: 'account', keywords: ['account', 'аккаунт', 'профиль', 'profile'] },
    { id: 'language', keywords: ['language', 'язык', 'lang'] },
    {
      id: 'privacy',
      keywords: ['privacy', 'приватность', 'конфиденциальность'],
    },
    {
      id: 'appearance',
      keywords: ['appearance', 'внешний вид', 'тема', 'theme'],
    },
    {
      id: 'active_sessions',
      keywords: ['sessions', 'сессии', 'устройства', 'devices'],
    },
  ];

export function searchSettingsClient(query: string): SettingSearchItem[] {
  if (!query || query.trim().length < 1) return [];
  const lower = query.trim().toLowerCase();
  return PROFILE_TAB_KEYWORDS.filter((tab) =>
    tab.keywords.some((k) => k.includes(lower) || lower.includes(k)),
  ).map((tab) => ({ id: tab.id }));
}
