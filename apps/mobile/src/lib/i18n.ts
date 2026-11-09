import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'de';

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, tr: { translation: tr }, en: { translation: en } },
  lng: ['de', 'tr', 'en'].includes(deviceLanguage) ? deviceLanguage : 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export default i18n;
