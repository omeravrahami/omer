import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import he from './locales/he.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'he', name: 'עברית', nativeName: 'Hebrew', isRTL: true },
  { code: 'en', name: 'English', nativeName: 'אנגלית', isRTL: false },
] as const;

export type LanguageCode = 'he' | 'en';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    lng: 'he',
    fallbackLng: 'he',
    interpolation: { escapeValue: false },
  });

export function applyLanguageDirection(lang: LanguageCode): boolean {
  const isRTL = lang === 'he';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    return true; // needs reload
  }
  return false;
}

export default i18n;
