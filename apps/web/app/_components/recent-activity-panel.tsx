import { formatEventType, formatRelativeTime } from "../_cards/format";
import type { SnapshotRecentAction } from "../_lib/use-business-snapshot";

/**
 * The command center's real activity feed — `recentActions` (backed by
 * `listRecentAuditEvents`) has been fetched into every `BusinessSnapshot`
 * poll since Phase 2 of the implementation roadmap, but nothing ever
 * rendered it: `CommandCenterBoard` only ever read `.cards` off the
 * polled snapshot (found in a dead-code/wiring audit this session, same
 * bug class as the `ownership_gap` finding and `internal_cost_events`
 * both were before being wired up). Client-rendered, not server-rendered
 * on first paint, since the source data only exists on
 * `BusinessSnapshot` (the polled shape), not `getTodaysAttention`'s
 * narrower server-rendered result — the same "empty until the first poll
 * lands" tradeoff `CommandCenterBoard` already accepts for
 * `deterministicCards`.
 *
 * Renders nothing when there is no real activity yet — matching this
 * app's "no fabricated data" rule rather than showing an empty list.
 */
export function RecentActivityPanel({
  recentActions,
  now,
}: {
  readonly recentActions: readonly SnapshotRecentAction[];
  readonly now: Date;
}) {
  if (recentActions.length === 0) {
    return null;
  }

  return (
    <section
      className="metricsSection recentActivitySection"
      aria-labelledby="recent-activity-heading"
    >
      <p className="sectionKicker" id="recent-activity-heading">
        Recent activity
      </p>
      <dl className="settingsList">
        {recentActions.map((action, index) => (
          <div key={`${action.eventType}:${action.occurredAt}:${index}`}>
            <dt>
              {formatEventType(action.eventType)}
              {action.outcome !== "succeeded"
                ? ` (${formatEventType(action.outcome)})`
                : ""}
            </dt>
            <dd>{formatRelativeTime(new Date(action.occurredAt), now)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
