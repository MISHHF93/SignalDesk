import { createHash, randomUUID } from "node:crypto";

import type {
  GmailMessage,
  GmailMessageHeader,
  GmailMessagePart,
} from "./client";

/**
 * Maps a real Gmail message onto the shape `parseSourceMessageRecord`
 * (`@signaldesk/schemas`) expects. Deliberately returns a plain
 * `unknown`-shaped object (or `null` — see below), matching
 * `mapHubSpotDealToSourceLeadRecord`'s "runtime validation stays at the
 * real boundary" rule.
 *
 * Returns `null`, not a fabricated record, for two honest reasons: (1)
 * the message has no usable From/To/Cc address at all — nothing to
 * attribute direction/counterparty to; (2) every participant shares the
 * connected account's own email domain — this is the "external-
 * correspondence only" bound (Phase 4b, implementation roadmap): a
 * purely internal email carries no customer-facing signal worth
 * ingesting. `syncGmailMessages` (apps/web/app/_lib/sync-gmail.ts) treats
 * either case as a filtered-out message, not a validation failure.
 *
 * Address parsing is a real, disclosed simplification, not full RFC 5322
 * parsing — splits `To`/`Cc` on commas and extracts `Name <email>` or a
 * bare address. Real-world edge cases (a quoted display name containing
 * a literal comma) would misparse; acceptable for a first slice, not
 * claimed as fully compliant.
 */

function getHeaderValue(
  headers: readonly GmailMessageHeader[],
  name: string,
): string | undefined {
  return headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

interface ParsedAddress {
  readonly email: string;
  readonly name: string | null;
}

function parseAddresses(
  headerValue: string | undefined,
): readonly ParsedAddress[] {
  if (!headerValue) {
    return [];
  }

  return headerValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): ParsedAddress | null => {
      const angleMatch = part.match(/<([^>]+)>/);

      if (angleMatch?.[1]) {
        const email = angleMatch[1].trim().toLowerCase();
        const name =
          part.slice(0, part.indexOf("<")).trim().replace(/^"|"$/g, "") || null;
        return email.includes("@") ? { email, name } : null;
      }

      const email = part.toLowerCase();
      return email.includes("@") ? { email, name: null } : null;
    })
    .filter((address): address is ParsedAddress => address !== null);
}

const FALLBACK_SUBJECT = "(no subject)";

export interface MapGmailMessageOptions {
  readonly now: Date;
  /** The connected Gmail account's own address (from
   * `integrations.externalAccountLabel`) — decides both `direction`
   * (from this address = outbound) and the internal-correspondence
   * filter (every participant sharing this address's domain = skip). */
  readonly accountEmail: string;
}

export function mapGmailMessageToSourceMessageRecord(
  message: GmailMessage,
  options: MapGmailMessageOptions,
): unknown | null {
  const headers = message.payload.headers ?? [];
  const fromAddresses = parseAddresses(getHeaderValue(headers, "From"));
  const toAddresses = parseAddresses(getHeaderValue(headers, "To"));
  const ccAddresses = parseAddresses(getHeaderValue(headers, "Cc"));
  const accountEmailLower = options.accountEmail.trim().toLowerCase();
  const accountDomain = accountEmailLower.split("@")[1] ?? "";

  const allParticipants = [...fromAddresses, ...toAddresses, ...ccAddresses];

  if (allParticipants.length === 0) {
    return null;
  }

  const isInternalOnly =
    accountDomain.length > 0 &&
    allParticipants.every(
      (address) => address.email.split("@")[1] === accountDomain,
    );

  if (isInternalOnly) {
    return null;
  }

  const fromIsAccount = fromAddresses.some(
    (address) => address.email === accountEmailLower,
  );
  const direction: "inbound" | "outbound" = fromIsAccount
    ? "outbound"
    : "inbound";

  const counterparty =
    direction === "inbound"
      ? fromAddresses[0]
      : (toAddresses.find((address) => address.email !== accountEmailLower) ??
        toAddresses[0]);

  if (!counterparty) {
    return null;
  }

  const subject =
    getHeaderValue(headers, "Subject")?.trim() || FALLBACK_SUBJECT;
  const internalDateMs = Number(message.internalDate);
  const occurredAt = Number.isFinite(internalDateMs)
    ? new Date(internalDateMs)
    : options.now;

  const recordDigestSha256 = createHash("sha256")
    .update(
      JSON.stringify({
        id: message.id,
        threadId: message.threadId,
        internalDate: message.internalDate,
        headers,
      }),
    )
    .digest("hex");

  return {
    id: randomUUID(),
    externalThreadId: message.threadId,
    direction,
    counterpartyEmail: counterparty.email,
    counterpartyName: counterparty.name,
    subject,
    snippet: message.snippet?.trim() || null,
    occurredAt: occurredAt.toISOString(),
    source: {
      system: "gmail",
      externalRecordId: message.id,
      sourceVersion: message.internalDate,
      recordDigestSha256,
      lastSyncedAt: options.now.toISOString(),
    },
  };
}

const MAX_BODY_PREVIEW_CHARS = 5_000;

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function findPart(
  part: GmailMessagePart,
  mimeType: string,
): GmailMessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }

  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);

    if (found) {
      return found;
    }
  }

  return null;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MessageBodyPreview {
  readonly bodyPreview: string | null;
  readonly bodyTruncated: boolean;
}

/**
 * Deterministically extracts a bounded, plain-text body preview — no AI
 * involved (Phase 4b, implementation roadmap). Prefers a real `text/plain`
 * MIME part; falls back to a naive tag-stripped `text/html` part only
 * when no plain part exists anywhere in the tree. Hard-truncates to
 * `MAX_BODY_PREVIEW_CHARS`, flagging `bodyTruncated` when clipped.
 * Deliberately kept separate from `mapGmailMessageToSourceMessageRecord`
 * — its output is never passed through `sourceMessageRecordSchema`
 * (a `strictObject` that would reject the extra keys), matching the
 * schema's own design: nothing above the ingest boundary ever validates
 * or reads `body_preview`.
 */
export function extractMessageBodyPreview(
  message: GmailMessage,
): MessageBodyPreview {
  const plainPart = findPart(message.payload, "text/plain");
  let text: string | null = null;

  if (plainPart?.body?.data) {
    text = decodeBase64Url(plainPart.body.data);
  } else {
    const htmlPart = findPart(message.payload, "text/html");

    if (htmlPart?.body?.data) {
      text = stripHtmlTags(decodeBase64Url(htmlPart.body.data));
    }
  }

  if (text === null) {
    return { bodyPreview: null, bodyTruncated: false };
  }

  const trimmed = text.trim();

  if (trimmed.length <= MAX_BODY_PREVIEW_CHARS) {
    return { bodyPreview: trimmed || null, bodyTruncated: false };
  }

  return {
    bodyPreview: trimmed.slice(0, MAX_BODY_PREVIEW_CHARS),
    bodyTruncated: true,
  };
}
