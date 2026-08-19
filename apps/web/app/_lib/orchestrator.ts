import {
  createBusinessAIOrchestrator,
  createDeterministicProvider,
} from "@signaldesk/application";

/**
 * The single Business AI Node for this app — everything that touches
 * intelligence findings, dashboard composition, or command-bar
 * interpretation goes through this one instance, never ad hoc logic
 * elsewhere in the web app. The provider is deterministic today; swapping
 * in a model-backed `AIProvider` later only changes this one line.
 */
export const businessAIOrchestrator = createBusinessAIOrchestrator({
  provider: createDeterministicProvider(),
});
