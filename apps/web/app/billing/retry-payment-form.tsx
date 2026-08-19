"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import type { RetryPaymentState } from "../_actions/retry-subscription-payment";
import { Button } from "../_components/button";

export function RetryPaymentForm({
  retryAction,
}: {
  readonly retryAction: () => Promise<RetryPaymentState>;
}) {
  const [state, setState] = useState<RetryPaymentState>({
    error: null,
    clientSecret: null,
  });
  const [isPending, startTransition] = useTransition();

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  function handleStart() {
    startTransition(async () => {
      setState(await retryAction());
    });
  }

  if (state.clientSecret && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: state.clientSecret }}
      >
        <RetryPaymentElementForm />
      </Elements>
    );
  }

  return (
    <div className="checkoutForm">
      <Button
        variant="primary"
        type="button"
        onClick={handleStart}
        disabled={isPending}
      >
        {isPending ? "Loading…" : "Retry payment"}
      </Button>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function RetryPaymentElementForm() {
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
    // itself — this only runs when confirmation failed outright.
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
