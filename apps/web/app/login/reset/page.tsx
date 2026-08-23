import type { Metadata } from "next";

import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ResetPasswordPage() {
  return (
    <main className="shell authShell" id="main-content">
      <section className="authCard" aria-labelledby="reset-heading">
        <p className="sectionKicker">Business command center</p>
        <h1 id="reset-heading">Reset your password</h1>
        <p className="authCopy">
          Enter the email on your account and we&rsquo;ll send a link to set a
          new password.
        </p>
        <ResetRequestForm />
      </section>
    </main>
  );
}
