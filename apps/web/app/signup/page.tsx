import type { Metadata } from "next";

import { safeNextPath } from "../_lib/safe-next-path";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  return (
    <main className="shell authShell" id="main-content">
      <section className="authCard" aria-labelledby="signup-heading">
        <p className="sectionKicker">Business command center</p>
        <h1 id="signup-heading">Create your account</h1>
        <p className="authCopy">
          Signing up automatically provisions one solo organization you own — no
          invite code needed.
        </p>
        <SignupForm next={next} />
      </section>
    </main>
  );
}
