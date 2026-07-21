# WSL hooks: Windows node needs Windows paths

## Problem

Claude-in-WSL SessionStart failed with `node:internal/modules/cjs/loader` when hooks used Windows `node.exe` but `/mnt/c/...` script args. Terminal Yes/No only; dock never saw events.

## Learned

- Command may be `/mnt/c/Program Files/nodejs/node.exe` (WSL can exec it).
- Script args must be `C:\...\hooks\ryu-*.mjs` — Windows Node does not understand `/mnt/c`.

## Rule

When installing WSL Claude hooks, convert hook file args with `toWindowsPath`. Prove load with `node.exe C:\...\ryu-claude-status.mjs SessionStart` during install.
