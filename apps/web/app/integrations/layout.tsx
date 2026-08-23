import type { ReactNode } from "react";

/**
 * The `@modal` parallel slot renders the intercepted connector-detail drawer
 * (`@modal/(.)[slug]/page.tsx`) alongside the list page's own `children`
 * whenever a click from `/integrations` opens one — both render
 * simultaneously so the list stays mounted underneath, matching the "the
 * One Page remains visible behind it" requirement rather than replacing it.
 */
export default function IntegrationsLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
