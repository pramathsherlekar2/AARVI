import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, type SupportedLanguage} from './languages';
import {en} from './locales/en';
import {hi} from './locales/hi';
import {kn} from './locales/kn';
import {mr} from './locales/mr';
import {ta} from './locales/ta';
import {te} from './locales/te';

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved as SupportedLanguage;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'en';
}

const initialLng = getInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: {translation: en},
    hi: {translation: hi},
    mr: {translation: mr},
    ta: {translation: ta},
    te: {translation: te},
    kn: {translation: kn},
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLng;
}

export function setAppLanguage(lang: SupportedLanguage) {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage write errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export default i18n;
