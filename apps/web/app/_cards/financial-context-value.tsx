import { EXPOSURE_TYPE_LABEL } from "@signaldesk/domain";
import type { FinancialContext } from "@signaldesk/schemas";

import { formatCardCurrency } from "./format";

/**
 * The `.leadValue` dollar-figure block, shared by every card whose finding
 * carries a `financialContext` — previously hand-duplicated identically in
 * four card files. Also surfaces `exposureType` (via `domain`'s own
 * `EXPOSURE_TYPE_LABEL`, not a new field): every capability that sets
 * `financialContext` already classifies its number as confirmed, outstanding,
 * at-risk, or potential — this was real, already-computed data that the UI
 * never showed before now, not something invented for this component.
 */
export function FinancialContextValue({
  financialContext,
}: {
  readonly financialContext: FinancialContext;
}) {
  return (
    <div className="leadValue">
      <span>{financialContext.label}</span>
      <strong>
        {formatCardCurrency(
          financialContext.amountCents,
          financialContext.currency,
        )}
      </strong>
      <span className="leadValueCertainty">
        {EXPOSURE_TYPE_LABEL[financialContext.exposureType]}
      </span>
    </div>
  );
}
