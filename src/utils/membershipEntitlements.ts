import { MEMBERSHIP_TIERS, MembershipTier } from '../data/membershipData';
import { MembershipTierId, MembershipBillingCycle } from '../types';

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: MembershipTierId;
  currentTier: MembershipTierId;
  limit?: number | string;
  currentValue?: number;
}

/**
 * Retrieve the full configuration definition for a membership tier
 */
export function getTierConfig(tierId: MembershipTierId = 'starter'): MembershipTier {
  const tier = MEMBERSHIP_TIERS.find(t => t.id === tierId);
  return tier || MEMBERSHIP_TIERS[1]; // fallback to Starter
}

/**
 * Maximum number of active connectors / MCP tools permitted by tier
 */
export function getTierConnectorLimit(tierId: MembershipTierId = 'starter'): number {
  switch (tierId) {
    case 'community':
      return 1;
    case 'starter':
      return 3;
    case 'growth':
      return 8;
    case 'executive':
      return 18;
    case 'enterprise':
      return 999;
    default:
      return 3;
  }
}

/**
 * Monthly verified inquiries quota
 */
export function getTierInquiriesLimit(tierId: MembershipTierId = 'starter'): number {
  const tier = getTierConfig(tierId);
  return tier.monthlyInquiries;
}

/**
 * Check if sending another inquiry / intelligence request is permitted
 */
export function checkInquiryEntitlement(
  tierId: MembershipTierId = 'starter',
  inquiriesUsedThisMonth: number = 0
): EntitlementCheckResult {
  const limit = getTierInquiriesLimit(tierId);
  const tier = getTierConfig(tierId);

  if (tierId === 'enterprise' || limit >= 99999) {
    return { allowed: true, currentTier: tierId, limit: 'Unlimited', currentValue: inquiriesUsedThisMonth };
  }

  if (inquiriesUsedThisMonth >= limit) {
    let nextTier: MembershipTierId = 'growth';
    if (tierId === 'community') nextTier = 'starter';
    else if (tierId === 'starter') nextTier = 'growth';
    else if (tierId === 'growth') nextTier = 'executive';
    else if (tierId === 'executive') nextTier = 'enterprise';

    const nextConfig = getTierConfig(nextTier);

    return {
      allowed: false,
      currentTier: tierId,
      limit,
      currentValue: inquiriesUsedThisMonth,
      requiredTier: nextTier,
      reason: `Monthly inquiry limit of ${limit.toLocaleString()} verified prompts reached on ${tier.name}. Upgrade to ${nextConfig.name} (${nextConfig.monthlyInquiries.toLocaleString()} inquiries) or top up prepaid escrow tokens at $0.02/inquiry.`
    };
  }

  return {
    allowed: true,
    currentTier: tierId,
    limit,
    currentValue: inquiriesUsedThisMonth
  };
}

/**
 * Check seats allowed for team invite
 */
export function checkSeatEntitlement(
  tierId: MembershipTierId = 'starter',
  currentSeatsCount: number = 1
): EntitlementCheckResult {
  const tier = getTierConfig(tierId);
  const limit = tier.seatsIncluded;

  if (tier.id === 'enterprise') {
    return { allowed: true, currentTier: tierId, limit: 'Unlimited', currentValue: currentSeatsCount };
  }

  const numericLimit = typeof limit === 'number' ? limit : 1;
  if (currentSeatsCount >= numericLimit) {
    let nextTier: MembershipTierId = 'growth';
    if (tierId === 'community' || tierId === 'starter') nextTier = 'growth';
    else if (tierId === 'growth') nextTier = 'executive';
    else if (tierId === 'executive') nextTier = 'enterprise';

    const nextConfig = getTierConfig(nextTier);
    return {
      allowed: false,
      currentTier: tierId,
      limit: numericLimit,
      currentValue: currentSeatsCount,
      requiredTier: nextTier,
      reason: `You have reached the seat limit of ${numericLimit} on ${tier.name}. Upgrade to ${nextConfig.name} for ${nextConfig.seatsIncluded} seats.`
    };
  }

  return {
    allowed: true,
    currentTier: tierId,
    limit: numericLimit,
    currentValue: currentSeatsCount
  };
}

/**
 * Monthly Safe Action Gateway write approvals
 */
export function getTierWriteGatesLimit(tierId: MembershipTierId = 'starter'): number {
  const tier = getTierConfig(tierId);
  return tier.monthlyWriteGates;
}

/**
 * Check if adding another connector is permitted under current tier
 */
export function checkConnectorEntitlement(
  tierId: MembershipTierId = 'starter',
  currentlyConnectedCount: number
): EntitlementCheckResult {
  const limit = getTierConnectorLimit(tierId);
  const tier = getTierConfig(tierId);

  if (tierId === 'enterprise') {
    return { allowed: true, currentTier: tierId, limit: 'Unlimited', currentValue: currentlyConnectedCount };
  }

  if (currentlyConnectedCount >= limit) {
    let nextTier: MembershipTierId = 'growth';
    if (tierId === 'community') nextTier = 'starter';
    else if (tierId === 'starter') nextTier = 'growth';
    else if (tierId === 'growth') nextTier = 'executive';
    else if (tierId === 'executive') nextTier = 'enterprise';

    const nextConfig = getTierConfig(nextTier);

    return {
      allowed: false,
      currentTier: tierId,
      limit,
      currentValue: currentlyConnectedCount,
      requiredTier: nextTier,
      reason: `You have reached the limit of ${limit} connected systems on ${tier.name}. Upgrade to ${nextConfig.name} to connect up to ${nextConfig.mcpToolsLimit === 'unlimited' ? 'all' : nextConfig.mcpToolsLimit} systems.`
    };
  }

  return {
    allowed: true,
    currentTier: tierId,
    limit,
    currentValue: currentlyConnectedCount
  };
}

/**
 * Check if Safe Action Gateway writes are permitted
 */
export function checkWriteActionEntitlement(
  tierId: MembershipTierId = 'starter',
  writesUsedThisMonth: number = 0
): EntitlementCheckResult {
  const limit = getTierWriteGatesLimit(tierId);
  const tier = getTierConfig(tierId);

  if (tierId === 'community') {
    return {
      allowed: false,
      currentTier: tierId,
      limit: 0,
      currentValue: 0,
      requiredTier: 'starter',
      reason: 'Community Explorer is Read-Only. Safe Action Gateway write execution requires Starter Solo ($19/mo) or higher.'
    };
  }

  if (writesUsedThisMonth >= limit && tierId !== 'enterprise') {
    let nextTier: MembershipTierId = 'growth';
    if (tierId === 'starter') nextTier = 'growth';
    else if (tierId === 'growth') nextTier = 'executive';
    else if (tierId === 'executive') nextTier = 'enterprise';

    const nextConfig = getTierConfig(nextTier);

    return {
      allowed: false,
      currentTier: tierId,
      limit,
      currentValue: writesUsedThisMonth,
      requiredTier: nextTier,
      reason: `Monthly write execution limit of ${limit} reached for ${tier.name}. Upgrade to ${nextConfig.name} or replenish escrow tokens.`
    };
  }

  return {
    allowed: true,
    currentTier: tierId,
    limit,
    currentValue: writesUsedThisMonth
  };
}

/**
 * Check if Dual-Key multi-seat signing is available
 */
export function checkDualKeyEntitlement(tierId: MembershipTierId = 'starter'): EntitlementCheckResult {
  if (tierId === 'community' || tierId === 'starter') {
    return {
      allowed: false,
      currentTier: tierId,
      requiredTier: 'growth',
      reason: 'Dual-Key Multi-Seat Signing requires a multi-user tier (Growth Team $49/mo or higher). Single-user plans use standard cryptographic single-signature.'
    };
  }

  return { allowed: true, currentTier: tierId };
}

/**
 * Check if Audio Briefing / Synthetic Voice Memo is available
 */
export function checkAudioBriefingEntitlement(tierId: MembershipTierId = 'starter'): EntitlementCheckResult {
  if (tierId === 'community' || tierId === 'starter') {
    return {
      allowed: false,
      currentTier: tierId,
      requiredTier: 'growth',
      reason: 'Gemini Synthetic Voice Briefings & Audio Memo player require Growth Team ($49/mo) or higher.'
    };
  }

  return { allowed: true, currentTier: tierId };
}

/**
 * Check Counterfactual Simulation studio limits
 */
export function checkSimulationEntitlement(tierId: MembershipTierId = 'starter'): EntitlementCheckResult {
  if (tierId === 'community') {
    return {
      allowed: false,
      currentTier: tierId,
      requiredTier: 'starter',
      limit: 0,
      reason: 'Counterfactual & Goal Variance simulations require Starter Solo ($19/mo) or higher.'
    };
  }

  const limit = tierId === 'starter' ? 5 : tierId === 'growth' ? 50 : 'Unlimited';
  return {
    allowed: true,
    currentTier: tierId,
    limit
  };
}

/**
 * Check Compliance & Audit Binder Export (SOC-2 / HIPAA BAA / Vanta)
 */
export function checkComplianceExportEntitlement(tierId: MembershipTierId = 'starter'): EntitlementCheckResult {
  if (tierId === 'community' || tierId === 'starter') {
    return {
      allowed: false,
      currentTier: tierId,
      requiredTier: 'growth',
      reason: 'Auditor-ready continuous compliance binders and export packages require Growth Team or Executive Scale.'
    };
  }

  return { allowed: true, currentTier: tierId };
}

/**
 * Return badge colors & typography styles for each tier
 */
export function getTierBadgeStyle(tierId: MembershipTierId = 'starter'): {
  bg: string;
  text: string;
  border: string;
  badgeLabel: string;
  priceLabel: string;
} {
  switch (tierId) {
    case 'community':
      return {
        bg: 'bg-stone-100 dark:bg-stone-800',
        text: 'text-stone-700 dark:text-stone-300',
        border: 'border-stone-300 dark:border-stone-700',
        badgeLabel: 'Community (Free)',
        priceLabel: '$0'
      };
    case 'starter':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-800 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-700',
        badgeLabel: 'Starter Solo ($19)',
        priceLabel: '$19/mo'
      };
    case 'growth':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/50',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-700',
        badgeLabel: 'Growth Team ($49)',
        priceLabel: '$49/mo'
      };
    case 'executive':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/50',
        text: 'text-indigo-800 dark:text-indigo-300',
        border: 'border-indigo-300 dark:border-indigo-700',
        badgeLabel: 'Executive Scale ($149)',
        priceLabel: '$149/mo'
      };
    case 'enterprise':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/50',
        text: 'text-purple-800 dark:text-purple-300',
        border: 'border-purple-300 dark:border-purple-700',
        badgeLabel: 'Enterprise Sovereign ($499)',
        priceLabel: '$499/mo'
      };
    default:
      return {
        bg: 'bg-stone-100 dark:bg-stone-800',
        text: 'text-stone-800 dark:text-stone-200',
        border: 'border-stone-300 dark:border-stone-700',
        badgeLabel: 'Starter Solo',
        priceLabel: '$19/mo'
      };
  }
}
