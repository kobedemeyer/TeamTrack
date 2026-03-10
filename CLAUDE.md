# CLAUDE.md — TeamTrack

## Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution.

**Your role:** You sit between what I want (workflows/instructions) and what actually gets done (code changes). Read instructions, make smart decisions, call the right tools, recover from errors, and keep improving the system as you go.

### How to Operate

1. **Look for existing patterns first** — Before building anything new, check how similar features are already implemented in the codebase. Only create new patterns when nothing exists for that task.

2. **Learn and adapt when things fail** — Read the full error, fix the issue and retest, then document what you learned. If a fix involves paid API calls or credits, check with me before running again.

3. **Keep instructions current** — When you find better methods, discover constraints, or encounter recurring issues, suggest updating this file. Don't overwrite without asking.

4. **The self-improvement loop:** Identify what broke → fix it → verify the fix → update instructions → move on with a more robust system.

Stay pragmatic. Stay reliable. Keep learning.

---

## Project Overview

**TeamTrack** — a zero-dependency PWA for team KPI tracking and RnR (Rank & Recognize) competition. Google Apps Script backend with Google Sheets as database, vanilla JS/HTML/CSS single-file frontend.

**Context:** Used by AIESEC Antwerp (~30 members) across three tracks: iGT, oGX, Marketing. March 2026 competition season.

## File Structure

```
tracker.html    — Main app (~3,100 lines: CSS + HTML + JS in one file)
Code.gs         — Google Apps Script backend (all API endpoints)
sw.js           — Service Worker (cache-first shell, network-first API)
manifest.json   — PWA manifest
```

- No build step, no bundler, no package manager. Files are served as-is.
- **Deliverables** (deployed app) live on GitHub Pages / hosted HTTPS.
- **Backend** lives in Google Apps Script (separate from this repo — copy `Code.gs` into the script editor).
- Local files are for development. The deployed Apps Script + hosted frontend are what users interact with.

## Development

```bash
# Serve locally (any static server on HTTPS or localhost)
python -m http.server 8080

# Backend: edit Code.gs in Google Apps Script editor
# Deploy → Manage deployments → bump version number → Deploy
```

After changing `tracker.html` or `sw.js`: bump the cache version in `sw.js` (`teamtrack-vNN`).

After changing `Code.gs`: redeploy the Apps Script web app (new version).

## Architecture

### Backend (`Code.gs`)

- **Runtime:** Google Apps Script, deployed as web app (Execute as Me, Access Anyone)
- **Database:** Google Sheets with 4 tabs: `Teams`, `Members`, `Categories`, `Logs`
- **Entry point:** `doGet(e)` switch on `e.parameter.action`
- **IDs:** 8-char UUID substrings
- **Categories** can be global (empty teamId) or team-specific

Key endpoints:
| Action | Purpose |
|--------|---------|
| `getAllSummaries` | All teams' data in 1 call (replaces N+1 pattern) |
| `getSummary` | Single team aggregates |
| `addLog` | Log action (supports negative count for subtract) |
| `getProfile` | User stats (total actions, top KPI, member since) |
| `checkName` | User lookup + password/team status |
| `registerMember` | Create or update user |

### Frontend (`tracker.html`)

**Single-file architecture:** `<style>` → `<body>` (HTML screens) → `<script>` (all JS).

**Screen system:** `goTo(screen)` toggles `.active` class on screen divs. Screens:
`login` → `teamselect` → `home` → `dashboard` | `log` | `categories` | `activity` | `rnr` | `profile` | `manageteam` | `allteams`

**State (localStorage-persisted):**
```
currentUser, currentTeamId, currentTeamName
```

**API layer:**
- `api(action, params)` — direct fetch
- `apiCached(action, params)` — 2-min client-side cache with deep clone
- `invalidateApiCache()` — clear on mutations
- `fetchAllTeamsSummaries()` — single `getAllSummaries` call, maps to `[{team, summary}]`

**Screen freshness:** `screenLastLoaded[screen]` tracks timestamps; `screenIsFresh(screen)` skips reload if < 2 min old.

**Optimistic UI pattern:** Update DOM immediately, revert on API error (used in logAction, logSubtract, bulk set).

### RnR Competition System

`RNR_TASKS` array defines all scored tasks with track, name, points, and optional threshold/sourceKpis.

**Two scoring modes:**
- **Direct:** `count * points` (e.g., "meeting with a company" x 5 pts)
- **Threshold:** `floor(sum_of_sourceKpis / threshold) * points` (e.g., 10 outreaches → 3 pts)

`RNR_SOURCE_KPIS` is auto-derived from tasks with `sourceKpis`. Both RnR tasks and source KPIs are auto-created as categories when screens load.

### Admin System

- **Admin:** URL param `?admin` → shows Categories, All Teams, Manage Team
- **Super-admin:** hardcoded `currentUser === 'kobe'` → team creation, member deletion, inline dashboard editing
- CSS classes: `.admin-only`, `.super-admin-only` (hidden via `body.is-admin` / `body.is-super-admin`)

## Conventions

- **CSS variables:** `--bg`, `--bg2`, `--bg3`, `--accent`, `--accent-light`, `--accent-dim`, `--accent-warm`, `--accent-warm-light`, `--text`, `--text-dim`, `--red`, `--green`, `--radius`, `--shadow`, `--shadow-hover`
- **Fonts:** Bebas Neue (display/headings), Barlow (body)
- **Color scheme:** Light theme — white bg (#ffffff), blue accent (#037ef3)
- **Constants:** UPPERCASE (`RNR_TASKS`, `SCREENS`, `API_URL`, `API_CACHE_TTL`)
- **Functions:** camelCase (`loadDashboard`, `logAction`, `fetchAllTeamsSummaries`)
- **IDs:** semantic (`#dash-content`, `#log-cards-wrapper`, `#profile-rnr-breakdown`)
- **Classes:** BEM-like (`.log-card`, `.log-card-plus`, `.log-card-count`, `.rnr-row`)
- **HTML escaping:** Always use `esc(str)` for dynamic content (XSS prevention)
- **No external dependencies** — everything is vanilla JS/CSS/HTML
- **Section comments:** decorated with `══` markers

## Key Patterns

**Adding a new API endpoint:**
1. Add function in `Code.gs`
2. Add `case` in `doGet()` switch
3. Redeploy Apps Script

**Adding a new screen:**
1. Add HTML `<div id="xxx-screen" class="screen">` with header + back button
2. Add entry in `SCREENS` object
3. Add `case` in `goTo()` switch
4. Add CSS styles
5. Add load function

**Adding a new RnR task:**
1. Add entry to `RNR_TASKS` array (track, name, points, optional threshold/sourceKpis)
2. Categories auto-create on next screen load

**Cache bump:** After any frontend change, increment version in `sw.js` (`teamtrack-vNN`).

## Google Sheets Schema

| Sheet | Columns |
|-------|---------|
| Teams | ID, Name, CreatedBy, CreatedAt |
| Members | Name, JoinedAt, TeamId, Password |
| Categories | ID, Name, CreatedBy, TeamId |
| Logs | Timestamp, Person, CategoryId, CategoryName, Count |
