"use client";

import { useFormStatus } from "react-dom";

/**
 * Real gap found by review: `AccountStatus`'s sign-out button had no
 * pending/disabled state at all, unlike `GuestButton`/`OAuthButtons` —
 * the only two other places in this app that bind a real Server Action
 * directly to a form — leaving it double-clickable while `signOutAction`
 * is in flight. `useFormStatus` (not `useActionState`, which both
 * siblings use) is the right tool here specifically because
 * `signOutAction` returns `void` and takes no `(prevState, formData)`
 * arguments — reshaping its signature just to fit `useActionState` would
 * be a pointless change to a function that has no state to report, only
 * a pending phase. `useFormStatus` must run in a component nested inside
 * the `<form>`, never the component that renders the form itself, which
 * is why this is split out from `account-status.tsx` (a server
 * component) rather than added inline there.
 */
export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="signOutButton" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
