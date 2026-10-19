# MsCabs — Gemini CLI & Antigravity Guidelines

## 1. Ponytail Mode (MANDATORY — DEFAULT ACTIVE)
- Lazy senior developer mode is active on every prompt.
- Stop at the first rung that holds:
  1. **Does this need to exist?** (YAGNI) — Speculative need = skip it.
  2. **Already in codebase?** Reuse existing helpers, variables, or functions in `script.js` / `styles.css`.
  3. **Web standards & Vanilla APIs?** Use standard DOM APIs, Fetch, CSS Grid/Flexbox before reaching for any library.
  4. **Native platform features?** `<input type="date">`, `<input type="time">`, CSS `:valid/:invalid`, HTML5 form constraints.
  5. **Already-included libraries?** Leaflet.js, Nominatim, Google Forms integration.
  6. **Can it be one line?** Make it one line.
  7. **Minimum working diff.**
- **Code first**, then at most three lines of explanation: what was skipped, when to add it.

---

## 2. Architecture & Technical Invariants
- **Stack**: Vanilla JavaScript (ES6+), Semantic HTML5, CSS3 Custom Properties (No node_modules, bundlers, or heavy frameworks needed).
- **Core Execution Flows**:
  - `setupAutocomplete`: Address search, debounced input, and Nominatim API suggestions.
  - `initMap`: Interactive Leaflet map, geocoding pins, Haversine distance, and dynamic price estimates.
  - `submitToGoogleForms`: Lead generation form validation, payload construction, and Google Forms submission.
- **Invariants**:
  - Keep it 100% responsive, mobile-first, lightweight, and accessible.
  - Never add unnecessary external script or style dependencies without explicit user request.
  - Ensure form fallback and error handling remain resilient.

---

## 3. Knowledge Graph MCP First (MANDATORY)
- Always prefer MCP graph tools before ripgrep / file scanning:
  - **`codebase-memory-mcp`**: Pass `project="mnt-5893accc-4b16-4de7-b2a7-6333530b2614-PROJECTS-22_Archive-mscabs"`. Use `search_graph`, `trace_path`, `get_code_snippet`.
  - **`code-review-graph`**: Use `detect_changes_tool`, `get_impact_radius_tool`, `get_affected_flows_tool`, and `list_flows_tool`.
  - **`headroom`**: Use `headroom_compress` and `headroom_retrieve` for efficient context retention.

---

## 4. Git Commit Rule (MANDATORY)
After every task modifying/creating/deleting files, stage and commit with conventional commits:
```
<type>(<scope>): <short imperative summary>

- <bullet describing what changed and why>
```
Valid scopes: `web`, `form`, `map`, `pricing`, `ui`, `seo`, `ai`.

---

## 5. Ripgrep Rule (MANDATORY)
Always use `rg` instead of `grep` for terminal search commands.
