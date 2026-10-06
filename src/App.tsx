import React, { useState, useEffect, useRef } from 'react';
import { 
  BusinessSignal,
  BusinessMission,
  BusinessAgent,
  BusinessMetric,
  WaitingOnMeItem,
  ConnectedTool,
  AuditRecord,
  BusinessGoal,
  CommitmentItem,
  InstitutionalDecision
} from './types';
import { INITIAL_AGENTS } from './data/platformConfig';
import { UserProfileData, INITIAL_USER_PROFILE } from './data/billsData';
import type { UserRoleFilter, ThemePalette } from './components/Header';
import { AIChatWorkspace } from './components/AIChatWorkspace';
import { PublicWebsite } from './components/PublicWebsite';
import { UserProfileModal } from './components/UserProfileModal';
import { MembershipAndPricingModal } from './components/MembershipAndPricingModal';
import { MembershipTierId } from './types';
import { AuditTrailModal } from './components/AuditTrailModal';
import { AuthGatewayModal } from './components/AuthGatewayModal';
import { CyberdeckModal } from './components/CyberdeckModal';
import { AiMcpAuthorityCenterModal } from './components/AiMcpAuthorityCenterModal';
import { ConnectorMarketplaceModal } from './components/ConnectorMarketplaceModal';
import { WorkflowStressTestModal } from './components/WorkflowStressTestModal';
import { GoogleMapsFleetModal } from './components/GoogleMapsFleetModal';
import { MorningBriefingModal } from './components/MorningBriefingModal';
import { playAlarmSound } from './utils/sound';
import { applyLanguageDirection, getSavedLanguage } from './utils/localization';
import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  // Enterprise operational state (Real-Data Activation: Genuine empty state until backend sync)
  const [situations, setSituations] = useState<BusinessSignal[]>([]);
  const [waitingOnMe, setWaitingOnMe] = useState<WaitingOnMeItem[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetric[]>([]);
  const [tools, setTools] = useState<ConnectedTool[]>([]);
  const [agents, setAgents] = useState<BusinessAgent[]>(INITIAL_AGENTS);
  const [missions, setMissions] = useState<BusinessMission[]>([]);
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [decisions, setDecisions] = useState<InstitutionalDecision[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);

  // User identity & executive lens with localStorage persistence
  const [userProfile, setUserProfile] = useState<UserProfileData>(() => {
    try {
      const saved = localStorage.getItem('signaldesk_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_USER_PROFILE, ...parsed };
      }
    } catch (e) {}
    return INITIAL_USER_PROFILE;
  });
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRoleFilter>('all');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Routing: Public Pre-login Website vs AI Command Center
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('signaldesk_authenticated');
      if (saved !== null) return saved === 'true';
      return false; // Default unauthenticated until user signs in or enters app
    } catch (e) {}
    return false;
  });

  const [currentRoute, setCurrentRoute] = useState<'website' | 'workspace'>(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
      if (hash.includes('workspace') || hash.includes('app') || hash.includes('command')) return 'workspace';
      const saved = localStorage.getItem('signaldesk_authenticated');
      if (saved === 'true') return 'workspace';
      return 'website'; // Default to organic single page landing website before entering
    } catch (e) {}
    return 'website';
  });
  const [pendingPostAuthTab, setPendingPostAuthTab] = useState<'profile' | 'membership' | 'connectors' | 'connector_config' | 'compliance' | 'billing' | 'authority' | 'notifications' | 'sessions' | null>(null);

  // Modals
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [userProfileInitialTab, setUserProfileInitialTab] = useState<'profile' | 'membership' | 'connectors' | 'connector_config' | 'compliance' | 'billing' | 'authority' | 'notifications' | 'sessions'>('profile');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAuthGatewayModal, setShowAuthGatewayModal] = useState(false);
  const [authGatewayInitialTab, setAuthGatewayInitialTab] = useState<'google' | 'email' | 'bypass'>('google');
  const [showCyberdeckModal, setShowCyberdeckModal] = useState(false);
  const [showMcpAuthorityModal, setShowMcpAuthorityModal] = useState(false);
  const [mcpAuthorityInitialTab, setMcpAuthorityInitialTab] = useState<'clients' | 'capabilities' | 'pipeline' | 'configs' | 'simulator' | 'external_servers' | 'prompts_resources' | 'marketplace_upgrades'>('marketplace_upgrades');
  const [showConnectorMarketplaceModal, setShowConnectorMarketplaceModal] = useState(false);
  const [showStressTestModal, setShowStressTestModal] = useState(false);
  const [showGoogleMapsModal, setShowGoogleMapsModal] = useState(false);
  const [showMorningBriefingModal, setShowMorningBriefingModal] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleOpenSettings = (tab: 'profile' | 'membership' | 'connectors' | 'connector_config' | 'compliance' | 'billing' | 'authority' | 'notifications' | 'sessions' = 'profile') => {
    if (currentRoute === 'website' && !isAuthenticated) {
      setPendingPostAuthTab(tab);
      setShowAuthGatewayModal(true);
      showToast('Authentication required to access platform settings.');
      return;
    }
    setUserProfileInitialTab(tab);
    setShowUserProfileModal(true);
  };

  const handleSelectMembershipTier = (tier: MembershipTierId) => {
    const updated: UserProfileData = {
      ...userProfile,
      membershipTier: tier
    };
    setUserProfile(updated);
    try {
      localStorage.setItem('signaldesk_user_profile', JSON.stringify(updated));
    } catch (e) {}
    showToast(`Switched plan to ${tier.toUpperCase()}`);
  };

  const handleSignOut = async () => {
    setShowUserProfileModal(false);
    setIsAuthenticated(false);
    try {
      localStorage.setItem('signaldesk_authenticated', 'false');
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setPendingPostAuthTab(null);
    setCurrentRoute('website');
    window.location.hash = 'website';
    showToast('Signed out. Welcome to SignalDesk Public Portal.');
  };

  const handleOpenMcpAuthority = (tab: 'clients' | 'capabilities' | 'pipeline' | 'configs' | 'simulator' | 'external_servers' | 'prompts_resources' | 'marketplace_upgrades' = 'marketplace_upgrades') => {
    setMcpAuthorityInitialTab(tab);
    setShowMcpAuthorityModal(true);
  };

  // Scoped event listener for operational orchestration
  useEffect(() => {
    const handleBriefingEvent = () => setShowMorningBriefingModal(true);
    window.addEventListener('signaldesk:open-morning-briefing', handleBriefingEvent);
    return () => {
      window.removeEventListener('signaldesk:open-morning-briefing', handleBriefingEvent);
    };
  }, []);

  // URL hash navigation support (#website, #workspace, #audit)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('website') || hash.includes('tour') || hash.includes('portal') || hash.includes('overview')) {
        setCurrentRoute('website');
      } else if (hash.includes('audit') || hash.includes('ledger')) {
        setCurrentRoute('workspace');
        setShowAuditModal(true);
      } else if (hash.includes('workspace') || hash.includes('app') || hash.includes('command')) {
        setCurrentRoute('workspace');
      } else {
        const saved = localStorage.getItem('signaldesk_authenticated');
        if (saved === 'true') {
          setCurrentRoute('workspace');
        } else {
          setCurrentRoute('website');
        }
      }
    };

    if (typeof window !== 'undefined') {
      handleHashChange();
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  // Sync bidirectional HTML direction (LTR/RTL for Hebrew & Arabic)
  useEffect(() => {
    applyLanguageDirection(getSavedLanguage());
    const onLangChanged = (e: any) => {
      if (e.detail) applyLanguageDirection(e.detail);
    };
    window.addEventListener('signaldesk_language_changed', onLangChanged);
    return () => window.removeEventListener('signaldesk_language_changed', onLangChanged);
  }, []);

  // Fetch fresh state from backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (data.situations) setSituations(data.situations);
        if (data.waitingOnMe) setWaitingOnMe(data.waitingOnMe);
        if (data.metrics) setMetrics(data.metrics);
        if (data.tools) setTools(data.tools);
        if (data.agents) setAgents(data.agents);
        if (data.missions) setMissions(data.missions);
        if (data.goals) setGoals(data.goals);
        if (data.commitments) setCommitments(data.commitments);
        if (data.decisions) setDecisions(data.decisions);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
      }
    } catch (err) {
      console.warn('Could not sync with backend /api/state; using local operational cache.', err);
    }
  };

  useEffect(() => {
    fetchState();
    // Validate session with server
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUserProfile(prev => ({ ...prev, ...data.user }));
        }
      })
      .catch(() => {});
  }, []);

  // Handlers wired to backend
  const handleTakeCareOfThis = async (sit: BusinessSignal) => {
    setSituations(prev => prev.filter(s => s.id !== sit.id));
    try {
      const res = await fetch('/api/situations/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situationId: sit.id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auditRecord) {
          setAuditLogs(prev => [data.auditRecord, ...prev.filter(a => a.id !== data.auditRecord.id)]);
        }
      }
    } catch (err) {
      console.error('Failed to sync resolution to backend:', err);
    }

    if (isSoundEnabled) playAlarmSound('acknowledge');
    showToast(`Resolved "${sit.title}". Changes committed to source of truth.`);
  };

  const handleApproveWaitingItem = async (item: WaitingOnMeItem) => {
    setWaitingOnMe(prev => prev.filter(w => w.id !== item.id));
    try {
      const res = await fetch('/api/waiting-on-me/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auditRecord) {
          setAuditLogs(prev => [data.auditRecord, ...prev.filter(a => a.id !== data.auditRecord.id)]);
        }
      }
    } catch (err) {
      console.error('Failed to sync approval to backend:', err);
    }

    if (isSoundEnabled) playAlarmSound('acknowledge');
    showToast(`Approved "${item.title}". Dual-key signature verified.`);
  };

  const handleInstantBypassWaitingItem = async (item: WaitingOnMeItem) => {
    setWaitingOnMe(prev => prev.filter(w => w.id !== item.id));
    try {
      const res = await fetch('/api/waiting-on-me/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isInstantBypass: true })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auditRecord) {
          setAuditLogs(prev => [data.auditRecord, ...prev.filter(a => a.id !== data.auditRecord.id)]);
        }
      }
    } catch (err) {
      console.error('Failed to sync bypass to backend:', err);
    }

    if (isSoundEnabled) playAlarmSound('acknowledge');
    showToast(`⚡ Instant Bypass executed for "${item.title}". Dispatched immediately.`);
  };

  const handleInstantBypassAllWaitingItems = async () => {
    const bypassedCount = waitingOnMe.length;
    setWaitingOnMe([]);
    try {
      const res = await fetch('/api/waiting-on-me/instant-bypass-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auditRecords && Array.isArray(data.auditRecords)) {
          setAuditLogs(prev => [...data.auditRecords, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to sync instant bypass all to backend:', err);
    }

    if (isSoundEnabled) playAlarmSound('acknowledge');
    showToast(`⚡ All ${bypassedCount} authorization gates instantly bypassed and executed.`);
  };

  const handleRejectWaitingItem = async (item: WaitingOnMeItem) => {
    try {
      await fetch('/api/waiting-on-me/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
    } catch (err) {
      console.error('Failed to sync rejection to backend:', err);
    }

    setWaitingOnMe(prev => prev.filter(w => w.id !== item.id));
    showToast(`Rejected authorization: "${item.title}". Item removed.`);
  };

  const handleCleanData = async () => {
    try {
      const res = await fetch('/api/state/clean', { method: 'POST' });
      if (res.ok) {
        await fetchState();
        showToast('Cleaned all demo data and mock situations.');
      }
    } catch (err) {
      console.error('Failed to clean data:', err);
    }
  };

  const handleStimulateData = async (payload?: any) => {
    try {
      const res = await fetch('/api/state/stimulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      if (res.ok) {
        await fetchState();
        showToast('Generated fresh operational data.');
      }
    } catch (err) {
      console.error('Failed to stimulate data:', err);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/state/reset-demo', { method: 'POST' });
      if (res.ok) {
        await fetchState();
        showToast('Restored default demo dataset.');
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  const handleLaunchMissionFromQuery = async (objective: string, sitId?: string) => {
    try {
      const res = await fetch('/api/missions/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, situationId: sitId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mission) {
          setMissions(prev => [data.mission, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to launch mission via backend:', err);
    }

    if (isSoundEnabled) playAlarmSound('acknowledge');
    showToast(`Autonomous mission dispatched: "${objective.slice(0, 48)}..."`);
  };

  const handleToggleTool = async (toolId: string) => {
    const targetTool = tools.find(t => t.id === toolId);
    if (!targetTool) return;
    const newStatus = targetTool.status === 'connected' ? 'disconnected' : 'connected';

    try {
      await fetch('/api/tools/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, status: newStatus })
      });
    } catch (err) {
      console.error('Failed to toggle tool on backend:', err);
    }

    setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: newStatus } : t));
    showToast(`${targetTool.name} is now ${newStatus}.`);
  };

  const handleInstantLaunch = (targetTab?: any) => {
    setIsAuthenticated(true);
    setCurrentRoute('workspace');
    window.location.hash = 'workspace';
    try {
      localStorage.setItem('signaldesk_authenticated', 'true');
    } catch (e) {}
    if (targetTab === 'connectors') {
      setShowConnectorMarketplaceModal(true);
    }
    showToast('Launched SignalDesk Executive Session.');
  };

  // Theme application class: Official Dark Mode is enforced globally
  const themeClass = 'dark theme-midnight bg-[#0c0a09] text-stone-100';

  const p1Count = situations.filter(s => s.urgency === 'critical').length;
  const connectedCount = tools.filter(t => t.status === 'connected' || t.status === 'syncing').length;

  return (
    <LanguageProvider>
      <div id="signaldesk-root-app" className={`min-h-[100dvh] h-[100dvh] w-full max-w-full flex flex-col font-sans select-none overflow-hidden ${themeClass}`}>
      
      {/* Route Switcher: Public Pre-login Portal vs Sovereign AI Command Center */}
      {currentRoute === 'website' ? (
        <div className="flex-1 w-full max-w-full overflow-y-auto min-h-0 h-full">
          <PublicWebsite
            isAuthenticated={isAuthenticated}
            currentUser={userProfile}
            onSignOut={handleSignOut}
            onInstantLaunch={handleInstantLaunch}
            onEnterCommandCenter={(targetTab) => {
              handleInstantLaunch(targetTab);
            }}
            onEnterApp={() => {
              handleInstantLaunch();
            }}
            onOpenAuthModal={() => {
              setPendingPostAuthTab(null);
              setAuthGatewayInitialTab('google');
              setShowAuthGatewayModal(true);
            }}
            onOpenMcpAuthority={() => {
              if (!isAuthenticated) {
                setAuthGatewayInitialTab('google');
                setShowAuthGatewayModal(true);
                showToast('Authentication required to access MCP Authority Center.');
              } else {
                setCurrentRoute('workspace');
                window.location.hash = 'workspace';
                handleOpenMcpAuthority('marketplace_upgrades');
              }
            }}
            onOpenConnectorConfig={() => {
              if (!isAuthenticated) {
                setPendingPostAuthTab('connector_config');
                setAuthGatewayInitialTab('google');
                setShowAuthGatewayModal(true);
                showToast('Authentication required to configure system connectors & ingress.');
              } else {
                setCurrentRoute('workspace');
                window.location.hash = 'workspace';
                handleOpenSettings('connector_config');
              }
            }}
            onOpenCompliance={() => {
              if (!isAuthenticated) {
                setPendingPostAuthTab('compliance');
                setAuthGatewayInitialTab('google');
                setShowAuthGatewayModal(true);
                showToast('Authentication required to access continuous compliance telemetry.');
              } else {
                setCurrentRoute('workspace');
                window.location.hash = 'workspace';
                handleOpenSettings('compliance');
              }
            }}
            onOpenSettings={(tab) => {
              if (!isAuthenticated) {
                setPendingPostAuthTab(tab || 'profile');
                setAuthGatewayInitialTab('google');
                setShowAuthGatewayModal(true);
                showToast('Authentication required to access platform settings.');
              } else {
                setCurrentRoute('workspace');
                window.location.hash = 'workspace';
                handleOpenSettings(tab);
              }
            }}
            connectedToolsCount={connectedCount}
            p1Count={p1Count}
            mrrAtRisk={situations.reduce((sum, s) => sum + (s.financialExposure || 0), 0)}
          />
        </div>
      ) : (
        /* Unified Command Center (Chat, Board & Audit with Persistent Sidebar & Full Governed Controls) */
        <div className="flex-1 w-full max-w-full overflow-hidden flex flex-col min-h-0 h-full">
          <AIChatWorkspace
            situations={situations}
            waitingOnMe={waitingOnMe}
            metrics={metrics}
            tools={tools}
            agents={agents}
            missions={missions}
            commitments={commitments}
            decisions={decisions}
            goals={goals}
            userProfile={userProfile}
            onOpenMembership={() => setShowMembershipModal(true)}
            onSelectMembershipTier={handleSelectMembershipTier}
            onTakeCareOfSituation={handleTakeCareOfThis}
            onApproveWaitingItem={handleApproveWaitingItem}
            onInstantBypassWaitingItem={handleInstantBypassWaitingItem}
            onInstantBypassAllWaitingItems={handleInstantBypassAllWaitingItems}
            onRejectWaitingItem={handleRejectWaitingItem}
            onLaunchMission={(objective, sitId) => {
              if (sitId) {
                const sit = situations.find(s => s.id === sitId);
                if (sit) handleTakeCareOfThis(sit);
              } else {
                handleLaunchMissionFromQuery(objective);
              }
            }}
            onShowToast={showToast}
            onOpenMcpAuthority={() => {
              handleOpenMcpAuthority('marketplace_upgrades');
            }}
            onOpenAuditLedger={() => setShowAuditModal(true)}
            onOpenAuditModal={() => setShowAuditModal(true)}
            onOpenBoardParameters={() => setShowAuditModal(true)}
            onOpenUserProfile={() => handleOpenSettings('profile')}
            onOpenConnectors={() => setShowConnectorMarketplaceModal(true)}
            onOpenConnectorConfig={() => handleOpenSettings('connector_config')}
            onOpenCyberdeck={() => setShowCyberdeckModal(true)}
            onOpenGoogleMaps={() => setShowGoogleMapsModal(true)}
            onOpenMorningBriefing={() => setShowMorningBriefingModal(true)}
            onOpenStressTest={() => setShowStressTestModal(true)}
            onOpenAudit={() => setShowAuditModal(true)}
            auditLogs={auditLogs}
            onRollback={(id) => showToast(`Rollback initiated for action ID: ${id}`)}
            selectedRole={selectedRole}
            onSelectRole={setSelectedRole}
            isSoundEnabled={isSoundEnabled}
            onToggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
            p1Count={p1Count}
            totalExposureUSD={situations.reduce((sum, s) => sum + (s.financialExposure || 0), 0)}
            onSignOut={handleSignOut}
            onToggleTool={handleToggleTool}
            onRefreshTools={fetchState}
            onUpdateProfile={(updated) => {
              setUserProfile(updated);
              try {
                localStorage.setItem('signaldesk_user_profile', JSON.stringify(updated));
              } catch (e) {}
            }}
          />
        </div>
      )}

      {/* Non-Repudiation Audit Ledger Modal */}
      {showAuditModal && (
        <AuditTrailModal
          auditLogs={auditLogs}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* Autonomous Workflow Stress & Resilience Testing Modal */}
      <WorkflowStressTestModal
        isOpen={showStressTestModal}
        onClose={() => setShowStressTestModal(false)}
        onShowToast={showToast}
      />

      {/* Executive User Profile & Authority Settings Modal */}
      <UserProfileModal
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        currentUser={userProfile}
        initialTab={userProfileInitialTab}
        tools={tools}
        onToggleTool={handleToggleTool}
        onRefreshTools={fetchState}
        onShowToast={showToast}
        onProfileChange={(updated) => {
          setUserProfile(updated);
          try {
            localStorage.setItem('signaldesk_user_profile', JSON.stringify(updated));
          } catch (e) {}
        }}
        onSignOut={handleSignOut}
      />

      {/* Membership Tiers & Google Cloud Hosting Economics Modal */}
      <MembershipAndPricingModal
        isOpen={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        currentUser={userProfile}
        onPlanChange={(tierId, billingCycle) => {
          const updated: UserProfileData = {
            ...userProfile,
            membershipTier: tierId as MembershipTierId,
            membershipBillingCycle: billingCycle
          };
          setUserProfile(updated);
          try {
            localStorage.setItem('signaldesk_user_profile', JSON.stringify(updated));
          } catch (e) {}
          setShowMembershipModal(false);
          showToast(`Plan updated to ${tierId.toUpperCase()} (${billingCycle})`);
        }}
        onShowToast={showToast}
      />

      {/* Auth Gateway & Role Bypass Modal */}
      <AuthGatewayModal
        isOpen={showAuthGatewayModal}
        initialTab={authGatewayInitialTab}
        onClose={() => {
          setShowAuthGatewayModal(false);
          setPendingPostAuthTab(null);
        }}
        currentUser={userProfile}
        onBypassAndEnter={(user) => {
          if (user) {
            setUserProfile(user);
            try {
              localStorage.setItem('signaldesk_user_profile', JSON.stringify(user));
            } catch (e) {}
          }
          setShowAuthGatewayModal(false);
          setCurrentRoute('workspace');
          setIsAuthenticated(true);
          try {
            localStorage.setItem('signaldesk_authenticated', 'true');
          } catch (e) {}
          window.location.hash = 'workspace';
          
          if (pendingPostAuthTab) {
            const targetTab = pendingPostAuthTab;
            setPendingPostAuthTab(null);
            setTimeout(() => {
              handleOpenSettings(targetTab);
            }, 100);
          }
          showToast('Executive identity authenticated. Welcome to Command Center.');
        }}
      />

      {/* Cyberdeck 4-Band Transceiver Modal */}
      {showCyberdeckModal && (
        <CyberdeckModal
          onClose={() => setShowCyberdeckModal(false)}
          onShowToast={showToast}
          onOpenMcpAuthority={() => {
            setShowCyberdeckModal(false);
            handleOpenMcpAuthority('marketplace_upgrades');
          }}
          onOpenStressTest={() => {
            setShowCyberdeckModal(false);
            setShowStressTestModal(true);
          }}
        />
      )}

      {/* Model Context Protocol (MCP) Authority & Protocol Marketplace Center */}
      {showMcpAuthorityModal && (
        <AiMcpAuthorityCenterModal
          isOpen={showMcpAuthorityModal}
          onClose={() => setShowMcpAuthorityModal(false)}
          initialTab={mcpAuthorityInitialTab}
        />
      )}

      {/* Full 57 Connectors & SaaS Integration Marketplace Modal */}
      <ConnectorMarketplaceModal
        isOpen={showConnectorMarketplaceModal}
        onClose={() => setShowConnectorMarketplaceModal(false)}
        tools={tools}
        onToggleTool={handleToggleTool}
        onRefreshAll={fetchState}
        onOpenBuyerTrustCenter={() => {
          setShowConnectorMarketplaceModal(false);
          handleOpenSettings('compliance');
        }}
        onOpenMcpAuthority={() => {
          setShowConnectorMarketplaceModal(false);
          handleOpenMcpAuthority('marketplace_upgrades');
        }}
      />

      {/* Google Maps Platform Fleet, Logistics & Air Quality Intelligence Modal */}
      {showGoogleMapsModal && (
        <GoogleMapsFleetModal
          isOpen={showGoogleMapsModal}
          onClose={() => setShowGoogleMapsModal(false)}
          onShowToast={showToast}
        />
      )}

      {/* Morning Executive Briefing & Autonomous Action Triage Modal */}
      {showMorningBriefingModal && (
        <MorningBriefingModal
          isOpen={showMorningBriefingModal}
          onClose={() => setShowMorningBriefingModal(false)}
          onShowToast={showToast}
          onSelectSituation={(sitId) => {
            setShowMorningBriefingModal(false);
            const sit = situations.find(s => s.id === sitId);
            if (sit) handleTakeCareOfThis(sit);
          }}
        />
      )}

      {/* Toast Notification Banner - Responsive & Mobile Safe */}
      {toastMessage && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto max-w-[calc(100vw-2rem)] sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div className="px-3.5 py-2.5 rounded-xl bg-stone-900/95 border border-stone-800 text-white shadow-2xl text-xs font-medium flex items-center gap-2.5 backdrop-blur-md min-w-0 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="truncate break-words leading-snug">{toastMessage}</span>
          </div>
        </div>
      )}

      </div>
    </LanguageProvider>
  );
}
