import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all language files
import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import gu from './locales/gu.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import pa from './locales/pa.json';
import or from './locales/or.json';
import as from './locales/as.json';
import ur from './locales/ur.json';
import kok from './locales/kok.json';
import sa from './locales/sa.json';

// Configure i18next with compatibility JSON v3 format
// This suppresses the Intl.PluralRules warning on React Native
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
      te: { translation: te },
      kn: { translation: kn },
      ml: { translation: ml },
      gu: { translation: gu },
      bn: { translation: bn },
      mr: { translation: mr },
      pa: { translation: pa },
      or: { translation: or },
      as: { translation: as },
      ur: { translation: ur },
      kok: { translation: kok },
      sa: { translation: sa },
    },
    lng: 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v3', // Use v3 format for React Native compatibility
    interpolation: {
      escapeValue: false,
    },
  });

// Load saved language preference on initialization
const initLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('userLanguage');
    if (savedLanguage) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.error('Error loading language preference:', error);
  }
};

initLanguage();

export default i18n;

