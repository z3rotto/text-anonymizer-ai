
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AnonymizationControls } from './components/AnonymizationControls';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingIcon } from './components/LoadingIcon';
import { anonymizeText as callAnonymizeApi } from './services/geminiService';
import { ErrorNotification } from './components/ErrorNotification';
import { SettingsModal } from './components/SettingsModal';
import { MAX_TEXT_LENGTH, PII_CATEGORIES, PROJECT_TYPES, LOCAL_STORAGE_KEYS, SUPPORTED_LANGUAGES } from './constants';
import type { PiiCategory, ProjectType, LanguageCode } from './types';
import { useLanguage } from './contexts/LanguageContext';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker path globally
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
}

const App: React.FC = () => {
  const { t, setLanguage, language } = useLanguage();
  const [inputText, setInputText] = useState<string>('');
  const [originalInputTextForComparison, setOriginalInputTextForComparison] = useState<string>('');
  const [anonymizedText, setAnonymizedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [selectedPiiTypes, setSelectedPiiTypes] = useState<PiiCategory[]>([]);
  const defaultProjectTypeKey = PROJECT_TYPES.find(pt => pt.key === 'generic')?.key || PROJECT_TYPES[PROJECT_TYPES.length - 1].key;
  const [selectedProjectTypeKey, setSelectedProjectTypeKey] = useState<string>(defaultProjectTypeKey); 

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(LOCAL_STORAGE_KEYS.userApiKey) || '';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const storedPreference = localStorage.getItem(LOCAL_STORAGE_KEYS.darkMode);
    if (storedPreference !== null) { 
      return storedPreference === 'true';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const rootHtmlElement = document.documentElement;
    if (darkMode) {
      rootHtmlElement.classList.add('dark');
      localStorage.setItem(LOCAL_STORAGE_KEYS.darkMode, 'true');
    } else {
      rootHtmlElement.classList.remove('dark');
      localStorage.setItem(LOCAL_STORAGE_KEYS.darkMode, 'false');
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prevMode => !prevMode);
  }, []);

  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  const handleUserApiKeyChange = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem(LOCAL_STORAGE_KEYS.userApiKey, key);
  };
  
  const handleLanguageChange = (langCode: LanguageCode) => {
    setLanguage(langCode); // This will also update localStorage via LanguageContext
  };

  const handleProjectTypeChange = useCallback((projectKey: string) => {
    setSelectedProjectTypeKey(projectKey);
    const projectType = PROJECT_TYPES.find(p => p.key === projectKey);
    
    if (projectType?.defaultPiiFocus) {
      const newPiiSelection = PII_CATEGORIES.filter(cat => projectType.defaultPiiFocus!.includes(cat.key));
      setSelectedPiiTypes(newPiiSelection);
    } else {
      setSelectedPiiTypes([]); 
    }
  }, []); // Removed 't' as it's not directly used for setting state from PII_CATEGORIES

  useEffect(() => {
    // Initialize project type and PII types on load or language change
    handleProjectTypeChange(selectedProjectTypeKey);
  }, [handleProjectTypeChange, selectedProjectTypeKey, language]);


  const handleAnonymize = useCallback(async () => {
    if (!inputText.trim()) {
      setError(t('error.enterTextOrUpload'));
      return;
    }
    if (inputText.length > MAX_TEXT_LENGTH) {
      setError(t('error.textTooLong', { maxLength: MAX_TEXT_LENGTH }));
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnonymizedText('');
    setOriginalInputTextForComparison(inputText); 

    const projectTypeDetails = PROJECT_TYPES.find(p => p.key === selectedProjectTypeKey);

    try {
      const result = await callAnonymizeApi(
        inputText, 
        userApiKey, 
        selectedPiiTypes.map(p => p.promptTextIt), // Pass only Italian prompt texts
        projectTypeDetails?.promptSegmentIt // Pass only Italian prompt segment
      );
      setAnonymizedText(result);
    } catch (err) {
      console.error(t('error.anonymizationFailedConsole'), err);
      setError(err instanceof Error ? err.message : t('error.unknownAnonymizationError'));
    } finally {
      setIsLoading(false);
    }
  }, [inputText, selectedPiiTypes, selectedProjectTypeKey, userApiKey, t]);

  const handleTextInput = useCallback((text: string) => {
    setInputText(text);
    if (text.trim() && error) setError(null);
  }, [error]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      let extractedText = '';
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'txt' || fileExtension === 'md' || fileExtension === 'csv' || file.type.startsWith('text/')) {
        extractedText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error(t('error.fileReadFailed')));
          reader.readAsText(file);
        });
      } else if (fileExtension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (fileExtension === 'pdf' || file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
        }
        extractedText = fullText;
      } else {
        throw new Error(t('error.unsupportedFileType', { fileName: file.name }));
      }

      if (extractedText.length > MAX_TEXT_LENGTH) {
        setError(t('error.fileContentTooLong', { fileName: file.name, maxLength: MAX_TEXT_LENGTH }));
        setInputText('');
        setOriginalInputTextForComparison('');
      } else {
        setInputText(extractedText);
      }

    } catch (err) {
      console.error(t('error.fileProcessingErrorConsole'), err);
      const errorMessage = err instanceof Error ? err.message : t('error.fileProcessingErrorGeneric');
      const unsupportedFileTypeLabelText = t('error.unsupportedFileTypeLabel');
      setError(errorMessage.startsWith(unsupportedFileTypeLabelText) ? errorMessage : t('error.fileProcessingErrorDetail', {fileName: file.name, error: errorMessage}));
      setInputText('');
      setOriginalInputTextForComparison('');
    } finally {
      setIsLoading(false);
    }
  }, [t]); 

  const handleClear = useCallback(() => {
    setInputText('');
    setAnonymizedText('');
    setOriginalInputTextForComparison('');
    setFileName(null);
    handleProjectTypeChange(selectedProjectTypeKey); 
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedProjectTypeKey, handleProjectTypeChange]);

  const handlePiiTypeChange = (categoryKey: string) => {
    setSelectedPiiTypes(prev => {
      const existing = prev.find(p => p.key === categoryKey);
      if (existing) {
        return prev.filter(p => p.key !== categoryKey);
      } else {
        const categoryToAdd = PII_CATEGORIES.find(p => p.key === categoryKey);
        return categoryToAdd ? [...prev, categoryToAdd] : prev;
      }
    });
  };
  
  const currentApiKeyInUse = userApiKey || 
    (typeof process !== 'undefined' && process.env && process.env.API_KEY ? t('settings.defaultApiKey') : t('settings.noDefaultApiKey'));


  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 dark:from-slate-800 dark:via-slate-900 dark:to-sky-900 flex flex-col items-center justify-center p-4 relative overflow-hidden light-stream">
      <div className="absolute inset-0 pattern-bg opacity-30 dark:opacity-10 z-0"></div>
      <div className="relative z-10 w-full max-w-4xl space-y-6 md:space-y-8">
        <Header 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode}
          onOpenSettings={openSettingsModal}
        />
        
        <main className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-2xl dark:shadow-sky-900/50 rounded-xl p-4 sm:p-6 md:p-10 space-y-6 transform transition-all duration-500 hover:shadow-sky-200/50 dark:hover:shadow-sky-700/60">
          {error && <ErrorNotification message={error} onClose={() => setError(null)} />}
          
          <AnonymizationControls
            inputText={inputText}
            onInputChange={handleTextInput}
            onFileUpload={handleFileUpload}
            onAnonymize={handleAnonymize}
            onClear={handleClear}
            isLoading={isLoading}
            fileName={fileName}
            fileInputRef={fileInputRef}
            piiCategories={PII_CATEGORIES} 
            selectedPiiTypes={selectedPiiTypes} 
            onPiiTypeChange={handlePiiTypeChange}
            projectTypes={PROJECT_TYPES} 
            selectedProjectTypeKey={selectedProjectTypeKey}
            onProjectTypeChange={handleProjectTypeChange}
          />

          {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-2 py-8">
              <LoadingIcon className="w-12 h-12 text-sky-500 dark:text-sky-400" />
              <p className="text-sky-600 dark:text-sky-300 font-medium">{t('anonymizingInProgress')}</p>
            </div>
          )}

          {(anonymizedText || originalInputTextForComparison) && !isLoading && (
            <ResultDisplay 
              originalText={originalInputTextForComparison} 
              anonymizedText={anonymizedText} 
            />
          )}
        </main>
        
        <Footer />
      </div>
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={closeSettingsModal}
          currentApiKey={userApiKey}
          onApiKeyChange={handleUserApiKeyChange}
          currentLanguage={language}
          onLanguageChange={handleLanguageChange}
          supportedLanguages={SUPPORTED_LANGUAGES}
          apiKeyInUse={currentApiKeyInUse}
        />
      )}
    </div>
  );
};

export default App;
