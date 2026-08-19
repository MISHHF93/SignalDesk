import { headers } from "next/headers";

/**
 * The current request's real origin, for Server Components — unlike a
 * Server Action (invoked via a form POST, which reliably carries a real
 * `Origin` header), a plain page-load GET request often has no `Origin`
 * header at all, so this is built from `host` + `x-forwarded-proto`
 * instead (the standard reverse-proxy convention Vercel and most hosts
 * set). Falls back to `http` only for an actual localhost/127.0.0.1 host,
 * since a real deployment is never plain HTTP.
 */
export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");

  return `${protocol}://${host}`;
}
