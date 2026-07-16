# How to maintain docs/STATUS.md

`docs/STATUS.md` is the living snapshot of where the project is. Update it **on every task completion**, before the commit that finishes the task.

## Rules

- **Newest first.** Prepend new entries to the top of each list.
- **Terse bullets.** One line each; no prose paragraphs.
- **Always stamp** entries with the date (`YYYY-MM-DD`) and the task ID (e.g. `T-1150`).
- Keep it short. When "Recently shipped" grows past ~15 bullets, trim the oldest into git history (the log is the archive).
- Record any **deviations** (e.g. a package version bumped from the pinned one) under Known issues or inline where relevant.

## Sections (keep this order)

1. **Current state** — one-paragraph summary of what works end-to-end right now.
2. **Recently shipped** — dated bullets of completed work, newest first.
3. **In progress** — what is actively being worked on (empty if nothing).
4. **Known issues / deviations** — bugs, gaps, pinned-version deviations, anything a fresh dev should know.
5. **Next** — the immediate next steps / priorities.
6. **Manual test checklist** — things a human (Eli) must verify in a real browser; not automatable.

## Template

```markdown
# PitchMi — STATUS

## Current state
<one paragraph>

## Recently shipped
- YYYY-MM-DD (T-XXXX): <what shipped>

## In progress
- <thing> — or "Nothing in progress."

## Known issues / deviations
- <issue or deviation>

## Next
- <next step>

## Manual test checklist (for Eli)
- [ ] <thing to verify in a real browser>
```
