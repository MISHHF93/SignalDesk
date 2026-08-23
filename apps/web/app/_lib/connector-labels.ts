import type { ConnectorDefinition } from "@signaldesk/integrations";

/**
 * The onboarding-facing framing: "where does this live in your business" —
 * each label doubles as the question the Integration Hub's Business Data
 * Map answers per capability class (ADR 0021, superseding the earlier
 * `category`/`purpose` split). A class with zero cataloged connectors
 * today (e.g. `hr`, `psa`) still gets a real label/question here — the
 * type keeps this Record exhaustive over all 22 classes, so a future
 * connector in one of those classes renders correctly with no extra work.
 */
export const capabilityClassLabels: Record<
  ConnectorDefinition["capabilityClasses"][number],
  string
> = {
  identity: "Identity & access",
  crm: "CRM",
  communication: "Communication",
  calendar: "Calendar",
  projects: "Projects",
  tasks: "Tasks",
  time: "Time tracking",
  accounting: "Accounting",
  payments: "Payments",
  documents: "Documents",
  contracts: "Contracts",
  support: "Customer support",
  hr: "HR",
  ats: "Recruiting",
  commerce: "Commerce",
  inventory: "Inventory",
  "field-service": "Field service",
  psa: "Professional services automation",
  rmm: "Remote monitoring & management",
  security: "Security",
  "product-analytics": "Product analytics",
  "data-warehouse": "Data warehouse",
};

export const capabilityClassQuestions: Record<
  ConnectorDefinition["capabilityClasses"][number],
  string
> = {
  identity: "Where does your team sign in and get access?",
  crm: "Where do your leads and deals live?",
  communication: "Where does your team communicate?",
  calendar: "Where do your meetings and schedules live?",
  projects: "Where does client and project work live?",
  tasks: "Where do individual to-dos and action items live?",
  time: "Where do you track hours and time worked?",
  accounting: "Where does your accounting live?",
  payments: "Where are payments processed?",
  documents: "Where do your files and documents live?",
  contracts: "Where do your contracts get signed?",
  support: "Where do customer support conversations live?",
  hr: "Where does your team's HR data live?",
  ats: "Where do you track job candidates?",
  commerce: "Where do your online sales happen?",
  inventory: "Where do you track stock and inventory?",
  "field-service": "Where do you schedule and dispatch field work?",
  psa: "Where do you manage client engagements end to end?",
  rmm: "Where do you monitor and manage client endpoints?",
  security: "Where do you monitor security and vulnerabilities?",
  "product-analytics": "Where do you track how your product is used?",
  "data-warehouse": "Where does your unified business data live?",
};
