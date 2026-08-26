import { getSourceSystemLabel } from "@signaldesk/integrations";
import type { IntelligenceCard } from "@signaldesk/schemas";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  CreateInternalTaskAction,
  RecordCardFeedbackAction,
} from "../_lib/actions";
import {
  CARD_FRESHNESS_LABELS,
  CARD_SEVERITY_LABELS,
} from "../_lib/visual-state";
import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { FinancialContextValue } from "./financial-context-value";
import { formatRelativeTime } from "./format";

export function CardBadges({ card }: { card: IntelligenceCard }) {
  const relatedCount = card.relatedFindingIds?.length ?? 0;

  return (
    <div className="badgeRow">
      <span className="priorityBadge" data-severity={card.severity}>
        {CARD_SEVERITY_LABELS[card.severity]}
      </span>
      <span className="objectBadge">{card.type.replace(/_/g, " ")}</span>
      {relatedCount > 0 ? (
        <span
          className="relatedBadge"
          title={`${relatedCount} other item${relatedCount === 1 ? "" : "s"} on this page mention the same customer — may describe the same real situation, not necessarily duplicates.`}
        >
          +{relatedCount} related
        </span>
      ) : null}
    </div>
  );
}

/**
 * The universal "Why am I seeing this?" interaction: every field here is
 * sourced from the card's real `explanation`/`sources`/`freshness` data,
 * never template filler (see README's explainability requirement).
 */
export function WhyDisclosure({ card }: { card: IntelligenceCard }) {
  return (
    <details className="evidenceDetails">
      <summary>Why am I seeing this?</summary>
      <div className="evidencePanel">
        <dl>
          <div>
            <dt>Trigger</dt>
            <dd>{card.explanation.trigger}</dd>
          </div>
          {card.explanation.observedValue ? (
            <div>
              <dt>Observed</dt>
              <dd>{card.explanation.observedValue}</dd>
            </div>
          ) : null}
          {card.explanation.expectedBaseline ? (
            <div>
              <dt>Baseline</dt>
              <dd>{card.explanation.expectedBaseline}</dd>
            </div>
          ) : null}
          <div>
            <dt>Confidence</dt>
            <dd>{card.explanation.confidence}</dd>
          </div>
        </dl>

        {card.sources.length > 0 ? (
          <>
            <h4>Source evidence</h4>
            <ul>
              {Array.from(
                card.sources
                  .reduce((bySystem, source) => {
                    const label = getSourceSystemLabel(source.system);
                    bySystem.set(label, (bySystem.get(label) ?? 0) + 1);
                    return bySystem;
                  }, new Map<string, number>())
                  .entries(),
              ).map(([label, recordCount]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>
                    {recordCount} record{recordCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No source record backs this card; it reflects catalog metadata.</p>
        )}

        <p>
          {CARD_FRESHNESS_LABELS[card.freshness.status]} · synced{" "}
          {formatRelativeTime(card.freshness.asOf, new Date())}
        </p>
      </div>
    </details>
  );
}

/**
 * The `<article className="attentionCard dynamicCard">` scaffold —
 * previously hand-copied into 9 of 11 card files (badges, title, optional
 * financial figure, summary, optional owner/assignee line, footer with
 * `WhyDisclosure`/`CardActions`, optional feedback buttons). The two real
 * structural outliers (`IntegrationHealthCard`, `UnknownCard`) stay outside
 * this shell rather than being forced to fit it.
 *
 * `financialContext`/`owner` render straight from `card` (every card already
 * carries them) — a card that genuinely has neither (e.g. a count-unit goal
 * with no dollar figure) simply renders nothing extra, with zero props
 * needed for that. `createTaskAction`/`recordCardFeedbackAction` are
 * deliberately optional here even though `CreateInternalTaskAction` is
 * required on `CardComponentProps`: `AgentRecommendationCard` is the one
 * caller that omits `createTaskAction` on purpose (its own Approve/Dismiss
 * controls replace `CardActions`, passed in via `footerActions` instead) —
 * "pass it if you want it" avoids a second boolean flag for the same
 * decision.
 */
export function CardShell({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  titleHref,
  ownerLabel,
  afterSummary,
  footerActions,
}: {
  readonly card: IntelligenceCard;
  readonly createTaskAction?: CreateInternalTaskAction;
  readonly recordCardFeedbackAction?: RecordCardFeedbackAction;
  /** When set, the title links here (e.g. `TicketRiskCard`'s
   * `/tickets/{id}` drawer route) instead of rendering as plain text. */
  readonly titleHref?: string;
  /** e.g. "Owner", "Assignee" — the owner/assignee line only renders when
   * both this and `card.owner` are set, since not every card type that has
   * an owner wants this line shown (and vice versa is never real: a card
   * with no `card.owner` has nothing to show regardless). */
  readonly ownerLabel?: string;
  /** Extra content between the owner line and the footer — e.g.
   * `InvoiceRiskCard`'s payment-simulation control. */
  readonly afterSummary?: ReactNode;
  /** Extra footer content, rendered after `CardActions` (or in its place
   * when `createTaskAction` is omitted) — e.g. a "Draft X" button, or
   * `AgentRecommendationCard`'s whole Approve/Dismiss control group. */
  readonly footerActions?: ReactNode;
}) {
  return (
    <article
      className="attentionCard dynamicCard"
      data-severity={card.severity}
      aria-label={card.title}
    >
      <div className="priorityRail" aria-hidden="true" />
      <div className="attentionMain">
        <div className="attentionHeader">
          <div>
            <CardBadges card={card} />
            {titleHref ? (
              <h3>
                <Link href={titleHref}>{card.title}</Link>
              </h3>
            ) : (
              <h3>{card.title}</h3>
            )}
          </div>
          {card.financialContext ? (
            <FinancialContextValue financialContext={card.financialContext} />
          ) : null}
        </div>
        <p>{card.summary}</p>
        {ownerLabel && card.owner ? (
          <p className="contactName">
            {ownerLabel}: {card.owner.name}
          </p>
        ) : null}
        {afterSummary}
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          {createTaskAction ? (
            <CardActions card={card} createTaskAction={createTaskAction} />
          ) : null}
          {footerActions}
        </div>
        {recordCardFeedbackAction ? (
          <CardFeedbackButtons
            card={card}
            recordCardFeedbackAction={recordCardFeedbackAction}
          />
        ) : null}
      </div>
    </article>
  );
}
