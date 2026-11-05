# Docker-free Supabase migration — capacity blocked

2026-11-05 UTC. Owner approved migration into a fresh dedicated Ubuntu WSL instance,
preservation of existing local data, and Docker removal only after native acceptance.
No hosted operations, production secrets, real email or spending are authorized.

## Verified inventory

- Docker Desktop was initially stopped. Started it temporarily, hidden, for inventory;
  Docker engine 29.9.2 became reachable.
- Current desktop-linux engine: **0 containers, 0 volumes, 0 build cache**, seven unused
  `public.ecr.aws/supabase/*` images. Docker reports 4.076 GB image storage; this is not
  a promise of Windows disk-space recovery.
- Images: postgres `17.11.0.006`, gotrue `v2.197.0`, storage-api `v1.84.19`,
  postgrest `v16.5`, realtime `v2.147.1`, mailpit `v1.31.3`, kong `2.8.1`.
- Inspected Windows-profile `.supabase/stacks` and both known CarworX checkouts'
  `supabase/.temp`: absent. No existing Docker-backed stack was available to export.
  This does not assert that arbitrary unrelated host directories contain no data.
- The apparent Docker data disks under ordinary LocalAppData and the Codex package's
  LocalCache are **the same NTFS file**, verified using `fsutil file queryfileid`:
  `0x0000000000000000000a0000001f48e4`. Count its approximately 5.88 GiB once.
  Never delete the surrounding Codex package directory.
- Existing Ubuntu registration points to a missing `ext4.vhdx`. Preserve it;
  no distribution was unregistered or replaced.
- C: free space fell from about 2.60 to 2.49 GiB during inspection.

## Space gate — STOP before installation/deletion

Microsoft's WSL distribution catalog currently selects this Ubuntu 24.04 image:

`https://releases.ubuntu.com/24.04.5/ubuntu-24.04.5-wsl-amd64.wsl`

SHA-256: `bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`.
HEAD reports **388,975,696 bytes**. Two eight-byte HTTP range requests verified gzip
format and its **1,275,596,800-byte** uncompressed-size trailer. That size is modulo
4 GiB, so treat it as a lower bound, not an exact installed VHD allocation. The full
archive was not downloaded.

Working budget:

| Item | GiB |
| --- | ---: |
| Compressed Ubuntu archive | 0.36 |
| Uncompressed Ubuntu archive footprint | at least 1.19 |
| Linux toolchain, native service archives/extraction, source/dependencies | 3.00 estimated allowance |
| Required safety margin | 2.00 |
| Existing-data preservation exports | add measured size if discovered |
| Baseline total | 6.55 |

Require **at least 7 GiB free** before resuming (approximately **4.5 GiB more** than
currently available). Recalculate upward from actual native download sizes before
preparing services. An external temporary destination is another option, but its
location must be explicitly selected. No other user files are removed to meet this
budget. Docker images/data remain intact under the agreed acceptance ordering.

`scripts/ops/native/preflight.ps1` performs a non-destructive capacity/engine check.
Exit 2 means blocked. Unknown Docker inventory is reported as null, never zero.
Even a successful preflight does not authorize deletion or prove data preservation.

## Resume procedure

1. Re-inventory Docker and known host data paths. Export any newly discovered local
   database/Auth/configuration and Storage metadata **plus object bytes**, privately.
   Verify checksums and completeness before changes. Record empty inventory honestly
   when there is nothing to export. Preserve unrelated workloads; do not prune broadly.
2. Verify the image's SHA-256 against the current official catalog. Import a fresh
   Ubuntu 24.04 distribution named `CarworX-Native` into an explicitly resolved,
   dedicated owner-profile directory. Preserve existing WSL registrations.
3. Use an unprivileged Linux service user. Install checksum-verified Linux Node
   24.22.2, pnpm 12.16.1 and Supabase CLI 2.122.1. Use a separate Linux checkout and
   Linux dependencies; never reuse Windows native modules. Verify glibc >=2.35.
4. Enable the experimental stack interface in its isolated local configuration;
   verify pinned CLI help before using explicit native runtime and on-demand
   preparation. No silent CLI upgrade. Keep persistent data on the Linux filesystem.
5. Restore preserved data, keeping required local secrets private. Use loopback API
   endpoints and synthetic mail capture. Add explicit start/status/stop wrappers,
   a normalized status adapter and native SQL access. Keep Docker GitHub CI intact.
6. Adapt the genuine Auth hook fixture to native lifecycle and loopback addressing;
   remove Docker-specific host/container commands only from its native path. Do not
   weaken report, required-suite, signature or provider-call assertions.
7. Verify cold start and restart persistence; all required RLS/Auth suites; genuine
   Auth->hook->capture behavior; private object bytes/hashes and access controls;
   built-app connectivity. Record measured storage/RAM and net savings. Native
   runtime's reduced isolation requires serializing local stacks/drills.
8. Only after successful acceptance and checked preservation: remove exact confirmed
   CarworX Docker resources, uninstall using Docker Desktop's official process,
   verify resolved Docker-only leftover paths, and measure actual reclaimed Windows
   space. Stop if unrelated data or workloads remain. Do not unregister Ubuntu or
   delete arbitrary VHDs. Keep preservation files and pinned image references for
   rollback. Do not add automatic startup.

## Evidence limits and rollback

No native distribution, service, migration, runtime adapter, restoration or test pass
is claimed. No Docker resources were deleted. Native acceptance and cleanup are
blocked by the measured capacity gate. Existing Docker image digests can be
re-inventoried with `docker image ls --digests`; preserve any actual data separately
before relying on image re-download as rollback. Images do not contain volume data.

Final preflight: 2.42 GiB free, 6.55 GiB working budget, 4.13 GiB short of that
budget; the rounded 7 GiB target requires about 4.6 GiB more. Returned Docker
Desktop to its original stopped state using its official CLI after confirming zero
containers. Validated PowerShell syntax, expected exit 2 for insufficient capacity,
null inventory when the engine is stopped, and rejection of a reduced safety margin.

Sources: [Supabase native runtime](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes),
[Microsoft WSL catalog](https://github.com/microsoft/WSL/blob/master/distributions/DistributionInfo.json),
[Docker backup/restore](https://docs.docker.com/desktop/settings-and-maintenance/backup-and-restore/).
