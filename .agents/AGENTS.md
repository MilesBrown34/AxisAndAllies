# Project Agent Rules

> **LEGACY — Gemini/Copilot IDE era.** Superseded by `../CLAUDE.md` and
> `.claude/`. Kept for reference only.

## Token Usage Tracker Rule — *inactive*

- **Original rule**: check that the token usage tracker is running
  (`node "D:/My Documents/3 Ai Projects/Antigravity IDE/Life Dashboard/watch_tokens.js"`)
  when starting or resuming work in this workspace.
- **Status**: no longer applicable. That path does not exist, and the tracker
  reads Gemini IDE transcripts this workspace no longer produces. Claude Code
  reports its own context usage.
- Do not prompt the user to start it.
