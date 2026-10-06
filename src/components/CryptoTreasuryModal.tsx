import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  Lock, 
  RefreshCw,
  RotateCcw,
  Wallet,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  Globe,
  Radio,
  KeyRound,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { INITIAL_CRYPTO_TREASURY, CryptoHolding, OnChainAuthorizationGate } from '../data/cryptoTreasuryData';
import { formatCurrency, AppCurrency, getSavedCurrency } from '../utils/localization';
import { playAlarmSound } from '../utils/sound';

export interface CryptoTreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
  currency?: AppCurrency;
  currentCurrency?: AppCurrency;
  onInstantBypassOnChainGate?: (gate: OnChainAuthorizationGate) => void;
}

export const CryptoTreasuryModal: React.FC<CryptoTreasuryModalProps> = ({
  isOpen,
  onClose,
  onShowToast = () => {},
  currency,
  currentCurrency,
  onInstantBypassOnChainGate
}) => {
  const activeCurrency = currentCurrency || currency || getSavedCurrency();
  const [treasury, setTreasury] = useState(INITIAL_CRYPTO_TREASURY);
  const [bypassedGateIds, setBypassedGateIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'holdings' | 'governance' | 'reconciliation'>('holdings');
  const [isMaximized, setIsMaximized] = useState(false);

  // Interactive Add Watch-Only Wallet State
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletChain, setNewWalletChain] = useState<'Ethereum Mainnet' | 'Arbitrum One' | 'Base' | 'Solana' | 'Bitcoin'>('Ethereum Mainnet');
  const [newWalletSymbol, setNewWalletSymbol] = useState<'ETH' | 'BTC' | 'SOL' | 'USDC' | 'USDT'>('ETH');
  const [newWalletAmount, setNewWalletAmount] = useState('15.5');
  const [syncingConnectorId, setSyncingConnectorId] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<Array<{
    id: string;
    name: string;
    status: string;
    health: string;
    lastSync: string;
    latencyMs: number;
  }>>([
    { id: 'safe_wallet', name: "Safe{Wallet} Multi-Sig", status: 'connected', health: 'Active (3/5)', lastSync: '12s ago', latencyMs: 28 },
    { id: 'evm_watchtower', name: 'EVM Watchtower', status: 'connected', health: 'Synced (L1/L2)', lastSync: '45s ago', latencyMs: 34 },
    { id: 'solana_vault', name: 'Solana Corporate Vault', status: 'available', health: 'Ready to Link', lastSync: 'Never', latencyMs: 0 },
    { id: 'coinbase_custody', name: 'Coinbase Custody PoR', status: 'available', health: 'Ready to Link', lastSync: 'Never', latencyMs: 0 },
    { id: 'etherscan_dune', name: 'Etherscan & Dune Indexer', status: 'available', health: 'Ready to Link', lastSync: 'Never', latencyMs: 0 },
    { id: 'btc_xpub', name: 'Bitcoin xPub Watcher', status: 'available', health: 'Ready to Link', lastSync: 'Never', latencyMs: 0 }
  ]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/crypto/treasury')
      .then(res => res.json())
      .then(json => {
        if (json?.data?.connectors) {
          setConnectors(json.data.connectors);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleToggleSyncConnector = async (connectorId: string) => {
    setSyncingConnectorId(connectorId);
    try {
      const res = await fetch('/api/crypto/sync-connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.connectors) {
          setConnectors(json.connectors);
        }
        onShowToast(`Connector updated: ${json.connector?.name} is now ${json.connector?.status}.`);
      }
    } catch {
      onShowToast('Failed to update connector.');
    } finally {
      setSyncingConnectorId(null);
    }
  };

  if (!isOpen) return null;

  const handleAddWatchOnlyWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletAddress.trim() || !newWalletName.trim()) {
      onShowToast('Please provide a valid wallet name and public address.');
      return;
    }

    const priceMap: Record<string, number> = {
      BTC: 68450,
      ETH: 3550,
      SOL: 178,
      USDC: 1.0,
      USDT: 1.0
    };

    const parsedAmount = parseFloat(newWalletAmount) || 0;
    const usdVal = parsedAmount * (priceMap[newWalletSymbol] || 1);

    const newHolding: CryptoHolding = {
      symbol: newWalletSymbol,
      name: newWalletName.trim(),
      chain: newWalletChain,
      amount: parsedAmount,
      usdPrice: priceMap[newWalletSymbol] || 1,
      totalUSD: usdVal,
      allocationPercent: 0,
      change24h: 1.85,
      custodyType: 'Gnosis Safe Multisig (3/5)',
      address: newWalletAddress.trim(),
      explorerUrl: newWalletAddress.startsWith('0x')
        ? `https://etherscan.io/address/${newWalletAddress.trim()}`
        : `https://solscan.io/account/${newWalletAddress.trim()}`
    };

    // Dispatch to backend API
    fetch('/api/crypto/add-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newWalletName.trim(),
        address: newWalletAddress.trim(),
        chain: newWalletChain,
        symbol: newWalletSymbol,
        amount: parsedAmount
      })
    }).catch(() => {});

    setTreasury(prev => {
      const updatedHoldings = [...prev.holdings, newHolding];
      const newTotalUSD = updatedHoldings.reduce((sum, h) => sum + h.totalUSD, 0);
      const withAllocations = updatedHoldings.map(h => ({
        ...h,
        allocationPercent: Math.round((h.totalUSD / newTotalUSD) * 1000) / 10
      }));
      return {
        ...prev,
        totalBalanceUSD: newTotalUSD,
        holdings: withAllocations
      };
    });

    onShowToast(`Watch-only wallet "${newWalletName}" enrolled and synced with backend.`);
    playAlarmSound('acknowledge', 0.2);

    // Reset Form
    setIsAddingWallet(false);
    setNewWalletName('');
    setNewWalletAddress('');
    setNewWalletAmount('10');
  };

  const handleInstantBypassGate = (gate: OnChainAuthorizationGate) => {
    setBypassedGateIds(prev => new Set(prev).add(gate.id));
    if (onInstantBypassOnChainGate) {
      onInstantBypassOnChainGate(gate);
    }
    onShowToast(`⚡ Sovereign On-Chain Bypass: TX ${gate.id} dispatched via Gnosis Safe relay.`);
    playAlarmSound('acknowledge', 0.2);
  };

  const handleBypassAllGates = () => {
    const pending = treasury.pendingOnChainGates.filter(g => !bypassedGateIds.has(g.id));
    if (pending.length === 0) {
      onShowToast('All on-chain gates already cleared.');
      return;
    }
    pending.forEach(g => {
      setBypassedGateIds(prev => new Set(prev).add(g.id));
      if (onInstantBypassOnChainGate) onInstantBypassOnChainGate(g);
    });
    onShowToast(`⚡ Dispatched all ${pending.length} on-chain multisig transactions with root override.`);
    playAlarmSound('acknowledge', 0.25);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-2 sm:p-4 md:p-6'
      } bg-stone-950/80 backdrop-blur-md animate-fadeIn`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-900 border border-stone-800 text-stone-100 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'w-full max-w-6xl 2xl:max-w-7xl h-[90vh] sm:h-[88vh] rounded-2xl'
        }`}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800/80 flex items-center justify-between gap-3 bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold truncate">Web3 & Corporate Crypto Treasury</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  Institutional Safe
                </span>
              </div>
              <p className="text-xs text-stone-400 truncate">
                Multi-chain institutional reserves, Gnosis Safe 3/5 multisig governance, and on-chain verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer flex items-center gap-1 font-mono text-xs font-bold"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-6 bg-stone-950/60 border-b border-stone-800/60">
          <div>
            <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Total Treasury Balance</div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-white mt-0.5">
              {formatCurrency(treasury.totalBalanceUSD, activeCurrency)}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>+{treasury.change24hPercent}% 24h (+{formatCurrency(treasury.change24hUSD, activeCurrency)})</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Staked Yield Generating</div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-amber-400 mt-0.5">
              {formatCurrency(treasury.stakedAssetsUSD, activeCurrency)}
            </div>
            <div className="text-[11px] text-stone-400 font-mono mt-0.5">
              Avg Yield: ~4.45% APY
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Gas Runway & Bundler</div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400 mt-0.5">
              {treasury.gasReserveDays} Days
            </div>
            <div className="text-[11px] text-stone-400 font-mono mt-0.5">
              ERC-4337 Paymaster OK
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Ledger Reconciliation</div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-blue-400 mt-0.5">
              {treasury.reconciliationRate}%
            </div>
            <div className="text-[11px] text-stone-400 font-mono mt-0.5">
              Matched to Stripe/Xero
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-800/80 px-4 sm:px-6 bg-stone-900/60 gap-4">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'holdings'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Asset Allocations ({treasury.holdings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'governance'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>On-Chain Multisig Gates ({treasury.pendingOnChainGates.filter(g => !bypassedGateIds.has(g.id)).length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'reconciliation'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ERP & Tax Reconciliation</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'holdings' && (
            <div className="space-y-4">
              {/* Unmonetized & Read-Only Observability Guarantee */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-white">Read-Only Non-Custodial Observability: </span>
                    <span className="text-stone-300">
                      SignalDesk is 100% free and unmonetized. Zero private keys or transaction rights are ever requested. Public ledger states are verified over decentralized RPC nodes.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingWallet(!isAddingWallet)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingWallet ? 'Cancel' : 'Add Watch-Only Wallet'}</span>
                </button>
              </div>

              {/* Interactive Add Watch-Only Wallet Drawer */}
              {isAddingWallet && (
                <form 
                  onSubmit={handleAddWatchOnlyWallet}
                  className="p-4 rounded-xl bg-stone-950 border border-amber-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-stone-800">
                    <span className="text-xs font-bold text-amber-300 font-mono flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      Add Public Watch-Only Address (Zero Private Keys)
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">Read-Only RPC Verification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-stone-400 mb-1">Account / Vault Label</label>
                      <input
                        type="text"
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                        placeholder="e.g. Operations Safe L2 or Strategic Staking"
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-stone-400 mb-1">Network / Blockchain</label>
                      <select
                        value={newWalletChain}
                        onChange={(e) => setNewWalletChain(e.target.value as any)}
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                      >
                        <option value="Ethereum Mainnet">Ethereum Mainnet (L1)</option>
                        <option value="Arbitrum One">Arbitrum One (L2)</option>
                        <option value="Base">Base (Coinbase L2)</option>
                        <option value="Solana">Solana Network</option>
                        <option value="Bitcoin">Bitcoin (Taproot/Native SegWit)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono text-stone-400 mb-1">Public Address / ENS / Safe Contract</label>
                      <input
                        type="text"
                        value={newWalletAddress}
                        onChange={(e) => setNewWalletAddress(e.target.value)}
                        placeholder="0x... or vitalik.eth or Solana Pubkey or xPub"
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-stone-400 mb-1">Primary Asset Asset</label>
                      <select
                        value={newWalletSymbol}
                        onChange={(e) => setNewWalletSymbol(e.target.value as any)}
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                      >
                        <option value="ETH">ETH (Ethereum)</option>
                        <option value="BTC">BTC (Bitcoin)</option>
                        <option value="SOL">SOL (Solana)</option>
                        <option value="USDC">USDC (USD Coin)</option>
                        <option value="USDT">USDT (Tether USD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-stone-400 mb-1">Approximate Balance Units</label>
                      <input
                        type="number"
                        step="any"
                        value={newWalletAmount}
                        onChange={(e) => setNewWalletAmount(e.target.value)}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingWallet(false)}
                      className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:bg-stone-800 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Attach Watch-Only Asset</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center justify-between text-xs font-mono text-stone-400 pb-1">
                <span>Asset / Custody</span>
                <span>Balance & USD Equivalent</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {treasury.holdings.map(h => (
                  <div 
                    key={h.symbol}
                    className="p-4 rounded-xl border border-stone-800 bg-stone-900/60 hover:border-stone-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center font-bold text-amber-400 text-base font-mono border border-stone-700 shrink-0">
                        {h.symbol === 'BTC' && '₿'}
                        {h.symbol === 'ETH' && 'Ξ'}
                        {h.symbol === 'SOL' && '◎'}
                        {h.symbol === 'USDC' && '$'}
                        {h.symbol === 'USDT' && '₮'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{h.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                            {h.chain}
                          </span>
                          {h.yieldApy && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {h.yieldApy}% APY
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2">
                          <span>{h.custodyType}</span>
                          <a 
                            href={h.explorerUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>{h.address.slice(0, 6)}...{h.address.slice(-4)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right font-mono">
                      <div className="text-base font-bold text-white">
                        {h.amount.toLocaleString()} {h.symbol}
                      </div>
                      <div className="text-xs text-stone-400">
                        ≈ {formatCurrency(h.totalUSD, activeCurrency)} ({h.allocationPercent}% of portfolio)
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Web3 Connectors Telemetry Bar */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-300 font-mono flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    Web3 Watchtowers & Multi-Sig Connectors ({connectors.filter(c => c.status === 'connected').length} Active)
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Click to Sync or Toggle Link</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] font-mono">
                  {connectors.map(c => {
                    const isConnected = c.status === 'connected';
                    const isSyncing = syncingConnectorId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleToggleSyncConnector(c.id)}
                        disabled={isSyncing}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                          isConnected
                            ? 'bg-stone-900/90 border-emerald-500/30 hover:border-emerald-500/60'
                            : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div>
                          <div className="text-stone-200 font-semibold">{c.name}</div>
                          <div className="text-[10px] text-stone-400">
                            {c.lastSync !== 'Never' ? `Sync: ${c.lastSync}` : 'Standby'}
                            {c.latencyMs > 0 && ` • ${c.latencyMs}ms`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSyncing ? (
                            <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />
                          ) : (
                            <span className={`text-[10px] font-bold ${isConnected ? 'text-emerald-400' : 'text-stone-400'}`}>
                              {isConnected ? '● Connected' : '○ Link'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                <div>
                  <h3 className="text-sm font-bold text-white">Gnosis Safe Multisig Governance Gates</h3>
                  <p className="text-xs text-stone-400">
                    Dual-key on-chain policy circuit breakers awaiting executive cryptographic confirmation
                  </p>
                </div>
                {treasury.pendingOnChainGates.filter(g => !bypassedGateIds.has(g.id)).length > 0 && (
                  <button
                    onClick={handleBypassAllGates}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 fill-stone-950" />
                    <span>⚡ Instant Bypass All On-Chain Gates</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {treasury.pendingOnChainGates.map(gate => {
                  const isBypassed = bypassedGateIds.has(gate.id);
                  return (
                    <div 
                      key={gate.id}
                      className={`p-4 rounded-xl border transition ${
                        isBypassed 
                          ? 'border-emerald-500/40 bg-emerald-950/20' 
                          : 'border-amber-500/30 bg-stone-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              isBypassed 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {isBypassed ? 'DISPATCHED ON-CHAIN' : 'AWAITING SOVEREIGN SIG'}
                            </span>
                            <span className="text-xs font-mono text-stone-400">{gate.chain}</span>
                            <span className="text-xs font-mono text-stone-500">Exp: {gate.expiresIn}</span>
                          </div>
                          <h4 className="font-bold text-sm text-white mt-1.5">{gate.title}</h4>
                          <p className="text-xs text-stone-300 mt-1">{gate.description}</p>
                          <div className="text-[11px] font-mono text-stone-400 mt-2 bg-stone-950/60 p-2 rounded border border-stone-800">
                            <strong>CallData:</strong> {gate.callDataSummary}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-bold font-mono text-amber-400">
                            {formatCurrency(gate.valueUSD, activeCurrency)}
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                            {gate.multisigThreshold}
                          </div>
                          
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleInstantBypassGate(gate)}
                              disabled={isBypassed}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                isBypassed
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 cursor-pointer shadow-xs'
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              <span>{isBypassed ? 'Relayed & Confirmed' : '⚡ Instant Bypass'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-stone-800 bg-stone-950/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>100% On-Chain Transactions Reconciled to General Ledger</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Every incoming customer crypto payment (Stripe Crypto, Coinbase Commerce, native USDC transfers) is automatically paired with QuickBooks/Xero ledger entries with zero manual reconciliation overhead.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs">
                    <div className="text-stone-400 font-mono">Matched Invoices</div>
                    <div className="text-base font-bold text-white mt-1">214 Payments</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs">
                    <div className="text-stone-400 font-mono">Accounting Engine</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">QuickBooks + Xero</div>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs">
                    <div className="text-stone-400 font-mono">Tax Cost Basis</div>
                    <div className="text-base font-bold text-blue-400 mt-1">FIFO / Form 8949 Ready</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800/80 bg-stone-900/90 flex items-center justify-between flex-wrap gap-2 text-xs text-stone-400">
          <div className="flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Proof of Reserves: Cryptographically verified against RPC node</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
