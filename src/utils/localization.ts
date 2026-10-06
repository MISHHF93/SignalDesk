/**
 * SignalDesk Universal Localization & Multi-Currency Engine
 * Provides multi-lingual translations (13 languages), real-time currency conversion
 * across global fiat and enterprise crypto assets, localized formatting, and DOM direction control.
 */

export type AppLanguage = 
  | 'en' // English (US/UK)
  | 'es' // Spanish (Español)
  | 'fr' // French (Français)
  | 'de' // German (Deutsch)
  | 'ja' // Japanese (日本語)
  | 'zh' // Simplified Chinese (简体中文)
  | 'ar' // Arabic (العربية)
  | 'pt' // Portuguese (Português)
  | 'it' // Italian (Italiano)
  | 'hi' // Hindi (हिन्दी)
  | 'ko' // Korean (한국어)
  | 'ru' // Russian (Русский)
  | 'nl' // Dutch (Nederlands)
  | 'he'; // Hebrew (עברית)

export type AppCurrency = 
  // Global Fiat Currencies
  | 'USD' // US Dollar ($)
  | 'EUR' // Euro (€)
  | 'GBP' // British Pound (£)
  | 'JPY' // Japanese Yen (¥)
  | 'CAD' // Canadian Dollar (CA$)
  | 'AUD' // Australian Dollar (A$)
  | 'CHF' // Swiss Franc (CHF)
  | 'CNY' // Chinese Yuan (¥)
  | 'SGD' // Singapore Dollar (S$)
  | 'INR' // Indian Rupee (₹)
  | 'BRL' // Brazilian Real (R$)
  | 'AED' // UAE Dirham (د.إ)
  | 'ILS' // Israeli Shekel (₪)
  // Web3 & Crypto Currencies
  | 'BTC' // Bitcoin (₿)
  | 'ETH' // Ethereum (Ξ)
  | 'SOL' // Solana (◎)
  | 'USDC' // USD Coin ($)
  | 'USDT'; // Tether ($)

export interface LanguageMeta {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
  speechLang: string;
  dir: 'ltr' | 'rtl';
}

export interface CurrencyMeta {
  code: AppCurrency;
  name: string;
  symbol: string;
  ratePerUSD: number; // 1 USD = ratePerUSD * [Currency]
  isCrypto: boolean;
  decimals: number;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', speechLang: 'en-US', dir: 'ltr' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', speechLang: 'he-IL', dir: 'rtl' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speechLang: 'es-ES', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speechLang: 'fr-FR', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', speechLang: 'de-DE', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', speechLang: 'ja-JP', dir: 'ltr' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', speechLang: 'zh-CN', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', speechLang: 'ar-SA', dir: 'rtl' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', speechLang: 'pt-BR', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', speechLang: 'it-IT', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speechLang: 'hi-IN', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', speechLang: 'ko-KR', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', speechLang: 'ru-RU', dir: 'ltr' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', speechLang: 'nl-NL', dir: 'ltr' }
];

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  // Fiat
  { code: 'USD', name: 'US Dollar', symbol: '$', ratePerUSD: 1.0, isCrypto: false, decimals: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', ratePerUSD: 0.92, isCrypto: false, decimals: 0 },
  { code: 'GBP', name: 'British Pound', symbol: '£', ratePerUSD: 0.79, isCrypto: false, decimals: 0 },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', ratePerUSD: 3.68, isCrypto: false, decimals: 0 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', ratePerUSD: 152.0, isCrypto: false, decimals: 0 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', ratePerUSD: 1.36, isCrypto: false, decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', ratePerUSD: 1.52, isCrypto: false, decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', ratePerUSD: 0.89, isCrypto: false, decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', ratePerUSD: 7.23, isCrypto: false, decimals: 0 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', ratePerUSD: 1.34, isCrypto: false, decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', ratePerUSD: 83.4, isCrypto: false, decimals: 0 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', ratePerUSD: 5.15, isCrypto: false, decimals: 0 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', ratePerUSD: 3.67, isCrypto: false, decimals: 0 },
  // Crypto & Web3
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', ratePerUSD: 1 / 68450, isCrypto: true, decimals: 4 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', ratePerUSD: 1 / 3550, isCrypto: true, decimals: 3 },
  { code: 'SOL', name: 'Solana', symbol: '◎', ratePerUSD: 1 / 178, isCrypto: true, decimals: 2 },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC', ratePerUSD: 1.0, isCrypto: true, decimals: 2 },
  { code: 'USDT', name: 'Tether USD', symbol: 'USDT', ratePerUSD: 1.0, isCrypto: true, decimals: 2 }
];

export interface TranslationDict {
  appName: string;
  tagline: string;
  operatingPromise: string;
  oneBusinessOnePage: string;
  needsAttention: string;
  waitingOnMe: string;
  decisionQueue: string;
  governanceGates: string;
  instantBypass: string;
  instantBypassAll: string;
  mcpServers: string;
  connectors: string;
  activeSignals: string;
  runway: string;
  burnRate: string;
  verifiedArr: string;
  cryptoTreasury: string;
  onChainMultiSig: string;
  voiceChat: string;
  startSpeaking: string;
  askAnything: string;
  signAndExecute: string;
  inspectContract: string;
  welcomeMessage: string;
  quickPromptsTitle: string;
  currency: string;
  language: string;
  switchCurrency: string;
  switchLanguage: string;
  placeholder: string;
  send: string;
  pressEnter: string;
  export: string;
  clearChat: string;
  operatingPulse: string;
  pendingApprovals: string;
  view: string;

  // Navigation & Menus
  newSession: string;
  dailyOperatingPulse: string;
  web3CryptoTreasury: string;
  criticalSituations: string;
  connectorsLibrary: string;
  liveVoiceChat: string;
  operationalHealth: string;
  operatingLoop: string;
  multiAgentGuild: string;
  truthModel: string;
  compliancePosture: string;
  userProfile: string;
  voiceBriefing: string;
  audioVoiceBriefing: string;

  // Perspectives
  roleAll: string;
  roleRev: string;
  roleFin: string;
  roleOps: string;
  roleSupport: string;
  roleAllTitle: string;
  roleRevTitle: string;
  roleFinTitle: string;
  roleOpsTitle: string;
  roleSupportTitle: string;
  perspectiveActive: string;
  restoreUniversalOverview: string;
  onePerspectiveToSolveAll: string;

  // Attention Cards & Controls
  highMaterialityAttentionCards: string;
  pendingHumanAuthorizationGates: string;
  clickFlipForProvenance: string;
  p1Critical: string;
  p2High: string;
  flipCard: string;
  flipBack: string;
  financialExposure: string;
  owner: string;
  investigate: string;
  resolveBlocker: string;
  resolved: string;
  truthLevel: string;
  authoritativeSystems: string;
  recordId: string;
  confidence: string;

  // Governance Gates / Waiting On Me
  pendingDualKeySignature: string;
  preparedBy: string;
  reason: string;
  reviewGate: string;
  approveAndExecute: string;
  approved: string;
  bypassed: string;
  rootSovereignOverride: string;
  blastRadiusAndPolicy: string;

  // Pulse & Questions
  whatCameIn: string;
  whatIsStuck: string;
  whoOwnsIt: string;
  whatIsNext: string;
  speedRunResolve: string;
  batchExecuted: string;

  // Graphs & Metrics
  arrTrajectory: string;
  grossMargin: string;
  multiSigReserve: string;
  onTrack: string;

  // Quick Prompts
  quickPromptStuck: string;
  quickPromptApprovals: string;
  quickPromptArr: string;
  quickPromptConnectors: string;
  quickPromptCrypto: string;

  // Global Controls
  menu?: string;
  close?: string;
  openSidebar?: string;
  targetSystem?: string;
  voiceChatPrompt?: string;
  cardTucked?: string;
  operationalContextDeck?: string;
  activeOperationalSession?: string;
  simulator?: string;
  ledger?: string;
  vantaSuite?: string;
  preCheck?: string;
  passed?: string;
  postAction?: string;
  signature?: string;
  zeroLeakage?: string;
  groundTruth?: string;
  sourcesCited?: string;
  verifiedArrTrajectory?: string;

  // Public Portal & Layout Normalization
  portal?: string;
  commandCenter?: string;
  guidedTour?: string;
  launchCommandCenter?: string;
  signIn?: string;
  signOut?: string;
  allSystemsOperational?: string;
  continuousAuditActive?: string;
  operatingLoopTitle?: string;
  truthModelTitle?: string;
  governedMcpTitle?: string;
  securityComplianceTitle?: string;
  heroHeadline?: string;
  heroSubhead?: string;
  features?: string;
  architecture?: string;
  pricing?: string;
  docs?: string;
  connectedTools?: string;
  criticalIssues?: string;
  mrrAtRiskLabel?: string;
  explorePlatform?: string;
  viewAllConnectors?: string;
  systemArchitecture?: string;
  auditTrail?: string;
  settings?: string;
  voiceBriefingPlay?: string;
  voiceBriefingPause?: string;

  // Deep Pages, Modals & Normalized Actions
  login?: string;
  loginSSO?: string;
  launchLiveCommandCenter?: string;
  exploreConnectors?: string;
  complianceVanta?: string;
  tabAttention?: string;
  tabSafeGateway?: string;
  tabAgentGuild?: string;
  tabMcpProtocol?: string;
  tabAudioBrief?: string;
  tabProfile?: string;
  tabMembership?: string;
  tabFleet?: string;
  tabConfig?: string;
  tabCompliance?: string;
  tabAuthority?: string;
  tabBilling?: string;
  tabNotifications?: string;
  tabSessions?: string;
  saveChanges?: string;
  resetDefaults?: string;
  exportCSV?: string;
  runLiveScan?: string;
  exportBinder?: string;
  trustCenter?: string;
  auditLedger?: string;
  search?: string;
  filterAll?: string;

  // Extended Operational & Navigation Keys
  recentSessions?: string;
  operationsTools?: string;
  scenarioSimulator?: string;
  commandPalette?: string;
  parameterLedger?: string;
  ssoAuth?: string;
  sessionWebhookDrift?: string;
  sessionAcmeRenewal?: string;
  sessionPendingGates?: string;
  sessionCashBurn?: string;
  muteAlerts?: string;
  unmuteAlerts?: string;
  reconciling?: string;
  stop?: string;
  copy?: string;
  copied?: string;
  retry?: string;
  play?: string;
  pause?: string;
  targetProtocol?: string;
  safeActionScope?: string;
  preFlightPolicy?: string;
  auditHash?: string;
  cryptographicSignatureVerified?: string;
  zeroAiHallucination?: string;
  dualKeySignatureVerified?: string;
  waitingOnExecutive?: string;
  welcomeGreeting?: string;
  provenance?: string;
  policyCheck?: string;
  readyToExecute?: string;
  dataFriendlyMode?: string;
  auditMode?: string;
  evaluateAspect?: string;
  aspectPulse?: string;
  aspectFinancial?: string;
  aspectAttention?: string;
  aspectGovernance?: string;
  aspectConnectors?: string;
  aspectSimulator?: string;
  humanImpact?: string;
  safeActionProtected?: string;
  launchSimulator?: string;
  viewLedger?: string;
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDict> = {
  en: {
    appName: 'SignalDesk',
    tagline: 'The Company Intelligence & Attention Operating System',
    operatingPromise: "What came in. What's stuck. Who owns it. What's next.",
    oneBusinessOnePage: 'One Business. One Page. Intelligence across everything.',
    needsAttention: 'Needs Attention',
    waitingOnMe: 'Waiting on Me',
    decisionQueue: 'Decision Queue',
    governanceGates: 'Authorization Gates',
    instantBypass: '⚡ Instant Bypass',
    instantBypassAll: '⚡ Instant Bypass All',
    mcpServers: 'MCP Tool Servers',
    connectors: 'Authoritative Connectors',
    activeSignals: 'Active Operational Signals',
    runway: 'Cash Runway',
    burnRate: 'Net Monthly Burn',
    verifiedArr: 'Verified ARR',
    cryptoTreasury: 'Web3 & Crypto Treasury',
    onChainMultiSig: 'Gnosis Safe Multi-Sig',
    voiceChat: 'Live Voice Chat',
    startSpeaking: 'Listening...',
    askAnything: 'Ask SignalDesk anything across 57 connectors & crypto treasury...',
    signAndExecute: 'Sign & Execute',
    inspectContract: 'Inspect ↗',
    welcomeMessage: 'Good morning. I am SignalDesk, connected across 57 enterprise systems and 20 MCP servers.',
    quickPromptsTitle: 'Quick Actions',
    currency: 'Currency',
    language: 'Language',
    switchCurrency: 'Select Currency',
    switchLanguage: 'Select Language',
    placeholder: 'Ask about signals, ARR graphs, approvals, connectors...',
    send: 'Send query',
    pressEnter: 'Press Enter to send · Shift+Enter for newline',
    export: 'Export Transcript',
    clearChat: 'Clear Chat',
    operatingPulse: 'Operating Pulse',
    pendingApprovals: 'Pending Approvals',
    view: 'Review',
    newSession: 'New Session',
    dailyOperatingPulse: 'Daily Operating Pulse',
    web3CryptoTreasury: 'Web3 Crypto Treasury',
    criticalSituations: 'Critical Situations',
    connectorsLibrary: 'Connectors Library (57)',
    liveVoiceChat: 'Live Voice Chat',
    operationalHealth: 'Operational Health',
    operatingLoop: '13-Step Operating Loop',
    multiAgentGuild: 'Multi-Agent Guild',
    truthModel: 'Truth & Provenance',
    compliancePosture: 'Vanta Compliance Posture',
    userProfile: 'Executive Profile',
    voiceBriefing: 'Voice Briefing',
    audioVoiceBriefing: 'Audio Voice Briefing',
    roleAll: 'All (Unified)',
    roleRev: 'Rev',
    roleFin: 'Fin',
    roleOps: 'Ops',
    roleSupport: 'Support',
    roleAllTitle: 'Universal cross-domain operational intelligence',
    roleRevTitle: 'Revenue & Sales Pipeline intelligence',
    roleFinTitle: 'Finance, Runway & Invoicing operations',
    roleOpsTitle: 'Engineering & Delivery operations',
    roleSupportTitle: 'Customer Support & SLA health',
    perspectiveActive: 'Perspective Active',
    restoreUniversalOverview: 'Restore universal overview across all domains',
    onePerspectiveToSolveAll: 'One Perspective To Solve All ↺',
    highMaterialityAttentionCards: 'High-Materiality Attention Cards',
    pendingHumanAuthorizationGates: 'Pending Human Authorization Gates',
    clickFlipForProvenance: 'Click "Flip Card" for provenance & causality DAG',
    p1Critical: 'P1 CRITICAL',
    p2High: 'P2 HIGH',
    flipCard: 'Flip Card ↷',
    flipBack: 'Flip Back ↶',
    financialExposure: 'Financial Exposure:',
    owner: 'Owner:',
    investigate: 'Investigate',
    resolveBlocker: 'Resolve Blocker',
    resolved: 'Resolved',
    truthLevel: 'TRUTH LEVEL: SOURCE_FACT',
    authoritativeSystems: 'Authoritative Systems:',
    recordId: 'Record ID:',
    confidence: 'Confidence:',
    pendingDualKeySignature: 'PENDING DUAL-KEY SIGNATURE',
    preparedBy: 'Prepared by:',
    reason: 'Reason:',
    reviewGate: 'Review Gate',
    approveAndExecute: 'Approve & Execute',
    approved: 'Approved',
    bypassed: 'Bypassed',
    rootSovereignOverride: 'Root Sovereign Override Available',
    blastRadiusAndPolicy: 'BLAST RADIUS & SAFE POLICY',
    whatCameIn: 'What came in',
    whatIsStuck: "What's stuck",
    whoOwnsIt: 'Who owns it',
    whatIsNext: "What's next",
    speedRunResolve: 'Speed Run 1-Click Resolve',
    batchExecuted: 'Batch executed across authoritative systems',
    arrTrajectory: 'ARR Trajectory',
    grossMargin: 'Gross Margin',
    multiSigReserve: 'Gnosis Safe Multi-Sig Reserve',
    onTrack: 'On Track',
    quickPromptStuck: "What's stuck right now?",
    quickPromptApprovals: 'Review pending dual-key approvals',
    quickPromptArr: 'Analyze ARR trajectory & cash runway',
    quickPromptConnectors: 'Inspect 57 authoritative connectors',
    quickPromptCrypto: 'Reconcile Web3 crypto treasury',
    menu: 'Menu',
    close: 'Close',
    openSidebar: 'Open navigation (⌘B)',
    targetSystem: 'Target System:',
    voiceChatPrompt: 'Listening to your executive query...',
    cardTucked: 'Deck tucked · Click to expand',
    operationalContextDeck: 'Operational Context Deck',
    activeOperationalSession: 'Active Operational Session',
    simulator: 'What-If Simulator',
    ledger: 'Audit Ledger',
    vantaSuite: 'Vanta Suite',
    preCheck: 'Pre-flight check:',
    passed: 'PASSED',
    postAction: 'Post-action:',
    signature: 'Dual-Key Ed25519 Signature Required',
    zeroLeakage: 'Zero Leakage Guarantee',
    groundTruth: 'Ground Truth Provenance',
    sourcesCited: 'Sources cited',
    verifiedArrTrajectory: 'Verified ARR Trajectory',
    portal: 'Public Portal',
    commandCenter: 'Command Center',
    guidedTour: 'Interactive Tour',
    launchCommandCenter: 'Launch Command Center',
    signIn: 'Executive Sign In',
    signOut: 'Sign Out',
    allSystemsOperational: 'All Systems Operational',
    continuousAuditActive: 'Continuous Audit Active',
    operatingLoopTitle: '13-Step Closed Operating Loop',
    truthModelTitle: '6-Level Deterministic Truth Model',
    governedMcpTitle: '20 Governed MCP Servers & 57 Connectors',
    securityComplianceTitle: 'Vanta Continuous Compliance & SOC 2',
    heroHeadline: 'One Business. One Page. Intelligence across everything.',
    heroSubhead: "What came in. What's stuck. Who owns it. What's next.",
    features: 'Operating Engine',
    architecture: 'Protocol & Truth',
    pricing: 'Membership & Tiers',
    docs: 'MCP 2026 Docs',
    connectedTools: 'Connected Tools',
    criticalIssues: 'Critical Issues',
    mrrAtRiskLabel: 'ARR At Risk',
    explorePlatform: 'Explore Live Operating OS',
    viewAllConnectors: 'View 57 Connectors & 20 MCPs',
    systemArchitecture: 'System Architecture',
    auditTrail: 'Governance Audit Trail',
    settings: 'Executive Settings',
    voiceBriefingPlay: 'Listen to Morning Briefing',
    voiceBriefingPause: 'Pause Briefing',
    login: 'Log In',
    loginSSO: 'Log In / SSO',
    launchLiveCommandCenter: 'Launch Command Center',
    exploreConnectors: 'Explore 57 Connectors',
    complianceVanta: 'SOC-2 & Vanta Compliance',
    tabAttention: '1. Attention & Radar',
    tabSafeGateway: '2. Safe Action Gateway',
    tabAgentGuild: '3. Autonomous Agent Guild',
    tabMcpProtocol: '4. Model Context Protocol (MCP)',
    tabAudioBrief: '5. Executive Audio Brief',
    tabProfile: 'Profile & Roles',
    tabMembership: 'Membership & Google Cost Model',
    tabFleet: 'Active Fleet (57 Tools • 20 MCP)',
    tabConfig: 'Connector Configuration & Guardrails',
    tabCompliance: 'Vanta Compliance (SOC 2, HIPAA, ISO)',
    tabAuthority: 'Signing Thresholds',
    tabBilling: 'Billing & Ledger',
    tabNotifications: 'Executive Briefs',
    tabSessions: 'Security & Keys',
    saveChanges: 'Save Changes',
    resetDefaults: 'Reset to Baseline',
    exportCSV: 'Export CSV',
    runLiveScan: 'Run Live Vanta Scan',
    exportBinder: 'Export Binder',
    trustCenter: 'Trust Center',
    auditLedger: 'Non-Repudiation Audit Ledger',
    search: 'Search',
    filterAll: 'All',

    // Extended Operational & Navigation Keys
    recentSessions: 'Recent Sessions',
    operationsTools: 'Operations & Tools',
    scenarioSimulator: 'Scenario Simulator',
    commandPalette: 'Command Palette',
    parameterLedger: 'Board Parameter Ledger',
    ssoAuth: 'SSO & Sovereign Auth',
    sessionWebhookDrift: 'P1 Stripe Webhook Drift',
    sessionAcmeRenewal: 'Acme Corp $180K Renewal',
    sessionPendingGates: 'Pending Authorization Gates',
    sessionCashBurn: 'Cash Burn & Runway',
    muteAlerts: 'Mute Alert Sounds',
    unmuteAlerts: 'Unmute Alert Sounds',
    reconciling: 'Analyzing cross-system data...',
    stop: 'Stop',
    copy: 'Copy',
    copied: 'Copied',
    retry: 'Retry',
    play: 'Play',
    pause: 'Pause',
    targetProtocol: 'Target Protocol:',
    safeActionScope: 'Safe Action Scope:',
    preFlightPolicy: 'Pre-Flight Policy:',
    auditHash: 'Audit Hash:',
    cryptographicSignatureVerified: 'Cryptographic signature verified',
    zeroAiHallucination: 'Deterministic Truth',
    dualKeySignatureVerified: 'Dual-Key Signature Ed25519 Verified',
    waitingOnExecutive: 'WAITING ON EXECUTIVE',
    welcomeGreeting: 'Good morning. Welcome to your operational workspace.',
    provenance: 'Source Verification:',
    policyCheck: 'Safe Action Policy',
    readyToExecute: 'Ready',
    dataFriendlyMode: 'Data-Friendly Mode',
    auditMode: 'Deep Audit Mode',
    evaluateAspect: 'Evaluate Operational Aspect',
    aspectPulse: 'Operating Pulse',
    aspectFinancial: 'Financial & Growth',
    aspectAttention: 'Attention & Risks',
    aspectGovernance: 'Governance & Approvals',
    aspectConnectors: 'Connected Systems',
    aspectSimulator: 'Scenario Simulator',
    humanImpact: 'Business Impact',
    safeActionProtected: 'Safe Action Protected',
    launchSimulator: 'Open Sandbox',
    viewLedger: 'Board Ledger'
  },
  es: {
    appName: 'SignalDesk',
    tagline: 'El Sistema Operativo de Inteligencia y Atención Empresarial',
    operatingPromise: 'Qué entró. Qué está atascado. Quién lo posee. Qué sigue.',
    oneBusinessOnePage: 'Una Empresa. Una Página. Inteligencia en todo.',
    needsAttention: 'Requiere Atención',
    waitingOnMe: 'Esperando por Mí',
    decisionQueue: 'Cola de Decisiones',
    governanceGates: 'Puertas de Autorización',
    instantBypass: '⚡ Omisión Instantánea',
    instantBypassAll: '⚡ Omitir Todo al Instante',
    mcpServers: 'Servidores de Herramientas MCP',
    connectors: 'Conectores Autoritativos',
    activeSignals: 'Señales Operativas Activas',
    runway: 'Pista de Efectivo',
    burnRate: 'Gasto Mensual Neto',
    verifiedArr: 'ARR Verificado',
    cryptoTreasury: 'Tesorería Web3 y Cripto',
    onChainMultiSig: 'Multi-Firma Gnosis Safe',
    voiceChat: 'Chat de Voz en Vivo',
    startSpeaking: 'Escuchando...',
    askAnything: 'Pregunte lo que sea a SignalDesk en 57 conectores y tesorería cripto...',
    signAndExecute: 'Firmar y Ejecutar',
    inspectContract: 'Inspeccionar ↗',
    welcomeMessage: 'Buenos días. Soy su Copiloto Soberano SignalDesk, conectado a 57 sistemas empresariales, 20 servidores MCP y tesorería Web3.',
    quickPromptsTitle: 'Acciones Rápidas Ejecutivas',
    currency: 'Moneda',
    language: 'Idioma',
    switchCurrency: 'Seleccionar Moneda',
    switchLanguage: 'Seleccionar Idioma',
    placeholder: 'Consulte sobre señales, gráficos ARR, aprobaciones y 57 conectores...',
    send: 'Enviar consulta',
    pressEnter: 'Presione Enter para enviar · Shift+Enter para salto de línea',
    export: 'Exportar Transcripción',
    clearChat: 'Limpiar Chat',
    operatingPulse: 'Pulso Operativo',
    pendingApprovals: 'Aprobaciones Pendientes',
    view: 'Revisar',
    newSession: 'Nueva Sesión',
    dailyOperatingPulse: 'Pulso Operativo Diario',
    web3CryptoTreasury: 'Tesorería Cripto Web3',
    criticalSituations: 'Situaciones Críticas',
    connectorsLibrary: 'Biblioteca de Conectores (57)',
    liveVoiceChat: 'Chat de Voz en Vivo',
    operationalHealth: 'Salud Operacional',
    operatingLoop: 'Ciclo Operativo de 13 Pasos',
    multiAgentGuild: 'Gremio Multi-Agente',
    truthModel: 'Verdad y Procedencia',
    compliancePosture: 'Postura de Cumplimiento Vanta',
    userProfile: 'Perfil Ejecutivo',
    voiceBriefing: 'Resumen de Voz',
    audioVoiceBriefing: 'Resumen Ejecutivo en Audio',
    roleAll: 'Todo (Unificado)',
    roleRev: 'Ingresos',
    roleFin: 'Finanzas',
    roleOps: 'Operaciones',
    roleSupport: 'Soporte',
    roleAllTitle: 'Inteligencia operativa universal cross-domain',
    roleRevTitle: 'Inteligencia del pipeline de ventas e ingresos',
    roleFinTitle: 'Finanzas, pista de efectivo y facturación',
    roleOpsTitle: 'Operaciones de ingeniería y despliegue',
    roleSupportTitle: 'Soporte al cliente y salud de SLA',
    perspectiveActive: 'Perspectiva Activa',
    restoreUniversalOverview: 'Restaurar vista universal de todos los dominios',
    onePerspectiveToSolveAll: 'Una Perspectiva Para Resolver Todo ↺',
    highMaterialityAttentionCards: 'Tarjetas de Atención de Alta Relevancia',
    pendingHumanAuthorizationGates: 'Puertas de Autorización Humana Pendientes',
    clickFlipForProvenance: 'Haga clic en "Girar Tarjeta" para ver procedencia y grafo causal',
    p1Critical: 'P1 CRÍTICO',
    p2High: 'P2 ALTO',
    flipCard: 'Girar Tarjeta ↷',
    flipBack: 'Volver a Girar ↶',
    financialExposure: 'Exposición Financiera:',
    owner: 'Responsable:',
    investigate: 'Investigar',
    resolveBlocker: 'Resolver Bloqueo',
    resolved: 'Resuelto',
    truthLevel: 'NIVEL DE VERDAD: HECHO_FUENTE',
    authoritativeSystems: 'Sistemas Autoritativos:',
    recordId: 'ID de Registro:',
    confidence: 'Confianza:',
    pendingDualKeySignature: 'PENDIENTE DE FIRMA DUAL-KEY',
    preparedBy: 'Preparado por:',
    reason: 'Motivo:',
    reviewGate: 'Revisar Puerta',
    approveAndExecute: 'Aprobar y Ejecutar',
    approved: 'Aprobado',
    bypassed: 'Omitido',
    rootSovereignOverride: 'Anulación Soberana Root Disponible',
    blastRadiusAndPolicy: 'RADIO DE IMPACTO Y POLÍTICA SEGURA',
    whatCameIn: 'Qué entró',
    whatIsStuck: 'Qué está atascado',
    whoOwnsIt: 'Quién lo posee',
    whatIsNext: 'Qué sigue',
    speedRunResolve: 'Resolución Rápida en 1 Clic',
    batchExecuted: 'Lote ejecutado en sistemas autoritativos',
    arrTrajectory: 'Trayectoria de ARR',
    grossMargin: 'Margen Bruto',
    multiSigReserve: 'Reserva Multi-Firma Gnosis Safe',
    onTrack: 'En Curso',
    quickPromptStuck: '¿Qué está atascado ahora mismo?',
    quickPromptApprovals: 'Revisar aprobaciones dual-key pendientes',
    quickPromptArr: 'Analizar trayectoria de ARR y pista de caja',
    quickPromptConnectors: 'Inspeccionar 57 conectores autoritativos',
    quickPromptCrypto: 'Conciliar tesorería Web3 cripto',
    portal: 'Portal Público',
    commandCenter: 'Centro de Mando',
    guidedTour: 'Tour Interactivo',
    launchCommandCenter: 'Abrir Centro de Mando',
    signIn: 'Iniciar Sesión',
    signOut: 'Cerrar Sesión',
    login: 'Iniciar Sesión',
    loginSSO: 'Iniciar Sesión / SSO',
    launchLiveCommandCenter: 'Abrir Centro de Mando',
    exploreConnectors: 'Explorar 57 Conectores',
    complianceVanta: 'Cumplimiento SOC-2 y Vanta',
    tabAttention: '1. Atención y Radar',
    tabSafeGateway: '2. Pasarela de Acción Segura',
    tabAgentGuild: '3. Gremio de Agentes Autónomos',
    tabMcpProtocol: '4. Protocolo de Contexto MCP',
    tabAudioBrief: '5. Resumen Ejecutivo de Audio',
    tabProfile: 'Perfil y Roles',
    tabMembership: 'Membresía y Costos Google',
    tabFleet: 'Flota Activa (57 Herramientas • 20 MCP)',
    tabConfig: 'Configuración de Conectores y Reglas',
    tabCompliance: 'Cumplimiento Vanta (SOC 2, HIPAA, ISO)',
    tabAuthority: 'Límites de Firma y Gobernanza',
    tabBilling: 'Facturación y Libro Mayor',
    tabNotifications: 'Resúmenes Ejecutivos y Alertas',
    tabSessions: 'Seguridad y Claves Activas',
    saveChanges: 'Guardar Cambios',
    resetDefaults: 'Restablecer Valores',
    exportCSV: 'Exportar CSV',
    runLiveScan: 'Ejecutar Escaneo Vanta',
    exportBinder: 'Exportar Carpeta Auditora',
    trustCenter: 'Centro de Confianza',
    auditLedger: 'Libro de Auditoría Inmutable',
    search: 'Buscar',
    filterAll: 'Todos',

    // Extended Operational & Navigation Keys
    recentSessions: 'Sesiones Recientes',
    operationsTools: 'Operaciones y Herramientas',
    scenarioSimulator: 'Simulador de Escenarios',
    commandPalette: 'Paleta de Comandos',
    parameterLedger: 'Libro de Parámetros',
    ssoAuth: 'SSO y Autenticación',
    sessionWebhookDrift: 'P1 Desviación Webhook Stripe',
    sessionAcmeRenewal: 'Renovación Acme Corp $180K',
    sessionPendingGates: 'Puertas de Autorización Pendientes',
    sessionCashBurn: 'Consumo de Caja y Runway',
    muteAlerts: 'Silenciar Alertas',
    unmuteAlerts: 'Activar Alertas',
    reconciling: 'Analizando datos entre sistemas...',
    stop: 'Detener',
    copy: 'Copiar',
    copied: 'Copiado',
    retry: 'Reintentar',
    play: 'Reproducir',
    pause: 'Pausar',
    targetProtocol: 'Protocolo Objetivo:',
    safeActionScope: 'Alcance de Acción Segura:',
    preFlightPolicy: 'Política Previa:',
    auditHash: 'Hash de Auditoría:',
    cryptographicSignatureVerified: 'Firma criptográfica verificada',
    zeroAiHallucination: 'Verdad Determinista',
    dualKeySignatureVerified: 'Firma de Doble Clave Ed25519 Verificada',
    waitingOnExecutive: 'ESPERANDO AL EJECUTIVO',
    welcomeGreeting: 'Buenos días. Bienvenido a su espacio de mando operativo.'
  },
  fr: {
    appName: 'SignalDesk',
    tagline: "Le Système d'Exploitation de l'Intelligence et de l'Attention",
    operatingPromise: 'Ce qui est arrivé. Ce qui est bloqué. Qui en est responsable. La suite.',
    oneBusinessOnePage: 'Une Entreprise. Une Page. Intelligence globale.',
    needsAttention: 'Nécessite Attention',
    waitingOnMe: "En Attente de Moi",
    decisionQueue: 'File de Décision',
    governanceGates: "Portes d'Autorisation",
    instantBypass: '⚡ Dérivation Instantanée',
    instantBypassAll: '⚡ Tout Dériver au Clic',
    mcpServers: "Serveurs d'Outils MCP",
    connectors: 'Connecteurs Faisant Foi',
    activeSignals: 'Signaux Opérationnels Actifs',
    runway: 'Autonomie Financière',
    burnRate: 'Dépense Nette Mensuelle',
    verifiedArr: 'ARR Vérifié',
    cryptoTreasury: 'Trésorerie Web3 & Crypto',
    onChainMultiSig: 'Multi-Signature Gnosis Safe',
    voiceChat: 'Chat Vocal en Direct',
    startSpeaking: 'À votre écoute...',
    askAnything: 'Posez toute question à SignalDesk sur 57 connecteurs & la trésorerie crypto...',
    signAndExecute: 'Signer & Exécuter',
    inspectContract: 'Inspecter ↗',
    welcomeMessage: 'Bonjour. Je suis votre Copilote Souverain SignalDesk, connecté à 57 systèmes, 20 serveurs MCP et la trésorerie Web3.',
    quickPromptsTitle: 'Actions Rapides Exécutives',
    currency: 'Devise',
    language: 'Langue',
    switchCurrency: 'Choisir la Devise',
    switchLanguage: 'Changer de Langue',
    placeholder: 'Interrogez les signaux, graphiques ARR, validations et 57 connecteurs...',
    send: 'Envoyer',
    pressEnter: 'Appuyez sur Entrée pour envoyer · Maj+Entrée pour saut de ligne',
    export: 'Exporter la Transcription',
    clearChat: 'Effacer le Chat',
    operatingPulse: 'Pouls Opérationnel',
    pendingApprovals: 'Validations en Attente',
    view: 'Examiner',
    newSession: 'Nouvelle Session',
    dailyOperatingPulse: 'Pouls Opérationnel Quotidien',
    web3CryptoTreasury: 'Trésorerie Crypto Web3',
    criticalSituations: 'Situations Critiques',
    connectorsLibrary: 'Bibliothèque de Connecteurs (57)',
    liveVoiceChat: 'Chat Vocal en Direct',
    operationalHealth: 'Santé Opérationnelle',
    operatingLoop: 'Boucle Opérationnelle en 13 Étapes',
    multiAgentGuild: 'Guilde Multi-Agents',
    truthModel: 'Vérité & Traçabilité',
    compliancePosture: 'Conformité Vanta',
    userProfile: 'Profil Exécutif',
    voiceBriefing: 'Briefing Vocal',
    audioVoiceBriefing: 'Briefing Audio Exécutif',
    roleAll: 'Tout (Unifié)',
    roleRev: 'Revenus',
    roleFin: 'Finances',
    roleOps: 'Opérations',
    roleSupport: 'Support',
    roleAllTitle: 'Intelligence opérationnelle universelle',
    roleRevTitle: 'Intelligence commerciale et pipeline',
    roleFinTitle: 'Finances, trésorerie et factures',
    roleOpsTitle: 'Opérations techniques et déploiement',
    roleSupportTitle: 'Support client et santé des SLA',
    perspectiveActive: 'Perspective Active',
    restoreUniversalOverview: 'Restaurer la vue universelle',
    onePerspectiveToSolveAll: 'Une Perspective Pour Tout Résoudre ↺',
    highMaterialityAttentionCards: "Cartes d'Attention à Haute Criticité",
    pendingHumanAuthorizationGates: "Portes d'Autorisation Humaine en Attente",
    clickFlipForProvenance: "Cliquez sur 'Retourner la Carte' pour la causalité",
    p1Critical: 'P1 CRITIQUE',
    p2High: 'P2 ÉLEVÉ',
    flipCard: 'Retourner la Carte ↷',
    flipBack: 'Face Avant ↶',
    financialExposure: 'Exposition Financière :',
    owner: 'Responsable :',
    investigate: 'Enquêter',
    resolveBlocker: 'Résoudre le Blocage',
    resolved: 'Résolu',
    truthLevel: 'NIVEAU DE VÉRITÉ : FAIT_SOURCE',
    authoritativeSystems: 'Systèmes de Référence :',
    recordId: 'ID Enregistrement :',
    confidence: 'Confiance :',
    pendingDualKeySignature: 'EN ATTENTE DE DOUBLE SIGNATURE',
    preparedBy: 'Préparé par :',
    reason: 'Motif :',
    reviewGate: 'Examiner la Porte',
    approveAndExecute: 'Approuver & Exécuter',
    approved: 'Approuvé',
    bypassed: 'Dérivé',
    rootSovereignOverride: 'Dérogation Souveraine Root Disponible',
    blastRadiusAndPolicy: 'RAYON D IMPACT & POLITIQUE SÉCURISÉE',
    whatCameIn: 'Ce qui est arrivé',
    whatIsStuck: 'Ce qui est bloqué',
    whoOwnsIt: 'Qui est responsable',
    whatIsNext: 'La suite',
    speedRunResolve: 'Résolution Rapide en 1 Clic',
    batchExecuted: 'Lot exécuté sur les systèmes de référence',
    arrTrajectory: 'Trajectoire ARR',
    grossMargin: 'Marge Brute',
    multiSigReserve: 'Réserve Multi-Sig Gnosis Safe',
    onTrack: 'Conforme',
    quickPromptStuck: "Qu'est-ce qui est bloqué maintenant ?",
    quickPromptApprovals: 'Examiner les approbations double clé en attente',
    quickPromptArr: "Analyser la trajectoire d'ARR et l'autonomie financière",
    quickPromptConnectors: 'Inspecter les 57 connecteurs de référence',
    quickPromptCrypto: 'Rapprocher la trésorerie crypto Web3',
    portal: 'Portail Public',
    commandCenter: 'Centre de Commande',
    guidedTour: 'Visite Guidée',
    launchCommandCenter: 'Lancer le Centre de Commande',
    signIn: 'Connexion',
    signOut: 'Déconnexion',
    login: 'Connexion',
    loginSSO: 'Connexion / SSO',
    launchLiveCommandCenter: 'Lancer le Centre de Commande',
    exploreConnectors: 'Explorer les 57 Connecteurs',
    complianceVanta: 'Conformité SOC-2 et Vanta',
    tabAttention: '1. Attention & Radar',
    tabSafeGateway: '2. Passerelle d’Action Sécurisée',
    tabAgentGuild: '3. Guilde d’Agents Autonomes',
    tabMcpProtocol: '4. Protocole MCP 2026',
    tabAudioBrief: '5. Briefing Audio Exécutif',
    tabProfile: 'Profil & Rôles',
    tabMembership: 'Abonnement & Modèle de Coûts',
    tabFleet: 'Flotte Active (57 Outils • 20 MCP)',
    tabConfig: 'Configuration & Garde-fous',
    tabCompliance: 'Conformité Vanta (SOC 2, HIPAA, ISO)',
    tabAuthority: 'Seuils de Signature & Gouvernance',
    tabBilling: 'Facturation & Grand Livre',
    tabNotifications: 'Briefs Stratégiques & Alertes',
    tabSessions: 'Sécurité & Sessions Actives',
    saveChanges: 'Enregistrer',
    resetDefaults: 'Réinitialiser',
    exportCSV: 'Exporter CSV',
    runLiveScan: 'Lancer Scan Vanta en Direct',
    exportBinder: 'Exporter Dossier Audit',
    trustCenter: 'Centre de Confiance',
    auditLedger: 'Registre d’Audit Immuable',
    search: 'Rechercher',
    filterAll: 'Tous',

    // Extended Operational & Navigation Keys
    recentSessions: 'Sessions Récentes',
    operationsTools: 'Opérations & Outils',
    scenarioSimulator: 'Simulateur de Scénarios',
    commandPalette: 'Palette de Commandes',
    parameterLedger: 'Registre des Paramètres',
    ssoAuth: 'SSO & Authentification',
    sessionWebhookDrift: 'P1 Dérive Webhook Stripe',
    sessionAcmeRenewal: 'Renouvellement Acme Corp 180K$',
    sessionPendingGates: 'Passerelles en Attente',
    sessionCashBurn: 'Consommation de Trésorerie',
    muteAlerts: 'Couper le son',
    unmuteAlerts: 'Activer le son',
    reconciling: 'Analyse des systèmes interconnectés...',
    stop: 'Arrêter',
    copy: 'Copier',
    copied: 'Copié',
    retry: 'Réessayer',
    play: 'Lire',
    pause: 'Pause',
    targetProtocol: 'Protocole Cible :',
    safeActionScope: 'Périmètre Sécurisé :',
    preFlightPolicy: 'Politique Pré-exécution :',
    auditHash: 'Hachage Audit :',
    cryptographicSignatureVerified: 'Signature cryptographique vérifiée',
    zeroAiHallucination: 'Vérité Déterministe',
    dualKeySignatureVerified: 'Signature double clé Ed25519 vérifiée',
    waitingOnExecutive: 'EN ATTENTE DIRECTION',
    welcomeGreeting: 'Bonjour. Bienvenue dans votre espace opérationnel.'
  },
  de: {
    appName: 'SignalDesk',
    tagline: 'Das Betriebssystem für Unternehmensintelligenz und Aufmerksamkeit',
    operatingPromise: 'Was einging. Was feststeckt. Wer zuständig ist. Was folgt.',
    oneBusinessOnePage: 'Ein Unternehmen. Eine Seite. Intelligenz über alles.',
    needsAttention: 'Aufmerksamkeit Erforderlich',
    waitingOnMe: 'Wartet auf Mich',
    decisionQueue: 'Entscheidungswarteschlange',
    governanceGates: 'Autorisierungs-Gates',
    instantBypass: '⚡ Sofort-Bypass',
    instantBypassAll: '⚡ Alle Sofort Freigeben',
    mcpServers: 'MCP-Werkzeug-Server',
    connectors: 'Autoritative Konnektoren',
    activeSignals: 'Aktive Operative Signale',
    runway: 'Liquiditätsreichweite',
    burnRate: 'Monatliche Netto-Burnrate',
    verifiedArr: 'Verifizierter ARR',
    cryptoTreasury: 'Web3 & Krypto-Treasury',
    onChainMultiSig: 'Gnosis Safe Multi-Sig',
    voiceChat: 'Live-Sprachchat',
    startSpeaking: 'Höre zu...',
    askAnything: 'Fragen Sie SignalDesk über 57 Konnektoren & Krypto-Treasury...',
    signAndExecute: 'Signieren & Ausführen',
    inspectContract: 'Prüfen ↗',
    welcomeMessage: 'Guten Morgen. Ich bin Ihr souveräner SignalDesk Copilot, vernetzt über 57 Unternehmenssysteme, 20 MCP-Server und Krypto-Treasury.',
    quickPromptsTitle: 'Executive Schnellaktionen',
    currency: 'Währung',
    language: 'Sprache',
    switchCurrency: 'Währung Wählen',
    switchLanguage: 'Sprache Ändern',
    placeholder: 'Signale, ARR-Kurven, Freigaben und 57 Konnektoren abfragen...',
    send: 'Senden',
    pressEnter: 'Enter zum Senden · Umschalt+Enter für Zeilenumbruch',
    export: 'Transkript Exportieren',
    clearChat: 'Chat Löschen',
    operatingPulse: 'Operativer Puls',
    pendingApprovals: 'Ausstehende Freigaben',
    view: 'Prüfen',
    newSession: 'Neue Sitzung',
    dailyOperatingPulse: 'Täglicher Operativer Puls',
    web3CryptoTreasury: 'Web3 Krypto-Treasury',
    criticalSituations: 'Kritische Situationen',
    connectorsLibrary: 'Konnektoren-Bibliothek (57)',
    liveVoiceChat: 'Live-Sprachchat',
    operationalHealth: 'Operative Gesundheit',
    operatingLoop: '13-Schritte-Betriebsschleife',
    multiAgentGuild: 'Multi-Agenten-Gilde',
    truthModel: 'Wahrheit & Provenienz',
    compliancePosture: 'Vanta Compliance-Status',
    userProfile: 'Führungsprofil',
    voiceBriefing: 'Sprachbriefing',
    audioVoiceBriefing: 'Audio-Vorstands-Briefing',
    roleAll: 'Alle (Einheitlich)',
    roleRev: 'Vertrieb',
    roleFin: 'Finanzen',
    roleOps: 'Betrieb',
    roleSupport: 'Support',
    roleAllTitle: 'Universelle domänenübergreifende Intelligenz',
    roleRevTitle: 'Vertriebs- und Pipeline-Intelligenz',
    roleFinTitle: 'Finanzen, Liquidität und Rechnungen',
    roleOpsTitle: 'Entwicklungs- und Betriebsabläufe',
    roleSupportTitle: 'Kundensupport und SLA-Status',
    perspectiveActive: 'Perspektive Aktiv',
    restoreUniversalOverview: 'Universelle Gesamtsicht wiederherstellen',
    onePerspectiveToSolveAll: 'Eine Perspektive Für Alles ↺',
    highMaterialityAttentionCards: 'Aufmerksamkeitskarten Hoher Wesentlichkeit',
    pendingHumanAuthorizationGates: 'Ausstehende Menschliche Autorisierungs-Gates',
    clickFlipForProvenance: 'Klicken Sie auf "Karte Drehen" für Provenienz',
    p1Critical: 'P1 KRITISCH',
    p2High: 'P2 HOCH',
    flipCard: 'Karte Drehen ↷',
    flipBack: 'Zurückdrehen ↶',
    financialExposure: 'Finanzielles Risiko:',
    owner: 'Zuständig:',
    investigate: 'Untersuchen',
    resolveBlocker: 'Blocker Beheben',
    resolved: 'Behoben',
    truthLevel: 'WAHRHEITSSTUFE: QUELL_FAKT',
    authoritativeSystems: 'Autoritative Systeme:',
    recordId: 'Datensatz-ID:',
    confidence: 'Konfidenz:',
    pendingDualKeySignature: 'DUAL-KEY SIGNATUR AUSSTEHEND',
    preparedBy: 'Vorbereitet von:',
    reason: 'Begründung:',
    reviewGate: 'Gate Prüfen',
    approveAndExecute: 'Freigeben & Ausführen',
    approved: 'Freigegeben',
    bypassed: 'Übersprungen',
    rootSovereignOverride: 'Root-Souveräne Übersteuerung Verfügbar',
    blastRadiusAndPolicy: 'AUSWIRKUNGSRADIUS & SICHERE RICHTLINIE',
    whatCameIn: 'Was einging',
    whatIsStuck: 'Was feststeckt',
    whoOwnsIt: 'Wer zuständig ist',
    whatIsNext: 'Was folgt',
    speedRunResolve: '1-Klick-Expressauflösung',
    batchExecuted: 'Batch in autoritativen Systemen ausgeführt',
    arrTrajectory: 'ARR-Verlauf',
    grossMargin: 'Bruttomarge',
    multiSigReserve: 'Gnosis Safe Multi-Sig Reserve',
    onTrack: 'Im Plan',
    quickPromptStuck: 'Was steckt gerade fest?',
    quickPromptApprovals: 'Ausstehende Dual-Key Freigaben prüfen',
    quickPromptArr: 'ARR-Verlauf und Cash Runway analysieren',
    quickPromptConnectors: '57 autoritative Konnektoren prüfen',
    quickPromptCrypto: 'Web3 Krypto-Treasury abstimmen',
    portal: 'Öffentliches Portal',
    commandCenter: 'Kommandozentrale',
    guidedTour: 'Interaktive Tour',
    launchCommandCenter: 'Kommandozentrale starten',
    signIn: 'Anmelden',
    signOut: 'Abmelden',
    login: 'Anmelden',
    loginSSO: 'Anmelden / SSO',
    launchLiveCommandCenter: 'Kommandozentrale starten',
    exploreConnectors: '57 Konnektoren erkunden',
    complianceVanta: 'SOC-2 & Vanta Compliance',
    tabAttention: '1. Aufmerksamkeit & Radar',
    tabSafeGateway: '2. Sicheres Aktions-Gateway',
    tabAgentGuild: '3. Autonome Agenten-Gilde',
    tabMcpProtocol: '4. Model Context Protocol (MCP)',
    tabAudioBrief: '5. Executive Audio-Briefing',
    tabProfile: 'Profil & Rollen',
    tabMembership: 'Mitgliedschaft & Kostenmodell',
    tabFleet: 'Aktive Flotte (57 Tools • 20 MCP)',
    tabConfig: 'Konnektor-Konfiguration & Richtlinien',
    tabCompliance: 'Vanta Compliance (SOC 2, HIPAA, ISO)',
    tabAuthority: 'Freigabeschwellen & Governance',
    tabBilling: 'Abrechnung & Hauptbuch',
    tabNotifications: 'Executive Briefings & Warnungen',
    tabSessions: 'Sicherheit & Aktive Sitzungen',
    saveChanges: 'Änderungen speichern',
    resetDefaults: 'Zurücksetzen',
    exportCSV: 'CSV exportieren',
    runLiveScan: 'Live-Vanta-Scan ausführen',
    exportBinder: 'Prüfbericht exportieren',
    trustCenter: 'Trust Center',
    auditLedger: 'Unveränderliches Audit-Hauptbuch',
    search: 'Suchen',
    filterAll: 'Alle',

    // Extended Operational & Navigation Keys
    recentSessions: 'Letzte Sitzungen',
    operationsTools: 'Betrieb & Werkzeuge',
    scenarioSimulator: 'Szenario-Simulator',
    commandPalette: 'Befehlspalette',
    parameterLedger: 'Parameter-Hauptbuch',
    ssoAuth: 'SSO & Authentifizierung',
    sessionWebhookDrift: 'P1 Stripe Webhook Drift',
    sessionAcmeRenewal: 'Acme Corp $180K Verlängerung',
    sessionPendingGates: 'Ausstehende Freigaben',
    sessionCashBurn: 'Cash-Burn & Runway',
    muteAlerts: 'Töne stummschalten',
    unmuteAlerts: 'Töne aktivieren',
    reconciling: 'Systemübergreifende Analyse...',
    stop: 'Stopp',
    copy: 'Kopieren',
    copied: 'Kopiert',
    retry: 'Wiederholen',
    play: 'Abspielen',
    pause: 'Pause',
    targetProtocol: 'Zielprotokoll:',
    safeActionScope: 'Sicherheitsbereich:',
    preFlightPolicy: 'Vorab-Richtlinie:',
    auditHash: 'Audit-Hash:',
    cryptographicSignatureVerified: 'Kryptografische Signatur verifiziert',
    zeroAiHallucination: 'Deterministische Wahrheit',
    dualKeySignatureVerified: 'Zwei-Schlüssel-Signatur Ed25519 verifiziert',
    waitingOnExecutive: 'WARTET AUF FREIGABE',
    welcomeGreeting: 'Guten Tag. Willkommen in Ihrer Schaltzentrale.'
  },
  ja: {
    appName: 'SignalDesk',
    tagline: '全社インテリジェンス＆アテンション・オペレーティングシステム',
    operatingPromise: '何が入信し、何が滞留し、誰が責任者で、次の一手は何か。',
    oneBusinessOnePage: '一つの事業。一つの画面。すべてを横断するインテリジェンス。',
    needsAttention: '要対応項目',
    waitingOnMe: '私の承認待ち',
    decisionQueue: '意思決定キュー',
    governanceGates: '承認ゲート',
    instantBypass: '⚡ 即時バイパス承認',
    instantBypassAll: '⚡ 全てを一括バイパス',
    mcpServers: 'MCPツールサーバー',
    connectors: '権威あるコネクタ群',
    activeSignals: '稼働中オペレーションシグナル',
    runway: '資金ランウェイ',
    burnRate: '月間ネットバーン',
    verifiedArr: '検証済みARR',
    cryptoTreasury: 'Web3・クリプト財務トレジャリー',
    onChainMultiSig: 'Gnosis Safe マルチシグ',
    voiceChat: 'ライブ音声対話',
    startSpeaking: '音声を認識中...',
    askAnything: '57のSaaS・MCPツール・暗号資産トレジャリーについて何でもお尋ねください...',
    signAndExecute: '署名して実行',
    inspectContract: '詳細を検査 ↗',
    welcomeMessage: 'おはようございます。57の企業システム、20のMCPサーバー、Web3トレジャリーに直結したSignalDesk副操縦士です。',
    quickPromptsTitle: 'エグゼクティブクイックアクション',
    currency: '通貨',
    language: '言語',
    switchCurrency: '通貨を選択',
    switchLanguage: '言語を切り替え',
    placeholder: 'シグナル、ARRグラフ、承認案件、57コネクタについて質問...',
    send: '送信',
    pressEnter: 'Enterで送信 · Shift+Enterで改行',
    export: '対話履歴を書き出す',
    clearChat: 'チャット履歴を消去',
    operatingPulse: 'デイリー運行パルス',
    pendingApprovals: '保留中の承認一覧',
    view: '精査する',
    newSession: '新規セッション',
    dailyOperatingPulse: '運行パルス・ダッシュボード',
    web3CryptoTreasury: 'Web3財務トレジャリー',
    criticalSituations: '緊急シチュエーション',
    connectorsLibrary: 'コネクタライブラリ (57)',
    liveVoiceChat: 'ライブ音声対話',
    operationalHealth: '全社運行ヘルススコア',
    operatingLoop: '13段階オペレーティングループ',
    multiAgentGuild: 'マルチエージェントギルド',
    truthModel: 'ファクト真実性・来歴グラフ',
    compliancePosture: 'Vantaセキュリティ適合性',
    userProfile: '役員プロファイル',
    voiceBriefing: '音声ブリーフィング',
    audioVoiceBriefing: '経営幹部向け音声報告',
    roleAll: '全体 (統合)',
    roleRev: '収益',
    roleFin: '財務',
    roleOps: '開発',
    roleSupport: 'サポート',
    roleAllTitle: '全ドメイン横断オペレーションインテリジェンス',
    roleRevTitle: '売上・商談パイプラインインテリジェンス',
    roleFinTitle: '財務・ランウェイ・請求オペレーション',
    roleOpsTitle: 'エンジニアリングおよびデリバリー運行',
    roleSupportTitle: 'カスタマーサポートおよびSLA状況',
    perspectiveActive: '視点フィルター適用中',
    restoreUniversalOverview: '全領域の統合ビューを復元',
    onePerspectiveToSolveAll: 'すべてを統合する単一ビュー ↺',
    highMaterialityAttentionCards: '重要アテンションシグナルカード',
    pendingHumanAuthorizationGates: '決裁者承認待ちガバナンスゲート',
    clickFlipForProvenance: '「カードを裏返す」で来歴と因果DAGを確認',
    p1Critical: 'P1 最重要緊急',
    p2High: 'P2 高優先度',
    flipCard: 'カードを裏返す ↷',
    flipBack: '表面に戻す ↶',
    financialExposure: '財務リスク露出額:',
    owner: '主担当:',
    investigate: '因果究明',
    resolveBlocker: '障害を解消',
    resolved: '解決済み',
    truthLevel: '真実レベル: 一次ソースファクト',
    authoritativeSystems: '参照元システム:',
    recordId: 'レコードID:',
    confidence: '信頼性スコア:',
    pendingDualKeySignature: 'デュアルキー署名保留中',
    preparedBy: '起票エージェント:',
    reason: '理由:',
    reviewGate: 'ゲート確認',
    approveAndExecute: '承認して即時実行',
    approved: '承認済み',
    bypassed: 'バイパス済み',
    rootSovereignOverride: 'ルート権限オーバーライド有効',
    blastRadiusAndPolicy: '影響範囲および安全ポリシー',
    whatCameIn: '何が入信したか',
    whatIsStuck: '何が停滞しているか',
    whoOwnsIt: '誰が責任者か',
    whatIsNext: '次の一手は何か',
    speedRunResolve: '1クリック高速一括解決',
    batchExecuted: '公式システムに対しバッチ実行完了',
    arrTrajectory: 'ARR成長軌道',
    grossMargin: '売上総利益率',
    multiSigReserve: 'Gnosis Safe マルチシグ準備金',
    onTrack: '計画達成中',
    quickPromptStuck: '現在何が滞留していますか？',
    quickPromptApprovals: '承認待ちの決裁ゲートを確認',
    quickPromptArr: 'ARR軌道と資金ランウェイを分析',
    quickPromptConnectors: '57の接続済みSaaSコネクタを検証',
    quickPromptCrypto: 'Web3クリプト金庫を照合',
    portal: '公開ポータル',
    commandCenter: 'コマンドセンター',
    guidedTour: 'ガイドツアー',
    launchCommandCenter: 'コマンドセンター起動',
    signIn: 'ログイン',
    signOut: 'ログアウト',
    login: 'ログイン',
    loginSSO: 'ログイン / SSO',
    launchLiveCommandCenter: 'コマンドセンター起動',
    exploreConnectors: '57のコネクタを探索',
    complianceVanta: 'SOC-2 & Vanta コンプライアンス',
    tabAttention: '1. 重点監視 & レーダー',
    tabSafeGateway: '2. ガバナンスアクションゲートウェイ',
    tabAgentGuild: '3. 自律エージェントギルド',
    tabMcpProtocol: '4. Model Context Protocol (MCP)',
    tabAudioBrief: '5. エグゼクティブ音声ブリーフ',
    tabProfile: 'プロフィール & 役割',
    tabMembership: 'メンバーシップ & 原価モデル',
    tabFleet: '稼働フリート (57ツール • 20 MCP)',
    tabConfig: 'コネクタ設定 & ガードレール',
    tabCompliance: 'Vanta監査 (SOC 2, HIPAA, ISO)',
    tabAuthority: '署名権限 & 閾値',
    tabBilling: '請求書 & 元帳',
    tabNotifications: '役員向け速報 & アラート',
    tabSessions: 'セキュリティ & 有効セッション',
    saveChanges: '変更を保存',
    resetDefaults: 'デフォルトに戻す',
    exportCSV: 'CSV出力',
    runLiveScan: 'Vantaライブスキャン実行',
    exportBinder: '監査調書エクスポート',
    trustCenter: 'トラストセンター',
    auditLedger: '改ざん防止監査台帳',
    search: '検索',
    filterAll: 'すべて',

    // Extended Operational & Navigation Keys
    recentSessions: '最近のセッション',
    operationsTools: '業務とツール',
    scenarioSimulator: 'シナリオシミュレーター',
    commandPalette: 'コマンドパレット',
    parameterLedger: 'パラメータ台帳',
    ssoAuth: 'SSO・認証ゲートウェイ',
    sessionWebhookDrift: 'P1 Stripe Webhook ドリフト',
    sessionAcmeRenewal: 'Acme社 $180K 契約更新',
    sessionPendingGates: '保留中の承認ゲート',
    sessionCashBurn: '資金ランウェイと燃焼率',
    muteAlerts: 'アラート音をミュート',
    unmuteAlerts: 'アラート音を解除',
    reconciling: 'システム全体のデータを照合中...',
    stop: '停止',
    copy: 'コピー',
    copied: 'コピー完了',
    retry: '再試行',
    play: '再生',
    pause: '一時停止',
    targetProtocol: '対象プロトコル:',
    safeActionScope: '安全実行スコープ:',
    preFlightPolicy: '事前ポリシー:',
    auditHash: '監査ハッシュ:',
    cryptographicSignatureVerified: '暗号署名検証済み',
    zeroAiHallucination: '確定的真実',
    dualKeySignatureVerified: 'Ed25519 デュアルキー署名検証済み',
    waitingOnExecutive: '経営幹部の承認待ち',
    welcomeGreeting: 'おはようございます。統合運用ワークスペースへようこそ。'
  },
  zh: {
    appName: 'SignalDesk',
    tagline: '企业智能与注意力管理操作系统',
    operatingPromise: '发生何事。何处受阻。谁在负责。下一步规划。',
    oneBusinessOnePage: '一家企业。一个界面。全域智能穿透。',
    needsAttention: '需紧急关注',
    waitingOnMe: '等待我的决策',
    decisionQueue: '决策处理队列',
    governanceGates: '双密钥授权关卡',
    instantBypass: '⚡ 极速特许放行',
    instantBypassAll: '⚡ 一键特许全部放行',
    mcpServers: 'MCP协议工具服务器',
    connectors: '权威数据源连接器',
    activeSignals: '活跃运营信号',
    runway: '现金跑道',
    burnRate: '净月度烧钱率',
    verifiedArr: '已验证ARR收入',
    cryptoTreasury: 'Web3与加密资产金库',
    onChainMultiSig: 'Gnosis Safe 多签链上金库',
    voiceChat: '实时语音交互',
    startSpeaking: '正在聆听...',
    askAnything: '跨57个企业系统及链上金库向SignalDesk提问...',
    signAndExecute: '签署并调度执行',
    inspectContract: '合约查验 ↗',
    welcomeMessage: '早上好。我是您的SignalDesk主权智航系统，已贯通57款企业SaaS、20台MCP服务及Web3加密金库。',
    quickPromptsTitle: '执行官快捷指引',
    currency: '结算币种',
    language: '系统语言',
    switchCurrency: '选择币种',
    switchLanguage: '切换语言',
    placeholder: '询问业务信号、ARR图表、待办决裁或57个数据连接器...',
    send: '发送指令',
    pressEnter: '按Enter发送 · Shift+Enter换行',
    export: '导出对话实录',
    clearChat: '清空会话',
    operatingPulse: '日常运营脉搏',
    pendingApprovals: '待处理审批事项',
    view: '审查详情',
    newSession: '新建会话',
    dailyOperatingPulse: '每日运营脉搏看板',
    web3CryptoTreasury: 'Web3加密资产金库',
    criticalSituations: '紧急业务险情',
    connectorsLibrary: '权威数据连接器 (57)',
    liveVoiceChat: '实时语音对话',
    operationalHealth: '企业综合运营健康度',
    operatingLoop: '13步运营飞轮闭环',
    multiAgentGuild: '多智能体协作公会',
    truthModel: '真相与溯源追溯网络',
    compliancePosture: 'Vanta合规与安全态势',
    userProfile: '高管档案设置',
    voiceBriefing: '语音播报',
    audioVoiceBriefing: '执行官专属音频简报',
    roleAll: '全部 (统一视角)',
    roleRev: '营收',
    roleFin: '财务',
    roleOps: '研发',
    roleSupport: '服务',
    roleAllTitle: '穿透全业务域的综合智能',
    roleRevTitle: '销售商机与收入管道情报',
    roleFinTitle: '财务账目、现金流与应收账单',
    roleOpsTitle: '技术研发与系统工程交付',
    roleSupportTitle: '客户服务质量与SLA履约',
    perspectiveActive: '专属业务视角已激活',
    restoreUniversalOverview: '恢复全域宏观统揽视图',
    onePerspectiveToSolveAll: '一屏统揽全域运营 ↺',
    highMaterialityAttentionCards: '高风险重点关注卡片',
    pendingHumanAuthorizationGates: '待执行官双重签署授权关卡',
    clickFlipForProvenance: '点击“翻转卡片”查看数据溯源与因果DAG图谱',
    p1Critical: 'P1 极度紧急',
    p2High: 'P2 高优先级',
    flipCard: '翻转卡片 ↷',
    flipBack: '还原卡片 ↶',
    financialExposure: '潜在财务风险敞口:',
    owner: '负责人:',
    investigate: '溯源调查',
    resolveBlocker: '化解阻碍',
    resolved: '已解除',
    truthLevel: '真相等级: 源头事实 (SOURCE_FACT)',
    authoritativeSystems: '权威数据源系统:',
    recordId: '底册记录编号:',
    confidence: '置信度评分:',
    pendingDualKeySignature: '待双密钥签名确认',
    preparedBy: '起草智能体:',
    reason: '触发依据:',
    reviewGate: '审查关卡',
    approveAndExecute: '核准并执行',
    approved: '已核准',
    bypassed: '已特许放行',
    rootSovereignOverride: '超级特权干预通道已就绪',
    blastRadiusAndPolicy: '影响范围评估与风控策略',
    whatCameIn: '发生何事',
    whatIsStuck: '何处受阻',
    whoOwnsIt: '谁在负责',
    whatIsNext: '下一步规划',
    speedRunResolve: '一键极速批量清障',
    batchExecuted: '已向底层权威系统批量下发指令',
    arrTrajectory: 'ARR增长轨迹',
    grossMargin: '毛利率',
    multiSigReserve: 'Gnosis Safe 多签链上储备金',
    onTrack: '按计划推进',
    quickPromptStuck: '当前有哪些业务严重受阻？',
    quickPromptApprovals: '审查待决裁的双密钥授权事项',
    quickPromptArr: '分析ARR增长趋势与现金跑道',
    quickPromptConnectors: '检查57个权威系统连接状态',
    quickPromptCrypto: '对账Web3链上金库资产',
    portal: '公共门户',
    commandCenter: '指挥中心',
    guidedTour: '平台交互导览',
    launchCommandCenter: '启动指挥中心',
    signIn: '登录',
    signOut: '退出登录',
    login: '登录',
    loginSSO: '登录 / SSO 单点登录',
    launchLiveCommandCenter: '启动指挥中心',
    exploreConnectors: '浏览 57 项系统连接器',
    complianceVanta: 'SOC-2 & Vanta 安全合规',
    tabAttention: '1. 关键注意项与前瞻雷达',
    tabSafeGateway: '2. 安全执行网关与双签',
    tabAgentGuild: '3. 自主智能体专家集群',
    tabMcpProtocol: '4. 模型上下文协议 (MCP 2026)',
    tabAudioBrief: '5. 高管智能语音简报',
    tabProfile: '身份档案与权限角色',
    tabMembership: '企业会员与 Google 云成本',
    tabFleet: '在线舰队 (57 工具 • 20 MCP)',
    tabConfig: '连接器配置与安全护栏',
    tabCompliance: 'Vanta 持续合规 (SOC 2, HIPAA, ISO)',
    tabAuthority: '双签阈值与治理约束',
    tabBilling: '财务账单与集中对账本',
    tabNotifications: '高管决策简报与警报',
    tabSessions: '安全会话与密钥凭证',
    saveChanges: '保存更改',
    resetDefaults: '恢复基线默认值',
    exportCSV: '导出 CSV',
    runLiveScan: '运行实时 Vanta 遥测扫描',
    exportBinder: '导出合规审计卷宗',
    trustCenter: '安全信任中心',
    auditLedger: '防篡改审计全量凭证账本',
    search: '搜索',
    filterAll: '全部',

    // Extended Operational & Navigation Keys
    recentSessions: '最近会话',
    operationsTools: '运营与工具',
    scenarioSimulator: '情景模拟器',
    commandPalette: '命令面板',
    parameterLedger: '参数账本',
    ssoAuth: 'SSO与主权认证',
    sessionWebhookDrift: 'P1 Stripe Webhook 偏差',
    sessionAcmeRenewal: 'Acme Corp 18万美元续约',
    sessionPendingGates: '待批准关口',
    sessionCashBurn: '资金消耗与跑道',
    muteAlerts: '静音提示音',
    unmuteAlerts: '开启提示音',
    reconciling: '正在分析跨系统数据...',
    stop: '停止',
    copy: '复制',
    copied: '已复制',
    retry: '重试',
    play: '播放',
    pause: '暂停',
    targetProtocol: '目标协议:',
    safeActionScope: '安全行动范围:',
    preFlightPolicy: '前置合规策略:',
    auditHash: '审计哈希:',
    cryptographicSignatureVerified: '密码学签名已验证',
    zeroAiHallucination: '确定性事实',
    dualKeySignatureVerified: 'Ed25519双密钥签名已验证',
    waitingOnExecutive: '等待高管批准',
    welcomeGreeting: '早上好，欢迎进入业务指挥空间。'
  },
  ar: {
    appName: 'SignalDesk',
    tagline: 'نظام تشغيل ذكاء الأعمال وإدارة الاهتمام المؤسسي',
    operatingPromise: 'ما الذي ورد. ما الذي توقف. من المسؤول. ما الخطوة التالية.',
    oneBusinessOnePage: 'شركة واحدة. شاشة واحدة. ذكاء شامل لكل العمليات.',
    needsAttention: 'يتطلب الاهتمام',
    waitingOnMe: 'بانتظار موافقتي',
    decisionQueue: 'قائمة القرارات',
    governanceGates: 'بوابات التفويض',
    instantBypass: '⚡ تجاوز فوري سيادي',
    instantBypassAll: '⚡ تجاوز فوري للكل',
    mcpServers: 'خوادم أدوات MCP',
    connectors: 'الموصلات المعتمدة',
    activeSignals: 'الإشارات التشغيلية النشطة',
    runway: 'المدرج المالي',
    burnRate: 'معدل الحرق الشهري',
    verifiedArr: 'الإيراد السنوي الموثق',
    cryptoTreasury: 'خزينة الويب 3 والأصول المشفرة',
    onChainMultiSig: 'المحفظة متعددة التوقيع Gnosis Safe',
    voiceChat: 'محادثة صوتية حية',
    startSpeaking: 'جاري الاستماع...',
    askAnything: 'اسأل SignalDesk عن أي شيء عبر 57 موصلاً وخزينة الكريبتو...',
    signAndExecute: 'توقيع وتنفيذ',
    inspectContract: 'فحص العقد ↗',
    welcomeMessage: 'صباح الخير. أنا مساعدك السيادي في SignalDesk، متصل بـ 57 نظاماً مؤسسياً، و20 خادم MCP، وخزينة الكريبتو.',
    quickPromptsTitle: 'إجراءات تنفيذية سريعة',
    currency: 'العملة',
    language: 'اللغة',
    switchCurrency: 'اختر العملة',
    switchLanguage: 'اختر اللغة',
    placeholder: 'استفسر عن الإشارات، ورسوم ARR، والموافقات و57 موصلاً...',
    send: 'إرسال',
    pressEnter: 'اضغط Enter للإرسال · Shift+Enter لسطر جديد',
    export: 'تصدير المحادثة',
    clearChat: 'مسح المحادثة',
    operatingPulse: 'النبض التشغيلي',
    pendingApprovals: 'موافقات معلقة',
    view: 'مراجعة',
    newSession: 'جلسة جديدة',
    dailyOperatingPulse: 'النبض التشغيلي اليومي',
    web3CryptoTreasury: 'خزينة الكريبتو والويب 3',
    criticalSituations: 'المواقف الحرجة',
    connectorsLibrary: 'مكتبة الموصلات (57)',
    liveVoiceChat: 'محادثة صوتية حية',
    operationalHealth: 'الصحة التشغيلية',
    operatingLoop: 'دورة التشغيل المكونة من 13 خطوة',
    multiAgentGuild: 'نقابة الوكلاء الأذكياء',
    truthModel: 'نموذج الحقيقة ومصدر البيانات',
    compliancePosture: 'مستوى الامتثال الأمني Vanta',
    userProfile: 'الملف التعريفي التنفيذي',
    voiceBriefing: 'الموجز الصوتي',
    audioVoiceBriefing: 'موجز صوتي تنفيذي',
    roleAll: 'الكل (موحد)',
    roleRev: 'الإيرادات',
    roleFin: 'المالية',
    roleOps: 'العمليات',
    roleSupport: 'الدعم',
    roleAllTitle: 'ذكاء تشغيلي شامل لكل القطاعات',
    roleRevTitle: 'ذكاء المبيعات ومسارات الإيرادات',
    roleFinTitle: 'المالية والمدرج النقدي والفواتير',
    roleOpsTitle: 'العمليات الهندسية والتسليم',
    roleSupportTitle: 'دعم العملاء ومستوى الخدمة SLA',
    perspectiveActive: 'المنظور نشط',
    restoreUniversalOverview: 'استعادة العرض الشامل الموحد',
    onePerspectiveToSolveAll: 'شاشة واحدة لحل كل شيء ↺',
    highMaterialityAttentionCards: 'بطاقات الاهتمام فائقة الأهمية',
    pendingHumanAuthorizationGates: 'بوابات التفويض البشري المعلقة',
    clickFlipForProvenance: 'انقر على "قلب البطاقة" للاطلاع على المصدر والسببية',
    p1Critical: 'أولوية قصوى P1',
    p2High: 'أولوية عالية P2',
    flipCard: 'قلب البطاقة ↷',
    flipBack: 'إعادة الوجه ↶',
    financialExposure: 'التعرض المالي:',
    owner: 'المسؤول:',
    investigate: 'تحقيق وتتبع',
    resolveBlocker: 'حل العائق',
    resolved: 'تم الحل',
    truthLevel: 'مستوى الحقيقة: حقيقة المصدر الأولية',
    authoritativeSystems: 'الأنظمة المعتمدة:',
    recordId: 'رقم السجل:',
    confidence: 'درجة الثقة:',
    pendingDualKeySignature: 'بانتظار التوقيع الثنائي المزدوج',
    preparedBy: 'إعداد بواسطة:',
    reason: 'السبب:',
    reviewGate: 'مراجعة البوابة',
    approveAndExecute: 'موافقة وتنفيذ',
    approved: 'تمت الموافقة',
    bypassed: 'تم التجاوز',
    rootSovereignOverride: 'التجاوز السيادي للمسؤول متاح',
    blastRadiusAndPolicy: 'نطاق التأثير والسياسة الآمنة',
    whatCameIn: 'ما الذي ورد',
    whatIsStuck: 'ما الذي توقف',
    whoOwnsIt: 'من المسؤول',
    whatIsNext: 'ما الخطوة التالية',
    speedRunResolve: 'حل فوري بنقرة واحدة',
    batchExecuted: 'تم التنفيذ الجماعي عبر الأنظمة الرسمية',
    arrTrajectory: 'مسار الإيرادات السنوية ARR',
    grossMargin: 'الهامش الإجمالي',
    multiSigReserve: 'احتياطي Gnosis Safe متعدد التوقيع',
    onTrack: 'ضمن الخطة',
    quickPromptStuck: 'ما هي المشكلات العالقة الآن؟',
    quickPromptApprovals: 'مراجعة بوابات التوقيع المزدوج المعلقة',
    quickPromptArr: 'تحليل مسار ARR والمدرج النقدي',
    quickPromptConnectors: 'فحص 57 موصلاً مؤسسياً معتمداً',
    quickPromptCrypto: 'تسوية خزينة الكريبتو والويب 3',
    portal: 'البوابة العامة',
    commandCenter: 'مركز القيادة',
    guidedTour: 'جولة تعريفية تفاعلية',
    launchCommandCenter: 'تشغيل مركز العمليات القيادي',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    login: 'تسجيل الدخول',
    loginSSO: 'تسجيل الدخول / SSO',
    launchLiveCommandCenter: 'تشغيل مركز العمليات القيادي',
    exploreConnectors: 'استكشف 57 رابط نظام موثوق',
    complianceVanta: 'امتثال أمني Vanta و SOC-2',
    tabAttention: '1. الرادار التنفيذي والانتباه',
    tabSafeGateway: '2. بوابة العمل الآمن والحوكمة',
    tabAgentGuild: '3. رابطة الوكلاء المستقلين',
    tabMcpProtocol: '4. بروتوكول سياق النموذج (MCP)',
    tabAudioBrief: '5. موجز الذكاء الصوتي اليومي',
    tabProfile: 'الملف التنفيذي والأدوار',
    tabMembership: 'العضوية ونموذج تكاليف السحابة',
    tabFleet: 'الأسطول النشط (57 أداة • 20 خادم MCP)',
    tabConfig: 'إعدادات الروابط وحواجز الحماية',
    tabCompliance: 'امتثال Vanta (SOC 2, HIPAA, ISO)',
    tabAuthority: 'صلاحيات التوقيع وحدود التفويض',
    tabBilling: 'الفواتير ودفتر الأستاذ الموحد',
    tabNotifications: 'الموجزات التنفيذية والتنبيهات',
    tabSessions: 'الأمان والجلسات والمفاتيح النشطة',
    saveChanges: 'حفظ التغييرات',
    resetDefaults: 'إعادة التعيين إلى الإعدادات الافتراضية',
    exportCSV: 'تصدير بتنسيق CSV',
    runLiveScan: 'بدء فحص Vanta المباشر',
    exportBinder: 'تصدير ملف التدقيق والامتثال',
    trustCenter: 'مركز الثقة والأمان',
    auditLedger: 'دفتر تدقيق العمليات الموثق',
    search: 'بحث',
    filterAll: 'الكل',

    // Extended Operational & Navigation Keys
    recentSessions: 'الجلسات الأخيرة',
    operationsTools: 'العمليات والأدوات',
    scenarioSimulator: 'محاكي السيناريوهات',
    commandPalette: 'لوحة الأوامر',
    parameterLedger: 'سجل المعايير',
    ssoAuth: 'تسجيل الدخول الموحد والتوثيق',
    sessionWebhookDrift: 'P1 انحراف خطاف ويب Stripe',
    sessionAcmeRenewal: 'تجديد عقد Acme بـ 180 ألف دولار',
    sessionPendingGates: 'بوابات التفويض المعلقة',
    sessionCashBurn: 'معدل الحرق وفترة السيولة',
    muteAlerts: 'كتم التنبيهات',
    unmuteAlerts: 'تشغيل التنبيهات',
    reconciling: 'جارٍ تحليل بيانات الأنظمة المتصلة...',
    stop: 'إيقاف',
    copy: 'نسخ',
    copied: 'تم النسخ',
    retry: 'إعادة المحاولة',
    play: 'تشغيل',
    pause: 'إيقاف مؤقت',
    targetProtocol: 'البروتوكول المستهدف:',
    safeActionScope: 'نطاق الإجراء الآمن:',
    preFlightPolicy: 'سياسة التحقق المسبق:',
    auditHash: 'تجزئة التدقيق:',
    cryptographicSignatureVerified: 'التوقيع المشفر موثق',
    zeroAiHallucination: 'حقيقة حتمية مؤكدة',
    dualKeySignatureVerified: 'توقيع المفتاح المزدوج Ed25519 موثق',
    waitingOnExecutive: 'بانتظار موافقة الإدارة',
    welcomeGreeting: 'صباح الخير. مرحبًا بك في منصة القيادة التشغيلية.'
  },
  pt: {
    appName: 'SignalDesk',
    tagline: 'O Sistema Operacional de Inteligência e Atenção Empresarial',
    operatingPromise: 'O que entrou. O que travou. Quem é o dono. O que vem a seguir.',
    oneBusinessOnePage: 'Uma Empresa. Uma Página. Inteligência em tudo.',
    needsAttention: 'Requer Atenção',
    waitingOnMe: 'Aguardando Minha Ação',
    decisionQueue: 'Fila de Decisões',
    governanceGates: 'Portões de Autorização',
    instantBypass: '⚡ Bypass Instantâneo',
    instantBypassAll: '⚡ Bypass Total Instantâneo',
    mcpServers: 'Servidores de Ferramentas MCP',
    connectors: 'Conectores Autoritativos',
    activeSignals: 'Sinais Operacionais Ativos',
    runway: 'Runway de Caixa',
    burnRate: 'Burn Rate Mensal',
    verifiedArr: 'ARR Verificado',
    cryptoTreasury: 'Tesouraria Web3 e Cripto',
    onChainMultiSig: 'Multi-Sig Gnosis Safe',
    voiceChat: 'Chat de Voz ao Vivo',
    startSpeaking: 'Ouvindo...',
    askAnything: 'Pergunte qualquer coisa ao SignalDesk em 57 conectores e tesouraria cripto...',
    signAndExecute: 'Assinar e Executar',
    inspectContract: 'Inspecionar ↗',
    welcomeMessage: 'Bom dia. Sou seu Copiloto Soberano SignalDesk, conectado a 57 sistemas corporativos, 20 servidores MCP e tesouraria Web3.',
    quickPromptsTitle: 'Ações Rápidas Executivas',
    currency: 'Moeda',
    language: 'Idioma',
    switchCurrency: 'Selecionar Moeda',
    switchLanguage: 'Alterar Idioma',
    placeholder: 'Pergunte sobre sinais, gráficos de ARR, aprovações e 57 conectores...',
    send: 'Enviar',
    pressEnter: 'Pressione Enter para enviar · Shift+Enter para nova linha',
    export: 'Exportar Transcrição',
    clearChat: 'Limpar Conversa',
    operatingPulse: 'Pulso Operacional',
    pendingApprovals: 'Aprovações Pendentes',
    view: 'Revisar',
    newSession: 'Nova Sessão',
    dailyOperatingPulse: 'Pulso Operacional Diário',
    web3CryptoTreasury: 'Tesouraria Cripto Web3',
    criticalSituations: 'Situações Críticas',
    connectorsLibrary: 'Biblioteca de Conectores (57)',
    liveVoiceChat: 'Chat de Voz ao Vivo',
    operationalHealth: 'Saúde Operacional',
    operatingLoop: 'Ciclo Operacional de 13 Etapas',
    multiAgentGuild: 'Guilda Multi-Agente',
    truthModel: 'Verdade e Proveniência',
    compliancePosture: 'Conformidade Vanta',
    userProfile: 'Perfil Executivo',
    voiceBriefing: 'Briefing por Voz',
    audioVoiceBriefing: 'Briefing Executivo em Áudio',
    roleAll: 'Tudo (Unificado)',
    roleRev: 'Receita',
    roleFin: 'Finanças',
    roleOps: 'Operações',
    roleSupport: 'Suporte',
    roleAllTitle: 'Inteligência operacional abrangente',
    roleRevTitle: 'Inteligência de pipeline e vendas',
    roleFinTitle: 'Finanças, caixa e faturamento',
    roleOpsTitle: 'Engenharia e entrega técnica',
    roleSupportTitle: 'Suporte ao cliente e metas de SLA',
    perspectiveActive: 'Perspectiva Ativa',
    restoreUniversalOverview: 'Restaurar visão geral unificada',
    onePerspectiveToSolveAll: 'Uma Perspectiva Para Resolver Tudo ↺',
    highMaterialityAttentionCards: 'Cartões de Atenção de Alta Materialidade',
    pendingHumanAuthorizationGates: 'Portões de Autorização Humana Pendentes',
    clickFlipForProvenance: 'Clique em "Virar Cartão" para ver proveniência',
    p1Critical: 'P1 CRÍTICO',
    p2High: 'P2 ALTO',
    flipCard: 'Virar Cartão ↷',
    flipBack: 'Desvirar ↶',
    financialExposure: 'Exposição Financeira:',
    owner: 'Responsável:',
    investigate: 'Investigar',
    resolveBlocker: 'Resolver Bloqueio',
    resolved: 'Resolvido',
    truthLevel: 'NÍVEL DE VERDADE: FATO_FONTE',
    authoritativeSystems: 'Sistemas Oficiais:',
    recordId: 'ID do Registro:',
    confidence: 'Confiança:',
    pendingDualKeySignature: 'PENDENTE DE ASSINATURA DUPLA',
    preparedBy: 'Preparado por:',
    reason: 'Motivo:',
    reviewGate: 'Revisar Portão',
    approveAndExecute: 'Aprovar e Executar',
    approved: 'Aprovado',
    bypassed: 'Ignorado',
    rootSovereignOverride: 'Substituição Soberana Root Disponível',
    blastRadiusAndPolicy: 'RAIO DE IMPACTO E POLÍTICA SEGURA',
    whatCameIn: 'O que entrou',
    whatIsStuck: 'O que travou',
    whoOwnsIt: 'Quem é o dono',
    whatIsNext: 'O que vem a seguir',
    speedRunResolve: 'Resolução Rápida em 1 Clique',
    batchExecuted: 'Execução em lote concluída nos sistemas oficiais',
    arrTrajectory: 'Trajetória de ARR',
    grossMargin: 'Margem Bruta',
    multiSigReserve: 'Reserva Multi-Sig Gnosis Safe',
    onTrack: 'No Prazo',
    quickPromptStuck: 'O que está travado agora?',
    quickPromptApprovals: 'Revisar portões de aprovação dupla pendentes',
    quickPromptArr: 'Analisar trajetória de ARR e runway de caixa',
    quickPromptConnectors: 'Inspecionar 57 conectores autoritativos',
    quickPromptCrypto: 'Reconciliar tesouraria cripto Web3',
    recentSessions: 'Sessões Recentes',
    operationsTools: 'Operações e Ferramentas',
    scenarioSimulator: 'Simulador de Cenários',
    commandPalette: 'Paleta de Comandos',
    parameterLedger: 'Livro de Parâmetros do Conselho',
    ssoAuth: 'SSO e Autenticação Soberana',
    sessionWebhookDrift: 'Desvio de Webhook Stripe P1',
    sessionAcmeRenewal: 'Renovação Acme Corp $180K',
    sessionPendingGates: 'Portões de Autorização Pendentes',
    sessionCashBurn: 'Queima de Caixa e Runway',
    muteAlerts: 'Silenciar Sons de Alerta',
    unmuteAlerts: 'Ativar Sons de Alerta',
    reconciling: 'Analisando dados entre sistemas...',
    stop: 'Parar',
    copy: 'Copiar',
    copied: 'Copiado',
    retry: 'Tentar Novamente',
    play: 'Reproduzir',
    pause: 'Pausar',
    targetProtocol: 'Protocolo Alvo:',
    safeActionScope: 'Escopo da Ação Segura:',
    preFlightPolicy: 'Política Pré-Voo:',
    auditHash: 'Hash de Auditoria:',
    cryptographicSignatureVerified: 'Assinatura criptográfica verificada',
    zeroAiHallucination: 'Verdade Determinística',
    dualKeySignatureVerified: 'Assinatura Ed25519 de Chave Dupla Verificada',
    waitingOnExecutive: 'AGUARDANDO EXECUTIVO',
    welcomeGreeting: 'Bom dia. Bem-vindo ao seu espaço operacional.'
  },
  it: {
    appName: 'SignalDesk',
    tagline: "Il Sistema Operativo di Intelligence e Attenzione Aziendale",
    operatingPromise: 'Cosa è arrivato. Cosa è bloccato. Chi ne è responsabile. Cosa segue.',
    oneBusinessOnePage: "Un'Azienda. Una Pagina. Intelligence su tutto.",
    needsAttention: 'Richiede Attenzione',
    waitingOnMe: 'In Attesa di Me',
    decisionQueue: 'Coda Decisionale',
    governanceGates: 'Gate di Autorizzazione',
    instantBypass: '⚡ Bypass Istantaneo',
    instantBypassAll: '⚡ Bypass Istantaneo Globale',
    mcpServers: 'Server Strumenti MCP',
    connectors: 'Connettori Autorevoli',
    activeSignals: 'Segnali Operativi Attivi',
    runway: 'Runway di Cassa',
    burnRate: 'Burn Rate Mensile',
    verifiedArr: 'ARR Verificato',
    cryptoTreasury: 'Tesoreria Web3 & Cripto',
    onChainMultiSig: 'Multi-Sig Gnosis Safe',
    voiceChat: 'Chat Vocale dal Vivo',
    startSpeaking: 'In ascolto...',
    askAnything: 'Chiedi qualunque cosa a SignalDesk su 57 connettori e tesoreria cripto...',
    signAndExecute: 'Firma ed Esegui',
    inspectContract: 'Ispeziona ↗',
    welcomeMessage: 'Buongiorno. Sono il tuo Copilota Sovrano SignalDesk, connesso a 57 sistemi aziendali, 20 server MCP e tesoreria Web3.',
    quickPromptsTitle: 'Azioni Rapide Direzionali',
    currency: 'Valuta',
    language: 'Lingua',
    switchCurrency: 'Seleziona Valuta',
    switchLanguage: 'Cambia Lingua',
    placeholder: 'Chiedi informazioni su segnali, ARR, approvazioni e 57 connettori...',
    send: 'Invia',
    pressEnter: 'Premi Invio per inviare · Shift+Invio per a capo',
    export: 'Esporta Trascrizione',
    clearChat: 'Cancella Chat',
    operatingPulse: 'Polso Operativo',
    pendingApprovals: 'Approvazioni in Sospeso',
    view: 'Rivedi',
    newSession: 'Nuova Sessione',
    dailyOperatingPulse: 'Polso Operativo Giornaliero',
    web3CryptoTreasury: 'Tesoreria Cripto Web3',
    criticalSituations: 'Situazioni Critiche',
    connectorsLibrary: 'Libreria Connettori (57)',
    liveVoiceChat: 'Chat Vocale dal Vivo',
    operationalHealth: 'Salute Operativa',
    operatingLoop: 'Ciclo Operativo in 13 Fasi',
    multiAgentGuild: 'Gilda Multi-Agente',
    truthModel: 'Verità e Provenienza',
    compliancePosture: 'Conformità Vanta',
    userProfile: 'Profilo Esecutivo',
    voiceBriefing: 'Briefing Vocale',
    audioVoiceBriefing: 'Briefing Audio Direzionale',
    roleAll: 'Tutto (Unificato)',
    roleRev: 'Ricavi',
    roleFin: 'Finanze',
    roleOps: 'Operazioni',
    roleSupport: 'Supporto',
    roleAllTitle: 'Intelligence operativa interfunzionale',
    roleRevTitle: 'Vendite e pipeline commerciale',
    roleFinTitle: 'Finanza, cassa e fatturazione',
    roleOpsTitle: 'Ingegneria e operazioni tecniche',
    roleSupportTitle: 'Assistenza clienti e SLA',
    perspectiveActive: 'Prospettiva Attiva',
    restoreUniversalOverview: 'Ripristina panoramica universale',
    onePerspectiveToSolveAll: 'Una Prospettiva Per Tutto ↺',
    highMaterialityAttentionCards: 'Schede di Attenzione ad Alta Rilevanza',
    pendingHumanAuthorizationGates: 'Gate di Autorizzazione Umana in Sospeso',
    clickFlipForProvenance: 'Clicca su "Gira Scheda" per la provenienza',
    p1Critical: 'P1 CRITICO',
    p2High: 'P2 ALTO',
    flipCard: 'Gira Scheda ↷',
    flipBack: 'Gira Dietro ↶',
    financialExposure: 'Esposizione Finanziaria:',
    owner: 'Responsabile:',
    investigate: 'Indaga',
    resolveBlocker: 'Risolvi Blocco',
    resolved: 'Risolto',
    truthLevel: 'LIVELLO DI VERITÀ: FATTO_FONTE',
    authoritativeSystems: 'Sistemi di Riferimento:',
    recordId: 'ID Record:',
    confidence: 'Confidenza:',
    pendingDualKeySignature: 'IN ATTESA DI DOPPIA FIRMA',
    preparedBy: 'Preparato da:',
    reason: 'Motivo:',
    reviewGate: 'Esamina Gate',
    approveAndExecute: 'Approva ed Esegui',
    approved: 'Approvato',
    bypassed: 'Bypassato',
    rootSovereignOverride: 'Override Sovrano Root Disponibile',
    blastRadiusAndPolicy: 'RAGGIO DI IMPATTO E POLICY SICURA',
    whatCameIn: 'Cosa è arrivato',
    whatIsStuck: 'Cosa è bloccato',
    whoOwnsIt: 'Chi è responsabile',
    whatIsNext: 'Cosa segue',
    speedRunResolve: 'Risoluzione Rapida in 1 Clic',
    batchExecuted: 'Esecuzione batch completata sui sistemi',
    arrTrajectory: 'Traiettoria ARR',
    grossMargin: 'Margine Lordo',
    multiSigReserve: 'Riserva Multi-Sig Gnosis Safe',
    onTrack: 'In Linea',
    quickPromptStuck: 'Cosa è bloccato in questo momento?',
    quickPromptApprovals: 'Controlla gate di approvazione doppia in sospeso',
    quickPromptArr: 'Analizza traiettoria ARR e runway di cassa',
    quickPromptConnectors: 'Ispeziona i 57 connettori autorevoli',
    quickPromptCrypto: 'Riconcilia tesoreria crypto Web3',
    recentSessions: 'Sessioni Recenti',
    operationsTools: 'Operazioni e Strumenti',
    scenarioSimulator: 'Simulatore di Scenari',
    commandPalette: 'Tavolozza dei Comandi',
    parameterLedger: 'Registro Parametri del CdA',
    ssoAuth: 'SSO e Autenticazione Sovrana',
    sessionWebhookDrift: 'Deriva Webhook Stripe P1',
    sessionAcmeRenewal: 'Rinnovo Acme Corp $180K',
    sessionPendingGates: 'Gate di Autorizzazione in Sospeso',
    sessionCashBurn: 'Burn di Cassa e Runway',
    muteAlerts: 'Disattiva Suoni di Avviso',
    unmuteAlerts: 'Attiva Suoni di Avviso',
    reconciling: 'Analisi dei dati cross-sistema...',
    stop: 'Ferma',
    copy: 'Copia',
    copied: 'Copiato',
    retry: 'Riprova',
    play: 'Riproduci',
    pause: 'Pausa',
    targetProtocol: 'Protocollo Bersaglio:',
    safeActionScope: 'Ambito Azione Sicura:',
    preFlightPolicy: 'Policy Pre-Volo:',
    auditHash: 'Hash di Verifica:',
    cryptographicSignatureVerified: 'Firma crittografica verificata',
    zeroAiHallucination: 'Verità Deterministica',
    dualKeySignatureVerified: 'Firma a Doppia Chiave Ed25519 Verificata',
    waitingOnExecutive: 'IN ATTESA DEL DIRIGENTE',
    welcomeGreeting: 'Buongiorno. Benvenuto nel tuo spazio operativo.'
  },
  hi: {
    appName: 'SignalDesk',
    tagline: 'कंपनी इंटेलिजेंस और अटेंशन ऑपरेटिंग सिस्टम',
    operatingPromise: 'क्या आया। क्या रुका है। मालिक कौन है। आगे क्या करना है।',
    oneBusinessOnePage: 'एक व्यवसाय। एक स्क्रीन। हर चीज़ में इंटेलिजेंस।',
    needsAttention: 'ध्यान देने योग्य',
    waitingOnMe: 'मेरी मंज़ूरी की प्रतीक्षा में',
    decisionQueue: 'निर्णय कतार',
    governanceGates: 'प्राधिकरण गेट्स',
    instantBypass: '⚡ त्वरित बाईपास',
    instantBypassAll: '⚡ सभी को तुरंत बाईपास करें',
    mcpServers: 'MCP टूल सर्वर',
    connectors: 'अधिकृत कनेक्टर्स',
    activeSignals: 'सक्रिय परिचालन संकेत',
    runway: 'कैश रनवे',
    burnRate: 'मासिक नेट खर्च',
    verifiedArr: 'सत्यापित ARR',
    cryptoTreasury: 'Web3 और क्रिप्टो ट्रेजरी',
    onChainMultiSig: 'Gnosis Safe मल्टी-सिग',
    voiceChat: 'लाइव वॉयस चैट',
    startSpeaking: 'सुन रहा हूँ...',
    askAnything: '57 कनेक्टर्स और क्रिप्टो ट्रेजरी में SignalDesk से कुछ भी पूछें...',
    signAndExecute: 'हस्ताक्षर और निष्पादन',
    inspectContract: 'जाँचें ↗',
    welcomeMessage: 'सुप्रभात। मैं आपका SignalDesk सॉवरेन कोपायलट हूँ, जो 57 कॉर्पोरेट सिस्टम और क्रिप्टो ट्रेजरी से जुड़ा है।',
    quickPromptsTitle: 'कार्यकारी त्वरित क्रियाएँ',
    currency: 'मुद्रा',
    language: 'भाषा',
    switchCurrency: 'मुद्रा चुनें',
    switchLanguage: 'भाषा बदलें',
    placeholder: 'सिग्नल, ARR चार्ट, मंज़ूरी और 57 कनेक्टर्स के बारे में पूछें...',
    send: 'भेजें',
    pressEnter: 'भेजने के लिए Enter दबाएँ · नई लाइन के लिए Shift+Enter',
    export: 'ट्रांसक्रिप्ट डाउनलोड करें',
    clearChat: 'चैट साफ़ करें',
    operatingPulse: 'ऑपरेटिंग पल्स',
    pendingApprovals: 'लंबित मंज़ूरी',
    view: 'समीक्षा करें',
    newSession: 'नया सत्र',
    dailyOperatingPulse: 'दैनिक ऑपरेटिंग पल्स',
    web3CryptoTreasury: 'Web3 क्रिप्टो ट्रेजरी',
    criticalSituations: 'गंभीर स्थितियाँ',
    connectorsLibrary: 'कनेक्टर्स लाइब्रेरी (57)',
    liveVoiceChat: 'लाइव वॉयस चैट',
    operationalHealth: 'परिचालन स्वास्थ्य',
    operatingLoop: '13-चरणीय ऑपरेटिंग लूप',
    multiAgentGuild: 'मल्टी-एजेंट गिल्ड',
    truthModel: 'सत्य और स्रोत साक्ष्य',
    compliancePosture: 'वांटा अनुपालन स्थिति',
    userProfile: 'कार्यकारी प्रोफ़ाइल',
    voiceBriefing: 'वॉयस ब्रीफिंग',
    audioVoiceBriefing: 'कार्यकारी ऑडियो ब्रीफिंग',
    roleAll: 'सभी (एकीकृत)',
    roleRev: 'राजस्व',
    roleFin: 'वित्त',
    roleOps: 'संचालन',
    roleSupport: 'सपोर्ट',
    roleAllTitle: 'सार्वभौमिक परिचालन बुद्धिमत्ता',
    roleRevTitle: 'बिक्री और राजस्व पाइपलाइन',
    roleFinTitle: 'वित्त, कैश और इनवॉइस',
    roleOpsTitle: 'इंजीनियरिंग और तकनीकी संचालन',
    roleSupportTitle: 'ग्राहक सहायता और एसएलए स्थिति',
    perspectiveActive: 'सक्रिय परिप्रेक्ष्य',
    restoreUniversalOverview: 'एकीकृत सार्वभौमिक दृश्य पुनर्स्थापित करें',
    onePerspectiveToSolveAll: 'सबके लिए एक परिप्रेक्ष्य ↺',
    highMaterialityAttentionCards: 'उच्च-महत्व ध्यान कार्ड',
    pendingHumanAuthorizationGates: 'लंबित मानवीय प्राधिकरण गेट्स',
    clickFlipForProvenance: 'स्रोत साक्ष्य देखने के लिए "कार्ड पलटें" पर क्लिक करें',
    p1Critical: 'P1 अत्यंत गंभीर',
    p2High: 'P2 उच्च प्राथमिकता',
    flipCard: 'कार्ड पलटें ↷',
    flipBack: 'वापस पलटें ↶',
    financialExposure: 'वित्तीय जोखिम:',
    owner: 'जिम्मेदार:',
    investigate: 'जाँच करें',
    resolveBlocker: 'रुकावट दूर करें',
    resolved: 'समाधान हो गया',
    truthLevel: 'सत्य स्तर: मूल स्रोत तथ्य',
    authoritativeSystems: 'अधिकृत प्रणालियाँ:',
    recordId: 'रिकॉर्ड आईडी:',
    confidence: 'विश्वसनीयता:',
    pendingDualKeySignature: 'दोहरे हस्ताक्षर की प्रतीक्षा में',
    preparedBy: 'तैयार किया:',
    reason: 'कारण:',
    reviewGate: 'गेट समीक्षा',
    approveAndExecute: 'स्वीकृत करें और निष्पादित करें',
    approved: 'स्वीकृत',
    bypassed: 'बाईपास किया गया',
    rootSovereignOverride: 'रूट सॉवरेन ओवरराइड उपलब्ध',
    blastRadiusAndPolicy: 'प्रभाव दायरा और सुरक्षित नीति',
    whatCameIn: 'क्या आया',
    whatIsStuck: 'क्या रुका है',
    whoOwnsIt: 'मालिक कौन है',
    whatIsNext: 'आगे क्या करना है',
    speedRunResolve: '1-क्लिक त्वरित समाधान',
    batchExecuted: 'अधिकृत प्रणालियों में बैच निष्पादित',
    arrTrajectory: 'ARR प्रक्षेपवक्र',
    grossMargin: 'सकल मार्जिन',
    multiSigReserve: 'Gnosis Safe मल्टी-सिग रिज़र्व',
    onTrack: 'योजना अनुसार',
    quickPromptStuck: 'इस समय क्या रुका हुआ है?',
    quickPromptApprovals: 'लंबित दोहरे हस्ताक्षर वाले गेट्स की समीक्षा करें',
    quickPromptArr: 'ARR प्रक्षेपवक्र और कैश रनवे का विश्लेषण करें',
    quickPromptConnectors: '57 अधिकृत कनेक्टर्स का निरीक्षण करें',
    quickPromptCrypto: 'Web3 क्रिप्टो ट्रेजरी का मिलान करें',
    recentSessions: 'हाल के सत्र',
    operationsTools: 'संचालन और उपकरण',
    scenarioSimulator: 'परिदृश्य सिम्युलेटर',
    commandPalette: 'कमांड पैलेट',
    parameterLedger: 'बोर्ड पैरामीटर लेज़र',
    ssoAuth: 'एसएसओ और संप्रभु प्रमाणीकरण',
    sessionWebhookDrift: 'P1 स्ट्राइप वेबहुक बहाव',
    sessionAcmeRenewal: 'Acme Corp $180K नवीनीकरण',
    sessionPendingGates: 'लंबित प्राधिकरण गेट्स',
    sessionCashBurn: 'कैश बर्न और रनवे',
    muteAlerts: 'चेतावनी ध्वनि म्यूट करें',
    unmuteAlerts: 'चेतावनी ध्वनि अनम्यूट करें',
    reconciling: 'क्रॉस-सिस्टम डेटा का विश्लेषण हो रहा है...',
    stop: 'रोकें',
    copy: 'कॉपी करें',
    copied: 'कॉपी किया गया',
    retry: 'पुनः प्रयास करें',
    play: 'चलाएं',
    pause: 'रोकें',
    targetProtocol: 'लक्षित प्रोटोकॉल:',
    safeActionScope: 'सुरक्षित कार्रवाई दायरा:',
    preFlightPolicy: 'प्री-फ़्लाइट नीति:',
    auditHash: 'ऑडिट हैश:',
    cryptographicSignatureVerified: 'क्रिप्टोग्राफ़िक हस्ताक्षर सत्यापित',
    zeroAiHallucination: 'नियतिवादी सत्य',
    dualKeySignatureVerified: 'दोहरी-कुंजी हस्ताक्षर Ed25519 सत्यापित',
    waitingOnExecutive: 'कार्यकारी निर्णय की प्रतीक्षा',
    welcomeGreeting: 'शुभ प्रभात। आपके परिचालन कार्यक्षेत्र में स्वागत है।'
  },
  ko: {
    appName: 'SignalDesk',
    tagline: '기업 인텔리전스 및 주의집중 운영체제',
    operatingPromise: '무엇이 유입되었는가. 어디가 막혔는가. 담당자는 누구인가. 다음 조치는 무엇인가.',
    oneBusinessOnePage: '하나의 기업. 하나의 화면. 전사적 인텔리전스.',
    needsAttention: '즉시 주의 필요',
    waitingOnMe: '내 결재 대기 중',
    decisionQueue: '의사결정 큐',
    governanceGates: '승인 거버넌스 게이트',
    instantBypass: '⚡ 즉각 주권 바이패스',
    instantBypassAll: '⚡ 전체 즉시 바이패스',
    mcpServers: 'MCP 도구 서버',
    connectors: '공식 커넥터',
    activeSignals: '활성 운영 시그널',
    runway: '현금 런웨이',
    burnRate: '월간 순 번레이트',
    verifiedArr: '검증된 ARR',
    cryptoTreasury: 'Web3 및 크립토 재무 금고',
    onChainMultiSig: 'Gnosis Safe 멀티시그',
    voiceChat: '라이브 음성 대화',
    startSpeaking: '듣고 있습니다...',
    askAnything: '57개 엔터프라이즈 시스템 및 온체인 금고에 대해 SignalDesk에 질문하세요...',
    signAndExecute: '서명 및 즉시 실행',
    inspectContract: '계약 세부검사 ↗',
    welcomeMessage: '좋은 아침입니다. 57개 엔터프라이즈 시스템, 20개 MCP 서버, Web3 크립토 금고에 연결된 SignalDesk 부조종사입니다.',
    quickPromptsTitle: '임원 퀵 액션',
    currency: '통화',
    language: '언어',
    switchCurrency: '통화 선택',
    switchLanguage: '언어 변경',
    placeholder: '시그널, ARR 그래프, 결재 건, 57개 커넥터에 대해 질문...',
    send: '전송',
    pressEnter: '전송은 Enter · 줄바꿈은 Shift+Enter',
    export: '대화 기록 내보내기',
    clearChat: '채팅 기록 지우기',
    operatingPulse: '데일리 운영 펄스',
    pendingApprovals: '대기 중인 승인',
    view: '검토하기',
    newSession: '새 세션',
    dailyOperatingPulse: '일일 운영 펄스',
    web3CryptoTreasury: 'Web3 크립토 금고',
    criticalSituations: '긴급 위기 상황',
    connectorsLibrary: '커넥터 라이브러리 (57)',
    liveVoiceChat: '실시간 음성 대화',
    operationalHealth: '운영 건강도 점수',
    operatingLoop: '13단계 운영 루프',
    multiAgentGuild: '멀티 에이전트 길드',
    truthModel: '진실성 및 데이터 출처',
    compliancePosture: 'Vanta 컴플라이언스 상태',
    userProfile: '임원 프로필',
    voiceBriefing: '음성 브리핑',
    audioVoiceBriefing: '임원 전용 오디오 브리핑',
    roleAll: '전체 (통합)',
    roleRev: '매출',
    roleFin: '재무',
    roleOps: '운영',
    roleSupport: '지원',
    roleAllTitle: '전사 영역 통합 운영 인텔리전스',
    roleRevTitle: '영업 파이프라인 및 매출 인텔리전스',
    roleFinTitle: '재무, 현금 런웨이 및 정산',
    roleOpsTitle: '엔지니어링 및 딜리버리 운영',
    roleSupportTitle: '고객 지원 및 SLA 건전성',
    perspectiveActive: '선택된 관점 활성',
    restoreUniversalOverview: '전사 통합 전체 화면으로 복원',
    onePerspectiveToSolveAll: '모든 것을 해결하는 통합 뷰 ↺',
    highMaterialityAttentionCards: '고위험 집중 관리 카드',
    pendingHumanAuthorizationGates: '대기 중인 인간 결재 게이트',
    clickFlipForProvenance: '출처 및 인과관계 DAG를 확인하려면 "카드 뒤집기"를 클릭하세요',
    p1Critical: 'P1 최우선 긴급',
    p2High: 'P2 높은 우선순위',
    flipCard: '카드 뒤집기 ↷',
    flipBack: '앞면으로 ↶',
    financialExposure: '재무 리스크 노출액:',
    owner: '담당자:',
    investigate: '원인 조사',
    resolveBlocker: '장애 해결',
    resolved: '해결됨',
    truthLevel: '진실 등급: 1차 소스 팩트',
    authoritativeSystems: '공식 출처 시스템:',
    recordId: '레코드 ID:',
    confidence: '신뢰도 점수:',
    pendingDualKeySignature: '듀얼키 전자서명 대기 중',
    preparedBy: '작성 에이전트:',
    reason: '사유:',
    reviewGate: '게이트 검토',
    approveAndExecute: '승인 및 즉시 실행',
    approved: '승인됨',
    bypassed: '바이패스됨',
    rootSovereignOverride: '루트 주권 오버라이드 가용',
    blastRadiusAndPolicy: '영향 범위 및 안전 거버넌스 정책',
    whatCameIn: '무엇이 유입되었는가',
    whatIsStuck: '어디가 막혔는가',
    whoOwnsIt: '담당자는 누구인가',
    whatIsNext: '다음 조치는 무엇인가',
    speedRunResolve: '1-클릭 고속 일괄 해결',
    batchExecuted: '공식 시스템에 일괄 실행 완료',
    arrTrajectory: 'ARR 성장 궤적',
    grossMargin: '매출총이익률',
    multiSigReserve: 'Gnosis Safe 멀티시그 준비금',
    onTrack: '목표 달성 순항 중',
    quickPromptStuck: '지금 병목이 발생한 곳은 어디인가요?',
    quickPromptApprovals: '대기 중인 듀얼키 결재 건 검토',
    quickPromptArr: 'ARR 성장 궤적과 현금 런웨이 분석',
    quickPromptConnectors: '연결된 57개 엔터프라이즈 커넥터 점검',
    quickPromptCrypto: 'Web3 크립토 금고 자산 대사',
    recentSessions: '최근 세션',
    operationsTools: '운영 및 도구',
    scenarioSimulator: '시나리오 시뮬레이터',
    commandPalette: '명령어 팔레트',
    parameterLedger: '이사회 파라미터 원장',
    ssoAuth: 'SSO 및 주권 인증',
    sessionWebhookDrift: 'P1 Stripe 웹훅 오류',
    sessionAcmeRenewal: 'Acme Corp $180K 갱신',
    sessionPendingGates: '대기 중인 결재 게이트',
    sessionCashBurn: '현금 소진율 및 런웨이',
    muteAlerts: '알림음 음소거',
    unmuteAlerts: '알림음 켜기',
    reconciling: '전사 시스템 데이터 분석 중...',
    stop: '중지',
    copy: '복사',
    copied: '복사됨',
    retry: '재시도',
    play: '재생',
    pause: '일시정지',
    targetProtocol: '대상 프로토콜:',
    safeActionScope: '안전 액션 범위:',
    preFlightPolicy: '사전 검증 정책:',
    auditHash: '감사 해시:',
    cryptographicSignatureVerified: '암호화 서명 검증 완료',
    zeroAiHallucination: '결정론적 진실',
    dualKeySignatureVerified: '듀얼키 Ed25519 서명 검증됨',
    waitingOnExecutive: '경영진 결재 대기 중',
    welcomeGreeting: '좋은 아침입니다. 운영 워크스페이스에 오신 것을 환영합니다.'
  },
  ru: {
    appName: 'SignalDesk',
    tagline: 'Операционная система корпоративного интеллекта и управления вниманием',
    operatingPromise: 'Что поступило. Что застряло. Кто отвечает. Что делать дальше.',
    oneBusinessOnePage: 'Один бизнес. Одна страница. Интеллект во всем.',
    needsAttention: 'Требует Внимания',
    waitingOnMe: 'Ждет Моего Решения',
    decisionQueue: 'Очередь Решений',
    governanceGates: 'Шлюзы Авторизации',
    instantBypass: '⚡ Мгновенный Байпас',
    instantBypassAll: '⚡ Пропустить Всё Сразу',
    mcpServers: 'Серверы Инструментов MCP',
    connectors: 'Авторитетные Коннекторы',
    activeSignals: 'Активные Операционные Сигналы',
    runway: 'Денежный Ранвей',
    burnRate: 'Чистый Ежемесячный Берн',
    verifiedArr: 'Проверенный ARR',
    cryptoTreasury: 'Казначейство Web3 и Крипто',
    onChainMultiSig: 'Мультисиг Gnosis Safe',
    voiceChat: 'Живой Голосовой Чат',
    startSpeaking: 'Слушаю вас...',
    askAnything: 'Спросите SignalDesk о 57 коннекторах и крипто-казначействе...',
    signAndExecute: 'Подписать и Выполнить',
    inspectContract: 'Инспектировать ↗',
    welcomeMessage: 'Доброе утро. Я ваш Суверенный Копилот SignalDesk, подключенный к 57 системам и крипто-казначейству Web3.',
    quickPromptsTitle: 'Быстрые Действия Руководителя',
    currency: 'Валюта',
    language: 'Язык',
    switchCurrency: 'Выбрать Валюту',
    switchLanguage: 'Сменить Язык',
    placeholder: 'Задайте вопрос о сигналах, графиках ARR, согласованиях и 57 коннекторах...',
    send: 'Отправить',
    pressEnter: 'Enter для отправки · Shift+Enter для новой строки',
    export: 'Экспорт Диалога',
    clearChat: 'Очистить Чат',
    operatingPulse: 'Операционный Пульс',
    pendingApprovals: 'Ожидающие Согласования',
    view: 'Изучить',
    newSession: 'Новая Сессия',
    dailyOperatingPulse: 'Ежедневный Операционный Пульс',
    web3CryptoTreasury: 'Крипто-Казначейство Web3',
    criticalSituations: 'Критические Ситуации',
    connectorsLibrary: 'Библиотека Коннекторов (57)',
    liveVoiceChat: 'Голосовой Чат',
    operationalHealth: 'Операционное Здоровье',
    operatingLoop: '13-Шаговый Операционный Цикл',
    multiAgentGuild: 'Мультиагентная Гильдия',
    truthModel: 'Модель Истины и Происхождение',
    compliancePosture: 'Комплаенс Vanta',
    userProfile: 'Профиль Руководителя',
    voiceBriefing: 'Голосовой Бриф',
    audioVoiceBriefing: 'Аудио-Брифинг Руководителя',
    roleAll: 'Все (Единый вид)',
    roleRev: 'Выручка',
    roleFin: 'Финансы',
    roleOps: 'Операции',
    roleSupport: 'Поддержка',
    roleAllTitle: 'Сквозной корпоративный интеллект',
    roleRevTitle: 'Воронка продаж и выручка',
    roleFinTitle: 'Финансы, ранвей и счета',
    roleOpsTitle: 'Разработка и релизы',
    roleSupportTitle: 'Поддержка клиентов и SLA',
    perspectiveActive: 'Активна Перспектива',
    restoreUniversalOverview: 'Восстановить единый сквозной обзор',
    onePerspectiveToSolveAll: 'Единая Перспектива Для Всего ↺',
    highMaterialityAttentionCards: 'Карточки Критического Внимания',
    pendingHumanAuthorizationGates: 'Шлюзы Авторизации Руководителем',
    clickFlipForProvenance: 'Нажмите "Перевернуть Карточку" для аудита фактов',
    p1Critical: 'P1 КРИТИЧЕСКИЙ',
    p2High: 'P2 ВЫСОКИЙ',
    flipCard: 'Перевернуть Карточку ↷',
    flipBack: 'Лицевая Сторона ↶',
    financialExposure: 'Финансовый Риск:',
    owner: 'Ответственный:',
    investigate: 'Расследовать',
    resolveBlocker: 'Устранить Блокер',
    resolved: 'Устранено',
    truthLevel: 'УРОВЕНЬ ИСТИНЫ: ПЕРВИЧНЫЙ_ФАКТ',
    authoritativeSystems: 'Первоисточники:',
    recordId: 'ID Записи:',
    confidence: 'Уверенность:',
    pendingDualKeySignature: 'ОЖИДАЕТ ДВОЙНОЙ ПОДПИСИ',
    preparedBy: 'Подготовлено:',
    reason: 'Причина:',
    reviewGate: 'Проверить Шлюз',
    approveAndExecute: 'Утвердить и Выполнить',
    approved: 'Утверждено',
    bypassed: 'Пропущено',
    rootSovereignOverride: 'Доступен Рут-Оверрайд',
    blastRadiusAndPolicy: 'РАДИУС ВЛИЯНИЯ И ПОЛИТИКА БЕЗОПАСНОСТИ',
    whatCameIn: 'Что поступило',
    whatIsStuck: 'Что застряло',
    whoOwnsIt: 'Кто отвечает',
    whatIsNext: 'Что делать дальше',
    speedRunResolve: 'Устранение в 1 Клик',
    batchExecuted: 'Пакет выполнен в первоисточниках',
    arrTrajectory: 'Траектория ARR',
    grossMargin: 'Валовая Маржа',
    multiSigReserve: 'Резерв Мультисига Gnosis Safe',
    onTrack: 'По Плану',
    quickPromptStuck: 'Что застряло прямо сейчас?',
    quickPromptApprovals: 'Проверить шлюзы двойной подписи',
    quickPromptArr: 'Анализ траектории ARR и ранвея',
    quickPromptConnectors: 'Проверить 57 авторитетных коннекторов',
    quickPromptCrypto: 'Сверить крипто-казначейство Web3',
    recentSessions: 'Недавние Сессии',
    operationsTools: 'Операции и Инструменты',
    scenarioSimulator: 'Симулятор Сценариев',
    commandPalette: 'Палитра Команд',
    parameterLedger: 'Реестр Параметров Совета',
    ssoAuth: 'SSO и Суверенная Авторизация',
    sessionWebhookDrift: 'Сбой Вебхука Stripe P1',
    sessionAcmeRenewal: 'Продление Acme Corp $180K',
    sessionPendingGates: 'Шлюзы Авторизации',
    sessionCashBurn: 'Сжигание Денег и Ранвей',
    muteAlerts: 'Заглушить Звуки Оповещений',
    unmuteAlerts: 'Включить Звуки Оповещений',
    reconciling: 'Анализ межсистемных данных...',
    stop: 'Остановить',
    copy: 'Копировать',
    copied: 'Скопировано',
    retry: 'Повторить',
    play: 'Воспроизвести',
    pause: 'Пауза',
    targetProtocol: 'Целевой Протокол:',
    safeActionScope: 'Область Безопасного Действия:',
    preFlightPolicy: 'Предполетная Политика:',
    auditHash: 'Хеш Аудита:',
    cryptographicSignatureVerified: 'Криптографическая подпись проверена',
    zeroAiHallucination: 'Детерминированная Истина',
    dualKeySignatureVerified: 'Подпись Ed25519 Двойного Ключа Проверена',
    waitingOnExecutive: 'ОЖИДАЕТ РЕШЕНИЯ РУКОВОДИТЕЛЯ',
    welcomeGreeting: 'Доброе утро. Добро пожаловать в командный центр.'
  },
  nl: {
    appName: 'SignalDesk',
    tagline: 'Het Besturingssysteem voor Bedrijfsintelligentie en Aandacht',
    operatingPromise: 'Wat binnenkwam. Wat vastzit. Wie eigenaar is. Wat volgt.',
    oneBusinessOnePage: 'Eén Bedrijf. Eén Pagina. Intelligentie over alles.',
    needsAttention: 'Aandacht Vereist',
    waitingOnMe: 'Wacht op Mij',
    decisionQueue: 'Beslissingswachtrij',
    governanceGates: 'Autorisatiepoorten',
    instantBypass: '⚡ Directe Bypass',
    instantBypassAll: '⚡ Alles Direct Vrijgeven',
    mcpServers: 'MCP Tool Servers',
    connectors: 'Gezaghebbende Connectoren',
    activeSignals: 'Actieve Operationele Signalen',
    runway: 'Kas-Runway',
    burnRate: 'Netto Maandelijkse Burn',
    verifiedArr: 'Geverifieerde ARR',
    cryptoTreasury: 'Web3 & Crypto Schatkist',
    onChainMultiSig: 'Gnosis Safe Multi-Sig',
    voiceChat: 'Live Spraakchat',
    startSpeaking: 'Luisteren...',
    askAnything: 'Vraag SignalDesk alles over 57 connectoren en crypto-treasury...',
    signAndExecute: 'Ondertekenen & Uitvoeren',
    inspectContract: 'Inspecteren ↗',
    welcomeMessage: 'Goedemorgen. Ik ben uw SignalDesk Soevereine Copiloot, verbonden met 57 enterprise systemen en Web3 crypto-treasury.',
    quickPromptsTitle: 'Executive Snelle Acties',
    currency: 'Valuta',
    language: 'Taal',
    switchCurrency: 'Selecteer Valuta',
    switchLanguage: 'Wijzig Taal',
    placeholder: 'Vraag over signalen, ARR-grafieken, goedkeuringen en 57 connectoren...',
    send: 'Verzenden',
    pressEnter: 'Druk op Enter om te verzenden · Shift+Enter voor nieuwe regel',
    export: 'Transcript Exporteren',
    clearChat: 'Chat Wissen',
    operatingPulse: 'Operationele Polsslag',
    pendingApprovals: 'Openstaande Goedkeuringen',
    view: 'Beoordelen',
    newSession: 'Nieuwe Sessie',
    dailyOperatingPulse: 'Dagelijkse Operationele Polsslag',
    web3CryptoTreasury: 'Web3 Crypto Schatkist',
    criticalSituations: 'Kritieke Situaties',
    connectorsLibrary: 'Connectoren Bibliotheek (57)',
    liveVoiceChat: 'Live Spraakchat',
    operationalHealth: 'Operationele Gezondheid',
    operatingLoop: '13-Staps Operationele Lus',
    multiAgentGuild: 'Multi-Agent Gilde',
    truthModel: 'Waarheid & Herkomst',
    compliancePosture: 'Vanta Compliance Status',
    userProfile: 'Directieprofiel',
    voiceBriefing: 'Spraakbriefing',
    audioVoiceBriefing: 'Audio Executive Briefing',
    roleAll: 'Alles (Geïntegreerd)',
    roleRev: 'Omzet',
    roleFin: 'Financiën',
    roleOps: 'Operatie',
    roleSupport: 'Support',
    roleAllTitle: 'Universele cross-domein operationele intelligentie',
    roleRevTitle: 'Omzet- en verkooppipeline intelligentie',
    roleFinTitle: 'Financiën, runway en facturatie',
    roleOpsTitle: 'Engineering en operationele levering',
    roleSupportTitle: 'Klantenservice en SLA-prestaties',
    perspectiveActive: 'Perspectief Actief',
    restoreUniversalOverview: 'Herstel universeel overzicht van alle domeinen',
    onePerspectiveToSolveAll: 'Eén Perspectief Voor Alles ↺',
    highMaterialityAttentionCards: 'Aandachtskaarten van Hoge Materialiteit',
    pendingHumanAuthorizationGates: 'Openstaande Menselijke Autorisatiepoorten',
    clickFlipForProvenance: 'Klik op "Draai Kaart" voor herkomst en oorzaak',
    p1Critical: 'P1 KRITIEK',
    p2High: 'P2 HOOG',
    flipCard: 'Draai Kaart ↷',
    flipBack: 'Terugdraaien ↶',
    financialExposure: 'Financieel Risico:',
    owner: 'Eigenaar:',
    investigate: 'Onderzoeken',
    resolveBlocker: 'Blokkade Oplossen',
    resolved: 'Opgelost',
    truthLevel: 'WAARHEIDSNIVEAU: BRON_FEIT',
    authoritativeSystems: 'Gezaghebbende Systemen:',
    recordId: 'Record-ID:',
    confidence: 'Betrouwbaarheid:',
    pendingDualKeySignature: 'WACHT OP DUBBELE HANDTEKENING',
    preparedBy: 'Opgesteld door:',
    reason: 'Reden:',
    reviewGate: 'Poort Beoordelen',
    approveAndExecute: 'Goedkeuren & Uitvoeren',
    approved: 'Goedgekeurd',
    bypassed: 'Omzeild',
    rootSovereignOverride: 'Root Soevereine Override Beschikbaar',
    blastRadiusAndPolicy: 'EFFECTRADIUS & VEILIG BELEID',
    whatCameIn: 'Wat binnenkwam',
    whatIsStuck: 'Wat vastzit',
    whoOwnsIt: 'Wie eigenaar is',
    whatIsNext: 'Wat volgt',
    speedRunResolve: '1-Klik Snelle Oplossing',
    batchExecuted: 'Batch uitgevoerd op gezaghebbende systemen',
    arrTrajectory: 'ARR-Traject',
    grossMargin: 'Brutomarge',
    multiSigReserve: 'Gnosis Safe Multi-Sig Reserve',
    onTrack: 'Op Koers',
    quickPromptStuck: 'Wat zit er nu vast?',
    quickPromptApprovals: 'Bekijk openstaande dubbele handtekeningen',
    quickPromptArr: 'Analyseer ARR-traject en cash runway',
    quickPromptConnectors: 'Inspecteer 57 gezaghebbende connectoren',
    quickPromptCrypto: 'Stem Web3 crypto-treasury af',
    recentSessions: 'Recente Sessies',
    operationsTools: 'Operaties & Tools',
    scenarioSimulator: 'Scenario Simulator',
    commandPalette: 'Opdrachtenpalet',
    parameterLedger: 'Bestuursparameter Grootboek',
    ssoAuth: 'SSO & Soevereine Authenticatie',
    sessionWebhookDrift: 'P1 Stripe Webhook Drift',
    sessionAcmeRenewal: 'Acme Corp $180K Verlenging',
    sessionPendingGates: 'Openstaande Autorisatiepoorten',
    sessionCashBurn: 'Cash Burn & Runway',
    muteAlerts: 'Waarschuwingsgeluiden Dempen',
    unmuteAlerts: 'Waarschuwingsgeluiden Inschakelen',
    reconciling: 'Gegevens over systemen heen analyseren...',
    stop: 'Stoppen',
    copy: 'Kopiëren',
    copied: 'Gekopieerd',
    retry: 'Opnieuw Proberen',
    play: 'Afspelen',
    pause: 'Pauzeren',
    targetProtocol: 'Doelprotocol:',
    safeActionScope: 'Bereik Veilige Actie:',
    preFlightPolicy: 'Pre-Flight Beleid:',
    auditHash: 'Audit-Hash:',
    cryptographicSignatureVerified: 'Cryptografische handtekening geverifieerd',
    zeroAiHallucination: 'Deterministische Waarheid',
    dualKeySignatureVerified: 'Dual-Key Handtekening Ed25519 Geverifieerd',
    waitingOnExecutive: 'WACHT OP DIRECTIE',
    welcomeGreeting: 'Goedemorgen. Welkom in uw operationele werkruimte.'
  },
  he: {
    appName: 'SignalDesk',
    tagline: 'מערכת ההפעלה המודיעינית ותשומת הלב של החברה',
    operatingPromise: "מה נכנס. מה תקוע. מי הבעלים. מה הצעד הבא.",
    oneBusinessOnePage: 'עסק אחד. דף אחד. מודיעין על פני הכל.',
    needsAttention: 'דורש תשומת לב',
    waitingOnMe: 'ממתין לי',
    decisionQueue: 'תור החלטות',
    governanceGates: 'שערי אישור משילות',
    instantBypass: '⚡ עקיפה מידית',
    instantBypassAll: '⚡ עקיפה מידית להכל',
    mcpServers: 'שרתי כלי MCP',
    connectors: 'מחברים סמכותיים',
    activeSignals: 'אותות תפעוליים פעילים',
    runway: 'מסלול מזומנים (Runway)',
    burnRate: 'קצב שריפה חודשי נטו',
    verifiedArr: 'ARR מאומת',
    cryptoTreasury: 'אוצר קריפטו ו-Web3',
    onChainMultiSig: 'חתימה מרובה Gnosis Safe',
    voiceChat: 'שיחה קולית חיה',
    startSpeaking: 'מקשיב... דבר כעת',
    askAnything: 'שאל את SignalDesk כל דבר על פני 57 מחברים ואוצר הקריפטו...',
    signAndExecute: 'חתום ובצע',
    inspectContract: 'בדוק חוזה ↗',
    welcomeMessage: 'בוקר טוב. אני טייס-המשנה הריבוני של SignalDesk, מחובר ל-57 מערכות ארגוניות, 20 שרתי MCP ואוצר קריפטו ארגוני.',
    quickPromptsTitle: 'פעולות הנהלה מהירות',
    currency: 'מטבע',
    language: 'שפה',
    switchCurrency: 'בחר מטבע',
    switchLanguage: 'בחר שפה',
    placeholder: 'שאל על אותות, גרפי ARR, אישורים, 57 מחברים ו-20 שרתי MCP...',
    send: 'שלח שאילתה',
    pressEnter: 'הקש Enter לשליחה · Shift+Enter לשורה חדשה',
    export: 'ייצוא תמליל',
    clearChat: 'נקה שיחה',
    operatingPulse: 'דופק תפעולי יומי',
    pendingApprovals: 'אישורים ממתינים',
    view: 'סקור',

    // Navigation & Menus
    newSession: 'סשן חדש',
    dailyOperatingPulse: 'דופק תפעולי יומי',
    web3CryptoTreasury: 'אוצר קריפטו Web3',
    criticalSituations: 'מצבים קריטיים',
    connectorsLibrary: 'ספריית מחברים (57)',
    liveVoiceChat: 'שיחה קולית חיה',
    operationalHealth: 'בריאות תפעולית',
    operatingLoop: 'לולאת 13 השלבים',
    multiAgentGuild: 'גילדת סוכנים אוטונומיים',
    truthModel: 'מודל האמת ומקורות',
    compliancePosture: 'תאימות ואבטחת Vanta',
    userProfile: 'פרופיל מנהל',
    voiceBriefing: 'תדריך קולי',
    audioVoiceBriefing: 'תדריך שמע קולי',

    // Perspectives
    roleAll: 'הכל (מאוחד)',
    roleRev: 'הכנסות (Rev)',
    roleFin: 'כספים (Fin)',
    roleOps: 'תפעול (Ops)',
    roleSupport: 'תמיכה (Support)',
    roleAllTitle: 'מודיעין תפעולי אוניברסלי חוצה תחומים',
    roleRevTitle: 'מודיעין צינור מכירות והכנסות',
    roleFinTitle: 'פיקוח על תקציב, מסלול ומזומנים',
    roleOpsTitle: 'מודיעין הנדסי, שרתים ותשתיות',
    roleSupportTitle: 'איכות שירות, SLA ושביעות רצון לקוחות',
    perspectiveActive: 'פרספקטיבה פעילה',
    restoreUniversalOverview: 'שחזר מבט אוניברסלי',
    onePerspectiveToSolveAll: 'פרספקטיבה אחת לפתרון הכל',

    // Attention Cards & Controls
    highMaterialityAttentionCards: 'כרטיסי תשומת לב בעלי מהותיות גבוהה',
    pendingHumanAuthorizationGates: 'שערי אישור אנושיים ממתינים',
    clickFlipForProvenance: 'לחץ "הפוך כרטיס" למקוריות ואימות',
    p1Critical: 'P1 קריטי',
    p2High: 'P2 גבוה',
    flipCard: 'הפוך כרטיס ↷',
    flipBack: 'הפוך חזרה ↶',
    financialExposure: 'חשיפה כספית:',
    owner: 'אחראי:',
    investigate: 'חקור סיבתיות',
    resolveBlocker: 'פתור חסימה',
    resolved: 'נפתר בהצלחה',
    truthLevel: 'רמת אמת: עובדת מקור',
    authoritativeSystems: 'מערכות סמכותיות:',
    recordId: 'מזהה רשומה:',
    confidence: 'רמת ודאות:',

    // Governance Gates / Waiting On Me
    pendingDualKeySignature: 'ממתין לחתימה כפולה (Dual-Key)',
    preparedBy: 'הוכן ע"י:',
    reason: 'סיבה:',
    reviewGate: 'סקור שער אישור',
    approveAndExecute: 'אשר ובצע בפועל',
    approved: 'נחתם ואומת',
    bypassed: '⚡ נעקף ונשלח',
    rootSovereignOverride: 'עקיפה ריבונית זמינה',
    blastRadiusAndPolicy: 'פרוטוקול פעולה בטוחה ומדיניות',

    // Pulse & Questions
    whatCameIn: '1. מה נכנס',
    whatIsStuck: '2. מה תקוע',
    whoOwnsIt: '3. מי הבעלים',
    whatIsNext: '4. מה הצעד הבא',
    speedRunResolve: 'ביצוע מהיר של כל הפעולות',
    batchExecuted: 'הפעולות בוצעו ואומתו במערכות המקור',

    // Graphs & Metrics
    arrTrajectory: 'מסלול צמיחת ARR',
    grossMargin: 'רווחיות גולמית',
    multiSigReserve: 'יתרות Multi-Sig',
    onTrack: 'בקצב היעד',

    // Quick Prompts
    quickPromptStuck: 'מה נכנס, מה תקוע כרגע ומי אחראי?',
    quickPromptApprovals: 'הצג את כל שערי האישור הממתינים לי',
    quickPromptArr: 'הצג גרפי ARR מאומת, קצב שריפה ומסלול מזומנים',
    quickPromptConnectors: 'הצג את 57 המחברים המחוברים ו-20 שרתי MCP',
    quickPromptCrypto: 'הצג יתרות קריפטו, תשואת סטייקינג ושערי Gnosis Safe',

    // Global Controls
    menu: 'תפריט מערכת',
    close: 'סגור',
    openSidebar: 'פתח סרגל צד',
    targetSystem: 'מערכת יעד:',
    voiceChatPrompt: 'שיחה קולית חיה פעילה. ניתן לדבר בעברית או בכל שפה.',
    cardTucked: 'כרטיס ממוזער',
    operationalContextDeck: 'חפיסת הקשר תפעולי',
    activeOperationalSession: 'סשן תפעולי פעיל',
    simulator: 'סימולטור השפעה תפעולית',
    ledger: 'ספר התחייבויות מועצת המנהלים',
    vantaSuite: 'מערך אבטחה ותאימות רציפה Vanta',
    preCheck: 'בדיקה מקדימה:',
    passed: 'עבר בהצלחה',
    postAction: 'בדיקה חוזרת סמכותית:',
    signature: 'חתימה:',
    zeroLeakage: 'אפס דליפת נתונים',
    groundTruth: 'אמת עובדתית מוכחת',
    sourcesCited: 'מקורות מצוטטים:',
    verifiedArrTrajectory: 'מסלול ARR מאומת',
    portal: 'פורטל ציבורי',
    commandCenter: 'מרכז פיקוד ושליטה',
    guidedTour: 'סיור אינטראקטיבי',
    launchCommandCenter: 'הפעלת מרכז הפיקוד',
    signIn: 'כניסת הנהלה בכירה',
    signOut: 'התנתקות',
    allSystemsOperational: 'כל המערכות פועלות כסדרן',
    continuousAuditActive: 'ביקורת רציפה פעילה',
    operatingLoopTitle: 'לולאת הפעלה סגורה בת 13 שלבים',
    truthModelTitle: 'מודל אמת דטרמיניסטי בן 6 רמות',
    governedMcpTitle: '20 שרתי כלי MCP מנוהלים ו-57 מחברים',
    securityComplianceTitle: 'תאימות ואבטחה רציפה Vanta ו-SOC 2',
    heroHeadline: 'עסק אחד. עמוד אחד. מודיעין על הכל.',
    heroSubhead: 'מה נכנס. מה תקוע. מי הבעלים. מה הצעד הבא.',
    features: 'מנוע תפעולי',
    architecture: 'פרוטוקול ואמת',
    pricing: 'מסלולים וחברות',
    docs: 'תיעוד MCP 2026',
    connectedTools: 'כלים מחוברים',
    criticalIssues: 'נושאים קריטיים',
    mrrAtRiskLabel: 'ARR בסיכון',
    explorePlatform: 'סיור במערכת ההפעלה',
    viewAllConnectors: 'צפה ב-57 מחברים ו-20 שרתי MCP',
    systemArchitecture: 'ארכיטקטורת המערכת',
    auditTrail: 'יומן ביקורת משילות',
    settings: 'הגדרות הנהלה',
    voiceBriefingPlay: 'האזנה לתדריך הבוקר',
    voiceBriefingPause: 'השהיית תדריך',
    login: 'כניסת מנהלים',
    loginSSO: 'כניסה / SSO',
    launchLiveCommandCenter: 'הפעלת מרכז הפיקוד',
    exploreConnectors: 'צפייה ב-57 מחברים',
    complianceVanta: 'תאימות אבטחה Vanta ו-SOC-2',
    tabAttention: '1. רדאר ותשומת לב ניהולית',
    tabSafeGateway: '2. שער פעולה מאובטח וחתימה כפולה',
    tabAgentGuild: '3. גילדת סוכנים אוטונומיים',
    tabMcpProtocol: '4. פרוטוקול הקשר מודלים (MCP)',
    tabAudioBrief: '5. תדריך מודיעין קולי יומי',
    tabProfile: 'פרופיל והרשאות ניהול',
    tabMembership: 'תוכנית חברות ומודל עלויות',
    tabFleet: 'צי מערכות פעיל (57 כלים • 20 שרתי MCP)',
    tabConfig: 'הגדרות מחברים וגבולות גזרה',
    tabCompliance: 'תאימות רציפה Vanta (SOC 2, HIPAA, ISO)',
    tabAuthority: 'ספי אישור ומשילות תאגידית',
    tabBilling: 'חיובים וספר התחייבויות מאוחד',
    tabNotifications: 'תדריכים ניהוליים והתראות',
    tabSessions: 'אבטחה, מפתחות והפעלות פעילות',
    saveChanges: 'שמור שינויים',
    resetDefaults: 'איפוס לברירת מחדל ארגונית',
    exportCSV: 'ייצוא לקובץ CSV',
    runLiveScan: 'סריקת Vanta חיה מיידית',
    exportBinder: 'ייצוא תיק ביקורת רשמי',
    trustCenter: 'מרכז אמון ואבטחה',
    auditLedger: 'ספר ביקורת פעולות בלתי ניתן לעריכה',
    search: 'חיפוש',
    filterAll: 'הכל',

    // Extended Operational & Navigation Keys
    recentSessions: 'הפעלות אחרונות',
    operationsTools: 'תפעול וכלים',
    scenarioSimulator: 'סימולטור תרחישים',
    commandPalette: 'לוח פקודות',
    parameterLedger: 'ספר פרמטרים',
    ssoAuth: 'אימות והתחברות SSO',
    sessionWebhookDrift: 'סטיית Webhook ב-Stripe (P1)',
    sessionAcmeRenewal: 'חידוש חוזה Acme ב-$180K',
    sessionPendingGates: 'שערי אישור ממתינים',
    sessionCashBurn: 'קצב שריפת מזומנים ו-Runway',
    muteAlerts: 'השתקת צלילים',
    unmuteAlerts: 'הפעלת צלילים',
    reconciling: 'מנתח נתונים חוצי-מערכות...',
    stop: 'עצור',
    copy: 'העתק',
    copied: 'הועתק',
    retry: 'נסה שוב',
    play: 'הפעל',
    pause: 'השהה',
    targetProtocol: 'פרוטוקול יעד:',
    safeActionScope: 'טווח פעולה מאובטח:',
    preFlightPolicy: 'מדיניות קדם-ביצוע:',
    auditHash: 'האש ביקורת:',
    cryptographicSignatureVerified: 'חתימה קריפטוגרפית מאומתת',
    zeroAiHallucination: 'אמת דטרמיניסטית',
    dualKeySignatureVerified: 'חתימת מפתח כפול Ed25519 מאומתת',
    waitingOnExecutive: 'ממתין לאישור הנהלה',
    welcomeGreeting: 'בוקר טוב. ברוכים הבאים למרחב הפיקוד התפעולי.'
  }
};

// Storage keys
const STORAGE_KEY_LANGUAGE = 'signaldesk_selected_language';
const STORAGE_KEY_CURRENCY = 'signaldesk_selected_currency';

/**
 * Returns a translated string with graceful fallback to English or default
 */
export const getSafeTranslation = (lang: AppLanguage, key: keyof TranslationDict, fallback?: string): string => {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return (dict[key] as string) || (TRANSLATIONS.en[key] as string) || fallback || '';
};

/**
 * Automatically applies HTML lang and dir attribute for bidirectional support (LTR/RTL)
 */
export const applyLanguageDirection = (lang: AppLanguage): void => {
  if (typeof document === 'undefined') return;
  const meta = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
};

export const getSavedLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
      return saved as AppLanguage;
    }
  } catch {}
  return 'en';
};

export const setSavedLanguage = (lang: AppLanguage): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
    applyLanguageDirection(lang);
    window.dispatchEvent(new CustomEvent('signaldesk_language_changed', { detail: lang }));
  } catch {}
};

export const getSavedCurrency = (): AppCurrency => {
  if (typeof window === 'undefined') return 'USD';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENCY);
    if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) {
      return saved as AppCurrency;
    }
  } catch {}
  return 'USD';
};

export const setSavedCurrency = (curr: AppCurrency): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CURRENCY, curr);
    window.dispatchEvent(new CustomEvent('signaldesk_currency_changed', { detail: curr }));
  } catch {}
};

/**
 * Format a USD-denominated number into the chosen currency with dynamic conversion & locale formatting.
 */
export const formatCurrency = (usdAmount: number, targetCurrency: AppCurrency = 'USD'): string => {
  const meta = SUPPORTED_CURRENCIES.find(c => c.code === targetCurrency) || SUPPORTED_CURRENCIES[0];
  const converted = usdAmount * meta.ratePerUSD;

  if (meta.isCrypto) {
    if (meta.code === 'BTC') {
      return `₿ ${converted.toFixed(meta.decimals)} BTC`;
    }
    if (meta.code === 'ETH') {
      return `Ξ ${converted.toFixed(meta.decimals)} ETH`;
    }
    if (meta.code === 'SOL') {
      return `◎ ${converted.toFixed(meta.decimals)} SOL`;
    }
    return `${meta.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Fiat formatting
  const formattedNumber = Math.round(converted).toLocaleString();
  if (meta.code === 'EUR') return `€${formattedNumber}`;
  if (meta.code === 'GBP') return `£${formattedNumber}`;
  if (meta.code === 'JPY' || meta.code === 'CNY') return `¥${formattedNumber}`;
  if (meta.code === 'INR') return `₹${formattedNumber}`;
  if (meta.code === 'BRL') return `R$ ${formattedNumber}`;
  if (meta.code === 'AED') return `${formattedNumber} د.إ`;
  return `${meta.symbol}${formattedNumber}`;
};

/**
 * Compact currency formatting for high-density stat cards (e.g. €3.15M, £2.70M, ₿49.96 BTC).
 */
export const formatCurrencyCompact = (usdAmount: number, targetCurrency: AppCurrency = 'USD'): string => {
  const meta = SUPPORTED_CURRENCIES.find(c => c.code === targetCurrency) || SUPPORTED_CURRENCIES[0];
  const converted = usdAmount * meta.ratePerUSD;

  if (meta.isCrypto) {
    if (meta.code === 'BTC') return `₿ ${converted.toFixed(2)} BTC`;
    if (meta.code === 'ETH') return `Ξ ${converted.toFixed(1)} ETH`;
    if (meta.code === 'SOL') return `◎ ${converted.toFixed(0)} SOL`;
    return `${meta.symbol} ${(converted / 1000000).toFixed(2)}M`;
  }

  if (converted >= 1000000) {
    const val = (converted / 1000000).toFixed(2);
    if (meta.code === 'EUR') return `€${val}M`;
    if (meta.code === 'GBP') return `£${val}M`;
    if (meta.code === 'JPY' || meta.code === 'CNY') return `¥${val}M`;
    return `${meta.symbol}${val}M`;
  }
  if (converted >= 1000) {
    const val = (converted / 1000).toFixed(0);
    if (meta.code === 'EUR') return `€${val}K`;
    if (meta.code === 'GBP') return `£${val}K`;
    if (meta.code === 'JPY' || meta.code === 'CNY') return `¥${val}K`;
    return `${meta.symbol}${val}K`;
  }
  return formatCurrency(usdAmount, targetCurrency);
};

export interface CryptoPlatformConfig {
  defaultChain: 'Ethereum Mainnet' | 'Arbitrum One' | 'Base' | 'Solana' | 'Bitcoin';
  gasUnit: 'gwei' | 'wei' | 'sats' | 'lamports';
  rpcProvider: 'Public Decentralized RPC' | 'Alchemy Verified' | 'Infura Enterprise' | 'Custom Private Node';
  customRpcUrl?: string;
  nonCustodialPolicy: boolean;
  alertThreshold: '2/5' | '3/5' | '4/5';
  autoConvertAllFinancials: boolean;
}

export const DEFAULT_CRYPTO_CONFIG: CryptoPlatformConfig = {
  defaultChain: 'Ethereum Mainnet',
  gasUnit: 'gwei',
  rpcProvider: 'Public Decentralized RPC',
  nonCustodialPolicy: true,
  alertThreshold: '3/5',
  autoConvertAllFinancials: true
};

const STORAGE_KEY_CRYPTO_CONFIG = 'signaldesk_crypto_config';

export const getSavedCryptoConfig = (): CryptoPlatformConfig => {
  if (typeof window === 'undefined') return DEFAULT_CRYPTO_CONFIG;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CRYPTO_CONFIG);
    if (saved) return { ...DEFAULT_CRYPTO_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CRYPTO_CONFIG;
};

export const setSavedCryptoConfig = (config: CryptoPlatformConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CRYPTO_CONFIG, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('signaldesk_crypto_config_changed', { detail: config }));
  } catch {}
};

export interface LocalizedBriefing {
  script: string;
  bulletPoints: string[];
}

export const DEFAULT_BRIEFINGS_BY_LANG: Record<string, LocalizedBriefing> = {
  en: {
    script: "Good morning. Here is your SignalDesk executive intelligence briefing. All authoritative systems are synchronized and nominal. There are zero urgent situations or financial exposures requiring intervention. All automated policies and Safe Action Gateway capabilities are operational.",
    bulletPoints: [
      "Business Health: 100/100 • All Systems Nominal",
      "Needs Attention: 0 Urgent Situations",
      "Financial Exposure: $0.00 At Risk",
      "Waiting on Me: 0 Pending Approvals",
      "Safe Action Gateway: Operational"
    ]
  },
  es: {
    script: "Buenos días. Aquí está su resumen de inteligencia ejecutiva de SignalDesk. Todos los sistemas autorizados están sincronizados y nominales. No hay situaciones urgentes ni exposiciones financieras que requieran intervención. Todas las políticas automatizadas y capacidades de Safe Action Gateway están operativas.",
    bulletPoints: [
      "Salud Empresarial: 100/100 • Todos los sistemas nominales",
      "Atención requerida: 0 situaciones urgentes",
      "Exposición financiera: $0.00 en riesgo",
      "Esperando por mí: 0 aprobaciones pendientes",
      "Pasarela de Acción Segura: Operativa"
    ]
  },
  fr: {
    script: "Bonjour. Voici votre briefing d'intelligence stratégique SignalDesk. Tous les systèmes sources font l'objet d'une synchronisation nominale. Aucune situation urgente ni exposition financière ne requiert d'intervention. Toutes les politiques automatisées et passerelles d'action sont opérationnelles.",
    bulletPoints: [
      "Santé Entreprise: 100/100 • Tous systèmes nominaux",
      "Attention requise: 0 situation urgente",
      "Exposition financière: 0,00 $ en risque",
      "En attente: 0 approbation en attente",
      "Passerelle d'Action Sécurisée: Opérationnelle"
    ]
  },
  nl: {
    script: "Goedemorgen. Hier is uw SignalDesk executive intelligence briefing. Alle gezaghebbende systemen zijn gesynchroniseerd en nominaal. Er zijn geen urgente situaties of financiële risico's die interventie vereisen. Alle geautomatiseerde beleidsregels en Safe Action Gateway-functies zijn operationeel.",
    bulletPoints: [
      "Bedrijfsgezondheid: 100/100 • Alle systemen nominaal",
      "Aandacht vereist: 0 urgente situaties",
      "Financieel risico: $0.00 in risico",
      "Wachtend op mij: 0 openstaande goedkeuringen",
      "Safe Action Gateway: Operationeel"
    ]
  },
  de: {
    script: "Guten Morgen. Hier ist Ihr SignalDesk Vorstands-Briefing. Alle maßgeblichen Systeme sind synchronisiert und im Nennzustand. Es liegen keine dringenden Situationen oder finanziellen Risiken vor, die ein Eingreifen erfordern. Alle Richtlinien und Safe Action Gateways sind betriebsbereit.",
    bulletPoints: [
      "Unternehmensgesundheit: 100/100 • Alle Systeme nominal",
      "Handlungsbedarf: 0 dringende Situationen",
      "Finanzielles Risiko: $0.00 gefährdet",
      "Wartend auf mich: 0 ausstehende Freigaben",
      "Safe Action Gateway: Betriebsbereit"
    ]
  },
  he: {
    script: "בוקר טוב. הנה תדריך המודיעין הניהולי של SignalDesk. כל המערכות המסונכרנות פועלות באופן תקין ומלא. אין מצבים דחופים או חשיפות פיננסיות הדורשות התערבות. כל המדיניות האוטונומית ושערי הפעולה הבטוחה מוכנים ופעילים.",
    bulletPoints: [
      "בריאות עסקית: 100/100 • כל המערכות תקינות",
      "דורש תשומת לב: 0 מצבים דחופים",
      "חשיפה כספית: $0.00 בסיכון",
      "ממתין לאישורי: 0 אישורים ממתינים",
      "שער פעולה בטוחה: פעיל ומוכן"
    ]
  },
  ja: {
    script: "おはようございます。SignalDeskのエグゼクティブ・インテリジェンス・ブリーフィングです。すべての公認システムが正常に同期されています。緊急対応や財務リスクを要する状況はゼロ件です。すべての自動ポリシーおよび安全アクションゲートウェイが正常稼働しています。",
    bulletPoints: [
      "事業健全性: 100/100 • 全システム正常",
      "要対応事項: 0件の緊急事態",
      "財務リスク: $0.00",
      "承認待ち: 0件の保留中承認",
      "安全アクションゲートウェイ: 正常稼働中"
    ]
  },
  zh: {
    script: "早上好。这是您的SignalDesk执行层情报简报。所有权威系统均已同步且运行正常。当前无需干预的紧急业务状况或财务风险。所有自动化策略与安全行动网关均处于良好就绪状态。",
    bulletPoints: [
      "企业健康度: 100/100 • 全系统平稳正常",
      "待处理事项: 0个紧急情况",
      "财务风险敞口: $0.00",
      "待我审批: 0项挂起审批",
      "安全行动网关: 运行良好"
    ]
  },
  ar: {
    script: "صباح الخير. هذا هو الموجز الاستخباراتي التنفيذي من SignalDesk. جميع الأنظمة المعتمدة متزامنة وتعمل بحالة طبيعية ممتازة. لا توجد أي حالات حرجة أو مخاطر مالية تتطلب التدخل. كافة السياسات وبوابات العمل الآمن تعمل بكفاءة.",
    bulletPoints: [
      "صحة الأعمال: 100/100 • جميع الأنظمة بحالة ممتازة",
      "تنبيهات الاهتمام: 0 حالات حرجة",
      "التعرض المالي: $0.00 تحت الخطر",
      "بانتظار موافقتي: 0 طلبات معلقة",
      "بوابة العمل الآمن: جاهزة ونشطة"
    ]
  },
  pt: {
    script: "Bom dia. Aqui está seu briefing executivo de inteligência do SignalDesk. Todos os sistemas autoritativos estão sincronizados e nominais. Não há situações urgentes ou exposições financeiras exigindo intervenção. Todas as políticas e o Safe Action Gateway estão plenamente operacionais.",
    bulletPoints: [
      "Saúde Empresarial: 100/100 • Todos os sistemas nominais",
      "Atenção Requerida: 0 situações urgentes",
      "Exposição Financeira: US$ 0,00 em risco",
      "Aguardando Minha Ação: 0 aprovações pendentes",
      "Safe Action Gateway: Operacional"
    ]
  },
  it: {
    script: "Buongiorno. Ecco il tuo briefing di intelligence esecutiva SignalDesk. Tutti i sistemi autorevoli sono sincronizzati e operativi. Non ci sono situazioni urgenti o esposizioni finanziarie che richiedano intervento. Tutte le politiche e il Safe Action Gateway sono pienamente attivi.",
    bulletPoints: [
      "Salute Aziendale: 100/100 • Tutti i sistemi operativi",
      "Attenzione richiesta: 0 situazioni urgenti",
      "Esposizione finanziaria: $0.00 a rischio",
      "In attesa: 0 approvazioni pendenti",
      "Safe Action Gateway: Operativo"
    ]
  },
  hi: {
    script: "शुभ प्रभात। यह आपका SignalDesk कार्यकारी खुफिया ब्रीफिंग है। सभी आधिकारिक प्रणालियाँ पूरी तरह से समन्वयित और सामान्य हैं। हस्तक्षेप की आवश्यकता वाली कोई भी तत्काल स्थिति या वित्तीय जोखिम नहीं है। सभी स्वचालित नीतियां और सेफ एक्शन गेटवे चालू हैं।",
    bulletPoints: [
      "व्यावसायिक स्वास्थ्य: 100/100 • सभी प्रणालियाँ सामान्य",
      "ध्यान देने योग्य: 0 तत्काल स्थितियाँ",
      "वित्तीय जोखिम: $0.00 जोखिम में",
      "मेरी स्वीकृति लंबित: 0 लंबित स्वीकृतियाँ",
      "सेफ एक्शन गेटवे: पूर्णतः सक्रिय"
    ]
  },
  ko: {
    script: "좋은 아침입니다. SignalDesk 경영진 인텔리전스 브리핑입니다. 모든 공인 시스템이 동기화되어 정상 운영 중입니다. 개입이 필요한 긴급 상황이나 재무 위험은 없습니다. 모든 자동화 정책과 안전 액션 게이트웨이가 정상 가동 중입니다.",
    bulletPoints: [
      "비즈니스 건전성: 100/100 • 모든 시스템 정상",
      "주의 요망: 0건의 긴급 상황",
      "재무 노출 위험: $0.00",
      "승인 대기: 0건의 승인 대기",
      "안전 액션 게이트웨이: 정상 운영 중"
    ]
  },
  ru: {
    script: "Доброе утро. Ваш оперативный брифинг SignalDesk готов. Все авторизованные системы синхронизированы и функционируют в штатном режиме. Срочных ситуаций и финансовых рисков, требующих вмешательства, не обнаружено. Все политики безопасности и шлюз безопасных действий полностью активны.",
    bulletPoints: [
      "Здоровье бизнеса: 100/100 • Все системы в норме",
      "Требует внимания: 0 критических ситуаций",
      "Финансовый риск: $0.00",
      "Ожидает утверждения: 0 согласований",
      "Шлюз безопасных действий: Готов к работе"
    ]
  }
};

export interface VocalLanguageCommandResult {
  targetLang: AppLanguage;
  langMeta: LanguageMeta;
  vocalAcknowledgment: string;
  toastMessage: string;
  assistantSummary: string;
}

/**
 * Parses vocal speech utterances and conversational input to detect commands
 * that switch the system language dynamically across all supported languages.
 */
export function parseVocalLanguageCommand(text: string): VocalLanguageCommandResult | null {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase();

  // Pattern checks for intent: "switch/change/set/speak/language/into" OR Hebrew intent "שנה/החלף/עבור/דבר/שפה"
  const isSwitchIntent = 
    /(switch|change|set|speak|translate|turn|convert|language|idioma|langue|sprache|lingua|שנה|החלף|עבור|תעבור|תחליף|דבר|שפה)/i.test(normalized) ||
    normalized.length <= 15; // Direct single-word language names

  // Hebrew detection (he)
  if (
    /(עברית|לעברית|שפה עברית|איברית|ivrit)/i.test(normalized) ||
    (isSwitchIntent && /(hebrew|hebrew language|into hebrew|to hebrew)/i.test(normalized)) ||
    normalized === 'עברית' || normalized === 'hebrew' ||
    // Handles voice dictation slips like "switch into able" or "switch language into able" (phonetic slip for hebrew/able)
    (/(switch|change).*(language|system).*into\s+(able|hebrew)/i.test(normalized))
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'he')!;
    return {
      targetLang: 'he',
      langMeta: meta,
      vocalAcknowledgment: 'שלום אלנה, שפת המערכת הוחלפה לעברית בהצלחה. כל כרטיסי הבקרה, המדדים והפקודות הקוליות פועלים כעת בעברית.',
      toastMessage: 'שפת המערכת הוחלפה לעברית (Hebrew)',
      assistantSummary: '🌐 **שפת המערכת הוחלפה לעברית (Hebrew)**\n\nכל חפיסות הנתונים, תשומת הלב הניהולית, 57 המחברים, ספריית שערי המשילות והזיהוי הקולי סונכרנו כעת במלואם בעברית (בתמיכת RTL מלאה).'
    };
  }

  // English detection (en)
  if (
    /(אנגלית|לאנגלית)/i.test(normalized) ||
    (isSwitchIntent && /(english|inglés|anglais|englisch|inglese|inglês)/i.test(normalized)) ||
    normalized === 'english' || normalized === 'אנגלית'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'en')!;
    return {
      targetLang: 'en',
      langMeta: meta,
      vocalAcknowledgment: 'System language switched to English. All cards and voice synthesis are active in English.',
      toastMessage: 'Language switched to English',
      assistantSummary: '🌐 **Language switched to English**\n\nAll operational attention cards, connectors, audio synthesis, and voice recognition are now functioning in English.'
    };
  }

  // Spanish detection (es)
  if (
    /(ספרדית|לספרדית)/i.test(normalized) ||
    (isSwitchIntent && /(spanish|español|espanol|castellano)/i.test(normalized)) ||
    normalized === 'spanish' || normalized === 'español'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'es')!;
    return {
      targetLang: 'es',
      langMeta: meta,
      vocalAcknowledgment: 'El idioma del sistema ha sido cambiado a español con éxito.',
      toastMessage: 'Idioma cambiado a Español',
      assistantSummary: '🌐 **Idioma cambiado a Español**\n\nTodas las tarjetas operativas, el ciclo de 13 pasos y el reconocimiento de voz están sincronizados en español.'
    };
  }

  // French detection (fr)
  if (
    /(צרפתית|לצרפתית)/i.test(normalized) ||
    (isSwitchIntent && /(french|français|francais)/i.test(normalized)) ||
    normalized === 'french' || normalized === 'français'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'fr')!;
    return {
      targetLang: 'fr',
      langMeta: meta,
      vocalAcknowledgment: 'La langue du système a été changée en français avec succès.',
      toastMessage: 'Langue changée en Français',
      assistantSummary: '🌐 **Langue changée en Français**\n\nTous les graphiques opérationnels, cartes de décision et la reconnaissance vocale fonctionnent désormais en français.'
    };
  }

  // German detection (de)
  if (
    /(גרמנית|לגרמנית)/i.test(normalized) ||
    (isSwitchIntent && /(german|deutsch|deutsche)/i.test(normalized)) ||
    normalized === 'german' || normalized === 'deutsch'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'de')!;
    return {
      targetLang: 'de',
      langMeta: meta,
      vocalAcknowledgment: 'Die Systemsprache wurde erfolgreich auf Deutsch umgestellt.',
      toastMessage: 'Sprache auf Deutsch umgestellt',
      assistantSummary: '🌐 **Sprache auf Deutsch umgestellt**\n\nAlle betrieblichen Lagekarten, Governance-Tore und Sprachsynthesen sind jetzt auf Deutsch aktiv.'
    };
  }

  // Japanese detection (ja)
  if (
    /(יפנית|ליפנית)/i.test(normalized) ||
    (isSwitchIntent && /(japanese|nihongo|日本語)/i.test(normalized)) ||
    normalized === 'japanese' || normalized === '日本語'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'ja')!;
    return {
      targetLang: 'ja',
      langMeta: meta,
      vocalAcknowledgment: 'システム言語を日本語に切り替えました。',
      toastMessage: '言語を日本語に設定しました',
      assistantSummary: '🌐 **言語を日本語に設定しました**\n\n全てのオペレーションカード、統治ゲート、音声認識が日本語で動作します。'
    };
  }

  // Chinese detection (zh)
  if (
    /(סינית|לסינית)/i.test(normalized) ||
    (isSwitchIntent && /(chinese|mandarin|中文|汉语)/i.test(normalized)) ||
    normalized === 'chinese' || normalized === '中文'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'zh')!;
    return {
      targetLang: 'zh',
      langMeta: meta,
      vocalAcknowledgment: '系统语言已成功切换至中文。',
      toastMessage: '语言已切换至中文',
      assistantSummary: '🌐 **系统语言已切换至中文**\n\n所有运营注意卡片、57 个系统连接器及语音交互现已同步为中文。'
    };
  }

  // Arabic detection (ar)
  if (
    /(ערבית|לערבית)/i.test(normalized) ||
    (isSwitchIntent && /(arabic|عربي|العربية)/i.test(normalized)) ||
    normalized === 'arabic' || normalized === 'العربية'
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'ar')!;
    return {
      targetLang: 'ar',
      langMeta: meta,
      vocalAcknowledgment: 'تم تغيير لغة النظام إلى العربية بنجاح.',
      toastMessage: 'تم ضبط اللغة إلى العربية',
      assistantSummary: '🌐 **تم ضبط اللغة إلى العربية**\n\nجميع بطاقات الاهتمام والعمليات وبوابات الحوكمة تدعم الآن اللغة العربية بشكل كامل.'
    };
  }

  // Portuguese detection (pt)
  if (
    /(פורטוגזית)/i.test(normalized) ||
    (isSwitchIntent && /(portuguese|português|portugues)/i.test(normalized))
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'pt')!;
    return {
      targetLang: 'pt',
      langMeta: meta,
      vocalAcknowledgment: 'O idioma do sistema foi alterado para português com sucesso.',
      toastMessage: 'Idioma alterado para Português',
      assistantSummary: '🌐 **Idioma alterado para Português**\n\nTodos os cartões e comandos de voz estão sincronizados em português.'
    };
  }

  // Italian detection (it)
  if (
    /(איטלקית)/i.test(normalized) ||
    (isSwitchIntent && /(italian|italiano)/i.test(normalized))
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'it')!;
    return {
      targetLang: 'it',
      langMeta: meta,
      vocalAcknowledgment: 'La lingua del sistema è stata cambiata in italiano.',
      toastMessage: 'Lingua impostata su Italiano',
      assistantSummary: '🌐 **Lingua impostata su Italiano**\n\nTutti i moduli operativi e i comandi vocali sono ora in italiano.'
    };
  }

  // Russian detection (ru)
  if (
    /(רוסית)/i.test(normalized) ||
    (isSwitchIntent && /(russian|русский)/i.test(normalized))
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'ru')!;
    return {
      targetLang: 'ru',
      langMeta: meta,
      vocalAcknowledgment: 'Язык системы переключен на русский.',
      toastMessage: 'Язык переключен на русский',
      assistantSummary: '🌐 **Язык переключен на русский**\n\nВсе операционные карточки и голосовое взаимодействие активны на русском языке.'
    };
  }

  // Dutch detection (nl)
  if (
    /(הולנדית)/i.test(normalized) ||
    (isSwitchIntent && /(dutch|nederlands)/i.test(normalized))
  ) {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === 'nl')!;
    return {
      targetLang: 'nl',
      langMeta: meta,
      vocalAcknowledgment: 'De systeemtaal is succesvol overgeschakeld naar het Nederlands.',
      toastMessage: 'Taal ingesteld op Nederlands',
      assistantSummary: '🌐 **Taal ingesteld op Nederlands**\n\nAlle operationele kaarten en spraakfuncties zijn nu actief in het Nederlands.'
    };
  }

  return null;
}

/**
 * High-performance In-Memory & Local Storage Translation Cache
 */
const IN_MEMORY_TRANSLATION_CACHE = new Map<string, string>();

function getCacheKey(text: string, targetLang: string, sourceLang: string): string {
  return `${sourceLang}->${targetLang}:${text.trim()}`;
}

/**
 * Native Google Gemini In-App Localization Engine
 * Dynamically translates operational text using the app's server-side Google GenAI environment.
 * Uses an in-memory & localStorage caching layer for instantaneous repeat renders.
 */
export async function translateWithGoogleNative(
  text: string, 
  targetLang: AppLanguage, 
  sourceLang: AppLanguage = 'en'
): Promise<string> {
  if (!text || targetLang === sourceLang) return text;
  
  const cacheKey = getCacheKey(text, targetLang, sourceLang);
  if (IN_MEMORY_TRANSLATION_CACHE.has(cacheKey)) {
    return IN_MEMORY_TRANSLATION_CACHE.get(cacheKey)!;
  }

  // Check localStorage if available
  try {
    const cached = localStorage.getItem(`sd_trans_${cacheKey}`);
    if (cached) {
      IN_MEMORY_TRANSLATION_CACHE.set(cacheKey, cached);
      return cached;
    }
  } catch {}
  
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang })
    });
    
    if (!res.ok) return text;
    const data = await res.json();
    if (data.success && data.translatedText) {
      const translated = data.translatedText;
      IN_MEMORY_TRANSLATION_CACHE.set(cacheKey, translated);
      try {
        localStorage.setItem(`sd_trans_${cacheKey}`, translated);
      } catch {}
      return translated;
    }
  } catch (err) {
    console.warn('Native translation fallback:', err);
  }
  return text;
}

/**
 * Batch translation with Google GenAI
 * Translates an array of operational strings concurrently in a single network roundtrip.
 */
export async function translateWithGoogleNativeBatch(
  texts: string[],
  targetLang: AppLanguage,
  sourceLang: AppLanguage = 'en'
): Promise<Record<string, string>> {
  if (!texts || texts.length === 0) return {};
  if (targetLang === sourceLang) {
    const identity: Record<string, string> = {};
    for (const t of texts) identity[t] = t;
    return identity;
  }

  const results: Record<string, string> = {};
  const missing: string[] = [];

  for (const t of texts) {
    if (!t) continue;
    const key = getCacheKey(t, targetLang, sourceLang);
    if (IN_MEMORY_TRANSLATION_CACHE.has(key)) {
      results[t] = IN_MEMORY_TRANSLATION_CACHE.get(key)!;
    } else {
      missing.push(t);
    }
  }

  if (missing.length === 0) {
    return results;
  }

  try {
    const res = await fetch('/api/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: missing, targetLang, sourceLang })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.translations) {
        for (const [src, trans] of Object.entries(data.translations as Record<string, string>)) {
          const key = getCacheKey(src, targetLang, sourceLang);
          IN_MEMORY_TRANSLATION_CACHE.set(key, trans);
          results[src] = trans;
          try {
            localStorage.setItem(`sd_trans_${key}`, trans);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Batch translation error:', err);
  }

  // Fill in any remaining misses with original text
  for (const m of missing) {
    if (!results[m]) results[m] = m;
  }

  return results;
}

// Re-export card localization utilities
export { getLocalizedSituation, getLocalizedWaitingOnMe } from './localizedCards';
