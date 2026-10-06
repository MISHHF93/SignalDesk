import React from 'react';

const brandMarkImg = '/src/assets/images/signaldesk_brand_mark_1788692463488.jpg';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type LogoVariant = 'mark' | 'full' | 'monogram' | 'badge' | 'image';

interface SignalDeskLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  isDark?: boolean;
  className?: string;
  badgeText?: string;
  showStatusIndicator?: boolean;
  statusColor?: 'emerald' | 'cyan' | 'amber' | 'rose';
  animated?: boolean;
  onClick?: () => void;
}

const SIZE_MAP: Record<LogoSize, { px: number; iconSize: string; textClass: string; badgeClass: string }> = {
  xs: { px: 20, iconSize: 'w-5 h-5', textClass: 'text-xs', badgeClass: 'text-[8px] px-1 py-0.2' },
  sm: { px: 24, iconSize: 'w-6 h-6', textClass: 'text-sm', badgeClass: 'text-[9px] px-1.5 py-0.5' },
  md: { px: 32, iconSize: 'w-8 h-8', textClass: 'text-base font-bold', badgeClass: 'text-[9px] px-1.5 py-0.5' },
  lg: { px: 40, iconSize: 'w-10 h-10', textClass: 'text-lg font-bold', badgeClass: 'text-[10px] px-2 py-0.5' },
  xl: { px: 48, iconSize: 'w-12 h-12', textClass: 'text-xl font-extrabold', badgeClass: 'text-[11px] px-2 py-0.5' },
  '2xl': { px: 64, iconSize: 'w-16 h-16', textClass: 'text-2xl font-extrabold', badgeClass: 'text-xs px-2.5 py-1' },
};

export const SignalDeskLogo: React.FC<SignalDeskLogoProps> = ({
  size = 'md',
  variant = 'full',
  isDark = false,
  className = '',
  badgeText = '',
  showStatusIndicator = false,
  statusColor = 'emerald',
  animated = false,
  onClick
}) => {
  const config = SIZE_MAP[size];

  // Precise SVG Geometric Brand Mark
  // Represents: 4 Cardinal Operating Questions converging into a central Focal Diamond
  const renderSvgMark = () => (
    <svg 
      viewBox="0 0 36 36" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${config.iconSize} shrink-0 ${animated ? 'transition-transform hover:scale-105' : ''}`}
      aria-label="SignalDesk Brand Mark"
    >
      <defs>
        {/* Brand Core Gradient: Deep Sapphire to Electric Cyan */}
        <linearGradient id="sdGradientPrimary" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" /> {/* Indigo 600 */}
          <stop offset="50%" stopColor="#2563eb" /> {/* Blue 600 */}
          <stop offset="100%" stopColor="#06b6d4" /> {/* Cyan 500 */}
        </linearGradient>

        {/* Diamond Focal Gradient */}
        <linearGradient id="sdFocalPrism" x1="12" y1="12" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" /> {/* Sky 400 */}
          <stop offset="100%" stopColor="#1d4ed8" /> {/* Blue 700 */}
        </linearGradient>

        {/* Subtle Ambient Shadow */}
        <filter id="sdGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Rounded Hexagonal / Squircle Foundation Container */}
      <rect 
        x="1.5" 
        y="1.5" 
        width="33" 
        height="33" 
        rx="8" 
        fill={isDark ? '#0f172a' : '#1e1b4b'} 
        stroke="url(#sdGradientPrimary)" 
        strokeWidth="1.5" 
      />

      {/* Left Inbound Signal Wave (What came in?) */}
      <path 
        d="M7 14C7 14 9.5 16 9.5 18C9.5 20 7 22 7 22" 
        stroke="#60a5fa" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
      />
      <path 
        d="M10.5 11.5C10.5 11.5 14 14.5 14 18C14 21.5 10.5 24.5 10.5 24.5" 
        stroke="#38bdf8" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
        strokeOpacity="0.85" 
      />

      {/* Right Outbound Verification Wave (What's next?) */}
      <path 
        d="M29 14C29 14 26.5 16 26.5 18C26.5 20 29 22 29 22" 
        stroke="#60a5fa" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
      />
      <path 
        d="M25.5 11.5C25.5 11.5 22 14.5 22 18C22 21.5 25.5 24.5 25.5 24.5" 
        stroke="#38bdf8" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
        strokeOpacity="0.85" 
      />

      {/* Vertical Axis (Who owns it? & What's stuck?) */}
      <line x1="18" y1="6" x2="18" y2="10" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="26" x2="18" y2="30" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" />

      {/* Central Precision Diamond (The Executive Focal Plane) */}
      <polygon 
        points="18,12 24,18 18,24 12,18" 
        fill="url(#sdFocalPrism)" 
        stroke="#93c5fd" 
        strokeWidth="1.2"
        filter="url(#sdGlow)"
      />

      {/* Center Core Node (Single Source of Truth) */}
      <circle cx="18" cy="18" r="2.2" fill="#ffffff" />
    </svg>
  );

  // High-Resolution Studio Raster Mark Variant
  const renderImageMark = () => (
    <div className={`relative ${config.iconSize} rounded-xl overflow-hidden shadow-xs border border-indigo-500/30 shrink-0 bg-slate-950`}>
      <img 
        src={brandMarkImg} 
        alt="SignalDesk Brand Identity Mark" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );

  const chosenMark = variant === 'image' ? renderImageMark() : renderSvgMark();

  if (variant === 'mark' || variant === 'image') {
    return (
      <div 
        onClick={onClick} 
        className={`inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {chosenMark}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div 
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border select-none transition-all ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white hover:border-slate-700' 
            : 'bg-white border-slate-200/90 text-slate-900 shadow-2xs hover:border-indigo-300'
        } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {chosenMark}
        <div className="flex flex-col text-left">
          <span className="font-display font-bold text-xs tracking-tight leading-tight">SignalDesk</span>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider leading-none">System OS</span>
        </div>
      </div>
    );
  }

  if (variant === 'monogram') {
    return (
      <div 
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-xl font-display font-extrabold select-none ${
          isDark ? 'bg-indigo-950/80 text-cyan-400 border border-indigo-500/40' : 'bg-indigo-600 text-white'
        } ${config.iconSize} ${config.textClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        SD
      </div>
    );
  }

  // Default 'full' variant
  return (
    <div 
      onClick={onClick} 
      className={`inline-flex items-center gap-2 select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {chosenMark}
      <div className="flex items-center gap-1.5 min-w-0">
        <span 
          className={`font-display font-bold tracking-tight transition-colors ${config.textClass} ${
            isDark ? 'text-white group-hover:text-cyan-300' : 'text-slate-900 group-hover:text-indigo-600'
          }`}
        >
          SignalDesk
        </span>
        {badgeText && (
          <span 
            className={`font-mono font-bold uppercase tracking-wider rounded-full border leading-none inline-flex items-center justify-center whitespace-nowrap ${config.badgeClass} ${
              isDark 
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
