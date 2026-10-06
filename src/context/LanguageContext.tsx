import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AppLanguage,
  AppCurrency,
  TranslationDict,
  TRANSLATIONS,
  SUPPORTED_LANGUAGES,
  getSavedLanguage,
  setSavedLanguage as persistSavedLanguage,
  getSavedCurrency,
  setSavedCurrency as persistSavedCurrency,
  formatCurrency,
  formatCurrencyCompact,
  applyLanguageDirection,
  translateWithGoogleNative,
  translateWithGoogleNativeBatch
} from '../utils/localization';
import { initializeGoogleTranslate, applyGoogleTranslation } from '../utils/googleTranslate';

interface LanguageContextValue {
  currentLanguage: AppLanguage;
  currentCurrency: AppCurrency;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
  t: TranslationDict;
  setLanguage: (lang: AppLanguage) => void;
  setCurrency: (curr: AppCurrency) => void;
  formatMoney: (usdAmount: number) => string;
  formatMoneyCompact: (usdAmount: number) => string;
  isRTL: boolean;
  translateWithGoogle: (text: string) => Promise<string>;
  translateBatchWithGoogle: (texts: string[]) => Promise<Record<string, string>>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<AppLanguage>(() => getSavedLanguage());
  const [currentCurrency, setCurrentCurrencyState] = useState<AppCurrency>(() => getSavedCurrency());

  // Check RTL
  const isRTL = currentLanguage === 'he' || currentLanguage === 'ar';

  // Apply direction, sync to storage, and kick in Google translation tools
  useEffect(() => {
    applyLanguageDirection(currentLanguage);
    initializeGoogleTranslate().then(() => {
      applyGoogleTranslation(currentLanguage);
    }).catch(() => {});
  }, [currentLanguage]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setCurrentLanguageState(lang);
    persistSavedLanguage(lang);
  }, []);

  const setCurrency = useCallback((curr: AppCurrency) => {
    setCurrentCurrencyState(curr);
    persistSavedCurrency(curr);
  }, []);

  // Listen to external language / currency events
  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail && e.detail !== currentLanguage) {
        setCurrentLanguageState(e.detail);
      }
    };
    const handleCurrChange = (e: any) => {
      if (e.detail && e.detail !== currentCurrency) {
        setCurrentCurrencyState(e.detail);
      }
    };

    window.addEventListener('signaldesk_language_changed', handleLangChange);
    window.addEventListener('signaldesk_currency_changed', handleCurrChange);

    return () => {
      window.removeEventListener('signaldesk_language_changed', handleLangChange);
      window.removeEventListener('signaldesk_currency_changed', handleCurrChange);
    };
  }, [currentLanguage, currentCurrency]);

  const t: TranslationDict = { ...TRANSLATIONS.en, ...(TRANSLATIONS[currentLanguage] || {}) };

  const formatMoney = useCallback((usdAmount: number) => {
    return formatCurrency(usdAmount, currentCurrency);
  }, [currentCurrency]);

  const formatMoneyCompact = useCallback((usdAmount: number) => {
    return formatCurrencyCompact(usdAmount, currentCurrency);
  }, [currentCurrency]);

  const translateWithGoogle = useCallback(async (text: string) => {
    return translateWithGoogleNative(text, currentLanguage, 'en');
  }, [currentLanguage]);

  const translateBatchWithGoogle = useCallback(async (texts: string[]) => {
    return translateWithGoogleNativeBatch(texts, currentLanguage, 'en');
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        currentCurrency,
        availableLanguages: SUPPORTED_LANGUAGES,
        t,
        setLanguage,
        setCurrency,
        formatMoney,
        formatMoneyCompact,
        isRTL,
        translateWithGoogle,
        translateBatchWithGoogle
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback safe defaults if rendered outside of provider
    const fallbackLang = getSavedLanguage();
    const fallbackCurr = getSavedCurrency();
    return {
      currentLanguage: fallbackLang,
      currentCurrency: fallbackCurr,
      availableLanguages: SUPPORTED_LANGUAGES,
      t: TRANSLATIONS[fallbackLang] || TRANSLATIONS.en,
      setLanguage: persistSavedLanguage,
      setCurrency: persistSavedCurrency,
      formatMoney: (usd) => formatCurrency(usd, fallbackCurr),
      formatMoneyCompact: (usd) => formatCurrencyCompact(usd, fallbackCurr),
      isRTL: fallbackLang === 'he' || fallbackLang === 'ar',
      translateWithGoogle: async (text) => text,
      translateBatchWithGoogle: async (texts) => {
        const obj: Record<string, string> = {};
        for (const t of texts) obj[t] = t;
        return obj;
      }
    };
  }
  return context;
};
