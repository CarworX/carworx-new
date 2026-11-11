import { spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";

/**
 * Integration harness (T3/T5). Requests go to the PRODUCTION BUILD of the
 * Worker (build/server/index.js, the same module Cloudflare runs), called
 * in Node through its `fetch` export: real routing, real loaders/actions,
 * the real T5 boundary and real Set-Cookie headers. The Worker talks to the
 * local Supabase stack; email goes to the stack's Mailpit sink.
 *
 * Every identity is synthetic (`…@example.test`, random per test).
 */
export const APP = "http://localhost:5173";

export const stack = inject("stack");

interface Worker {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
}

let worker: Promise<Worker> | undefined;
function loadWorker(): Promise<Worker> {
  worker ??= import(
    pathToFileURL(
      join(import.meta.dirname, "..", "build", "server", "index.js"),
    ).href
  ).then((m: { default: Worker }) => m.default);
  return worker;
}

export const workerEnv = {
  APP_ORIGIN: APP,
  SUPABASE_URL: stack.apiUrl,
  SUPABASE_PUBLISHABLE_KEY: stack.anonKey,
};

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

export interface Reply {
  status: number;
  headers: Headers;
  setCookies: string[];
  location: string | null;
  body: string;
}

/** A browser stand-in: a cookie jar plus the headers a browser would send. */
export class Browser {
  readonly jar = new Map<string, string>();
  constructor(
    readonly env: typeof workerEnv & Record<string, string> = workerEnv,
  ) {}

  cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  csrf(): string {
    const token = this.jar.get("__Host-cx-csrf");
    if (token === undefined)
      throw new Error("no CSRF cookie yet; GET a page first");
    return token;
  }

  async send(
    path: string,
    init: {
      method?: string;
      form?: Record<string, string | string[]>;
      headers?: Record<string, string>;
      origin?: string | null;
      csrf?: boolean;
      jar?: boolean;
    } = {},
  ): Promise<Reply> {
    const method = init.method ?? (init.form ? "POST" : "GET");
    const headers = new Headers(init.headers);
    if (init.jar !== false && this.jar.size > 0)
      headers.set("Cookie", this.cookieHeader());
    let body: string | undefined;
    if (init.form !== undefined) {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(init.form))
        for (const item of Array.isArray(value) ? value : [value])
          form.append(key, item);
      if (init.csrf !== false && !form.has("csrf"))
        form.set("csrf", this.csrf());
      body = form.toString();
      headers.set("Content-Type", "application/x-www-form-urlencoded");
    }
    if (method !== "GET" && init.origin !== null && !headers.has("Origin")) {
      headers.set("Origin", init.origin ?? this.env.APP_ORIGIN);
    }
    const request = new Request(new URL(path, this.env.APP_ORIGIN), {
      method,
      headers,
      body,
    });
    const response = await (await loadWorker()).fetch(request, this.env, ctx);
    const setCookies = response.headers.getSetCookie();
    for (const header of setCookies) {
      const [pair = ""] = header.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = decodeURIComponent(pair.slice(eq + 1).trim());
      if (/;\s*max-age=0(?:;|$)/i.test(header) || value === "")
        this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return {
      status: response.status,
      headers: response.headers,
      setCookies,
      location: response.headers.get("Location"),
      body: await response.text(),
    };
  }

  /** The session stored in the HttpOnly cookie(s), decoded the way @supabase/ssr stores it. */
  session(): { access_token: string; refresh_token: string } {
    const whole = this.jar.get("__Host-cx-auth");
    let raw = whole;
    if (raw === undefined) {
      const parts: string[] = [];
      for (let i = 0; this.jar.has(`__Host-cx-auth.${String(i)}`); i++) {
        parts.push(this.jar.get(`__Host-cx-auth.${String(i)}`) ?? "");
      }
      raw = parts.join("");
    }
    if (!raw.startsWith("base64-")) throw new Error("no session cookie");
    return JSON.parse(
      Buffer.from(raw.slice(7), "base64url").toString("utf8"),
    ) as {
      access_token: string;
      refresh_token: string;
    };
  }

  sessionCookieNames(): string[] {
    return [...this.jar.keys()].filter((k) =>
      /^__Host-cx-auth(\.\d+)?$/.test(k),
    );
  }
}

export function jwtClaims(token: string): Record<string, unknown> {
  const [, payload = ""] = token.split(".");
  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

// --- Synthetic data, as the server would see it -------------------------------

export const admin = createClient(stack.apiUrl, stack.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function syntheticEmail(label: string): string {
  return `t3-${label}-${randomUUID().slice(0, 8)}@example.test`;
}

// Built at run time: a synthetic password, never a literal in the repo.
export const PASSWORD = `synthetic-${randomUUID()}`;

export async function createConfirmedUser(
  label: string,
  extra: { user_metadata?: Record<string, unknown> } = {},
): Promise<{ id: string; email: string }> {
  const email = syntheticEmail(label);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: extra.user_metadata,
  });
  if (error !== null) throw new Error(`createUser failed: ${error.message}`);
  return { id: data.user.id, email };
}

export async function createOrganisation(name: string): Promise<string> {
  const { data, error } = await admin
    .from("organisations")
    .insert({ name: `${name} (synthetic)` })
    .select("id")
    .single<{ id: string }>();
  if (error !== null)
    throw new Error(`insert organisation failed: ${error.message}`);
  return data.id;
}

export async function setMembership(
  organisationId: string,
  userId: string,
  status: "active" | "revoked",
): Promise<void> {
  const { error } = await admin.from("memberships").upsert(
    {
      organisation_id: organisationId,
      user_id: userId,
      role: "staff",
      status,
    },
    { onConflict: "organisation_id,user_id" },
  );
  if (error !== null)
    throw new Error(`membership upsert failed: ${error.message}`);
}

/** Runs SQL as the database owner (private schema is not reachable over the API). */
export function sql(statement: string): void {
  sqlRows(statement);
}

/** Like sql(), returning each output row (unaligned, tuples only). */
export function sqlRows(statement: string): string[] {
  const args = [
    "-X",
    "-q",
    "-t",
    "-A",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    statement,
  ];
  const host = spawnSync("psql", ["--version"], { encoding: "utf8" });
  let result;
  if (host.status === 0) {
    result = spawnSync("psql", [...args, stack.dbUrl], { encoding: "utf8" });
  } else {
    const config = readFileSync(
      join(stack.root, "supabase", "config.toml"),
      "utf8",
    );
    const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1] ?? "";
    const inner = new URL(stack.dbUrl);
    inner.hostname = "127.0.0.1";
    inner.port = "5432";
    result = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${projectId}`,
        "psql",
        ...args,
        inner.toString(),
      ],
      { encoding: "utf8" },
    );
  }
  // The URL carries the local stack's password: never print it.
  if (result.status !== 0) throw new Error("psql statement failed");
  return result.stdout.split("\n").filter((line) => line !== "");
}

export function makePlatformAdmin(userId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("bad id");
  sql(`insert into private.platform_admins (user_id) values ('${userId}')`);
}

/** A PostgREST client acting with a given user access token (the database API boundary). */
export function asUser(accessToken: string) {
  return createClient(stack.apiUrl, stack.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// --- Mail sink (Mailpit) --------------------------------------------------------

interface MailSummary {
  ID: string;
}

export async function mailTo(
  address: string,
  count = 1,
  timeoutMs = 15000,
): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const search = await fetch(
      `${stack.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    );
    if (search.ok) {
      const found = (await search.json()) as { messages?: MailSummary[] };
      const messages = found.messages ?? [];
      if (messages.length >= count) {
        const bodies: string[] = [];
        for (const message of messages) {
          const full = await fetch(
            `${stack.mailUrl}/api/v1/message/${message.ID}`,
          );
          const parsed = (await full.json()) as {
            HTML?: string;
            Text?: string;
          };
          bodies.push(`${parsed.HTML ?? ""}\n${parsed.Text ?? ""}`);
        }
        return bodies;
      }
    }
    if (Date.now() > deadline) throw new Error("expected email did not arrive");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** The app path of the /auth/confirm link in an email body. */
export function confirmLink(body: string): string {
  const match = /https?:\/\/[^"'\s<>]+\/auth\/confirm\?[^"'\s<>]+/.exec(body);
  if (match === null) throw new Error("no confirm link in email");
  const url = new URL(match[0].replace(/&amp;/g, "&"));
  return `${url.pathname}${url.search}`;
}

// --- TOTP (RFC 6238, SHA-1, 6 digits, 30 s), as an authenticator app computes it ---

function base32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(ch);
    if (index < 0) throw new Error("bad base32");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret: string, stepOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32(secret)).update(message).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

// --- Page helpers ---------------------------------------------------------------

export function attr(body: string, name: string): string | undefined {
  const match = new RegExp(`${name}="([^"]*)"`).exec(body);
  return match?.[1];
}

/** Signs in through the real form and returns the browser holding the session. */
export async function signIn(
  email: string,
  password = PASSWORD,
  returnTo = "",
): Promise<Browser> {
  const browser = new Browser();
  await browser.send("/auth/sign-in");
  const reply = await browser.send("/auth/sign-in", {
    form: { intent: "password", email, password, returnTo },
  });
  if (reply.status !== 302)
    throw new Error(`sign-in failed with ${String(reply.status)}`);
  return browser;
}
