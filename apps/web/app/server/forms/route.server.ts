import { data } from "react-router";

import { requireConfig, type SecurityContext } from "../security/boundary";
import {
  formDeps,
  PROBLEM_STATUS,
  runForm,
  type FormResult,
  type FormsEnv,
} from "./submit";
import type { DbOutcome, FormsDb } from "./db";
import type { Parsed } from "./parse";
import type { FormAction } from "./turnstile";

/**
 * Shared action body: run the pipeline. Returns null when sent (the route
 * redirects), else the problem as no-store data.
 */
export async function formAction<T>(
  request: Request,
  context: { cloudflare: { env: unknown }; security: SecurityContext },
  action: FormAction,
  parse: (form: FormData) => Parsed<T>,
  write: (db: FormsDb, value: T) => Promise<DbOutcome>,
) {
  const config = requireConfig(context.security);
  const env = context.cloudflare.env as FormsEnv;
  const result = await runForm(
    request,
    await request.formData(),
    await formDeps(env, config, action),
    parse,
    write,
  );
  if (result.kind === "sent") return null;
  return problemData(result);
}

function problemData(result: Extract<FormResult, { kind: "problem" }>) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (result.retryAfterSeconds !== undefined)
    headers.set("Retry-After", String(result.retryAfterSeconds));
  return data(
    { problem: result.problem },
    { status: PROBLEM_STATUS[result.problem], headers },
  );
}

/** Route `headers` for form pages: never cached; a 429 keeps Retry-After. */
export function formHeaders({ actionHeaders }: { actionHeaders: Headers }) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const retry = actionHeaders.get("Retry-After");
  if (retry !== null) headers.set("Retry-After", retry);
  return headers;
}
