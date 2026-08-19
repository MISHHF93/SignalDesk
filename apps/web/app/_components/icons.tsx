/**
 * Shared icon set. Consolidated here because `LockIcon`/`ShieldIcon` were
 * previously redefined locally in three separate files — same shapes,
 * drift-prone. One stroke weight (1.6) and one visual language (rounded,
 * outline-only) across the app.
 */

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path
        d="M5.5 9V6.5a4.5 4.5 0 0 1 9 0V9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="9"
        width="12"
        height="8"
        rx="1.6"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M12 3 5.5 5.6v5.7c0 4.2 2.7 7.8 6.5 9.7 3.8-1.9 6.5-5.5 6.5-9.7V5.6L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="m8.8 12 2.1 2.1 4.4-4.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
