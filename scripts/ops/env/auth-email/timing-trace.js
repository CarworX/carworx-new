import { randomUUID, createHash } from "node:crypto";
import {
  constants,
  existsSync,
  openSync,
  closeSync,
  lstatSync,
  fstatSync,
  ftruncateSync,
  writeSync,
  fsyncSync,
  realpathSync,
} from "node:fs";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { requireCondition } from "../contract.js";

function privateAccess(path) {
  if (process.platform === "win32") {
    // Constant code, no interpolation of paths or user input. Never echo ACLs.
    const code = `$ErrorActionPreference='Stop'; try {$a=Get-Acl -LiteralPath $env:CARWORX_TRACE_TARGET; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $allowed=@($me,'S-1-5-18','S-1-5-32-544'); foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){exit 1}}; if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $allowed){exit 1}} catch {exit 1}`;
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", code],
      {
        // Windows PowerShell must build its own module path, rather than inherit
        // PowerShell 7 modules that cannot load in the built-in 5.1 host.
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key.toLowerCase() !== "psmodulepath",
            ),
          ),
          CARWORX_TRACE_TARGET: path,
        },
        stdio: "pipe",
        timeout: 5000,
      },
    );
    requireCondition(r.status === 0, "Private trace ACL verification failed");
  } else {
    const s = lstatSync(path);
    requireCondition(
      s.uid === process.getuid() && (s.mode & 0o077) === 0,
      "Owner-only trace permissions required",
    );
  }
}

export function createTimingTrace(path, config) {
  requireCondition(
    typeof path === "string" && path.length > 0,
    "Private trace path required",
  );
  const target = resolve(path),
    parent = dirname(target);
  requireCondition(
    lstatSync(parent).isDirectory() && !lstatSync(parent).isSymbolicLink(),
    "Private trace directory required",
  );
  for (let directory = realpathSync(parent); ; directory = dirname(directory)) {
    requireCondition(
      !existsSync(join(directory, ".git")),
      "Trace must stay outside Git",
    );
    if (dirname(directory) === directory) break;
  }
  privateAccess(parent);
  const config_sha256 = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex");
  const fd = openSync(
    target,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  const identity = fstatSync(fd);
  let closed = false;
  const manifest = {
    version: 1,
    private_run_id: randomUUID(),
    config_sha256,
    status: "collecting",
    strata: [],
    samples: [],
  };
  function persist(checkAcl = false) {
    const current = lstatSync(target);
    requireCondition(
      current.isFile() &&
        !current.isSymbolicLink() &&
        current.ino === identity.ino &&
        current.dev === identity.dev,
      "Trace identity changed",
    );
    if (checkAcl || process.platform !== "win32") {
      privateAccess(parent);
      privateAccess(target);
    }
    const bytes = Buffer.from(JSON.stringify(manifest) + "\n");
    ftruncateSync(fd, 0);
    let offset = 0;
    while (offset < bytes.length) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset, offset);
      requireCondition(n > 0, "Private trace write failed");
      offset += n;
    }
    fsyncSync(fd);
  }
  try {
    persist(true);
  } catch (error) {
    closeSync(fd);
    throw error;
  }
  return {
    begin(case_index, path, flow, cooldown) {
      const correlation_id = randomUUID();
      manifest.strata.push({
        case_index,
        path,
        flow,
        cooldown,
        correlation_id,
      });
      persist();
      return correlation_id;
    },
    start(correlation_id, pair_index, group) {
      const sample = {
        correlation_id,
        pair_index,
        group,
        started_at: new Date().toISOString(),
        duration_ms: null,
        http_status: null,
      };
      manifest.samples.push(sample);
      persist();
      return manifest.samples.length - 1;
    },
    end(index, ms, status) {
      manifest.samples[index].duration_ms = ms;
      manifest.samples[index].http_status = status;
      persist();
    },
    finish() {
      manifest.status = "completed";
      persist(true);
    },
    fail() {
      manifest.status = "failed";
      persist(true);
    },
    close() {
      if (!closed) {
        closeSync(fd);
        closed = true;
      }
    },
  };
}
