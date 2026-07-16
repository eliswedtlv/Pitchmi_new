# PitchMi — STATUS

## Current state
Greenfield build in progress (T-1150). Repo scaffolded (git, docs, root CLAUDE.md, README). Server and client being built per `docs/cc-goal-pitchmi-v1.md`.

## Recently shipped
- 2026-07-16 (T-1150): Repo scaffolding — git init (`main`), `.gitignore`, root `CLAUDE.md`, `README.md`, `docs/update_status.md`, initial `STATUS.md` / `TASKS.md`.

## In progress
- T-1150 — v1 core loop build (server + client).

## Known issues / deviations
- Local Node is v24.11.1; spec pins Node 22 (Railway runtime target). v24 is backward-compatible for dev; no action needed.

## Next
- Build server CORE IP (path + score algorithms) with tests, then API layer, then client.

## Manual test checklist (for Eli)
- [ ] Camera record on Chrome desktop + iOS Safari.
- [ ] Karaoke highlight sync feels right.
- [ ] Hebrew take end-to-end incl. RTL prompter.
- [ ] Share sheet on mobile (Web Share API with file).
