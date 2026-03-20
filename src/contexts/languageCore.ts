import { createContext, useContext } from 'react';

const localeModules = import.meta.glob('/src/locales/*.ts', {
  eager: true,
  import: 'default',
});

type NestedMessages = { [k: string]: string | NestedMessages };

export const locales = Object.fromEntries(
  Object.entries(localeModules).map(([path, mod]) => {
    const lang = path.split('/').pop()?.replace('.ts', '') ?? 'en';
    return [lang, mod as NestedMessages];
  }),
) as Record<string, NestedMessages>;

export type Locale = keyof typeof locales;
export type Messages = NestedMessages;

export type LocaleKeys<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? K | `${K}.${LocaleKeys<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type LanguageContextType = {
  locale: Locale;
  messages: Messages;
  t: (path: LocaleKeys<Messages>) => string;
  changeLanguage: (lang: Locale) => void;
};

export const LanguageContext = createContext<LanguageContextType | null>(null);

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error('useTranslation must be used within LanguageProvider');
  return context;
};

export const availableLanguages: {
  code: Locale;
  country: string;
  name: string;
}[] = [
  { code: 'en', country: 'gb', name: 'English' },
  { code: 'ru', country: 'ru', name: 'Русский' },
  // { code: 'ar', country: 'sa', name: 'العربية' },
  { code: 'es', country: 'es', name: 'Español' },
  { code: 'fr', country: 'fr', name: 'Français' },
  { code: 'de', country: 'de', name: 'Deutsch' },
  { code: 'it', country: 'it', name: 'Italiano' },
  { code: 'zh', country: 'cn', name: '中文' },
  { code: 'ja', country: 'jp', name: '日本語' },
  { code: 'ko', country: 'kr', name: '한국어' },
  { code: 'ua', country: 'ua', name: 'Українська' },
];
