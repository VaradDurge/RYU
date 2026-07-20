# What works / what doesn’t

Last touch: 2026-07-20 · detail: `UPDATES.md`

## Works

- Dock UI + demo Inject (`npm run dev`)
- Bridge `127.0.0.1:41999` (`/event` `/decision` `/status` `/agents`)
- Cursor **status rings** (live + `verify:cursor-status`)
- Claude status + permission plumbing (`verify:claude-status`, `verify:claude-resume`)
- Fail-open when RYU down (scripted)

## Does not / deferred

- Claude **live** Write → Approve → file (home checklist; esp. WSL)
- Cursor Approve on every tool — **intentionally off** (spam)
- Cursor Multitask external approve — unsupported
- Codex at Cursor/Claude parity — early
- Mac notch track — `diff/mac/` only; not Windows daily path
- Stale permission cards — restart RYU workaround

## Deliberate product rule

Dock Approve/Deny = **Claude Resume** (and optional Cursor ACP spike). Cursor IDE hooks = **rings only**.
