import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Headphones,
  CheckCircle2,
  Sliders,
  Copy,
  Check,
  Zap,
  BookOpen,
  ListFilter,
  Type,
  Radio,
  Users,
  Mic,
  Activity,
  Layers,
  Wand2,
  X
} from 'lucide-react';
import { AudioBriefingData } from '../types';
import { playAlarmSound, playVoiceCadencePulse } from '../utils/sound';
import { copyToClipboard } from '../utils/clipboard';
import { 
  SovereignVoicePersona, 
  SOVEREIGN_VOICE_PERSONAS,
  GoogleTtsModelId,
  GOOGLE_TTS_MODELS,
  getSavedGoogleTtsModel,
  setSavedGoogleTtsModel,
  getSavedDialogueMode,
  setSavedDialogueMode,
  getSavedVoicePersona, 
  setSavedVoicePersona, 
  getSavedVoiceSpeed, 
  setSavedVoiceSpeed,
  subscribeToVoiceSettings,
  speakSovereignText,
  stopSovereignSpeech,
  playGoogleTtsWavAudio,
  stopGoogleTtsAudio,
  GoogleTtsPlayerController
} from '../utils/sovereignVoice';
import {
  AppLanguage,
  getSavedLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_BRIEFINGS_BY_LANG
} from '../utils/localization';

interface AudioBriefingPlayerProps {
  onShowToast?: (msg: string) => void;
  defaultExpanded?: boolean;
  onClose?: () => void;
  onLaunchCommandCenter?: () => void;
}

const DEFAULT_BRIEFING: AudioBriefingData = {
  script: "Good morning. Here is your SignalDesk executive intelligence briefing. All authoritative systems are synchronized and nominal. There are zero urgent situations or financial exposures requiring intervention. All automated policies and Safe Action Gateway capabilities are operational.",
  bulletPoints: [
    "Business Health: 100/100 • All Systems Nominal",
    "Needs Attention: 0 Urgent Situations",
    "Financial Exposure: $0.00 At Risk",
    "Waiting on Me: 0 Pending Approvals",
    "Safe Action Gateway: Operational"
  ],
  voiceName: 'Kore',
  modelName: 'gemini-3.8-flash-lite-tts',
  generatedAt: 'Just now',
  durationSeconds: 15,
  audioSource: 'gemini_tts'
};

export const AudioBriefingPlayer: React.FC<AudioBriefingPlayerProps> = ({ 
  onShowToast, 
  defaultExpanded = true, 
  onClose,
  onLaunchCommandCenter 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [briefing, setBriefing] = useState<AudioBriefingData>(() => {
    const lang = getSavedLanguage();
    if (DEFAULT_BRIEFINGS_BY_LANG[lang]) {
      return {
        ...DEFAULT_BRIEFING,
        script: DEFAULT_BRIEFINGS_BY_LANG[lang].script,
        bulletPoints: DEFAULT_BRIEFINGS_BY_LANG[lang].bulletPoints
      };
    }
    return DEFAULT_BRIEFING;
  });
  const [activeLang, setActiveLang] = useState<AppLanguage>(getSavedLanguage());
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SovereignVoicePersona>(getSavedVoicePersona());
  const [ttsModel, setTtsModel] = useState<GoogleTtsModelId>(getSavedGoogleTtsModel());
  const [dialogueMode, setDialogueMode] = useState<boolean>(getSavedDialogueMode());
  const [secondaryVoice, setSecondaryVoice] = useState<SovereignVoicePersona>('Puck');
  const [speechStyle, setSpeechStyle] = useState<string>('Authoritative, calm, executive intelligence officer');
  const [viewMode, setViewMode] = useState<'teleprompter' | 'highlights' | 'settings'>('teleprompter');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(getSavedVoiceSpeed());
  const [scriptFontSize, setScriptFontSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [copied, setCopied] = useState(false);
  const [audioMode, setAudioMode] = useState<'google_tts' | 'speech' | 'cadence'>('google_tts');
  const [frequencyBars, setFrequencyBars] = useState<number[]>([18, 32, 54, 76, 45, 88, 62, 95, 58, 80, 42, 85, 68, 38, 26, 14]);

  const googlePlayerRef = useRef<GoogleTtsPlayerController | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<any>(null);
  const cadenceIntervalRef = useRef<any>(null);
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  // Split script into readable, highlightable sentences
  const sentences = useMemo(() => {
    const raw = briefing?.script || DEFAULT_BRIEFING.script;
    const matches = raw.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (matches && matches.length > 0) {
      return matches.map(s => s.trim()).filter(Boolean);
    }
    return [raw];
  }, [briefing?.script]);

  // Determine active sentence index
  const activeSentenceIndex = useMemo(() => {
    if (!isPlaying || sentences.length === 0) return -1;
    const idx = Math.min(sentences.length - 1, Math.floor((playbackProgress / 100) * sentences.length));
    return idx;
  }, [isPlaying, playbackProgress, sentences.length]);

  // Scroll active teleprompter sentence into view
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSentenceIndex]);

  // Sync with global voice settings & language updates
  useEffect(() => {
    const unsubscribe = subscribeToVoiceSettings((persona, speed) => {
      setSelectedVoice(persona);
      setPlaybackSpeed(speed);
    });

    const handleLanguageChanged = (e: any) => {
      const newLang: AppLanguage = e.detail || getSavedLanguage();
      setActiveLang(newLang);
      if (DEFAULT_BRIEFINGS_BY_LANG[newLang]) {
        setBriefing(prev => ({
          ...prev,
          script: DEFAULT_BRIEFINGS_BY_LANG[newLang].script,
          bulletPoints: DEFAULT_BRIEFINGS_BY_LANG[newLang].bulletPoints
        }));
      }
      fetchAudioBriefing(selectedVoice, newLang, false);
    };

    window.addEventListener('signaldesk_language_changed', handleLanguageChanged);
    fetchAudioBriefing(selectedVoice, activeLang, false);

    return () => {
      unsubscribe();
      window.removeEventListener('signaldesk_language_changed', handleLanguageChanged);
      stopPlayback();
    };
  }, []);

  const fetchAudioBriefing = async (
    voice: SovereignVoicePersona = selectedVoice, 
    lang: AppLanguage = activeLang,
    autoPlay: boolean = false
  ) => {
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('/api/ai/audio-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voiceName: voice, 
          targetLang: lang,
          ttsModel,
          dialogueMode,
          secondaryVoiceName: secondaryVoice,
          speechStyle
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const fallback = DEFAULT_BRIEFINGS_BY_LANG[lang] || DEFAULT_BRIEFING;
          const updatedBriefing: AudioBriefingData = {
            ...data.data,
            script: data.data.script || fallback.script,
            bulletPoints: Array.isArray(data.data.bulletPoints) && data.data.bulletPoints.length > 0
              ? data.data.bulletPoints 
              : fallback.bulletPoints,
            audioSource: data.data.audioSource || 'gemini_tts'
          };
          setBriefing(updatedBriefing);

          if (autoPlay) {
            startAudioPlayback(updatedBriefing.script, updatedBriefing.audioBase64);
          }
        } else if (autoPlay) {
          const fallback = DEFAULT_BRIEFINGS_BY_LANG[lang] || DEFAULT_BRIEFING;
          startAudioPlayback(briefing?.script || fallback.script);
        }
      } else if (autoPlay) {
        const fallback = DEFAULT_BRIEFINGS_BY_LANG[lang] || DEFAULT_BRIEFING;
        startAudioPlayback(briefing?.script || fallback.script);
      }
    } catch {
      // Fallback stays active
      if (autoPlay) {
        const fallback = DEFAULT_BRIEFINGS_BY_LANG[lang] || DEFAULT_BRIEFING;
        startAudioPlayback(briefing?.script || fallback.script);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (googlePlayerRef.current) {
      googlePlayerRef.current.stop();
      googlePlayerRef.current = null;
    }
    stopGoogleTtsAudio();
    stopSovereignSpeech();

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (cadenceIntervalRef.current) {
      clearInterval(cadenceIntervalRef.current);
      cadenceIntervalRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      onShowToast?.('Spoken briefing paused.');
      return;
    }

    // Auto-expand so full brief is readable
    if (!isExpanded) {
      setIsExpanded(true);
    }

    // Audible start chirp
    playAlarmSound('acknowledge', 0.2);

    const textToSpeak = briefing?.script || DEFAULT_BRIEFING.script;

    // Immediately resume speech synthesis context in the user gesture
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.resume(); } catch {}
    }

    // If audio is already synthesized and present, play it directly
    if (briefing?.audioBase64 && briefing?.audioSource === 'gemini_tts' && !briefing?.isFallback) {
      startAudioPlayback(textToSpeak, briefing.audioBase64);
    } else {
      // Start playback immediately with zero delay, preserving user gesture activation
      startAudioPlayback(textToSpeak);
      if (!briefing || briefing.isFallback) {
        fetchAudioBriefing(selectedVoice, activeLang, false);
      }
    }
  };

  const startAudioPlayback = (text: string, base64Audio?: string) => {
    stopPlayback();
    setIsPlaying(true);
    setPlaybackProgress(0);

    const audioToUse = base64Audio || briefing?.audioBase64;
    const isGenuineGoogleAudio = Boolean(audioToUse && briefing?.audioSource === 'gemini_tts' && !briefing?.isFallback);

    // 1. PRIMARY: Google Gemini 3.8 Studio WAV Audio Player (when genuine audio is provided)
    if (isGenuineGoogleAudio && audioToUse) {
      const controller = playGoogleTtsWavAudio(audioToUse, {
        speed: playbackSpeed,
        onStart: () => {
          setAudioMode('google_tts');
          const modelMeta = GOOGLE_TTS_MODELS[ttsModel];
          onShowToast?.(`Playing Google ${modelMeta.name} (24kHz Studio WAV)`);
        },
        onProgress: (pct) => {
          setPlaybackProgress(pct);
        },
        onEnd: () => {
          setIsPlaying(false);
          setPlaybackProgress(100);
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          setTimeout(() => setPlaybackProgress(0), 1200);
        },
        onError: () => {
          fallbackBrowserSpeech(text);
        }
      });

      if (controller) {
        googlePlayerRef.current = controller;

        // Animate visualizer frequency bars
        const updateVisualizer = () => {
          if (googlePlayerRef.current) {
            const data = new Uint8Array(16);
            googlePlayerRef.current.getAnalyserData(data);
            const heights = Array.from(data).map(v => Math.max(12, Math.min(100, Math.round((v / 255) * 100))));
            setFrequencyBars(heights);
            animFrameRef.current = requestAnimationFrame(updateVisualizer);
          }
        };
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
        return;
      }
    }

    // 2. SECONDARY: Browser Sovereign Speech Synthesis
    fallbackBrowserSpeech(text);
  };

  const fallbackBrowserSpeech = (text: string) => {
    const wordCount = text.split(/\s+/).length;
    const totalDurationSec = Math.max(16, Math.round(wordCount / (2.5 * playbackSpeed)));
    const startTime = Date.now();

    // Pulse simulated cadence bars during sovereign speech
    if (cadenceIntervalRef.current) clearInterval(cadenceIntervalRef.current);
    cadenceIntervalRef.current = setInterval(() => {
      setFrequencyBars(prev => prev.map(() => Math.floor(Math.random() * 60) + 20));
    }, 150);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min(98, Math.round((elapsed / totalDurationSec) * 100));
      setPlaybackProgress(pct);
    }, 200);

    const activeLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === activeLang);
    speakSovereignText(text, {
      persona: selectedVoice,
      speed: playbackSpeed,
      lang: activeLangMeta?.speechLang,
      onStart: () => {
        setAudioMode('speech');
        onShowToast?.(`Speaking brief in ${activeLangMeta?.name || 'English'} (${SOVEREIGN_VOICE_PERSONAS[selectedVoice].displayName})`);
      },
      onBoundary: (charIdx, textLen) => {
        if (textLen > 0) {
          const charPct = Math.min(99, Math.round((charIdx / textLen) * 100));
          setPlaybackProgress(prev => Math.max(prev, charPct));
        }
      },
      onEnd: () => {
        setIsPlaying(false);
        setPlaybackProgress(100);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (cadenceIntervalRef.current) clearInterval(cadenceIntervalRef.current);
        setTimeout(() => {
          setPlaybackProgress(0);
          setFrequencyBars(Array(16).fill(12));
        }, 1200);
      },
      onError: () => {
        setIsPlaying(false);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (cadenceIntervalRef.current) clearInterval(cadenceIntervalRef.current);
      }
    });
  };

  const startHarmonicCadenceBackup = () => {
    setAudioMode('cadence');
    if (cadenceIntervalRef.current) clearInterval(cadenceIntervalRef.current);
    
    const baseFreq = selectedVoice === 'Puck' ? 340 : selectedVoice === 'Zephyr' ? 240 : 285;
    let tick = 0;
    cadenceIntervalRef.current = setInterval(() => {
      tick++;
      const modPitch = baseFreq + (tick % 3 === 0 ? 30 : tick % 2 === 0 ? -15 : 10);
      playVoiceCadencePulse(modPitch, 0.08);
    }, 420);
  };

  const handleModelChange = (modelId: GoogleTtsModelId) => {
    setTtsModel(modelId);
    setSavedGoogleTtsModel(modelId);
    stopPlayback();
    onShowToast?.(`Selected Google TTS Model: ${GOOGLE_TTS_MODELS[modelId].name}`);
    fetchAudioBriefing(selectedVoice, activeLang, false);
  };

  const handleDialogueToggle = () => {
    const nextVal = !dialogueMode;
    setDialogueMode(nextVal);
    setSavedDialogueMode(nextVal);
    stopPlayback();
    onShowToast?.(nextVal ? 'Dual-Speaker Executive Dialogue Enabled' : 'Single Speaker Mode Enabled');
    fetchAudioBriefing(selectedVoice, activeLang, false);
  };

  const handleVoiceChange = (voice: SovereignVoicePersona) => {
    setSelectedVoice(voice);
    setSavedVoicePersona(voice);
    stopPlayback();
    onShowToast?.(`Switched executive voice to ${SOVEREIGN_VOICE_PERSONAS[voice].displayName}`);
    fetchAudioBriefing(voice, activeLang, false);
  };

  const handleSpeedChange = () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : 1.0;
    setPlaybackSpeed(nextSpeed);
    setSavedVoiceSpeed(nextSpeed);
    if (googlePlayerRef.current) {
      googlePlayerRef.current.setSpeed(nextSpeed);
    } else if (isPlaying) {
      stopPlayback();
      const textToSpeak = briefing?.script || DEFAULT_BRIEFING.script;
      setTimeout(() => startAudioPlayback(textToSpeak), 100);
    }
    onShowToast?.(`Playback speed: ${nextSpeed}x`);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    setPlaybackProgress(pct);

    if (googlePlayerRef.current) {
      const dur = googlePlayerRef.current.getDuration() || totalDurationSec;
      const targetSec = (pct / 100) * dur;
      googlePlayerRef.current.seek(targetSec);
    }
  };

  const handleCopyScript = async () => {
    const text = briefing?.script || DEFAULT_BRIEFING.script;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      onShowToast?.('Complete executive script copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalDurationSec = briefing?.durationSeconds || 45;
  const currentSec = Math.floor((playbackProgress / 100) * totalDurationSec);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeModelMeta = GOOGLE_TTS_MODELS[ttsModel];

  return (
    <div className="bg-stone-900/95 text-stone-100 rounded-2xl p-4 sm:p-5 border border-stone-800/90 shadow-2xl space-y-4 backdrop-blur-md">
      
      {/* 1. Header Row with Play Controls, Google TTS Model Badge & Voice Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Brand & Briefing Identity */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 cursor-pointer select-none group flex-1"
        >
          <div className={`p-3 rounded-xl transition-all shrink-0 ${
            isPlaying 
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10' 
              : 'bg-stone-800 text-stone-400 group-hover:text-amber-400 group-hover:bg-stone-800/90 border border-stone-700/60'
          }`}>
            <Headphones className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Executive Spoken Briefing
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Google {activeModelMeta.badge}
              </span>
              {dialogueMode && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Dual-Speaker Co-Host
                </span>
              )}
              {isPlaying && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Playing 24kHz Studio WAV
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 truncate mt-0.5">
              Live neural speech: verified telemetry and Safe Action Gateway triage.
            </p>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          
          {/* Main Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 shrink-0 ${
              isPlaying 
                ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-amber-500/20 ring-2 ring-amber-400/40' 
                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20'
            }`}
            title={isPlaying ? 'Pause spoken brief' : 'Listen with Google Gemini 3.8 TTS'}
            aria-label={isPlaying ? 'Pause spoken brief' : 'Listen with Google Gemini 3.8 TTS'}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-stone-950" />
            ) : (
              <Play className="w-4 h-4 fill-stone-950 ml-0.5" />
            )}
          </button>

          {/* Speed Toggle */}
          <button
            onClick={handleSpeedChange}
            className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-mono font-bold text-stone-300 border border-stone-700 transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {playbackSpeed}x
          </button>

          {/* Expand / Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2.5 rounded-xl text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors flex items-center justify-center cursor-pointer"
            title={isExpanded ? 'Collapse viewer' : 'Expand full reading display'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Optional Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors flex items-center justify-center cursor-pointer"
              title="Close briefing bar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Audio Scrubber & Dynamic Frequency Visualizer */}
      <div className="space-y-1.5">
        <div 
          onClick={handleSeek}
          className="w-full py-1.5 cursor-pointer select-none group"
          title="Seek playback position"
        >
          <div className="relative w-full h-2 bg-stone-800 rounded-full overflow-hidden transition-all group-hover:h-2.5">
            <div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-150"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-stone-400">
          <div className="flex items-center gap-1.5 tabular-nums">
            <span className="text-amber-300 font-bold">{formatTime(currentSec)}</span>
            <span className="text-stone-600">/</span>
            <span className="text-stone-400">{formatTime(totalDurationSec)}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-Time Frequency Spectrum Visualizer */}
            {isPlaying && (
              <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {frequencyBars.map((height, i) => (
                  <span 
                    key={i} 
                    className="w-1 bg-amber-400 rounded-xs transition-all duration-75"
                    style={{ height: `${Math.max(15, height)}%` }}
                  />
                ))}
              </div>
            )}
            <span className="text-[11px] text-stone-400 font-sans hidden sm:inline">
              Voice: <strong className="text-amber-400 font-semibold">{selectedVoice}</strong>
              {dialogueMode && <span className="text-stone-500"> + {secondaryVoice}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Expanded Full Reading & Model Settings Section */}
      {isExpanded && (
        <div className="pt-3 border-t border-stone-800 space-y-4 animate-in fade-in-50 duration-200">
          
          {/* Top Google Model Selector Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-stone-950/80 p-3 rounded-xl border border-stone-800">
            {/* Option A: Gemini 3.8 Flash-Lite TTS */}
            <div 
              onClick={() => handleModelChange('gemini-3.8-flash-lite-tts')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                ttsModel === 'gemini-3.8-flash-lite-tts'
                  ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Gemini 3.8 Flash-Lite TTS
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  Ultra-Fast (~120ms)
                </span>
              </div>
              <p className="text-[11px] text-stone-400 leading-snug">
                Google's cost-optimized, low-latency engine for executive morning briefs and screen reading.
              </p>
            </div>

            {/* Option B: Gemini 3.8 Flash TTS Flagship */}
            <div 
              onClick={() => handleModelChange('gemini-3.8-flash-tts')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                ttsModel === 'gemini-3.8-flash-tts'
                  ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Gemini 3.8 Flash TTS (Flagship)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  Expressive HD (~300ms)
                </span>
              </div>
              <p className="text-[11px] text-stone-400 leading-snug">
                Google's premier model with voice design, co-host dialogue, vocal bursts, and backchanneling.
              </p>
            </div>
          </div>

          {/* Sub-navigation bar: View Modes + Google Voices + Co-Host Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-950/70 p-2.5 rounded-xl border border-stone-800">
            
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('teleprompter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'teleprompter'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Script Reader</span>
              </button>

              <button
                onClick={() => setViewMode('highlights')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'highlights'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Operating Gates ({briefing.bulletPoints.length})</span>
              </button>

              <button
                onClick={() => setViewMode('settings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'settings'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Voice & Persona Studio</span>
              </button>
            </div>

            {/* Voice Profile Switcher & Quick Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dual-Speaker Dialogue Toggle */}
              <button
                onClick={handleDialogueToggle}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer border ${
                  dialogueMode 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/30' 
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-white'
                }`}
                title="Toggle dual-speaker co-host dialogue (Elena & Marcus)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{dialogueMode ? 'Co-Host Dialogue: On' : 'Co-Host: Off'}</span>
              </button>

              {/* 5 Google Prebuilt Voices Switcher */}
              <div className="inline-flex rounded-lg bg-stone-900 p-0.5 border border-stone-800">
                {(['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => handleVoiceChange(v)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      selectedVoice === v 
                        ? 'bg-amber-500 text-stone-950 shadow-xs' 
                        : 'text-stone-400 hover:text-white'
                    }`}
                    title={SOVEREIGN_VOICE_PERSONAS[v].description}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Copy Script */}
              <button
                onClick={handleCopyScript}
                className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy full spoken script to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: FULL SPOKEN DOSSIER (TELEPROMPTER WITH REAL-TIME HIGHLIGHTING) */}
          {viewMode === 'teleprompter' && (
            <div className="p-4 sm:p-5 bg-stone-950 rounded-2xl border border-stone-800/90 shadow-inner space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-800/70 pb-2">
                <span className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Executive Teleprompter & Live Reader
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  {isPlaying ? '● Live Teleprompter Sync' : 'Click Play above to hear 24kHz studio audio'}
                </span>
              </div>

              {/* The Full Script with Real-Time Sentence Highlighting */}
              <div 
                className={`max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-3 leading-relaxed text-stone-200 font-sans select-text scroll-smooth ${
                  scriptFontSize === 'huge' 
                    ? 'text-lg sm:text-xl leading-loose' 
                    : scriptFontSize === 'large' 
                    ? 'text-base sm:text-lg leading-relaxed' 
                    : 'text-sm sm:text-base leading-relaxed'
                }`}
              >
                {sentences.map((sentence, idx) => {
                  const isActive = idx === activeSentenceIndex;
                  return (
                    <span 
                      key={idx}
                      ref={isActive ? activeSentenceRef : undefined}
                      className={`inline-block mr-1.5 p-1 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-amber-400/25 text-amber-50 font-medium ring-1 ring-amber-400/50 shadow-sm'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      {sentence}{' '}
                    </span>
                  );
                })}
              </div>

              {/* Bottom Quick-Action Bar */}
              <div className="pt-2 border-t border-stone-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-stone-500">Audio: 24kHz Studio WAV</span>
                  <span className="text-stone-700">·</span>
                  <button
                    onClick={() => fetchAudioBriefing(selectedVoice, activeLang, true)}
                    disabled={isLoading}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Synthesize with Gemini 3.8</span>
                  </button>
                </div>

                {onLaunchCommandCenter && (
                  <button
                    onClick={onLaunchCommandCenter}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-stone-950" />
                    <span>Act in Command Center</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: EXECUTIVE BULLET TAKEAWAYS */}
          {viewMode === 'highlights' && (
            <div className="p-4 bg-stone-950 rounded-2xl border border-stone-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-800/70 pb-2">
                <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Key Materiality Operating Gates
                </span>
                <span className="text-stone-500">Zero Hallucination Ground Truth</span>
              </div>

              <div className="space-y-2">
                {(briefing?.bulletPoints || []).map((point, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 flex items-start gap-3 text-xs sm:text-sm text-stone-200"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold font-mono">
                      {idx + 1}
                    </div>
                    <span className="leading-relaxed font-medium">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: VOICE & PERSONA STUDIO */}
          {viewMode === 'settings' && (
            <div className="p-4 bg-stone-950 rounded-2xl border border-stone-800 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-800/70 pb-2">
                <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Google Gemini 3.8 Voice Studio
                </span>
                <span className="text-stone-500">5 Prebuilt Personas + Dialogue Mode</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(Object.entries(SOVEREIGN_VOICE_PERSONAS) as [SovereignVoicePersona, typeof SOVEREIGN_VOICE_PERSONAS[SovereignVoicePersona]][]).map(([key, config]) => (
                  <div
                    key={key}
                    onClick={() => handleVoiceChange(key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVoice === key 
                        ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30' 
                        : 'bg-stone-900/70 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">{config.displayName}</span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {config.gender}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 leading-snug mb-2">{config.description}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-500">
                      <span>Role: {config.role.split('&')[0]}</span>
                      <span className="text-amber-300 font-semibold">{config.tone}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Co-Host Secondary Voice Picker if Dialogue Mode is enabled */}
              {dialogueMode && (
                <div className="p-3 bg-stone-900/80 rounded-xl border border-cyan-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Co-Host Persona (Speaker 2)</div>
                      <div className="text-[11px] text-stone-400">Marcus will speak with natural conversational backchanneling.</div>
                    </div>
                  </div>
                  <div className="inline-flex rounded-lg bg-stone-950 p-1 border border-stone-800">
                    {(['Puck', 'Fenrir', 'Charon'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => {
                          setSecondaryVoice(v);
                          fetchAudioBriefing(selectedVoice, activeLang, false);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          secondaryVoice === v ? 'bg-cyan-500 text-stone-950' : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
