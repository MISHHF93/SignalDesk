import {
  createConsoleErrorReporter,
  type ErrorReporter,
} from "@signaldesk/application";

/**
 * The one error-reporting instance every catch block routes through
 * (`describe-action-error.ts`) — mirrors `agent-fabric.ts`'s own
 * module-scoped singleton pattern for the same reason: one real place to
 * swap the console-based default for a real vendor adapter later
 * (`PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 5), not many.
 */
export const errorReporter: ErrorReporter = createConsoleErrorReporter();
