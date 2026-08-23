"use client";

import type { Artifact } from "@signaldesk/persistence";
import Link from "next/link";
import { useState, useTransition } from "react";

import type { EmailDailyBriefActionResult } from "../_actions/email-daily-brief";
import type { GenerateDailyBriefActionResult } from "../_actions/generate-daily-brief";
import type { GenerateSinceYouLeftBriefActionResult } from "../_actions/generate-since-you-left-brief";
import { Button } from "./button";

function formatGeneratedAt(generatedAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(generatedAt);
}

export function DailyBriefPanel({
  generateAction,
  generateSinceYouLeftAction,
  emailAction,
  canEmailBrief,
  initialArtifact,
}: {
  readonly generateAction: () => Promise<GenerateDailyBriefActionResult>;
  readonly generateSinceYouLeftAction: () => Promise<GenerateSinceYouLeftBriefActionResult>;
  readonly emailAction: () => Promise<EmailDailyBriefActionResult>;
  readonly canEmailBrief: boolean;
  readonly initialArtifact: Artifact | null;
}) {
  const [artifact, setArtifact] = useState<Artifact | null>(initialArtifact);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<
    "daily_brief" | "since_you_left" | "email" | null
  >(null);

  function handleGenerate() {
    setPendingKind("daily_brief");
    setEmailStatus(null);
    startTransition(async () => {
      const outcome = await generateAction();

      if (outcome.ok) {
        setArtifact(outcome.artifact);
        setError(null);
      } else {
        setError(outcome.error);
      }
    });
  }

  function handleEmail() {
    setPendingKind("email");
    setEmailStatus(null);
    startTransition(async () => {
      const outcome = await emailAction();

      if (outcome.ok) {
        setEmailStatus(`Sent to ${outcome.sentTo}.`);
        setError(null);
      } else {
        setError(outcome.error);
      }
    });
  }

  function handleGenerateSinceYouLeft() {
    setPendingKind("since_you_left");
    setEmailStatus(null);
    startTransition(async () => {
      const outcome = await generateSinceYouLeftAction();

      if (outcome.ok) {
        setArtifact(outcome.artifact);
        setError(null);
      } else {
        setError(outcome.error);
      }
    });
  }

  return (
    <section
      className="dailyBriefSection"
      aria-labelledby="daily-brief-heading"
    >
      <div className="sectionHeading">
        <div>
          <p className="sectionKicker">Summary</p>
          <h2 id="daily-brief-heading">Daily Brief</h2>
        </div>
        <div className="dailyBriefActions">
          <Button
            variant="ghost"
            type="button"
            onClick={handleGenerateSinceYouLeft}
            disabled={isPending}
          >
            {isPending && pendingKind === "since_you_left"
              ? "Comparing…"
              : "Since you left"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending && pendingKind === "daily_brief"
              ? "Generating…"
              : artifact
                ? "Regenerate Daily Brief"
                : "Generate Daily Brief"}
          </Button>
          {canEmailBrief && artifact ? (
            <Button
              variant="ghost"
              type="button"
              onClick={handleEmail}
              disabled={isPending}
            >
              {isPending && pendingKind === "email"
                ? "Sending…"
                : "Email me this brief"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}

      {emailStatus ? <p className="dailyBriefMeta">{emailStatus}</p> : null}

      {artifact ? (
        <article className="dailyBriefCard">
          <h3>{artifact.title}</h3>
          <pre className="dailyBriefContent">{artifact.content}</pre>
          <p className="dailyBriefMeta">
            Built from {artifact.sourceFindingIds.length} real finding
            {artifact.sourceFindingIds.length === 1 ? "" : "s"} — generated{" "}
            {formatGeneratedAt(artifact.generatedAt)}. Deterministic assembly of
            your real data, not AI-generated prose.{" "}
            <Link href="/briefs">View past briefs</Link>
          </p>
        </article>
      ) : (
        <p className="dailyBriefMeta">
          No brief generated yet today — click Generate to build one from your
          current findings. <Link href="/briefs">View past briefs</Link>
        </p>
      )}
    </section>
  );
}
