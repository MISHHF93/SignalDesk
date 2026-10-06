import React, { useState } from 'react';
import { 
  X, 
  AlertOctagon, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight 
} from 'lucide-react';
import { ChatMessage } from './AIChatWorkspace';

interface DiscrepancyModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  onClose: () => void;
  onSubmitDiscrepancy: (messageId: string, category: string, system: string, notes: string) => void;
}

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  isOpen,
  message,
  onClose,
  onSubmitDiscrepancy,
}) => {
  if (!isOpen || !message) return null;

  const [selectedCategory, setSelectedCategory] = useState<string>('financial_mismatch');
  const [selectedSystem, setSelectedSystem] = useState<string>('QuickBooks Online');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: 'financial_mismatch', label: 'Financial or Ledger Discrepancy', desc: 'Invoice, payment, or run-rate amount needs authoritative re-sync' },
    { id: 'crm_outdated', label: 'Outdated CRM Stage / Deal Status', desc: 'Deal stage, ARR value, or customer relationship changed in Salesforce/HubSpot' },
    { id: 'wrong_owner', label: 'Incorrect Task Assignee or Owner', desc: 'Delegation target or approval gate routed to incorrect department' },
    { id: 'unverified_inference', label: 'Unverified AI Inference', desc: 'Claim lacks deterministic source fact proof or verifiable audit trail' },
  ];

  const systems = [
    'QuickBooks Online',
    'Stripe Billing',
    'Salesforce CRM',
    'HubSpot',
    'Google Workspace (Gmail/Docs)',
    'Jira Software',
    'Slack Enterprise Grid'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSubmitDiscrepancy(message.id, selectedCategory, selectedSystem, notes);
      onClose();
    }, 400);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-stone-925 border border-stone-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-stone-100 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-850 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Report Discrepancy & Re-Sync Source</h3>
              <p className="text-[11px] text-stone-400 font-mono">Continuous Learning & Non-Repudiation Loop</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-850 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Excerpt */}
        <div className="p-3 rounded-xl bg-stone-950 border border-stone-850 text-xs space-y-1">
          <div className="text-[10px] font-mono uppercase text-stone-500 font-bold">Flagged Intelligence Excerpt:</div>
          <div className="text-stone-300 line-clamp-3 italic">
            "{message.text.slice(0, 180)}..."
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-300 block">
              Discrepancy Classification
            </label>
            <div className="space-y-1.5">
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : 'bg-stone-900/50 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-850'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{cat.label}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{cat.desc}</div>
                  </div>
                  {selectedCategory === cat.id && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Authoritative System to Re-Query */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-300 block">
              Authoritative System of Record to Re-Query
            </label>
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              {systems.map((sys) => (
                <option key={sys} value={sys}>{sys}</option>
              ))}
            </select>
          </div>

          {/* Optional Executive Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-300 block">
              Executive Context / Correction Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Meridian Tech paid $42K via wire yesterday; verify against SVB cash sweep..."
              className="w-full bg-stone-900 border border-stone-800 rounded-xl p-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 resize-y min-h-[60px]"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Re-Querying Sources...' : 'Re-Query & Correct Ground Truth'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
