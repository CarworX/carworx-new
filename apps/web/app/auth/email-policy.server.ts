import type { ServerConfig } from "../server/security/config";
import {
  canonicalEmail,
  loopbackOrigin,
} from "../server/security/recipient-policy";

export type EmailDecision = "allow" | "acknowledge" | "unavailable";

export function emailDecision(
  request: Request,
  config: ServerConfig,
  recipient: string,
): EmailDecision {
  if (new URL(request.url).origin !== config.appOrigin) return "unavailable";
  if (config.environment === "local") {
    // A hosted Worker cannot enter this branch by spoofing Origin or a mode header.
    return loopbackOrigin(request.url) &&
      loopbackOrigin(config.appOrigin) &&
      loopbackOrigin(config.supabaseUrl)
      ? "allow"
      : "unavailable";
  }
  if (
    config.environment !== "staging" ||
    !config.appOrigin.startsWith("https:") ||
    config.approvedRecipients === null
  )
    return "unavailable";
  const email = canonicalEmail(recipient);
  return email !== null && config.approvedRecipients.has(email)
    ? "allow"
    : "acknowledge";
}
