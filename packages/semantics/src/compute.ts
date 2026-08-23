import type {
  Invoice,
  Lead,
  Payment,
  SourceReference,
  Task,
} from "@signaldesk/domain";

import {
  ACCOUNTS_RECEIVABLE,
  CASH_COLLECTED_RECENT,
  OPEN_TASK_BACKLOG,
  OVERDUE_RECEIVABLE_EXPOSURE,
  PIPELINE_VALUE,
} from "./catalog";
import type {
  MetricDefinition,
  MetricLineageRecord,
  MetricValue,
} from "./types";

interface CurrencyGroup<T> {
  totalCents: number;
  readonly records: T[];
}

/**
 * Groups a currency-bearing record set by currency and sums an amount
 * within each group — the shared engine behind every currency metric
 * below. Never blends currencies: a data set spanning USD and CAD produces
 * two independent groups, never one summed total (see
 * `MetricValue.currency`'s doc comment in `types.ts`).
 *
 * Exported so callers outside this module that need the same real
 * per-currency count+sum (not a full `MetricValue`, e.g. a UI-facing
 * scenario simulation) can reuse this instead of hand-rolling an
 * equivalent loop — closes a real duplicate-arithmetic gap between this
 * function and `invoice-payment-scenario.ts`'s own grouping (issue 7,
 * `docs/25-issue-audit.md`: "Semantic Metric Consistency").
 */
export function groupByCurrency<T>(
  records: readonly T[],
  currencyOf: (record: T) => string,
  amountCentsOf: (record: T) => number,
): ReadonlyMap<string, CurrencyGroup<T>> {
  const groups = new Map<string, CurrencyGroup<T>>();

  for (const record of records) {
    const currency = currencyOf(record);
    const amountCents = amountCentsOf(record);
    const existing = groups.get(currency);

    if (existing) {
      existing.totalCents += amountCents;
      existing.records.push(record);
    } else {
      groups.set(currency, { totalCents: amountCents, records: [record] });
    }
  }

  return groups;
}

function lineageRecordFor(source: SourceReference): MetricLineageRecord {
  return { ...source };
}

function buildCurrencyMetricValues<T>(
  definition: MetricDefinition,
  groups: ReadonlyMap<string, CurrencyGroup<T>>,
  sourceOf: (record: T) => SourceReference,
  now: Date,
): readonly MetricValue[] {
  const values: MetricValue[] = [];

  for (const [currency, group] of groups) {
    const records = group.records.map((record) =>
      lineageRecordFor(sourceOf(record)),
    );
    const sourceSystems = Array.from(
      new Set(records.map((record) => record.system)),
    );

    values.push({
      metricId: definition.id,
      concept: definition.concept,
      value: group.totalCents,
      unit: "currency",
      currency,
      valueKind: definition.valueKind,
      timeGrain: definition.timeGrain,
      asOf: now,
      lineage: {
        formulaId: definition.formulaId,
        formulaVersion: definition.formulaVersion,
        sourceRecordCount: records.length,
        sourceSystems,
        records,
      },
    });
  }

  return values;
}

/** `AccountsReceivable` (Prompt 21) — sum of every open invoice, grouped by currency. */
export function computeAccountsReceivable(
  invoices: readonly Invoice[],
  now: Date,
): readonly MetricValue[] {
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const groups = groupByCurrency(
    openInvoices,
    (invoice) => invoice.currency,
    (invoice) => invoice.amountCents,
  );

  return buildCurrencyMetricValues(
    ACCOUNTS_RECEIVABLE,
    groups,
    (invoice) => invoice.source,
    now,
  );
}

/**
 * `Exposure` (Prompt 21) — sum of every overdue, still-open invoice.
 * Filters defensively even though real callers pass an already-overdue set
 * (`listOverdueInvoices`, `@signaldesk/persistence`): a caller that
 * accidentally passed every invoice should still get a correct exposure
 * number, not a silently inflated one.
 */
export function computeOverdueReceivableExposure(
  overdueInvoices: readonly Invoice[],
  now: Date,
): readonly MetricValue[] {
  const overdue = overdueInvoices.filter(
    (invoice) =>
      invoice.status === "open" && invoice.dueAt.getTime() < now.getTime(),
  );
  const groups = groupByCurrency(
    overdue,
    (invoice) => invoice.currency,
    (invoice) => invoice.amountCents,
  );

  return buildCurrencyMetricValues(
    OVERDUE_RECEIVABLE_EXPOSURE,
    groups,
    (invoice) => invoice.source,
    now,
  );
}

/** `Pipeline` (Prompt 21) — sum of every synced lead's value. */
export function computePipelineValue(
  leads: readonly Lead[],
  now: Date,
): readonly MetricValue[] {
  const groups = groupByCurrency(
    leads,
    (lead) => lead.currency,
    (lead) => lead.valueCents,
  );

  return buildCurrencyMetricValues(
    PIPELINE_VALUE,
    groups,
    (lead) => lead.source,
    now,
  );
}

/** `Cash` (Prompt 21) — sum of every recently observed payment. */
export function computeCashCollectedRecent(
  payments: readonly Payment[],
  now: Date,
): readonly MetricValue[] {
  const groups = groupByCurrency(
    payments,
    (payment) => payment.currency,
    (payment) => payment.amountCents,
  );

  return buildCurrencyMetricValues(
    CASH_COLLECTED_RECENT,
    groups,
    (payment) => payment.source,
    now,
  );
}

/**
 * `Backlog` (Prompt 21) — count of synced tasks not yet marked complete.
 * Returns `null`, not a zero-value `MetricValue`, when no task has synced
 * at all: a guest with no connected task system and a real Asana
 * connection with a genuinely empty backlog must not read the same way.
 * Lineage cites every *considered* task, not just the incomplete subset —
 * "0 records from no connected source" would be exactly as misleading as
 * a fabricated zero, even when a real, fully-caught-up backlog is the
 * true answer.
 */
export function computeOpenTaskBacklog(
  tasks: readonly Task[],
  now: Date,
): MetricValue | null {
  if (tasks.length === 0) {
    return null;
  }

  const incomplete = tasks.filter((task) => !task.completed);
  const records = tasks.map((task) => lineageRecordFor(task.source));
  const sourceSystems = Array.from(
    new Set(records.map((record) => record.system)),
  );

  return {
    metricId: OPEN_TASK_BACKLOG.id,
    concept: OPEN_TASK_BACKLOG.concept,
    value: incomplete.length,
    unit: "count",
    currency: null,
    valueKind: OPEN_TASK_BACKLOG.valueKind,
    timeGrain: OPEN_TASK_BACKLOG.timeGrain,
    asOf: now,
    lineage: {
      formulaId: OPEN_TASK_BACKLOG.formulaId,
      formulaVersion: OPEN_TASK_BACKLOG.formulaVersion,
      sourceRecordCount: records.length,
      sourceSystems,
      records,
    },
  };
}

export interface ComputeBusinessMetricsInput {
  readonly now: Date;
  readonly allInvoices: readonly Invoice[];
  readonly overdueInvoices: readonly Invoice[];
  readonly leads: readonly Lead[];
  readonly recentPayments: readonly Payment[];
  readonly tasks: readonly Task[];
}

/**
 * Computes every real catalog metric this package defines, from data the
 * caller has already fetched — this function does no I/O itself, matching
 * `assembleBusinessSnapshot`'s own "assembly is pure, orchestration lives
 * in the caller" precedent (`@signaldesk/application`).
 */
export function computeBusinessMetrics(
  input: ComputeBusinessMetricsInput,
): readonly MetricValue[] {
  const backlog = computeOpenTaskBacklog(input.tasks, input.now);

  return [
    ...computeAccountsReceivable(input.allInvoices, input.now),
    ...computeOverdueReceivableExposure(input.overdueInvoices, input.now),
    ...computePipelineValue(input.leads, input.now),
    ...computeCashCollectedRecent(input.recentPayments, input.now),
    ...(backlog ? [backlog] : []),
  ];
}
