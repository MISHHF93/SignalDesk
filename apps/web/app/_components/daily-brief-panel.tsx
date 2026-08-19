"use client";

import type { Artifact } from "@business-dashboard/persistence";
import Link from "next/link";
import { useState, useTransition } from "react";

import type { GenerateDailyBriefActionResult } from "../_actions/generate-daily-brief";
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
  initialArtifact,
}: {
  readonly generateAction: () => Promise<GenerateDailyBriefActionResult>;
  readonly initialArtifact: Artifact | null;
}) {
  const [artifact, setArtifact] = useState<Artifact | null>(initialArtifact);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
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

  return (
    <section
      className="dailyBriefSection"
      aria-labelledby="daily-brief-heading"
    >
      <div className="sectionHeading">
        <div>
          <p className="sectionKicker">Artifact</p>
          <h2 id="daily-brief-heading">Daily Brief</h2>
        </div>
        <Button
          variant="secondary"
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending
            ? "Generating…"
            : artifact
              ? "Regenerate Daily Brief"
              : "Generate Daily Brief"}
        </Button>
      </div>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}

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
