# Closing the Resume gap

Product spine: **Idle → Attention → Understand → Decide → Resume**.

## What “done” means

Someone can leave their IDE, see RYU light up for a real Claude permission, **Approve once**, and Claude continues **without** a stuck terminal Yes/No.

## Status

| Path | Status |
| --- | --- |
| Claude bridge Resume (`verify:claude-resume`) | Automated green |
| Claude live (your terminal) | Checklist below — restart Claude after `hook:install` |
| Cursor harness / bridge branding | Demo only |
| Cursor IDE hooks | Spike (allow-weak) |
| Cursor ACP client | Spike: `npm run acp:cursor -- "prompt"` |
| Codex hooks | Installed via `hook:install:codex` |

## Live Claude checklist

1. `npm run dev` on Windows  
2. `npm run hook:install` (once)  
3. **Restart** Claude Code  
4. Prompt: `Create ryu-live-test.txt with text hello`  
5. Dock → Approve → file exists  
6. Deny / kill RYU for block / fail-open  

Log: `~/.ryu/hook.log`
