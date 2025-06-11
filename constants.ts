
import type { PiiCategory, ProjectType, Language } from './types';

export const MAX_TEXT_LENGTH = 15000; // Character limit for input text

export const LOCAL_STORAGE_KEYS = {
  userApiKey: 'anonymizer_userApiKey',
  language: 'anonymizer_language',
  darkMode: 'anonymizer_darkMode',
};

export const DEFAULT_API_KEY_ERROR_MESSAGE = 'Chiave API Gemini non configurata. Inseriscine una nelle impostazioni o tramite variabile d\'ambiente.';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ar', name: 'العربية' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'hi', name: 'हिन्दी' },
];

export const PII_CATEGORIES: PiiCategory[] = [
  { key: 'names', labelKey: 'pii.names.label', descriptionKey: 'pii.names.description', promptTextIt: 'Nomi e Cognomi' },
  { key: 'contacts', labelKey: 'pii.contacts.label', descriptionKey: 'pii.contacts.description', promptTextIt: 'Contatti (email, telefono)' },
  { key: 'addresses', labelKey: 'pii.addresses.label', descriptionKey: 'pii.addresses.description', promptTextIt: 'Indirizzi Fisici' },
  { key: 'personal_ids', labelKey: 'pii.personal_ids.label', descriptionKey: 'pii.personal_ids.description', promptTextIt: 'Identificativi Personali (CF, DocId)' },
  { key: 'financial_data', labelKey: 'pii.financial_data.label', descriptionKey: 'pii.financial_data.description', promptTextIt: 'Dati Finanziari (IBAN, Valori Monetari)' },
  { key: 'sensitive_dates', labelKey: 'pii.sensitive_dates.label', descriptionKey: 'pii.sensitive_dates.description', promptTextIt: 'Date Sensibili (Nascita)' },
  { key: 'online_ids', labelKey: 'pii.online_ids.label', descriptionKey: 'pii.online_ids.description', promptTextIt: 'Identificativi Online (IP, Username)' },
  { key: 'vehicle_ids', labelKey: 'pii.vehicle_ids.label', descriptionKey: 'pii.vehicle_ids.description', promptTextIt: 'Identificativi Veicoli (Targhe)' },
];

export const PROJECT_TYPES: ProjectType[] = [
  { 
    key: 'email', 
    labelKey: 'projectType.email.label', 
    descriptionKey: 'projectType.email.description',
    defaultPiiFocus: ['names', 'contacts', 'online_ids'],
    promptSegmentIt: 'Il testo è un\'email. Presta particolare attenzione a indirizzi email mittente/destinatario, firme, saluti e metadati potenzialmente presenti nel corpo del testo. Identifica e anonimizza anche eventuali tracker di apertura o link univoci.'
  },
  { 
    key: 'letter', 
    labelKey: 'projectType.letter.label', 
    descriptionKey: 'projectType.letter.description',
    defaultPiiFocus: ['names', 'addresses', 'contacts', 'personal_ids'],
    promptSegmentIt: 'Il testo è una lettera formale. Focalizzati su intestazioni, indirizzi del mittente e del destinatario, date specifiche, riferimenti a documenti e firme.'
  },
  { 
    key: 'contract', 
    labelKey: 'projectType.contract.label', 
    descriptionKey: 'projectType.contract.description',
    defaultPiiFocus: ['names', 'addresses', 'personal_ids', 'financial_data', 'sensitive_dates'],
    promptSegmentIt: 'Il testo è un documento legale o un contratto. Assicurati che tutte le parti contraenti, testimoni, notai, dettagli finanziari specifici (oltre ai [VALORE_MONETARIO] generici), numeri di protocollo, riferimenti a clausole specifiche con dati personali e date chiave siano accuratamente anonimizzati.'
  },
  {
    key: 'chat',
    labelKey: 'projectType.chat.label',
    descriptionKey: 'projectType.chat.description',
    defaultPiiFocus: ['names', 'contacts', 'online_ids', 'sensitive_dates'],
    promptSegmentIt: 'Il testo è una trascrizione di una chat o messaggistica. Identifica i nomi degli interlocutori (anche se solo nomi propri o username), numeri di telefono, email, e qualsiasi altro dato personale scambiato durante la conversazione. Fai attenzione a timestamp se associati a PII.'
  },
  { 
    key: 'generic', 
    labelKey: 'projectType.generic.label', 
    descriptionKey: 'projectType.generic.description',
    defaultPiiFocus: [],
    promptSegmentIt: 'Il testo è di natura generica. Applica le regole di anonimizzazione standard a tutte le PII rilevate, come descritto nelle categorie base.'
  }
];


export const ANONYMIZATION_PROMPT_TEMPLATE = `
Sei uno strumento esperto nella redazione di PII (Informazioni di Identificazione Personale). Il tuo compito è anonimizzare meticolosamente il testo seguente.
Sostituisci tutte le istanze di identificatori personali specifici con segnaposto generici.
Le PII da redigere includono, ma non sono limitate a:
- Nomi propri di persona, quando non accompagnati da un cognome (es. Mario) -> [NOME]
- Nomi e cognomi completi di persone (es. Mario Rossi) -> [NOME_COGNOME]
- Indirizzi email (es. mario.rossi@esempio.com) -> [INDIRIZZO_EMAIL]
- Numeri di telefono (es. (012) 345-6789, +390123456789) -> [NUMERO_TELEFONO]
- Indirizzi fisici (nomi di strade, numeri civici, numeri di appartamento/interno, città se non di fama mondiale, stati/province, CAP/codici postali) -> [INDIRIZZO_FISICO]
- Codici Fiscali, numeri di carta d'identità o altri numeri di identificazione nazionale -> [IDENTIFICATIVO_PERSONALE]
- Numeri di conto corrente bancario, IBAN -> [NUMERO_CONTO_BANCARIO]
- Numeri di carta di credito -> [NUMERO_CARTA_CREDITO]
- Date di nascita specifiche -> [DATA_NASCITA]
- Numeri di patente di guida -> [NUMERO_PATENTE]
- Numeri di passaporto -> [NUMERO_PASSAPORTO]
- Numeri di targa di veicoli -> [TARGA_VEICOLO]
- Indirizzi IP -> [INDIRIZZO_IP]
- Nomi utente o handle online se appaiono correlati a PII o univoci -> [NOME_UTENTE]
- Importi monetari specifici (es. 25 mila euro, €5000, $10.000) -> [VALORE_MONETARIO]
- Qualsiasi altro dato che potrebbe identificare univocamente un individuo o che è di natura sensibile.

Usa segnaposto in maiuscolo tra parentesi quadre come [TIPO_SEGNAPOSTO].
Conserva il più possibile la struttura originale, la formattazione (come interruzioni di riga) e il significato generale del testo.
Concentrati SOLO sulla rimozione o mascheramento delle PII.

Istruzioni specifiche basate sul tipo di progetto:
{PROJECT_SPECIFIC_INSTRUCTIONS}

Eventuale focus specifico su categorie PII selezionate dall'utente:
{PII_FOCUS_SECTION}

Non fornire alcun commento, spiegazione, preambolo o scusa.
Restituisci solo il testo completamente anonimizzato.

Testo da anonimizzare:
---
{TEXT_TO_ANONYMIZE}
---
Testo anonimizzato:
`;