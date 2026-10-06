import React, { useState, useEffect } from 'react';
import { 
  Globe2, 
  Coins, 
  Settings2, 
  Check, 
  Volume2, 
  Sparkles, 
  X, 
  ShieldCheck, 
  Cpu, 
  Wallet, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sliders,
  Radio,
  ArrowRight,
  Zap,
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { 
  AppLanguage, 
  AppCurrency, 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_CURRENCIES, 
  TRANSLATIONS,
  getSavedLanguage, 
  setSavedLanguage, 
  getSavedCurrency, 
  setSavedCurrency,
  formatCurrency,
  formatCurrencyCompact,
  CryptoPlatformConfig,
  getSavedCryptoConfig,
  setSavedCryptoConfig,
  DEFAULT_BRIEFINGS_BY_LANG
} from '../utils/localization';
import { 
  SovereignVoicePersona, 
  SOVEREIGN_VOICE_PERSONAS,
  getSavedVoicePersona, 
  setSavedVoicePersona, 
  getSavedVoiceSpeed, 
  setSavedVoiceSpeed,
  getSavedVoiceSpokenLanguage,
  setSavedVoiceSpokenLanguage,
  getEffectiveSpeechLanguage,
  MULTILINGUAL_VOICE_SAMPLES,
  speakSovereignText,
  stopSovereignSpeech
} from '../utils/sovereignVoice';
import { playAlarmSound } from '../utils/sound';

interface LocalizationCurrencyCryptoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: AppLanguage;
  currentCurrency: AppCurrency;
  onLanguageChange: (lang: AppLanguage) => void;
  onCurrencyChange: (curr: AppCurrency) => void;
  onOpenCryptoTreasury?: () => void;
  onShowToast?: (msg: string) => void;
  initialTab?: 'language' | 'currency' | 'crypto';
}

export const LocalizationCurrencyCryptoModal: React.FC<LocalizationCurrencyCryptoModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  currentCurrency,
  onLanguageChange,
  onCurrencyChange,
  onOpenCryptoTreasury,
  onShowToast,
  initialTab = 'language'
}) => {
  const [activeTab, setActiveTab] = useState<'language' | 'currency' | 'crypto'>(initialTab);
  const [voicePersona, setVoicePersona] = useState<SovereignVoicePersona>(getSavedVoicePersona());
  const [voiceSpeed, setVoiceSpeed] = useState<number>(getSavedVoiceSpeed());
  const [spokenLanguage, setSpokenLanguage] = useState<string>(getSavedVoiceSpokenLanguage());
  const [isSpeakingSample, setIsSpeakingSample] = useState(false);
  const [cryptoConfig, setCryptoConfig] = useState<CryptoPlatformConfig>(getSavedCryptoConfig());
  const [customConverterAmount, setCustomConverterAmount] = useState<number>(100000); // Clean $100K baseline
  const [isMaximized, setIsMaximized] = useState(false);
  const [geminiVoiceSample, setGeminiVoiceSample] = useState<{
    spokenText?: string;
    phoneticGuide?: string;
    englishTranslation?: string;
    provider?: string;
    personaCharacteristics?: string[];
  } | null>(null);
  const [isLoadingVoiceSample, setIsLoadingVoiceSample] = useState(false);

  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  const activeLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const activeCurrMeta = SUPPORTED_CURRENCIES.find(c => c.code === currentCurrency) || SUPPORTED_CURRENCIES[0];

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  // Handle spoken voice sample in active language or explicit spoken language via Gemini 3.8 Flash
  const handleTestVoiceSample = async (explicitLangCode?: string) => {
    stopSovereignSpeech();
    setIsSpeakingSample(true);
    setIsLoadingVoiceSample(true);
    playAlarmSound('acknowledge', 0.1);

    const effective = getEffectiveSpeechLanguage(explicitLangCode);
    let sampleText = MULTILINGUAL_VOICE_SAMPLES[effective.langCode] || MULTILINGUAL_VOICE_SAMPLES.en;

    try {
      const resp = await fetch('/api/voice/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenLanguage: effective.langCode,
          persona: voicePersona,
          speed: voiceSpeed
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.spokenText) {
          sampleText = data.spokenText;
          setGeminiVoiceSample({
            spokenText: data.spokenText,
            phoneticGuide: data.phoneticGuide,
            englishTranslation: data.englishTranslation,
            provider: data.provider,
            personaCharacteristics: data.personaCharacteristics
          });
        }
      }
    } catch {
      // Fallback to local sovereign samples
    } finally {
      setIsLoadingVoiceSample(false);
    }

    speakSovereignText(sampleText, {
      persona: voicePersona,
      speed: voiceSpeed,
      lang: effective.speechLang,
      onEnd: () => setIsSpeakingSample(false),
      onError: () => setIsSpeakingSample(false)
    });

    const langName = SUPPORTED_LANGUAGES.find(l => l.code === effective.langCode)?.name || effective.langCode;
    onShowToast?.(`Speaking ${langName} using ${SOVEREIGN_VOICE_PERSONAS[voicePersona].displayName} (${effective.speechLang})`);
  };

  const handleSelectSpokenLanguage = (code: string) => {
    setSpokenLanguage(code);
    setSavedVoiceSpokenLanguage(code);
    playAlarmSound('acknowledge', 0.1);
    if (code === 'auto') {
      onShowToast?.(`AI Spoken Language set to Auto-Sync with written language (${activeLangMeta.name}).`);
    } else {
      const match = SUPPORTED_LANGUAGES.find(l => l.code === code);
      onShowToast?.(`AI Spoken Language explicitly set to ${match?.nativeName} (${match?.name}). All speech synthesizes in this language.`);
    }
  };

  const handleSelectLanguage = (lang: AppLanguage) => {
    onLanguageChange(lang);
    setSavedLanguage(lang);
    playAlarmSound('acknowledge', 0.1);
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    onShowToast?.(`Language switched to ${meta?.nativeName} (${meta?.name}). Everything written and heard updated.`);
  };

  const handleSelectCurrency = (curr: AppCurrency) => {
    onCurrencyChange(curr);
    setSavedCurrency(curr);
    playAlarmSound('acknowledge', 0.1);
    const meta = SUPPORTED_CURRENCIES.find(c => c.code === curr);
    onShowToast?.(`Reporting currency set to ${meta?.code} (${meta?.symbol}). All figures auto-converted.`);
  };

  const handleUpdateCryptoConfig = (updates: Partial<CryptoPlatformConfig>) => {
    const updated = { ...cryptoConfig, ...updates };
    setCryptoConfig(updated);
    setSavedCryptoConfig(updated);
    playAlarmSound('acknowledge', 0.1);
    onShowToast?.('Web3 & Crypto configurations updated.');
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4 md:p-6'
      } bg-black/80 backdrop-blur-md animate-fadeIn`}
      onClick={onClose}
    >
      <div 
        className={`relative w-full flex flex-col bg-stone-950 border border-stone-800/90 shadow-2xl overflow-hidden text-stone-200 transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'max-w-5xl xl:max-w-6xl h-full sm:h-[90vh] rounded-none sm:rounded-2xl'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER: Strict horizontal alignment */}
        <div className="shrink-0 h-16 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight leading-none truncate">
                Localization, Currencies & Crypto
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 mt-1 leading-none truncate">
                Configure Language Packs, reporting currency, and Web3 treasury.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="h-9 px-2.5 rounded-xl border border-stone-800 bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-white flex items-center gap-1 text-xs font-mono transition cursor-pointer"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-stone-800 bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION: Evenly aligned and centered */}
        <div className="shrink-0 h-12 px-3 sm:px-6 border-b border-stone-800/80 bg-stone-950 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('language')}
            className={`h-9 px-3 sm:px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'language'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-white hover:bg-stone-900'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            <span>Language Packs (Written & Heard)</span>
            <span className="px-1.5 py-0.2 rounded bg-stone-800 text-[10px] font-mono text-stone-300">14</span>
          </button>

          <button
            onClick={() => setActiveTab('currency')}
            className={`h-9 px-3 sm:px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'currency'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-white hover:bg-stone-900'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Currency Determination & FX</span>
            <span className="px-1.5 py-0.2 rounded bg-stone-800 text-[10px] font-mono text-stone-300">18 Pairs</span>
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`h-9 px-3 sm:px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'crypto'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-white hover:bg-stone-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Crypto & Web3 Configurations</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[10px] font-mono text-amber-400">Non-Custodial</span>
          </button>
        </div>

        {/* MODAL BODY: Scrollable with strictly aligned containers */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">

          {/* TAB 1: LANGUAGE PACKS (WRITTEN & HEARD) */}
          {activeTab === 'language' && (
            <div className="space-y-6">
              
              {/* Telemetry Overview Card: Everything Written & Everything Heard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      Everything Written
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {activeLangMeta.nativeName} ({activeLangMeta.name})
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      100% Native dictionary + Google Gemini contextual translation.
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                      Everything Heard
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-2">
                      <span>{SOVEREIGN_VOICE_PERSONAS[voicePersona].displayName}</span>
                      <span className="text-xs text-stone-400 font-mono">({activeLangMeta.speechLang})</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Executive briefings and voice chat synthesize in {activeLangMeta.name}.
                    </div>
                  </div>
                </div>
              </div>

              {/* Voice Persona & Live Spoken Preview Controller */}
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">
                      Google Speech Synthesis & Persona Configuration
                    </span>
                  </div>
                  <div className="text-xs font-mono text-stone-400">
                    Speech Engine: Google Neural / Native Browser W3C
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['Kore', 'Puck', 'Zephyr'] as const).map(p => {
                    const info = SOVEREIGN_VOICE_PERSONAS[p];
                    const isSelected = voicePersona === p;
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          setVoicePersona(p);
                          setSavedVoicePersona(p);
                          playAlarmSound('acknowledge', 0.1);
                        }}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{info.displayName}</span>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {info.description}
                        </div>
                        <div className="text-[10px] font-mono text-stone-500">
                          Pitch: {info.pitch}x · Pace: {info.rateMultiplier}x
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* AI Spoken Language Selector (Multilingual Speech Control) */}
                <div className="pt-3 border-t border-stone-800/80 space-y-2">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                    <label className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                      <span>AI Spoken Language (Voice Synthesis Engine)</span>
                    </label>
                    <span className="text-[11px] font-mono text-amber-400">
                      {spokenLanguage === 'auto' ? `Auto-Synced: ${activeLangMeta.name}` : `Fixed: ${SUPPORTED_LANGUAGES.find(l => l.code === spokenLanguage)?.name || spokenLanguage}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar p-0.5">
                    <button
                      onClick={() => handleSelectSpokenLanguage('auto')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        spokenLanguage === 'auto'
                          ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                          : 'bg-stone-950 border border-stone-800 text-stone-300 hover:border-stone-700 hover:text-white'
                      }`}
                    >
                      <span>⚡ Auto-Sync</span>
                      <span className="text-[10px] opacity-80">({activeLangMeta.flag})</span>
                    </button>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => handleSelectSpokenLanguage(lang.code)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                          spokenLanguage === lang.code
                            ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                            : 'bg-stone-950 border border-stone-800 text-stone-400 hover:border-stone-700 hover:text-white'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spoken Voice Test Button */}
                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span>Voice Speed:</span>
                    {( [0.85, 1.0, 1.25, 1.5] as const).map(spd => (
                      <button
                        key={spd}
                        onClick={() => {
                          setVoiceSpeed(spd);
                          setSavedVoiceSpeed(spd);
                        }}
                        className={`px-2 py-1 rounded-md text-xs font-mono font-bold transition cursor-pointer ${
                          voiceSpeed === spd
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleTestVoiceSample(spokenLanguage === 'auto' ? currentLanguage : spokenLanguage)}
                    disabled={isSpeakingSample || isLoadingVoiceSample}
                    className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeakingSample || isLoadingVoiceSample ? 'animate-bounce' : ''}`} />
                    <span>
                      {isLoadingVoiceSample ? 'Querying Gemini 3.8 Flash...' : isSpeakingSample ? 'Synthesizing...' : `Test Spoken Voice Sample (${getEffectiveSpeechLanguage(spokenLanguage === 'auto' ? currentLanguage : spokenLanguage).speechLang})`}
                    </span>
                  </button>
                </div>

                {/* Gemini 3.8 Flash Dynamic Voice Sample Details */}
                {geminiVoiceSample && (
                  <div className="p-3.5 rounded-xl bg-stone-950 border border-amber-500/30 space-y-2 mt-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">
                          Google Gemini 3.8 Flash Dynamic Voice Phrasing
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {geminiVoiceSample.provider || 'gemini-3.8-flash'}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white italic">
                      "{geminiVoiceSample.spokenText}"
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-900 text-xs">
                      <div>
                        <span className="text-stone-500 font-mono text-[11px] block">Pronunciation / Phonetic:</span>
                        <span className="text-stone-300">{geminiVoiceSample.phoneticGuide || 'Standard cadence'}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-mono text-[11px] block">English Translation:</span>
                        <span className="text-stone-300">{geminiVoiceSample.englishTranslation}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Supported Google Language Packs Grid: Strict horizontal and vertical alignment */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Select Active Google Language Pack
                  </h3>
                  <span className="text-xs text-stone-400 font-mono">13 Fully Supported Locales</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isSelected = lang.code === currentLanguage;
                    return (
                      <div
                        key={lang.code}
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl leading-none">{lang.flag}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white leading-none truncate">
                              {lang.nativeName}
                            </div>
                            <div className="text-xs text-stone-400 mt-1 leading-none truncate">
                              {lang.name} · <span className="font-mono text-[10px] text-stone-500">{lang.speechLang}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestVoiceSample(lang.code);
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-amber-400 flex items-center justify-center transition"
                            title={`Listen to sample in ${lang.name}`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURRENCY DETERMINATION & MULTI-CURRENCY ENGINE */}
          {activeTab === 'currency' && (
            <div className="space-y-6">
              
              {/* Header Telemetry */}
              <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    Active Reporting & Settlement Currency
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-stone-800 flex items-center justify-center font-mono font-bold text-amber-400 text-sm">
                      {activeCurrMeta.symbol}
                    </span>
                    <span>{activeCurrMeta.name} ({activeCurrMeta.code})</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      {activeCurrMeta.isCrypto ? 'On-Chain Web3' : 'Global Fiat'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cryptoConfig.autoConvertAllFinancials}
                      onChange={e => handleUpdateCryptoConfig({ autoConvertAllFinancials: e.target.checked })}
                      className="rounded border-stone-700 text-amber-500 focus:ring-amber-400"
                    />
                    <span>Auto-Convert All Financial Figures Across Platform</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Live Conversion Matrix & Calculator */}
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Live Conversion Calculator & Preview
                  </span>
                  <span className="text-xs font-mono text-stone-400">
                    Base: ${customConverterAmount.toLocaleString()} USD
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                    <div className="text-[10px] font-mono text-stone-400 uppercase">US Dollar (USD)</div>
                    <div className="text-base font-bold text-white mt-1">
                      {formatCurrency(customConverterAmount, 'USD')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                    <div className="text-[10px] font-mono text-stone-400 uppercase">Euro (EUR)</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {formatCurrency(customConverterAmount, 'EUR')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                    <div className="text-[10px] font-mono text-stone-400 uppercase">Bitcoin (BTC)</div>
                    <div className="text-base font-bold text-amber-400 mt-1">
                      {formatCurrency(customConverterAmount, 'BTC')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                    <div className="text-[10px] font-mono text-stone-400 uppercase">Ethereum (ETH)</div>
                    <div className="text-base font-bold text-indigo-400 mt-1">
                      {formatCurrency(customConverterAmount, 'ETH')}
                    </div>
                  </div>
                </div>

                {/* Amount presets */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-stone-500 font-mono">Test Presets:</span>
                  {[
                    { label: '$100K Baseline', val: 100000 },
                    { label: '$500K Growth', val: 500000 },
                    { label: '$1M Enterprise', val: 1000000 },
                    { label: '$5M Scale', val: 5000000 }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setCustomConverterAmount(preset.val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                        customConverterAmount === preset.val
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Picker: Web3 vs Fiat Sections */}
              <div className="space-y-4">
                {/* 1. Web3 & Crypto Assets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Web3 & Crypto Native Denominations
                    </h4>
                    <span className="text-[11px] text-stone-500 font-mono">5 On-Chain Assets</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {SUPPORTED_CURRENCIES.filter(c => c.isCrypto).map(curr => {
                      const isSelected = curr.code === currentCurrency;
                      return (
                        <div
                          key={curr.code}
                          onClick={() => handleSelectCurrency(curr.code)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                              : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center font-mono font-bold text-amber-400 text-sm">
                              {curr.symbol}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white leading-none truncate">{curr.code}</div>
                              <div className="text-xs text-stone-400 mt-1 leading-none truncate">{curr.name}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Global Fiat Currencies */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5" />
                      Global Fiat Currencies
                    </h4>
                    <span className="text-[11px] text-stone-500 font-mono">12 FX Pairs</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {SUPPORTED_CURRENCIES.filter(c => !c.isCrypto).map(curr => {
                      const isSelected = curr.code === currentCurrency;
                      return (
                        <div
                          key={curr.code}
                          onClick={() => handleSelectCurrency(curr.code)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                              : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
                              {curr.symbol}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white leading-none truncate">{curr.code}</div>
                              <div className="text-xs text-stone-400 mt-1 leading-none truncate">{curr.name}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CRYPTO RELEVANT CONFIGURATIONS */}
          {activeTab === 'crypto' && (
            <div className="space-y-6">
              
              {/* Sovereign Non-Custodial Safeguard Banner */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-bold">100% Read-Only & Non-Custodial Sovereign Operating Model:</strong> SignalDesk never requests or stores private keys, mnemonic seeds, or custodial control. All multi-chain telemetry is fetched through public verified RPC endpoints and Gnosis Safe multi-sig contracts.
                </div>
              </div>

              {/* Primary Network Watchtower Selection */}
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Default Network Watchtower</h4>
                    <p className="text-xs text-stone-400 mt-0.5">Primary chain monitored for corporate treasury gas reserves and governance.</p>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">{cryptoConfig.defaultChain}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    { name: 'Ethereum Mainnet', desc: 'L1 Base Security & Safe Multi-Sig' },
                    { name: 'Arbitrum One', desc: 'High-speed institutional rollup' },
                    { name: 'Base', desc: 'Coinbase L2 institutional corridor' },
                    { name: 'Solana', desc: 'High-throughput payment rails' },
                    { name: 'Bitcoin', desc: 'Cold storage reserve watchtower' }
                  ] as const).map(chain => {
                    const isSelected = cryptoConfig.defaultChain === chain.name;
                    return (
                      <button
                        key={chain.name}
                        onClick={() => handleUpdateCryptoConfig({ defaultChain: chain.name as any })}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{chain.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1">{chain.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gas Unit & Governance Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Gas Unit */}
                <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
                    Operational Gas Unit Denomination
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'gwei', label: 'Gwei (Standard EVM)' },
                      { id: 'wei', label: 'Wei (Exact Precision)' },
                      { id: 'sats', label: 'Satoshis (Bitcoin)' },
                      { id: 'lamports', label: 'Lamports (Solana)' }
                    ] as const).map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleUpdateCryptoConfig({ gasUnit: g.id })}
                        className={`p-2.5 rounded-lg border text-xs font-mono text-left transition cursor-pointer ${
                          cryptoConfig.gasUnit === g.id
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safe Multi-Sig Threshold */}
                <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
                    Multi-Sig Approval Threshold Alert
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['2/5', '3/5', '4/5'] as const).map(th => (
                      <button
                        key={th}
                        onClick={() => handleUpdateCryptoConfig({ alertThreshold: th })}
                        className={`p-2.5 rounded-lg border text-xs font-mono text-center transition cursor-pointer ${
                          cryptoConfig.alertThreshold === th
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        {th} Signatures
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Triggers high-priority executive alerts when pending Safe transactions approach quorum.
                  </p>
                </div>
              </div>

              {/* RPC Provider Configuration */}
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Public RPC Node Providers</span>
                  <span className="text-xs font-mono text-stone-400">Zero-latency verified telemetry</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {([
                    { name: 'Public Decentralized RPC', desc: 'Cloudflare / Ethereum Foundation / Solana Public' },
                    { name: 'Alchemy Verified', desc: 'High-reliability enterprise gateway (Read-only)' },
                    { name: 'Infura Enterprise', desc: 'Consensys institutional node endpoints' },
                    { name: 'Custom Private Node', desc: 'Direct corporate RPC endpoint URL' }
                  ] as const).map(p => {
                    const isSelected = cryptoConfig.rpcProvider === p.name;
                    return (
                      <div
                        key={p.name}
                        onClick={() => handleUpdateCryptoConfig({ rpcProvider: p.name as any })}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-white">{p.name}</div>
                          <div className="text-[10px] text-stone-500 mt-0.5">{p.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fast-action button to open full Crypto Treasury Modal */}
              {onOpenCryptoTreasury && (
                <div className="pt-2 flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div>
                    <div className="text-sm font-bold text-white">Launch Web3 Corporate Treasury Dashboard</div>
                    <div className="text-xs text-stone-400">
                      Manage Gnosis Safe multisig signers, watch-only wallets, and reserves ($5.35M total balance).
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCryptoTreasury();
                    }}
                    className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shrink-0 shadow-sm"
                  >
                    <span>Open Treasury</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER: Perfectly aligned actions */}
        <div className="shrink-0 h-14 px-5 sm:px-6 border-t border-stone-800/80 bg-stone-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Settings Persisted to Local Storage & System Bus</span>
          </div>

          <button
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
