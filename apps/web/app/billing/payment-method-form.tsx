"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState, useTransition, type FormEvent } from "react";

import type { StartPaymentMethodSetupResult } from "../_actions/start-payment-method-setup";
import { Button } from "../_components/button";

export function PaymentMethodForm({
  startSetupAction,
}: {
  readonly startSetupAction: () => Promise<StartPaymentMethodSetupResult>;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  function handleStart() {
    startTransition(async () => {
      const outcome = await startSetupAction();

      if (outcome.ok) {
        setClientSecret(outcome.clientSecret);
        setError(null);
      } else {
        setError(outcome.error);
      }
    });
  }

  if (clientSecret && publishableKey) {
    return (
      <Elements stripe={loadStripe(publishableKey)} options={{ clientSecret }}>
        <SetupForm />
      </Elements>
    );
  }

  return (
    <div className="checkoutForm">
      <Button
        variant="secondary"
        type="button"
        onClick={handleStart}
        disabled={isPending}
      >
        {isPending ? "Preparing…" : "Add or update payment method"}
      </Button>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SetupForm() {
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

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/payment-method/return`,
      },
    });

    // A successful confirmation navigates the browser to `return_url`
    // itself — this only runs when confirmation failed outright.
    if (confirmError) {
      setError(confirmError.message ?? "Couldn't save that card. Try another.");
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
        {submitting ? "Saving…" : "Save payment method"}
      </Button>
    </form>
  );
}
