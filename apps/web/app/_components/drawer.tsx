"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The Level-3 "side drawer" shell — any entity's detail view opened from
 * a still-visible, still-mounted list/One-Page behind it (this is meant
 * to render in a route's `@modal` parallel slot, a sibling of `children`,
 * never a replacement for it). Closing always calls `router.back()`
 * rather than a hardcoded href, since it needs to undo exactly the soft
 * navigation that opened it (preserving scroll position/filter state on
 * whatever page opened it) — the same interaction a full page's back
 * button would give, just without ever actually leaving that page.
 *
 * Generalized from the first real consumer (`/integrations`' connector
 * detail drawer) once a second one (ticket detail) made the shared shape
 * obvious — not built speculatively ahead of a second real need.
 */
// Real gap found by review: `summary` is natively focusable/tabbable
// without an explicit `tabindex` (it's the one real focusable element in
// this drawer's actual content that isn't a form control/link — see
// `connector-detail-content.tsx`'s `<details><summary>` implementation-
// gates disclosure). Omitting it meant the trap's computed "last"
// element was actually some earlier control, so Tab from there snapped
// straight back to the close button — leaving the `<summary>` toggle and
// everything after it permanently unreachable by keyboard, even though a
// mouse user could click straight into it.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Drawer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Real focus restoration (WAI-ARIA dialog pattern) — a dialog that
    // moves focus in on open must return it to wherever it came from on
    // close, or a keyboard/screen-reader user is left stranded at
    // whatever DOM position the dialog happened to unmount from. The page
    // behind this drawer stays mounted (see this component's own doc
    // comment), so the element that opened the drawer is still there to
    // restore focus to.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.back();
        return;
      }

      // Real focus trap (WAI-ARIA Authoring Practices' dialog pattern) —
      // this renders over a still-visible, still-mounted page, so without
      // this, Tab/Shift+Tab could walk keyboard focus out of the dialog
      // and into that page behind it.
      if (event.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );

        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [router]);

  return (
    <div className="drawerBackdrop" onClick={() => router.back()}>
      <div
        aria-label={title}
        aria-modal="true"
        className="drawerPanel"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
      >
        <button
          aria-label="Close"
          className="drawerClose"
          onClick={() => router.back()}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="drawerBody">{children}</div>
      </div>
    </div>
  );
}
