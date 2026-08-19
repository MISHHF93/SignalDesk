/**
 * Only ever redirect somewhere inside this app. Rejects protocol-relative
 * URLs ("//evil.example") and backslash variants ("/\evil.example" or
 * "/\/evil.example") — browsers normalize a leading backslash to a forward
 * slash when resolving a relative reference (WHATWG URL spec), so
 * "/\evil.example" resolves identically to "//evil.example": an off-origin
 * navigation. A bare "starts with / and not //" check misses this.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.includes("\\")) {
    return "/";
  }

  return value;
}
