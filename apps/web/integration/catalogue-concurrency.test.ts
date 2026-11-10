import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sql, stack } from "./harness";

// Separate real database connections, not Promise.all against a shared transaction.
function connection() {
  const flags = ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  if (spawnSync("psql", ["--version"]).status === 0)
    return { command: "psql", args: [...flags, stack.dbUrl] };
  const project = /^project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(join(stack.root, "supabase/config.toml"), "utf8"),
  )?.[1];
  if (!project) throw Error("Missing synthetic project");
  const inner = new URL(stack.dbUrl);
  inner.hostname = "127.0.0.1";
  inner.port = "5432";
  return {
    command: "docker",
    args: [
      "exec",
      "-i",
      `supabase_db_${project}`,
      "psql",
      ...flags,
      inner.toString(),
    ],
  };
}
function session() {
  const c = connection();
  const child = spawn(c.command, c.args, { stdio: "pipe" });
  let output = "",
    errors = "";
  child.stdout.on("data", (data: Buffer) => {
    output += data.toString();
  });
  child.stderr.on("data", (data: Buffer) => {
    errors += data.toString();
  });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once("close", resolve);
    child.once("error", () => {
      reject(Error("Private database process failed"));
    });
  });
  return { child, done, output: () => output, errors: () => errors };
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!check()) {
    if (Date.now() > deadline)
      throw Error("Concurrent category check timed out");
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

for (const commit of [true, false])
  it(`serializes competing parent writes when first writer ${commit ? "commits" : "rolls back"}`, async () => {
    const tag = randomUUID(),
      a = `race-a-${tag}`,
      b = `race-b-${tag}`;
    const application = `category-race-${tag}`;
    sql(
      `insert into public.categories(slug,name) values ('${a}','Synthetic race A'),('${b}','Synthetic race B')`,
    );
    const first = session(),
      second = session();
    try {
      first.child.stdin.write(
        `begin; update public.categories set parent_slug='${b}' where slug='${a}';\n\\echo FIRST_LOCKED\n`,
      );
      await until(() => first.output().includes("FIRST_LOCKED"));
      second.child.stdin.end(
        `set application_name='${application}'; begin; update public.categories set parent_slug='${a}' where slug='${b}'; commit;\n`,
      );
      const c = connection();
      await until(() => {
        const r = spawnSync(c.command, c.args, {
          input: `select exists(select from pg_stat_activity where application_name='${application}' and wait_event='advisory');`,
          encoding: "utf8",
          timeout: 3000,
        });
        return r.status === 0 && r.stdout.trim() === "t";
      });
      first.child.stdin.end(`${commit ? "commit" : "rollback"};\n`);
      expect(await first.done).toBe(0);
      const status = await second.done;
      expect(status === 0).toBe(!commit);
      if (commit) expect(/23514/.test(second.errors())).toBe(true);
    } finally {
      first.child.kill();
      second.child.kill();
      await Promise.allSettled([first.done, second.done]);
      sql(`delete from public.categories where slug in ('${a}','${b}')`);
    }
  });

it("rejects category writes under a stale repeatable-read snapshot", () => {
  const c = connection();
  const r = spawnSync(c.command, c.args, {
    input:
      "begin isolation level repeatable read; update public.categories set parent_slug=parent_slug; rollback;",
    encoding: "utf8",
    timeout: 5000,
  });
  expect(r.status === 0).toBe(false);
  expect(/25000/.test(r.stderr)).toBe(true);
});
