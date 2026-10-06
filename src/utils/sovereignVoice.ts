/**
 * Sovereign AI Voice Service & Audio Protocol
 * Unifies voice briefing, conversational voice chat, speech-to-text dictation,
 * and spoken response playback with Google & browser speech synthesis engines.
 */

import { getSavedLanguage, SUPPORTED_LANGUAGES } from './localization';

export type SovereignVoicePersona = 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';

export type GoogleTtsModelId = 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';

export interface GoogleTtsModelMeta {
  id: GoogleTtsModelId;
  name: string;
  tagline: string;
  description: string;
  latencyRating: string;
  features: string[];
  badge: string;
}

export const GOOGLE_TTS_MODELS: Record<GoogleTtsModelId, GoogleTtsModelMeta> = {
  'gemini-3.8-flash-lite-tts': {
    id: 'gemini-3.8-flash-lite-tts',
    name: 'Gemini 3.8 Flash-Lite TTS',
    tagline: 'High-Efficiency Ultra-Low Latency Speech Model',
    description: "Google's high-efficiency, cost-optimized voice model delivering crisp, studio-grade 24kHz audio with minimal latency.",
    latencyRating: 'Ultra-Fast (~120ms)',
    features: ['24kHz Studio Audio', 'Prebuilt Voice Personas', 'Multi-lingual Executive Delivery', 'Low Latency Playback'],
    badge: '⚡ Ultra-Fast'
  },
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    name: 'Gemini 3.8 Flash TTS (Flagship)',
    tagline: 'Flagship Voice Design & Dual-Speaker Dialogue Model',
    description: "Google's premier audio generation model with expressive voice design, dual-speaker podcast mode, vocal bursts (<laugh>, <breath>), and backchanneling (|mhm|, |yeah|).",
    latencyRating: 'Expressive HD (~300ms)',
    features: ['Voice Design Prompting', 'Dual-Speaker Dialogue (CEO + Ops)', 'Vocal Bursts & Backchanneling', 'Nuanced Emotional Inflection'],
    badge: '👑 Flagship Voice'
  }
};

export interface VoicePersonaConfig {
  id: SovereignVoicePersona;
  displayName: string;
  role: string;
  pitch: number;
  rateMultiplier: number;
  voiceKeywords: string[];
  description: string;
  tone: string;
  gender: string;
  googleVoiceName: 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
}

export const SOVEREIGN_VOICE_PERSONAS: Record<SovereignVoicePersona, VoicePersonaConfig> = {
  Kore: {
    id: 'Kore',
    displayName: 'Aria Sovereign (Kore)',
    role: 'Executive Briefing & Strategic Authority',
    pitch: 1.0,
    rateMultiplier: 1.02,
    voiceKeywords: ['Google UK English Female', 'Google US English', 'Natural', 'Samantha', 'Karen', 'Moira', 'Victoria', 'en-US', 'en-GB'],
    description: 'Crisp, measured, authoritative executive cadence tuned for high-signal morning briefings.',
    tone: 'Authoritative & Clear',
    gender: 'Female',
    googleVoiceName: 'Kore'
  },
  Puck: {
    id: 'Puck',
    displayName: 'Orion Strategic (Puck)',
    role: 'Operational Ingress & Incident Response',
    pitch: 1.12,
    rateMultiplier: 1.06,
    voiceKeywords: ['Google UK English Male', 'Google US English', 'Daniel', 'Alex', 'Oliver', 'en-US', 'en-GB'],
    description: 'Dynamic, direct, and fast-paced operational voice for active blocker mitigation.',
    tone: 'Dynamic & Urgent',
    gender: 'Male',
    googleVoiceName: 'Puck'
  },
  Zephyr: {
    id: 'Zephyr',
    displayName: 'Zephyr Horizon',
    role: 'Long-Range Governance & Financial Audit',
    pitch: 0.94,
    rateMultiplier: 0.98,
    voiceKeywords: ['Google UK English Female', 'Serena', 'Tessa', 'en-GB', 'en-AU', 'en-US'],
    description: 'Calm, deliberate, analytical tone designed for board audit reviews and risk projections.',
    tone: 'Calm & Analytical',
    gender: 'Female',
    googleVoiceName: 'Zephyr'
  },
  Charon: {
    id: 'Charon',
    displayName: 'Atlas Commander (Charon)',
    role: 'Board Advisory & Deep Executive Gravitas',
    pitch: 0.90,
    rateMultiplier: 0.96,
    voiceKeywords: ['Google UK English Male', 'Arthur', 'George', 'en-GB', 'en-US'],
    description: 'Deep, steady, commanding authoritative resonance for board reviews and risk appraisals.',
    tone: 'Deep & Authoritative',
    gender: 'Male',
    googleVoiceName: 'Charon'
  },
  Fenrir: {
    id: 'Fenrir',
    displayName: 'Fenrir Vanguard',
    role: 'Tactical Execution & Technical Triage',
    pitch: 1.05,
    rateMultiplier: 1.08,
    voiceKeywords: ['Google US English', 'Tom', 'Aaron', 'en-US'],
    description: 'Grounded, sharp, tactical voice built for incident war rooms and code verification.',
    tone: 'Sharp & Tactical',
    gender: 'Male',
    googleVoiceName: 'Fenrir'
  }
};

const STORAGE_KEY_PERSONA = 'signaldesk_sovereign_voice_persona';
const STORAGE_KEY_SPEED = 'signaldesk_sovereign_voice_speed';
const STORAGE_KEY_AUTO_SPEAK = 'signaldesk_sovereign_voice_auto_speak';
const STORAGE_KEY_SPOKEN_LANG = 'signaldesk_sovereign_voice_spoken_lang';
const STORAGE_KEY_TTS_MODEL = 'signaldesk_google_tts_model';
const STORAGE_KEY_DIALOGUE_MODE = 'signaldesk_audio_dialogue_mode';

export type VoiceChangeListener = (persona: SovereignVoicePersona, speed: number, autoSpeak: boolean, spokenLang: string) => void;
const listeners = new Set<VoiceChangeListener>();

export const getSavedVoicePersona = (): SovereignVoicePersona => {
  if (typeof window === 'undefined') return 'Kore';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PERSONA);
    if (saved && (saved === 'Kore' || saved === 'Puck' || saved === 'Zephyr' || saved === 'Charon' || saved === 'Fenrir')) {
      return saved as SovereignVoicePersona;
    }
  } catch {}
  return 'Kore';
};

export const getSavedGoogleTtsModel = (): GoogleTtsModelId => {
  if (typeof window === 'undefined') return 'gemini-3.8-flash-lite-tts';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TTS_MODEL);
    if (saved === 'gemini-3.8-flash-lite-tts' || saved === 'gemini-3.8-flash-tts') {
      return saved;
    }
  } catch {}
  return 'gemini-3.8-flash-lite-tts';
};

export const setSavedGoogleTtsModel = (model: GoogleTtsModelId): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TTS_MODEL, model);
  } catch {}
};

export const getSavedDialogueMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_DIALOGUE_MODE) === 'true';
  } catch {}
  return false;
};

export const setSavedDialogueMode = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_DIALOGUE_MODE, enabled ? 'true' : 'false');
  } catch {}
};

export const setSavedVoicePersona = (persona: SovereignVoicePersona): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PERSONA, persona);
  } catch {}
  notifyListeners(persona, getSavedVoiceSpeed());
};

export const getSavedVoiceSpeed = (): number => {
  if (typeof window === 'undefined') return 1.0;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SPEED);
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.75 && val <= 1.5) return val;
    }
  } catch {}
  return 1.0;
};

export const setSavedVoiceSpeed = (speed: number): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SPEED, speed.toString());
  } catch {}
  notifyListeners(getSavedVoicePersona(), speed);
};

export const getSavedVoiceAutoSpeak = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_AUTO_SPEAK) === 'true';
  } catch {}
  return false;
};

export const setSavedVoiceAutoSpeak = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_AUTO_SPEAK, enabled ? 'true' : 'false');
  } catch {}
  notifyListeners(getSavedVoicePersona(), getSavedVoiceSpeed());
};

export const getSavedVoiceSpokenLanguage = (): string => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SPOKEN_LANG);
    if (saved) return saved;
  } catch {}
  return 'auto';
};

export const setSavedVoiceSpokenLanguage = (langCode: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SPOKEN_LANG, langCode);
    window.dispatchEvent(new CustomEvent('signaldesk_spoken_language_changed', { detail: langCode }));
  } catch {}
  notifyListeners(getSavedVoicePersona(), getSavedVoiceSpeed());
};

export const getEffectiveSpeechLanguage = (explicitLang?: string): { speechLang: string; langCode: string } => {
  if (explicitLang) {
    const directMeta = SUPPORTED_LANGUAGES.find(l => l.speechLang === explicitLang || l.code === explicitLang);
    if (directMeta) return { speechLang: directMeta.speechLang, langCode: directMeta.code };
    return { speechLang: explicitLang, langCode: explicitLang.split('-')[0] };
  }

  const savedSpoken = getSavedVoiceSpokenLanguage();
  if (savedSpoken && savedSpoken !== 'auto') {
    const match = SUPPORTED_LANGUAGES.find(l => l.code === savedSpoken || l.speechLang === savedSpoken);
    if (match) return { speechLang: match.speechLang, langCode: match.code };
  }

  const currentUiLang = getSavedLanguage();
  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === currentUiLang);
  return {
    speechLang: langMeta?.speechLang || 'en-US',
    langCode: langMeta?.code || 'en'
  };
};

export const MULTILINGUAL_VOICE_SAMPLES: Record<string, string> = {
  en: "SignalDesk operational intelligence is active. All 57 connectors and 20 MCP servers are verified with 100% policy pass.",
  es: "La inteligencia operativa de SignalDesk está activa. Los 57 conectores y 20 servidores MCP están verificados con éxito.",
  fr: "L'intelligence opérationnelle de SignalDesk est active. Les 57 connecteurs et 20 serveurs MCP sont rigoureusement vérifiés.",
  de: "Die SignalDesk-Betriebsintelligenz ist aktiv. Alle 57 Konnektoren und 20 MCP-Server sind verifiziert und betriebsbereit.",
  he: "מודיעין התפעול של SignalDesk פעיל. כל 57 המחברים ו-20 שרתי ה-MCP מאומתים עם תאימות מלאה.",
  ja: "SignalDeskの運用インテリジェンスが稼働中です。57のコネクタと20のMCPサーバーが全て検証されています。",
  zh: "SignalDesk运营智能中心已就绪。57个数据连接器和20个MCP服务均已通过合规验证。",
  ar: "ذكاء العمليات في SignalDesk نشط. تم التحقق من جميع الموصلات البالغ عددها 57 و 20 خادم MCP بنجاح تام.",
  pt: "A inteligência operacional do SignalDesk está ativa. Todos os 57 conectores e 20 servidores MCP estão verificados.",
  it: "L'intelligence operativa di SignalDesk è attiva. Tutti i 57 connettori e 20 server MCP sono verificati con successo.",
  hi: "SignalDesk परिचालन बुद्धिमत्ता सक्रिय है। सभी 57 कनेक्टर्स और 20 MCP सर्वर सत्यापित हैं।",
  ko: "SignalDesk 운영 인텔리전스가 활성화되었습니다. 57개 커넥터와 20개 MCP 서버가 안전하게 검증되었습니다.",
  ru: "Операционная аналитика SignalDesk активна. Все 57 коннекторов и 20 серверов MCP успешно верифицированы.",
  nl: "SignalDesk operationele intelligentie is actief. Alle 57 connectors en 20 MCP-servers zijn geverifieerd."
};

export const subscribeToVoiceSettings = (listener: VoiceChangeListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = (persona: SovereignVoicePersona, speed: number) => {
  const autoSpeak = getSavedVoiceAutoSpeak();
  const spokenLang = getSavedVoiceSpokenLanguage();
  listeners.forEach(cb => {
    try { cb(persona, speed, autoSpeak, spokenLang); } catch {}
  });
};

/**
 * Finds the optimal system or Google TTS voice matching the selected persona and language.
 */
export const findBestSpeechVoice = (
  persona: SovereignVoicePersona,
  availableVoices: SpeechSynthesisVoice[],
  targetSpeechLang?: string
): SpeechSynthesisVoice | null => {
  if (!availableVoices || availableVoices.length === 0) return null;
  const config = SOVEREIGN_VOICE_PERSONAS[persona];

  const { speechLang } = getEffectiveSpeechLanguage(targetSpeechLang);
  const effectiveLang = speechLang;
  const langPrefix = effectiveLang.split('-')[0].toLowerCase();

  // STRICT RULE: Candidates MUST match the target language code first!
  // Prevents non-English voices (e.g. Thai, French) from being selected to read English,
  // which causes garbled sounds and broken phonemes like "th".
  const matchingVoices = availableVoices.filter(v => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang.startsWith(langPrefix);
  });

  const candidates = matchingVoices.length > 0
    ? matchingVoices
    : (langPrefix !== 'en' ? availableVoices.filter(v => v.lang.toLowerCase().startsWith('en')) : availableVoices);

  // 1. Search candidate voices for persona keywords (safe because candidates are already in target language)
  for (const keyword of config.voiceKeywords) {
    const match = candidates.find(v => 
      v.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) return match;
  }

  // 2. Look for natural / neural / google voices in that target language
  const highQuality = candidates.find(v => 
    v.name.toLowerCase().includes('google') ||
    v.name.toLowerCase().includes('natural') || 
    v.name.toLowerCase().includes('premium') ||
    v.name.toLowerCase().includes('neural')
  );
  if (highQuality) return highQuality;

  // 3. Fallback to default or first candidate voice in target language
  const defaultVoice = candidates.find(v => v.default) || candidates[0];
  return defaultVoice || null;
};

// Prime voices eagerly so window.speechSynthesis.getVoices() is ready when needed
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    const updateCachedVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) cachedVoices = v;
      } catch {}
    };
    window.speechSynthesis.onvoiceschanged = updateCachedVoices;
    updateCachedVoices();
  } catch {}
}

const ONES_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD_ONES_WORDS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const ORD_TENS_WORDS = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];

/**
 * Universal ordinal converter for natural English pronunciation (e.g. 4th -> fourth, 40th -> fortieth, 100th -> one hundredth)
 */
export function numberToOrdinalWord(n: number): string {
  if (n <= 0) return String(n);
  if (n < 20) return ORD_ONES_WORDS[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    if (r === 0) return ORD_TENS_WORDS[t];
    return `${TENS_WORDS[t]}-${ORD_ONES_WORDS[r]}`;
  }
  if (n === 100) return 'one hundredth';
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (r === 0) return `${ONES_WORDS[h]} hundredth`;
    return `${ONES_WORDS[h]} hundred and ${numberToOrdinalWord(r)}`;
  }
  if (n === 1000) return 'one thousandth';
  return String(n);
}

/**
 * Clean markdown, technical symbols, quotes, and format abbreviations/currencies/ordinals/digraphs for natural human speech.
 * Preserves all business facts, numbers, tables, and acronyms while ensuring letters and words are read aloud with complete fidelity.
 */
export const cleanTextForSpeech = (raw: string): string => {
  if (!raw) return '';
  let cleaned = raw
    // 1. Normalize typographic quotes, dashes, and whitespace
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes and apostrophes to standard ASCII
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes to standard ASCII
    .replace(/[\u2013\u2014]/g, ', ') // en-dash and em-dash to natural speech pauses
    .replace(/\u00A0/g, ' ') // non-breaking space to regular space
    // 2. Visual syntax & Markdown removal
    .replace(/```[\s\S]*?```/g, '') // strip code blocks
    .replace(/`([^`]+)`/g, '$1') // unwrap inline code so variable names/terms are read aloud
    .replace(/\{[\s\S]*?"error"[\s\S]*?\}/gi, '') // strip error JSON payloads
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // convert markdown links to plain text
    .replace(/https?:\/\/\S+/g, '') // strip URLs
    .replace(/\(\s*\)/g, '') // clean empty parentheses from removed URLs
    .replace(/^\|?[\s-:]+\|[\s-:|]+$/gm, '') // strip markdown table divider rows (|---|---|)
    .replace(/\|/g, ', ') // convert table pipes to natural audible pauses
    .replace(/<[^>]+>/g, '') // strip HTML and vocal burst tags like <laugh>, <breath>
    .replace(/\|(mhm|yeah|yes|uh-huh)\|/gi, '$1') // convert dialogue backchannels into spoken words
    .replace(/^#{1,6}\s+/gm, '') // strip markdown header tags
    .replace(/[*_~]/g, '') // strip markdown bold/italic/strikethrough markers
    .replace(/^[•\-\*]\s+/gm, ', ') // convert bullet points into natural pauses
    .replace(/[{}\[\]]/g, ' ') // convert remaining braces and brackets to pauses (never deleting the words inside)
    // 3. Pronunciation of standalone letters and consonant digraphs
    // When "th", "sh", "ch", etc. are written standalone or in quotes, articulate them as distinct spoken letters ("T-H", "S-H")
    .replace(/\b(th|TH|Th|tH)\b/g, 'T-H')
    .replace(/\b(sh|SH|Sh|sH)\b/g, 'S-H')
    .replace(/\b(ch|CH|Ch|cH)\b/g, 'C-H')
    .replace(/\b(ph|PH|Ph|pH)\b/g, 'P-H')
    .replace(/\b(wh|WH|Wh|wH)\b/g, 'W-H')
    .replace(/\b(ck|CK|Ck)\b/g, 'C-K')
    .replace(/\b(ng|NG|Ng)\b/g, 'N-G')
    .replace(/\b(gh|GH|Gh)\b/g, 'G-H')
    // 4. Conversational shorthand & business terminology
    .replace(/\b(w\/o)\b/gi, 'without')
    .replace(/\b(w\/)\b/gi, 'with')
    .replace(/\b(e\.g\.)\b/gi, 'for example')
    .replace(/\b(i\.e\.)\b/gi, 'that is')
    .replace(/\b(etc\.)\b/gi, 'etcetera')
    .replace(/\b(vs\.)\b/gi, 'versus')
    .replace(/\b(YoY)\b/g, 'Year over Year')
    .replace(/\b(MoM)\b/g, 'Month over Month')
    .replace(/\b(Q[1-4])\b/g, (m) => m[0] + ' ' + m[1])
    .replace(/\bOAuth2?\b/g, 'O Auth')
    .replace(/\bPostgreSQL\b/gi, 'Postgres Q L')
    .replace(/\bGraphQL\b/gi, 'Graph Q L')
    .replace(/\bgRPC\b/g, 'G R P C')
    .replace(/\bmTLS\b/g, 'M T L S')
    .replace(/\bJWT\b/g, 'J W T')
    .replace(/\bk8s\b/gi, 'K eight s')
    // 5. Currencies and large numbers
    .replace(/[$](\d+(?:\.\d+)?)\s*([Mm])/g, '$1 million dollars')
    .replace(/[€](\d+(?:\.\d+)?)\s*([Mm])/g, '$1 million euros')
    .replace(/[£](\d+(?:\.\d+)?)\s*([Mm])/g, '$1 million pounds')
    .replace(/[$](\d+(?:\.\d+)?)\s*([Kk])/g, '$1 thousand dollars')
    .replace(/[€](\d+(?:\.\d+)?)\s*([Kk])/g, '$1 thousand euros')
    .replace(/[£](\d+(?:\.\d+)?)\s*([Kk])/g, '$1 thousand pounds')
    .replace(/[$](\d+(?:\.\d+)?)\s*([Bb])/g, '$1 billion dollars')
    .replace(/[€](\d+(?:\.\d+)?)\s*([Bb])/g, '$1 billion euros')
    .replace(/[£](\d+(?:\.\d+)?)\s*([Bb])/g, '$1 billion pounds')
    .replace(/[$](\d+(?:,\d+)*(?:\.\d+)?)/g, '$1 dollars')
    .replace(/[€](\d+(?:,\d+)*(?:\.\d+)?)/g, '$1 euros')
    .replace(/[£](\d+(?:,\d+)*(?:\.\d+)?)/g, '$1 pounds')
    .replace(/\+(\d+(?:\.\d+)?%)/g, 'plus $1')
    .replace(/-(\d+(?:\.\d+)?%)/g, 'minus $1')
    .replace(/(\d+(?:\.\d+)?)%/g, '$1 percent')
    .replace(/\bAI\b/g, 'A I')
    .replace(/\bARR\b/g, 'A R R')
    .replace(/\bMRR\b/g, 'M R R')
    .replace(/\bCRM\b/g, 'C R M')
    .replace(/\bERP\b/g, 'E R P')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bAPIs\b/g, 'A P I s')
    .replace(/\bSLA\b/g, 'S L A')
    .replace(/\bSLAs\b/g, 'S L A s')
    .replace(/\bKPI\b/g, 'K P I')
    .replace(/\bKPIs\b/g, 'K P I s')
    .replace(/\bMCP\b/g, 'M C P')
    .replace(/\bUI\b/g, 'U I')
    .replace(/\bCEO\b/g, 'C E O')
    .replace(/\bCFO\b/g, 'C F O')
    .replace(/\bCTO\b/g, 'C T O')
    .replace(/\bCOO\b/g, 'C O O')
    .replace(/\bACH\b/g, 'A C H')
    .replace(/\bKYC\b/g, 'K Y C')
    .replace(/\bSOC\s*2\b/gi, 'S O C 2')
    .replace(/\bUSD\b/g, 'dollars')
    .replace(/\bEUR\b/g, 'euros')
    .replace(/\bGBP\b/g, 'pounds')
    .replace(/\bBTC\b/g, 'Bitcoin')
    .replace(/\bETH\b/g, 'Ethereum')
    .replace(/\bSOL\b/g, 'Solana');

  // 6. Convert any ordinals like 1st, 2nd, 3rd, 4th, 20th, 40th, 100th into spoken English words
  cleaned = cleaned.replace(/\b(\d{1,4})(?:st|nd|rd|th)\b/gi, (match, digits) => {
    const num = parseInt(digits, 10);
    if (!isNaN(num) && num > 0 && num <= 1000) {
      return numberToOrdinalWord(num);
    }
    return match;
  });

  // 7. Strip stray quote characters and clean punctuation pauses
  return cleaned
    .replace(/["\\]/g, '') // remove quotation marks so TTS doesn't stumble or say "quote"
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
};

export interface SpeakOptions {
  persona?: SovereignVoicePersona;
  speed?: number;
  lang?: string;
  onBoundary?: (charIndex: number, textLength: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Global sovereign speech playback with multilingual support.
 */
export const speakSovereignText = (
  text: string, 
  options: SpeakOptions | string = {}
): SpeechSynthesisUtterance | null => {
  const opts: SpeakOptions = typeof options === 'string' ? { lang: options } : options;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onError?.('Speech synthesis not supported');
    return null;
  }

  stopGoogleTtsAudio();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    opts.onEnd?.();
    return null;
  }

  try {
    const wasSpeaking = window.speechSynthesis.speaking;
    if (wasSpeaking) {
      window.speechSynthesis.cancel();
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const persona = opts.persona || getSavedVoicePersona();
    const config = SOVEREIGN_VOICE_PERSONAS[persona];
    const baseSpeed = opts.speed ?? getSavedVoiceSpeed();

    const { speechLang } = getEffectiveSpeechLanguage(opts.lang);

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.volume = 1.0;
    utterance.pitch = config.pitch;
    utterance.rate = Math.max(0.6, Math.min(2.0, baseSpeed * config.rateMultiplier));
    utterance.lang = speechLang;

    const voices = window.speechSynthesis.getVoices().length > 0 ? window.speechSynthesis.getVoices() : cachedVoices;
    const matchedVoice = findBestSpeechVoice(persona, voices, speechLang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    let keepAliveTimer: any = null;

    utterance.onstart = () => {
      opts.onStart?.();
      // Chrome keepalive: Chromium pauses utterances longer than 15s unless resumed
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = setInterval(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (!window.speechSynthesis.speaking) {
            clearInterval(keepAliveTimer);
          } else if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }
      }, 3000);
    };

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.charIndex !== undefined && cleaned.length > 0) {
        opts.onBoundary?.(e.charIndex, cleaned.length);
      }
    };

    utterance.onend = () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      opts.onEnd?.();
    };

    utterance.onerror = (e) => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      // Ignore normal cancel/interrupted events
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.warn('Sovereign voice synthesis event:', e);
      opts.onError?.(e);
    };

    // Store reference on window to protect from garbage collection in Chromium browsers
    (window as any).__sovereignUtterance = utterance;

    // Execute speak synchronously to preserve the active user activation context
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to execute speak:', err);
      opts.onError?.(err);
    }

    return utterance;
  } catch (err) {
    console.error('Failed to initiate sovereign voice playback:', err);
    opts.onError?.(err);
    return null;
  }
};

export const stopSovereignSpeech = (): void => {
  stopGoogleTtsAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
};

let currentGoogleTtsAudio: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let currentAnalyserNode: AnalyserNode | null = null;

const getSharedAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
};

export interface GoogleTtsPlayOptions {
  speed?: number;
  onStart?: () => void;
  onProgress?: (progressPct: number, currentTime: number, duration: number) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface GoogleTtsPlayerController {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setSpeed: (rate: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getAnalyserData: (dataArray: Uint8Array) => void;
}

export const stopGoogleTtsAudio = (): void => {
  if (currentGoogleTtsAudio) {
    try {
      currentGoogleTtsAudio.pause();
      currentGoogleTtsAudio.currentTime = 0;
      currentGoogleTtsAudio.src = '';
    } catch {}
    currentGoogleTtsAudio = null;
  }
};

export const playGoogleTtsWavAudio = (
  base64Audio: string,
  options: GoogleTtsPlayOptions = {}
): GoogleTtsPlayerController | null => {
  if (typeof window === 'undefined') return null;

  stopGoogleTtsAudio();
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }

  try {
    const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
    const audioSrc = `data:audio/wav;base64,${cleanBase64}`;
    const audio = new Audio(audioSrc);
    audio.volume = 1.0;
    currentGoogleTtsAudio = audio;

    const speed = options.speed ?? getSavedVoiceSpeed();
    audio.playbackRate = Math.min(2.0, Math.max(0.5, speed));

    let analyser: AnalyserNode | null = null;
    const audioCtx = getSharedAudioContext();
    if (audioCtx) {
      try {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        currentAnalyserNode = analyser;
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch {
        // Fallback: audio element will play directly via default output if Web Audio routing is restricted
      }
    }

    audio.onplay = () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      options.onStart?.();
    };

    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        const pct = Math.min(100, Math.round((audio.currentTime / audio.duration) * 100));
        options.onProgress?.(pct, audio.currentTime, audio.duration);
      }
    };

    audio.onended = () => {
      options.onEnd?.();
      stopGoogleTtsAudio();
    };

    audio.onerror = (e) => {
      console.warn('Google TTS audio playback event:', e);
      options.onError?.(e);
      stopGoogleTtsAudio();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Google TTS audio play deferred:', err);
        options.onError?.(err);
      });
    }

    return {
      stop: () => stopGoogleTtsAudio(),
      pause: () => audio.pause(),
      resume: () => audio.play().catch(() => {}),
      seek: (secs: number) => {
        if (!isNaN(secs) && audio.duration) {
          audio.currentTime = Math.max(0, Math.min(audio.duration, secs));
        }
      },
      setSpeed: (rate: number) => {
        audio.playbackRate = Math.min(2.0, Math.max(0.5, rate));
      },
      getDuration: () => audio.duration || 0,
      getCurrentTime: () => audio.currentTime || 0,
      getAnalyserData: (dataArray: Uint8Array) => {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
        }
      }
    };
  } catch (err) {
    console.error('Failed to initialize Google TTS audio:', err);
    options.onError?.(err);
    return null;
  }
};

/**
 * Speech Recognition factory for browser-based dictation and voice chat.
 */
export const createSovereignSpeechRecognizer = (callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}): any => {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const currentLang = getSavedLanguage();
  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
  const speechLang = callbacks.lang || langMeta?.speechLang || 'en-US';

  const recognizer = new SpeechRecognition();
  recognizer.continuous = callbacks.continuous ?? true;
  recognizer.interimResults = callbacks.interimResults ?? true;
  recognizer.lang = speechLang;

  recognizer.onstart = () => {
    callbacks.onStart?.();
  };

  recognizer.onresult = (event: any) => {
    let interim = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    const output = (finalTranscript || interim).trim();
    if (output) {
      callbacks.onResult(output, !!finalTranscript);
    }
  };

  recognizer.onerror = (err: any) => {
    callbacks.onError?.(err);
  };

  recognizer.onend = () => {
    callbacks.onEnd?.();
  };

  return recognizer;
};
