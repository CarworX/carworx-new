# Codex wake-trigger investigation

Updated 2026-11-14 02:52 UTC. Agent: codex.

## Outcome

The owner authorized investigating and configuring immediate GitHub-triggered continuation. Immediate wake-up of the existing desktop master conversation is **not enabled**: the supported CLI route could queue messages but could not resume a conversation already owned by the desktop app. Do not bypass its writer lock or start a second writer.

The existing `carworx-github-follow-up` heartbeat remains ACTIVE, every ten minutes, attached to the master conversation. It checks GitHub handoffs and CI and continues work within existing owner authorization. This is scheduled follow-up, not a GitHub webhook. The Sites preview is refreshed at completed feature milestones, not at every check.

## Verified evidence

- Installed desktop CLI: `0.167.0-alpha.4.1`. `codex queue --help` documents `--thread`, `--message` and `--resume`. Queueing uses the target thread's model.
- Initial self-test queued a harmless verification message but warned that resuming needed a local daemon or explicit remote server.
- The bundled bare CLI could not initialize a daemon: `this CLI has no complete local package`.
- Downloaded OpenAI's official Windows installer; Authenticode status was Valid, signer OpenAI OpCo, LLC. Installed only the daemon package, pinned to the same `0.167.0-alpha.4.1` version. The daemon-only installer did not replace the desktop application or change shell PATH.
- `codex app-server daemon start` reported matching CLI/server versions and a running local daemon.
- A second harmless `queue --resume` self-test queued successfully but returned `thread/resume failed: thread ... already has an active writer (code -32600)`. Successful queue command exit is therefore not proof of wake-up or delivery to a running agent.
- `codex app-server daemon stop` reported stopped. No watcher, public webhook endpoint, remote-control pairing, GitHub workflow, API credential, or separate coding worker was configured. The pinned package remains installed but stopped.
- Two verification messages may remain queued; both explicitly prohibit repository work and request only acknowledgement.
- No global Claude hook configuration or project-local `.claude` watcher configuration was found in the inspected local checkout. This does not establish how the currently running Claude app implements its follow-up behavior.

## Supported paths to revisit

1. An app-supported external message/wake endpoint targeting the desktop conversation, or a supported migration of its ownership to a shared daemon. Neither was established in this investigation. Do not patch app internals or manipulate thread locks.
2. A separate Codex GitHub Actions worker can run from GitHub events, but it is a separate execution environment, not a wake-up of this master session. The official action requires provider authentication. Repository secret names and runners were queried; none were listed. No API spending or alternate worker was enabled.
3. A local GitHub poller would still need a verified wake endpoint; polling faster alone does not resolve the ownership problem. Retain the functioning ten-minute heartbeat.

Sources: [OpenAI queue implementation](https://github.com/openai/codex/blob/main/codex-rs/tui/src/session_queue_commands.rs), [OpenAI daemon installation and lifecycle](https://github.com/openai/codex/blob/main/codex-rs/app-server-daemon/README.md), [OpenAI GitHub Action](https://github.com/openai/codex-action).
