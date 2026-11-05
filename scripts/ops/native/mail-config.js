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
