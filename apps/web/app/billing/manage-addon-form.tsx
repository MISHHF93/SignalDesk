"use client";

import { useState, useTransition } from "react";

import type { AddonActionState } from "../_actions/manage-addon";
import { Button } from "../_components/button";

interface AddonOption {
  readonly id: string;
  readonly addonKey: string;
  readonly name: string;
  readonly grantsUsers: number;
  readonly grantsActiveConnections: number;
  readonly amountCents: number;
  readonly billingInterval: "month" | "year";
}

interface PurchasedAddon {
  readonly addonKey: string;
  readonly quantity: number;
}

function formatCents(cents: number, interval: "month" | "year"): string {
  const amount = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `${amount}/${interval}`;
}

function describeGrant(addon: AddonOption): string {
  const parts: string[] = [];

  if (addon.grantsActiveConnections > 0) {
    parts.push(`+${addon.grantsActiveConnections} active connections`);
  }

  if (addon.grantsUsers > 0) {
    parts.push(`+${addon.grantsUsers} users`);
  }

  return parts.join(", ");
}

export function ManageAddonForm({
  addons,
  purchased,
  addAction,
  removeAction,
}: {
  readonly addons: readonly AddonOption[];
  readonly purchased: readonly PurchasedAddon[];
  readonly addAction: (addonKey: string) => Promise<AddonActionState>;
  readonly removeAction: (addonKey: string) => Promise<AddonActionState>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(addonKey: string) {
    setError(null);
    setPendingKey(addonKey);
    startTransition(async () => {
      const result = await addAction(addonKey);
      // A successful add redirects the whole page — this only runs on
      // failure.
      setError(result.error);
    });
  }

  function handleRemove(addonKey: string) {
    setError(null);
    setPendingKey(addonKey);
    startTransition(async () => {
      const result = await removeAction(addonKey);
      setError(result.error);
    });
  }

  if (addons.length === 0) {
    return null;
  }

  return (
    <div className="checkoutForm">
      <ul className="pricingLimits">
        {addons.map((addon) => {
          const owned = purchased.find(
            (entry) => entry.addonKey === addon.addonKey,
          );
          const isThisPending = isPending && pendingKey === addon.addonKey;

          return (
            <li key={addon.addonKey}>
              <div>
                <dt>{addon.name}</dt>
                <dd>
                  {describeGrant(addon)} —{" "}
                  {formatCents(addon.amountCents, addon.billingInterval)}
                  {owned ? " — active" : null}
                </dd>
              </div>
              {owned ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => handleRemove(addon.addonKey)}
                  disabled={isPending}
                >
                  {isThisPending ? "Removing…" : "Remove"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => handleAdd(addon.addonKey)}
                  disabled={isPending}
                >
                  {isThisPending ? "Adding…" : "Add"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
