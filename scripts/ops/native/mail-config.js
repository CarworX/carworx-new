import { canonicalEmail } from "../../../apps/web/app/server/security/recipient-policy.ts";

export function loopbackHttp(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("Native Auth requires loopback HTTP");
  return url;
}

export function nativeMailConfig(config, hookUri) {
  const hook = loopbackHttp(hookUri);
  if (hook.pathname !== "/hook") throw Error("Unexpected native hook path");
  const sections = config.split(/(?=^\[)/m);
  const templates = new Set([
    "[auth.email.template.confirmation]",
    "[auth.email.template.recovery]",
    // Finish-build PR 6: the email-change template. Native parity sends
    // through the loopback hook instead, and covers sign-up and recovery.
    "[auth.email.template.email_change]",
  ]);
  const output = [];
  let changed = false;
  for (const section of sections) {
    const name = section.split(/\r?\n/, 1)[0];
    if (templates.delete(name)) continue;
    if (name === "[auth.hook.send_email]") {
      if (
        !/^enabled = false$/m.test(section) ||
        !/^uri = "env\(LOCAL_AUTH_EMAIL_HOOK_URI\)"$/m.test(section)
      )
        throw Error("Unexpected native hook configuration");
      output.push(
        section
          .replace(/^enabled = false$/m, "enabled = true")
          .replace(/^uri = .*$/m, `uri = "${hook.href}"`),
      );
      changed = true;
    } else {
      output.push(section);
    }
  }
  if (!changed || templates.size > 0)
    throw Error("Native template source configuration missing");
  return output.join("");
}

export function nativeMessage(payload, origin, templates) {
  const site = loopbackHttp(origin);
  const address = canonicalEmail(payload?.user?.email);
  const action = payload?.email_data?.email_action_type;
  const token = payload?.email_data?.token_hash;
  if (
    site.origin !== origin ||
    !address?.endsWith("@example.test") ||
    !["signup", "recovery"].includes(action) ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{8,256}$/.test(token)
  )
    throw Error("Unsupported native email");
  const template =
    action === "signup" ? templates.confirmation : templates.recovery;
  if (
    !template.includes("{{ .SiteURL }}") ||
    !template.includes("{{ .TokenHash }}")
  )
    throw Error("Native template is incompatible");
  const HTML = template
    .replaceAll("{{ .SiteURL }}", site.origin)
    .replaceAll("{{ .TokenHash }}", token);
  if (HTML.includes("{{")) throw Error("Unresolved native template");
  return {
    From: { Email: "carworx@example.test" },
    To: [{ Email: address }],
    Subject: action === "signup" ? "Confirm your email" : "Reset your password",
    HTML,
  };
}

/**
 * Every message one hook call sends (finish-build PR 6). Sign-up and
 * recovery send one; an email change (double_confirm_changes) sends two:
 * one to the current address and one to the new address, each with its own
 * token hash. Both addresses must be synthetic, as for nativeMessage.
 */
export function nativeMessages(payload, origin, templates) {
  if (payload?.email_data?.email_action_type !== "email_change")
    return [nativeMessage(payload, origin, templates)];
  const site = loopbackHttp(origin);
  const current = canonicalEmail(payload?.user?.email);
  const next = canonicalEmail(payload?.user?.new_email);
  const tokens = [
    payload?.email_data?.token_hash_new,
    payload?.email_data?.token_hash,
  ];
  const template = templates.email_change;
  if (
    site.origin !== origin ||
    !current?.endsWith("@example.test") ||
    !next?.endsWith("@example.test") ||
    current === next ||
    !tokens.every(
      (t) => typeof t === "string" && /^[A-Za-z0-9_-]{8,256}$/.test(t),
    ) ||
    tokens[0] === tokens[1] ||
    typeof template !== "string" ||
    !template.includes("{{ .TokenHash }}")
  )
    throw Error("Unsupported native email");
  // token_hash_new goes to the current address and token_hash to the new
  // one (GoTrue's secure email change). Both links are needed either way.
  return [
    [current, tokens[0]],
    [next, tokens[1]],
  ].map(([address, token]) => {
    const HTML = template
      .replaceAll("{{ .SiteURL }}", site.origin)
      .replaceAll("{{ .TokenHash }}", token)
      .replaceAll("{{ .NewEmail }}", next);
    if (HTML.includes("{{")) throw Error("Unresolved native template");
    return {
      From: { Email: "carworx@example.test" },
      To: [{ Email: address }],
      Subject: "Confirm the change to your email",
      HTML,
    };
  });
}
