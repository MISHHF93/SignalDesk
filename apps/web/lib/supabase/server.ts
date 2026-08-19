import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set. See .env.example.`);
  }

  return value;
}

/**
 * A fresh, per-request Supabase server client. Must be created new on every
 * call rather than module-scoped, since it captures this request's cookie
 * jar (Supabase's SSR guidance). `setAll` is best-effort: Server Components
 * cannot write cookies, and the session is refreshed by `proxy.ts` on every
 * request regardless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render; proxy.ts refreshes
            // the session on every request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
