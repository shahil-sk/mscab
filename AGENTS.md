# MsCabs — Instructions for Autonomous AI Agents

**MsCabs** is a lightweight, responsive cab booking and lead collection web platform built with **Vanilla HTML5, CSS3, and modern JavaScript**, featuring Leaflet/Nominatim map integration and Google Forms backend submission.

---

## 1. Autonomous Operation Protocol

Follow this protocol for every session and task:
1. **Orient**: Consult knowledge graph MCP tools (`codebase-memory-mcp`, `code-review-graph`).
2. **Plan (Ponytail Default)**: Channel a lazy senior developer. Select the first rung that holds:
   - Does this need to exist? (YAGNI) $\to$ Reuse existing code $\to$ Web standards $\to$ Native browser platform $\to$ Existing libraries $\to$ One line $\to$ Shortest working diff.
3. **Implement**: Clean, modular HTML/CSS/JS with zero unneeded dependencies or speculative abstraction.
4. **Verify**: Check browser rendering, responsive layout, form submit handlers, and console logs.
5. **Review**: Run `detect_changes_tool` and `get_impact_radius_tool`.
6. **Commit**: Mandatory Conventional Git Commit before finalizing (`feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `chore`).

---

## 2. Non-Negotiables & Technical Invariants

### 2.1 Ponytail & Zero Bloat (Strict Invariant)
- Never introduce heavy frameworks (React, Vue, jQuery) or build tooling (Webpack, Vite) unless explicitly ordered.
- Native browser capabilities before libraries:
  - Flexbox and CSS Grid before layout libraries.
  - Native form validation (`checkValidity()`, `:invalid`, `:valid`) before JS validator packages.
  - Native Fetch API and URLSearchParams for HTTP requests.

### 2.2 Resilient Form Submission & User Feedback
- Form submission must provide clear feedback states:
  - Submit button loading spinner (`btnLoading(true)`).
  - Clear error toast or inline message on failure.
  - Success modal with booking recap.
- Preserve fallback behaviors when geocoding or external tile APIs fail.

### 2.3 Mobile-First & Accessible
- Touch target sizes minimum 44x44px.
- Legible typography on mobile viewports.
- Keyboard accessible forms and modals (Escape to close modal, Enter to submit).

---

## 3. Knowledge Graph MCP Reference

### codebase-memory-mcp
- **Project identifier**: `mnt-5893accc-4b16-4de7-b2a7-6333530b2614-PROJECTS-22_Archive-mscabs`
- Tools:
  - `search_graph(project=..., name_pattern=...)`: Find functions, variables, and sections.
  - `trace_path(project=..., function_name=..., direction="inbound"|"outbound")`: Trace call hierarchy.
  - `get_code_snippet(project=..., qualified_name=...)`: Fetch exact symbol source code.
  - `get_architecture(project=...)`: High-level symbol architecture.

### code-review-graph
- **Repository root**: `/mnt/5893accc-4b16-4de7-b2a7-6333530b2614/PROJECTS/22_Archive/mscabs`
- Tools:
  - `detect_changes_tool`: Review modifications with risk scoring.
  - `get_impact_radius_tool`: Trace blast radius of altered symbols.
  - `get_affected_flows_tool`: Trace user execution flows (`setupAutocomplete`, `initMap`, `submitToGoogleForms`).
  - `list_flows_tool` & `get_flow_tool`: Inspect execution flow call chains.

### headroom
- Context compression & retrieval proxy for optimizing token capacity:
  - `headroom_compress`, `headroom_retrieve`, `headroom_stats`.

---

## 4. Conventional Commits Standard (MANDATORY)

Every task that touches files MUST be committed before concluding:
```
<type>(<scope>): <short imperative summary>

- <bullet describing what changed and why>
```
Valid types: `feat`, `fix`, `style`, `refactor`, `perf`, `docs`, `chore`.
Valid scopes: `web`, `form`, `map`, `pricing`, `ui`, `seo`, `ai`.
Always use `rg` (ripgrep) for searching.
