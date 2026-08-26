import type { DraftedContent } from "@signaldesk/schemas";

/**
 * A composer-card treatment for a real drafted reply/note/nudge awaiting
 * approval (ADR 0056/0057) — a real email-header-style subject row (only
 * for the connectors whose draft is email-shaped; a comment/note draft has
 * none) above a monospace-adjacent body, upgrading the previous plain
 * blockquote without fabricating a before/after diff no real data backs
 * (every one of today's 5 draft-then-approve action types drafts net-new
 * content, never an edit to something that already existed).
 */
export function DraftedContentPreview({
  draftedContent,
}: {
  readonly draftedContent: DraftedContent;
}) {
  return (
    <div className="draftedContentPreview">
      {draftedContent.subject ? (
        <div className="draftedContentHeader">
          <span className="draftedContentHeaderLabel">Subject</span>
          <span className="draftedContentHeaderValue">
            {draftedContent.subject}
          </span>
        </div>
      ) : null}
      <p className="draftedContentBody">{draftedContent.body}</p>
    </div>
  );
}
