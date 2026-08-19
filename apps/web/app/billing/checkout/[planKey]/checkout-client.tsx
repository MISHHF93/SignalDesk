"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useMemo, useState, type FormEvent } from "react";
import { useActionState } from "react";

import {
  startCheckoutAction,
  type StartCheckoutState,
} from "../../../_actions/start-checkout";
import { Button } from "../../../_components/button";

const INITIAL_STATE: StartCheckoutState = { error: null, clientSecret: null };

export function CheckoutClient({
  planKey,
  billingInterval,
  promoKey,
  showTrialOption,
}: {
  readonly planKey: string;
  readonly billingInterval: "month" | "year";
  readonly promoKey: string | null;
  readonly showTrialOption: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    startCheckoutAction,
    INITIAL_STATE,
  );

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (state.clientSecret && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: state.clientSecret }}
      >
        <PaymentForm />
      </Elements>
    );
  }

  return (
    <>
      {showTrialOption ? (
        <form action={formAction} className="checkoutForm">
          <input type="hidden" name="planKey" value={planKey} />
          <input type="hidden" name="billingInterval" value={billingInterval} />
          {promoKey ? (
            <input type="hidden" name="promoKey" value={promoKey} />
          ) : null}
          <input type="hidden" name="mode" value="trial" />
          <Button variant="primary" type="submit" disabled={isPending}>
            {isPending ? "Starting trial…" : "Start your 14-day free trial"}
          </Button>
          <p className="checkoutHint">No card required.</p>
        </form>
      ) : null}

      <form action={formAction} className="checkoutForm">
        <input type="hidden" name="planKey" value={planKey} />
        <input type="hidden" name="billingInterval" value={billingInterval} />
        {promoKey ? (
          <input type="hidden" name="promoKey" value={promoKey} />
        ) : null}
        <input type="hidden" name="mode" value="pay-now" />
        <Button
          variant={showTrialOption ? "secondary" : "primary"}
          type="submit"
          disabled={isPending}
        >
          {isPending
            ? "Preparing checkout…"
            : showTrialOption
              ? "Skip the trial — subscribe now"
              : "Continue to payment"}
        </Button>
      </form>

      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/checkout/return`,
      },
    });

    // A successful confirmation navigates the browser to `return_url`
    // itself — this only runs when confirmation failed outright (e.g. a
    // declined card) and execution returns here instead.
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Try another card.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="checkoutForm">
      <PaymentElement />
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="primary" type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Subscribe"}
      </Button>
    </form>
  );
}
