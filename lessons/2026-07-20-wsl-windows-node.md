# WSL hooks need Windows Node

**Problem:** Claude in WSL calling Linux `node` → `127.0.0.1` is the VM, not Windows RYU. User only sees Claude’s Yes/No.

**Learned:** Hooks must invoke **Windows `node.exe`**. `npm run hook:install` writes that path for Win + WSL.

**Rule:** If live Claude fails open to terminal prompts, re-install hooks from Windows and restart Claude before debugging the dock.
