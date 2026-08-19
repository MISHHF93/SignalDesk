import type { ConnectorDefinition } from "@signaldesk/integrations";

export const categoryLabels: Record<ConnectorDefinition["category"], string> = {
  communication: "Communication",
  crm: "CRM",
  email: "Email",
  payments: "Payments",
  accounting: "Accounting",
  calendar: "Calendar",
  "project-management": "Project management",
};

/**
 * The onboarding-facing framing: "where does this live in your business,"
 * not the technical category above. Each label doubles as the question the
 * Integration Hub's Business Data Map answers per purpose.
 */
export const purposeLabels: Record<ConnectorDefinition["purpose"], string> = {
  pipeline: "Pipeline",
  communication: "Communication",
  delivery: "Delivery",
  calendar: "Calendar",
  finance: "Finance",
  payments: "Payments",
};

export const purposeQuestions: Record<ConnectorDefinition["purpose"], string> =
  {
    pipeline: "Where do your leads and deals live?",
    communication: "Where does your team communicate?",
    delivery: "Where does client work live?",
    calendar: "Where do your meetings and schedules live?",
    finance: "Where does your accounting live?",
    payments: "Where are payments processed?",
  };
