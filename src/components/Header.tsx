import React from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  CreditCard, 
  Activity, 
  Headphones 
} from 'lucide-react';

export type UserRoleFilter = 'all' | 'executive' | 'revenue' | 'finance' | 'operations' | 'support';
export type ThemePalette = 'midnight';

export interface RoleDefinition {
  id: UserRoleFilter;
  title: string;
  badge: string;
  icon: React.ElementType;
  description: string;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: 'all',
    title: 'Executive Lens',
    badge: 'Universal',
    icon: Briefcase,
    description: 'Complete cross-functional overview across all business domains'
  },
  {
    id: 'revenue',
    title: 'Revenue & Growth',
    badge: 'Pipeline & ARR',
    icon: TrendingUp,
    description: 'Focus on pipeline, renewals, contract risks, and customer expansion'
  },
  {
    id: 'finance',
    title: 'Finance & Cashflow',
    badge: 'AR / AP & Invoices',
    icon: CreditCard,
    description: 'Focus on overdue invoices, ACH authorizations, write-downs, and burn'
  },
  {
    id: 'operations',
    title: 'Operations & Infra',
    badge: 'Ops & Engineering',
    icon: Activity,
    description: 'Focus on engineering blockers, deployment velocity, and infrastructure'
  },
  {
    id: 'support',
    title: 'Customer Success',
    badge: 'Support & SLAs',
    icon: Headphones,
    description: 'Focus on tier-3 escalations, SLA alarms, and customer sentiment'
  }
];
