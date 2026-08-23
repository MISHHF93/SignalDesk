// The root `@modal` parallel slot's fallback — every route that isn't one
// of the intercepted drawers (`(.)tickets/[id]`, `(.)integrations/[slug]`)
// renders no modal at all.
export default function Default() {
  return null;
}
