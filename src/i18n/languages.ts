export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'kn';

export interface LanguageOption {
  code: SupportedLanguage;
  nativeLabel: string;
  englishLabel: string;
  scriptLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {code: 'en', nativeLabel: 'English', englishLabel: 'English', scriptLabel: 'Latin'},
  {code: 'hi', nativeLabel: 'हिन्दी', englishLabel: 'Hindi', scriptLabel: 'देवनागरी'},
  {code: 'mr', nativeLabel: 'मराठी', englishLabel: 'Marathi', scriptLabel: 'देवनागरी'},
  {code: 'ta', nativeLabel: 'தமிழ்', englishLabel: 'Tamil', scriptLabel: 'தமிழ்'},
  {code: 'te', nativeLabel: 'తెలుగు', englishLabel: 'Telugu', scriptLabel: 'తెలుగు'},
  {code: 'kn', nativeLabel: 'ಕನ್ನಡ', englishLabel: 'Kannada', scriptLabel: 'ಕನ್ನಡ'},
];

export const LANGUAGE_STORAGE_KEY = 'aarvi_language_v1';
