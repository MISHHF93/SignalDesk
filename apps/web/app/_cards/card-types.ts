import type { IntelligenceCard } from "@business-dashboard/schemas";

import type { CreateInternalTaskAction } from "../_lib/actions";

export interface CardComponentProps {
  readonly card: IntelligenceCard;
  readonly createTaskAction: CreateInternalTaskAction;
}
