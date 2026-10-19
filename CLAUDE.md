# Claude Code Guidelines — MsCabs

## Core Philosophy: Ponytail
- Lazy senior developer mindset. Stop at the first rung that holds:
  1. YAGNI (skip unneeded features)
  2. Reuse existing helpers in `script.js` / `styles.css`
  3. Web standards & vanilla JS/CSS
  4. Native HTML5 capabilities
  5. Minimum working diff
- Code first, max 3 lines explanation.

## MCP Knowledge Graph First
- Always query `codebase-memory-mcp` (project: `mnt-5893accc-4b16-4de7-b2a7-6333530b2614-PROJECTS-22_Archive-mscabs`) and `code-review-graph` before grep/find.

## Git Commits
- Mandatory Conventional Commits: `<type>(<scope>): <summary>`
- Scopes: `web`, `form`, `map`, `pricing`, `ui`, `seo`, `ai`.
