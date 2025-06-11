
export type LanguageCode = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'zh-CN' | 'ja' | 'ar' | 'tr' | 'hi';

export interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}

export interface Language {
  code: LanguageCode;
  name: string; // Native name of the language
}

export interface PiiCategory {
  key: string;
  labelKey: string; // Key for translation, e.g., "pii.names.label"
  descriptionKey?: string; // Key for translation, e.g., "pii.names.description"
  promptTextIt: string; // Specific text in Italian for the prompt to the AI
}

export interface ProjectType {
  key: string;
  labelKey: string; // Key for translation
  descriptionKey: string; // Key for translation
  defaultPiiFocus?: string[]; // Array of PiiCategory keys
  promptSegmentIt: string; // Specific instructions in Italian for the prompt to the AI
}