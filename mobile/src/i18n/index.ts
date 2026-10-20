import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Language } from '@/api/types';
import { storage } from '@/storage';

import bn from './locales/bn.json';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import or from './locales/or.json';
import pa from './locales/pa.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

/**
 * Static UI text comes only from these locale files — nothing is translated at runtime.
 * Adding a language: add its JSON file and one entry here.
 */
export const LANGUAGES: { code: Language; nativeName: string; englishName: string; speechLocale: string }[] = [
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', speechLocale: 'ta-IN' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', speechLocale: 'hi-IN' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', speechLocale: 'te-IN' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', speechLocale: 'kn-IN' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', speechLocale: 'mr-IN' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', speechLocale: 'bn-IN' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', speechLocale: 'gu-IN' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', speechLocale: 'ml-IN' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', speechLocale: 'pa-IN' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia', speechLocale: 'or-IN' },
  { code: 'en', nativeName: 'English', englishName: 'English', speechLocale: 'en-IN' },
];

const LOCALES: Record<Language, object> = { en, ta, hi, te, kn, mr, bn, gu, ml, pa, or };

const LANGUAGE_KEY = 'agrismart.language';
const supported = new Set(LANGUAGES.map((l) => l.code));

export const isLanguage = (value: string | null | undefined): value is Language =>
  Boolean(value && supported.has(value as Language));

export function speechLocale(language: Language): string {
  return LANGUAGES.find((l) => l.code === language)?.speechLocale ?? 'en-IN';
}

// Initialised synchronously at import (resources are bundled), so no component can render
// before i18n is ready; the saved language is applied by `initI18n` right after.
// eslint-disable-next-line import/no-named-as-default-member -- configuring the default instance
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(LOCALES).map(([code, translation]) => [code, { translation }])),
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

/** Returns the saved language, or null on first launch (the app then asks the farmer). */
export async function initI18n(): Promise<Language | null> {
  const saved = await storage.get(LANGUAGE_KEY);
  const device = getLocales()[0]?.languageCode;
  const initial: Language = isLanguage(saved) ? saved : isLanguage(device) ? device : 'en';
  // eslint-disable-next-line import/no-named-as-default-member -- the shared instance react-i18next uses
  await i18n.changeLanguage(initial);
  return isLanguage(saved) ? saved : null;
}

export async function setLanguage(language: Language): Promise<void> {
  await storage.set(LANGUAGE_KEY, language);
  // eslint-disable-next-line import/no-named-as-default-member -- the shared instance react-i18next uses
  await i18n.changeLanguage(language);
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'en';
}

export default i18n;
