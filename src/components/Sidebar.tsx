import React, { useState } from 'react';
import { 
  LayoutGrid, 
  History, 
  Settings, 
  Volume2, 
  VolumeX, 
  LogOut, 
  X,
  Plug,
  Plus,
  Pin,
  Trash2,
  Download,
  Search,
  Radio,
  Cpu,
  Activity,
  Mic,
  MicOff,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Headphones,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { SignalDeskLogo } from './SignalDeskLogo';
import { UserProfileData } from '../data/billsData';
import { WaitingOnMeItem } from '../types';
import { SovereignVoicePersona } from '../utils/sovereignVoice';

export type NavItem = 'command' | 'connectors' | 'history' | 'settings';

export interface RecentChatSession {
  id: string;
  title: string;
  prompt: string;
  timestamp: string;
  isPinned?: boolean;
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;

  // Navigation props (fully safe with optional fallback)
  activeNav?: NavItem;
  onSelectNav?: (nav: NavItem) => void;
  waitingCount?: number;
  attentionCount?: number;
  connectedCount?: number;

  // Executive workspace props
  userProfile?: UserProfileData;
  activeVoicePersona?: SovereignVoicePersona;
  isVoiceChatMode?: boolean;
  showAudioBriefBar?: boolean;
  soundEnabled?: boolean;
  waitingOnMe?: WaitingOnMeItem[];
  approvedItemIds?: string[] | Set<string>;
  recentChats?: RecentChatSession[];
  activeChatId?: string | null;
  onSelectChat?: (chat: RecentChatSession) => void;
  onRenameChat?: (id: string, newTitle: string) => void;
  onPinChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onExportChat?: (chat: RecentChatSession) => void;
  onShowToast?: (msg: string) => void;
  onSendMessage?: (text: string) => void;
  onNewChat?: () => void;
  onToggleVoiceChat?: () => void;
  onToggleAudioBriefBar?: () => void;
  onToggleSound?: () => void;
  onOpenPulseModal?: () => void;
  onOpenMorningBriefing?: () => void;
  onOpenSimulatorModal?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenConnectors?: () => void;
  onOpenMcpAuthority?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenAudit?: () => void;
  onOpenCompliance?: () => void;
  onOpenCryptoModal?: () => void;
  onOpenStressTest?: () => void;
  onOpenBoardParameters?: () => void;
  onOpenUserProfile?: () => void;
  onOpenLocalizationSettings?: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isMobile,
  activeNav = 'command',
  onSelectNav,
  waitingCount = 0,
  attentionCount = 0,
  connectedCount = 0,
  userProfile,
  isVoiceChatMode,
  showAudioBriefBar,
  soundEnabled = true,
  waitingOnMe = [],
  recentChats = [],
  activeChatId,
  onSelectChat,
  onPinChat,
  onDeleteChat,
  onExportChat,
  onNewChat,
  onToggleVoiceChat,
  onToggleAudioBriefBar,
  onToggleSound,
  onOpenMorningBriefing,
  onOpenCommandPalette,
  onOpenConnectors,
  onOpenMcpAuthority,
  onOpenAudit,
  onOpenUserProfile,
  onSignOut
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  // Calculate badges
  const pendingApprovalsCount = waitingCount || waitingOnMe.length;
  const totalAttention = (attentionCount || 0) + pendingApprovalsCount;

  const navItems: { id: NavItem; label: string; icon: React.ElementType; badge?: string | number; badgeColor?: string }[] = [
    {
      id: 'command',
      label: 'Command Center',
      icon: LayoutGrid,
      badge: totalAttention > 0 ? `${totalAttention} urgent` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      id: 'connectors',
      label: 'Connectors & Gateways',
      icon: Cpu,
      badge: connectedCount > 0 ? `${connectedCount} live` : undefined,
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'history',
      label: 'Audit Ledger & History',
      icon: History,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pending` : undefined,
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    },
    {
      id: 'settings',
      label: 'Settings & Authority',
      icon: Settings
    }
  ];

  const handleNavClick = (id: NavItem) => {
    // 1. Invoke onSelectNav callback to switch active workspace view
    if (typeof onSelectNav === 'function') {
      try {
        onSelectNav(id);
      } catch (err) {
        console.error('Error invoking onSelectNav:', err);
      }
    } else {
      // 2. Fallback modal dispatches only when onSelectNav is not supplied
      if (id === 'connectors') {
        onOpenConnectors?.();
      } else if (id === 'history') {
        onOpenAudit?.();
      } else if (id === 'settings') {
        onOpenUserProfile?.();
      } else if (id === 'command') {
        onNewChat?.();
      }
    }

    if (isMobile) {
      onClose();
    }
  };

  const filteredChats = recentChats.filter(chat => 
    !searchFilter || chat.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-30 w-72 sm:w-80 md:w-64 lg:w-72 bg-[#0c0a09] border-r border-stone-800 flex flex-col justify-between transition-all duration-200 ease-in-out shrink-0 select-none ${
          isOpen 
            ? 'translate-x-0 shadow-2xl md:shadow-none' 
            : '-translate-x-full md:hidden pointer-events-none'
        }`}
      >
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-stone-800/80 flex items-center justify-between shrink-0 bg-stone-950/40">
          <div className="flex items-center gap-2.5">
            <SignalDeskLogo size="sm" variant="mark" />
            <div className="leading-tight">
              <span className="font-bold text-sm text-stone-100 font-display tracking-tight block">
                SignalDesk
              </span>
              <span className="text-[10px] text-stone-500 font-mono">
                One Business · One Page
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer transition md:hidden"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer transition hidden md:flex"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Center Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 text-xs">
          
          {/* New Inquiry Action Button */}
          {onNewChat && (
            <button
              onClick={() => {
                onNewChat();
                if (isMobile) onClose();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-between transition shadow-sm cursor-pointer group active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Inquiry</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-600/30 text-stone-950 group-hover:bg-amber-600/40">
                ⌘N
              </span>
            </button>
          )}

          {/* Primary Navigation Links */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
              Operating Environment
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between transition cursor-pointer active:scale-98 ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                        : 'text-stone-300 hover:text-white hover:bg-stone-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                        item.badgeColor || (isActive ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-stone-850 text-stone-400 border-stone-800')
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Morning Audio Briefing Card in Sidebar */}
          {onToggleAudioBriefBar && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 via-stone-900 to-stone-950 border border-amber-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Headphones className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block leading-tight">Daily Briefing</span>
                    <span className="text-[10px] text-stone-400">Audio Intelligence Synthesis</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  2 min
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleAudioBriefBar();
                  if (isMobile) onClose();
                }}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                  showAudioBriefBar 
                    ? 'bg-amber-500 text-stone-950 shadow-xs' 
                    : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>{showAudioBriefBar ? 'Close Player Dock' : 'Play Briefing Dock'}</span>
              </button>
            </div>
          )}

          {/* Executive Quick Tools */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
              Executive Tools
            </div>

            <div className="space-y-0.5">
              {onOpenCommandPalette && (
                <button
                  onClick={() => {
                    onOpenCommandPalette();
                    if (isMobile) onClose();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-900 flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-stone-500" />
                    <span>Command Bar</span>
                  </div>
                  <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">
                    ⌘K
                  </kbd>
                </button>
              )}

              {onOpenMorningBriefing && (
                <button
                  onClick={() => {
                    onOpenMorningBriefing();
                    if (isMobile) onClose();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-900 flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-stone-500" />
                    <span>Executive Briefing</span>
                  </div>
                </button>
              )}

              {onOpenMcpAuthority && (
                <button
                  onClick={() => {
                    onOpenMcpAuthority();
                    if (isMobile) onClose();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-900 flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-stone-500" />
                    <span>MCP 2026 Gateway</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Recent Executive Sessions */}
          {recentChats.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold flex items-center justify-between">
                <span>Recent Sessions</span>
                <span className="text-[10px] font-mono text-stone-600">{recentChats.length}</span>
              </div>

              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {filteredChats.map((chat) => {
                  const isSelected = activeChatId === chat.id;
                  return (
                    <div
                      key={chat.id}
                      className={`group w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-500/10 text-amber-200 font-medium border border-amber-500/20' 
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectChat?.(chat);
                          if (isMobile) onClose();
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        title={chat.title}
                      >
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
                        <span className="truncate text-xs">{chat.title}</span>
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        {onPinChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPinChat(chat.id);
                            }}
                            className={`p-1 rounded hover:bg-stone-800 ${chat.isPinned ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
                            title={chat.isPinned ? 'Unpin session' : 'Pin session'}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                        )}
                        {onExportChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportChat(chat);
                            }}
                            className="p-1 rounded hover:bg-stone-800 text-stone-500 hover:text-stone-300"
                            title="Export markdown"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(chat.id);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-stone-500 hover:text-rose-400"
                            title="Remove session"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Identity & Audio Controls */}
        <div className="p-3 border-t border-stone-800/80 bg-stone-950/70 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => handleNavClick('settings')}
              className="flex items-center gap-2.5 hover:opacity-90 transition cursor-pointer min-w-0 flex-1 text-left"
              title="Open Account & System Settings"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-stone-950 font-bold text-xs shrink-0 shadow-xs">
                {userProfile?.avatarInitials || (userProfile?.name ? userProfile.name.charAt(0) : 'E')}
              </div>
              <div className="min-w-0 truncate">
                <div className="text-xs font-semibold text-stone-200 truncate">
                  {userProfile?.name || 'Executive Lead'}
                </div>
                <div className="text-[10px] text-stone-500 truncate">
                  {userProfile?.role || 'CEO & Sovereign'}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              {onToggleVoiceChat && (
                <button
                  onClick={onToggleVoiceChat}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    isVoiceChatMode 
                      ? 'text-amber-400 bg-amber-500/20' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                  title={isVoiceChatMode ? 'Voice Mode Active' : 'Enable Voice Mode'}
                >
                  {isVoiceChatMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              )}

              {onToggleSound && (
                <button
                  onClick={onToggleSound}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
                  title={soundEnabled ? 'Mute Alert Sounds' : 'Unmute Alert Sounds'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
