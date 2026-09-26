# UI/UX Wireframes & Screen Specifications

> **Date:** 21 June 2026 | **Web:** React + Vite | **Mobile:** React Native + Expo

---

## Part A: Web Dashboard

### Global Layout

```
┌──────────────────────────────────────────────────────────┐
│  TOP BAR: Logo | "CodeHealth" | Search repos...  | 🔔 3 | Avatar ▼ │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │                                               │
│          │            MAIN CONTENT AREA                   │
│ 📊 Dash  │                                               │
│ 📁 Repos │         (varies per screen)                   │
│ ⚙ Gates  │                                               │
│ 🔔 Notif │                                               │
│          │                                               │
│ ──────── │                                               │
│ 🌙 Theme │                                               │
│ 🚪 Logout│                                               │
├──────────┴───────────────────────────────────────────────┤
│  FOOTER (minimal): © 2026 CodeHealth · v1.0              │
└──────────────────────────────────────────────────────────┘
```

- **Sidebar:** Fixed 240px, collapsible to 64px icon-only on smaller screens
- **Top bar:** Sticky, 56px height. Notification bell shows unread count badge.
- **Theme:** Dark mode default (developer audience), light mode toggle

---

### Screen 1: Repository List / Overview

**Route:** `/dashboard`

```
┌─────────────────────────────────────────────────────────┐
│  HEADER STATS ROW (4 cards, equal width)                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐ │
│  │ Total     │ │ Avg Health│ │ Total Debt│ │ Active  │ │
│  │ Repos: 8  │ │ Score: 74 │ │ 42h 15m   │ │ PRs: 12 │ │
│  └───────────┘ └───────────┘ └───────────┘ └─────────┘ │
│                                                         │
│  ┌─ Search + Filter Bar ──────────────────────────────┐ │
│  │ 🔍 Search repos...  | Lang ▼ | Score ▼ | + Link   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  REPO CARDS (grid: 2-3 columns)                        │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │ 📁 user/my-project   │  │ 📁 user/api-service      │ │
│  │ TS · main             │  │ Python · main             │ │
│  │                       │  │                           │ │
│  │ [====78====] 🟢       │  │ [===62===] 🟠             │ │
│  │ Health Score           │  │ Health Score               │ │
│  │                       │  │                           │ │
│  │ ▲ +2.3 vs last scan  │  │ ▼ -5.1 vs last scan      │ │
│  │ Debt: 3h 20m          │  │ Debt: 8h 45m              │ │
│  │ Open PRs: 3           │  │ Open PRs: 1               │ │
│  │ ─────────────────     │  │ ─────────────────         │ │
│  │ Last scan: 2h ago     │  │ Last scan: 1d ago         │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `StatCard` × 4 — total repos, avg score, total debt, active PRs
- `SearchFilterBar` — text search, language dropdown, score range filter, "+ Link Repository" button
- `RepoCard` (grid) — health score gauge (circular or linear), delta indicator (▲/▼ with color), debt, PR count, last scan timestamp
- "+ Link Repository" opens a modal listing available GitHub repos (from `GET /api/repos/available`)

**Interactions:**
- Click repo card → navigate to `/repos/:id`
- Score badge color: green (90+), yellow-green (70-89), orange (50-69), red (<50)
- Sort by: name, score (asc/desc), last analyzed

---

### Screen 2: Repository Detail

**Route:** `/repos/:repoId`

```
┌─────────────────────────────────────────────────────────┐
│  BREADCRUMB: Dashboard > user/my-project                │
│                                                         │
│  ┌─── HERO SECTION ───────────────────────────────────┐ │
│  │                                                     │ │
│  │   ┌─────────┐   user/my-project                    │ │
│  │   │   78    │   TypeScript · main · Active          │ │
│  │   │  /100   │   Last analyzed: 2 hours ago          │ │
│  │   │  🟢    │   ▲ +2.3 from previous                │ │
│  │   └─────────┘                                       │ │
│  │   (large circular gauge)                            │ │
│  │                                                     │ │
│  │   Debt: 3h 20m (▼ -15m)  |  Issues: 38  |  LOC: 12K│ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─── TAB BAR ────────────────────────────────────────┐ │
│  │ [Overview]  [PRs]  [Findings]  [Quality Gate]      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ═══ OVERVIEW TAB ═══                                  │
│                                                         │
│  ┌── Trend Chart (60% width) ──┐ ┌── Debt Breakdown ─┐ │
│  │                             │ │   (donut chart)    │ │
│  │  Health Score Over Time     │ │                    │ │
│  │  [7d] [30d] [90d] [1y]     │ │  🔴 Vuln: 60m     │ │
│  │                             │ │  🟠 Complex: 80m  │ │
│  │  100├─────────────────      │ │  🟡 Dup: 50m      │ │
│  │   80├──╱──╲──╱──────        │ │  🔵 Smell: 50m    │ │
│  │   60├─╱────╲╱───────        │ │                    │ │
│  │   40├───────────────        │ │  Total: 3h 20m     │ │
│  │     └──┬──┬──┬──┬──         │ │                    │ │
│  │      May Jun Jul Aug        │ │                    │ │
│  └─────────────────────────────┘ └────────────────────┘ │
│                                                         │
│  ┌── Worst Offending Files ─────────────────────────┐   │
│  │ #  File                    Issues  New  Debt      │   │
│  │ 1  src/services/analyzer   12     3    95m   ▶   │   │
│  │ 2  src/utils/parser         8     0    45m   ▶   │   │
│  │ 3  src/routes/webhook       6     2    35m   ▶   │   │
│  │ 4  src/middleware/auth      5     1    30m   ▶   │   │
│  │ 5  src/config/database      4     0    20m   ▶   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌── Recent PR Scans ──────────────────────────────────┐│
│  │ PR    Title              Score  Gate    Date     ▶  ││
│  │ #42   Add user auth      78     ✅PASS  2h ago   ▶  ││
│  │ #41   Fix login bug      82     ✅PASS  1d ago   ▶  ││
│  │ #40   Add payments       55     ❌FAIL  3d ago   ▶  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `HealthGauge` — large circular progress indicator (SVG), prominent number, color-coded
- `DeltaIndicator` — ▲/▼ with green/red coloring
- `TrendLineChart` (Recharts `LineChart`) — time range selector: 7d / 30d / 90d / 1y buttons
- `DebtDonutChart` (Recharts `PieChart`) — breakdown by category with legend
- `HotspotTable` — sortable table, columns: rank, file path, total issues, new issues, debt minutes
- `PRScanTable` — PR number, title, score badge, gate result (✅/❌), relative time, click to drill down
- `TabBar` — Overview | PRs | Findings | Quality Gate

**Interactions:**
- Time range buttons update trend chart via query param `?days=7|30|90|365`
- Click file row → filter findings view to that file
- Click PR row → navigate to `/repos/:id/pulls/:prNumber`
- Hover on trend chart → tooltip with exact score + date

---

### Screen 3: PR Finding Drill-Down

**Route:** `/repos/:repoId/pulls/:prNumber`

```
┌─────────────────────────────────────────────────────────┐
│  BREADCRUMB: Dashboard > user/my-project > PR #42       │
│                                                         │
│  ┌── PR Header ────────────────────────────────────────┐│
│  │ PR #42: Add user auth                               ││
│  │ rumeshc · feature/auth → main · abc123d             ││
│  │ Score: 78 🟢  |  Gate: ✅ PASS  |  New: 3  Fixed: 5 ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌── Filter Bar ───────────────────────────────────────┐│
│  │ Category: [All ▼]  Severity: [All ▼]  [New Only ☐] ││
│  │ File: [🔍 filter...]                  38 findings   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌── Findings List ────────────────────────────────────┐│
│  │                                                     ││
│  │  🔴 CRITICAL · vulnerability · NEW                  ││
│  │  src/auth.ts:42                                     ││
│  │  SQL injection: user input used in query (B101)     ││
│  │  Tool: bandit · Fix time: ~60 min                   ││
│  │  ─────────────────────────────────────────────      ││
│  │                                                     ││
│  │  🟠 HIGH · complexity                               ││
│  │  src/services/analyzerService.ts:87                 ││
│  │  Function 'processResults' cyclomatic complexity 15 ││
│  │  Tool: eslint · Fix time: ~25 min                   ││
│  │  ─────────────────────────────────────────────      ││
│  │                                                     ││
│  │  🟡 MEDIUM · code_smell                             ││
│  │  src/utils/parser.ts:120                            ││
│  │  Unused variable 'tempResult' (no-unused-vars)      ││
│  │  Tool: eslint · Fix time: ~5 min                    ││
│  │                                                     ││
│  │  ... (paginated, 50 per page)                       ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `PRHeader` — PR metadata, score badge, gate result, new/fixed counts
- `FindingFilterBar` — dropdowns for category, severity; checkbox for "New Only"; file text filter
- `FindingCard` (list) — severity icon + color, category badge, "NEW" tag if `isNew`, file:line, message, tool name, estimated fix time

**Interactions:**
- Filter dropdowns trigger `GET /api/snapshots/:id/findings?category=...&severity=...&isNew=...`
- Click file path → could link to GitHub file at that line (stretch goal)
- Pagination at bottom (50 findings per page)
- "NEW" badge is visually prominent (filled red/orange tag) vs carried-over (muted gray)

---

### Screen 4: Quality Gate Configuration

**Route:** `/repos/:repoId/quality-gate`

```
┌─────────────────────────────────────────────────────────┐
│  BREADCRUMB: Dashboard > user/my-project > Quality Gate │
│                                                         │
│  ┌── Gate Status Card ─────────────────────────────────┐│
│  │ Current Status: ✅ Passing (Score: 78, Min: 60)     ││
│  │ Last evaluated: PR #42 · 2 hours ago                ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌── Configuration Form ───────────────────────────────┐│
│  │                                                     ││
│  │  Minimum Health Score                               ││
│  │  [====●==========] 60 / 100                         ││
│  │  (slider + number input)                            ││
│  │                                                     ││
│  │  Maximum Vulnerabilities                            ││
│  │  [  5  ] findings  ☐ No limit                       ││
│  │                                                     ││
│  │  Maximum Duplication                                ││
│  │  [  10 ] %         ☐ No limit                       ││
│  │                                                     ││
│  │  Maximum Complexity Score                           ││
│  │  [    ] score      ☑ No limit                       ││
│  │                                                     ││
│  │  ┌──────────────────────────────────────────┐       ││
│  │  │ ☐ Block PRs that fail this gate          │       ││
│  │  │   (Posts failing commit status on GitHub) │       ││
│  │  └──────────────────────────────────────────┘       ││
│  │                                                     ││
│  │  [Save Changes]  [Reset to Defaults]                ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌── Gate History ─────────────────────────────────────┐│
│  │ PR #42 · ✅ PASS · Score 78 ≥ 60 · 2h ago          ││
│  │ PR #41 · ✅ PASS · Score 82 ≥ 60 · 1d ago          ││
│  │ PR #40 · ❌ FAIL · Score 55 < 60 · 3d ago          ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `GateStatusBanner` — pass/fail with current score vs threshold
- `SliderInput` — min health score (0-100 range slider with number input)
- `NumberInput` + "No limit" checkbox — for vulnerability count, duplication %, complexity
- `ToggleSwitch` — "Block PRs" with explanation text
- `GateHistoryList` — recent evaluations with pass/fail results

**Interactions:**
- Slider updates number input and vice versa
- "No limit" checkbox clears the number input and sends `null`
- Save calls `PUT /api/repos/:id/quality-gate`
- Form validation: score must be 0-100, counts must be ≥0

---

## Part B: Mobile App (React Native / Expo)

### Design Philosophy — Web vs Mobile Differences

| Aspect | Web Dashboard | Mobile App |
|---|---|---|
| **Primary use** | Deep analysis, configuration, trend review | Quick glance, notifications, on-the-go monitoring |
| **Layout** | Multi-column, sidebar, tabs, tables | Single column, cards, bottom tab navigator |
| **Charts** | Full interactive charts with hover tooltips | Simplified sparkline charts, tap for detail |
| **Tables** | Full sortable data tables | Card lists with key metrics only |
| **Configuration** | Full quality gate editor | Read-only gate status (configure on web) |
| **Findings** | Paginated list with filters | Top 5-10 findings only, link to web for full list |

---

### Screen M1: Repository List (Home)

```
┌───────────────────────┐
│  ◉ CodeHealth    🔔 3 │  ← Status bar area
├───────────────────────┤
│                       │
│  Good morning,        │
│  Rumesh 👋            │
│                       │
│  ┌─────────────────┐  │
│  │ 8 repos · Avg 74│  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ 📁 my-project    │  │
│  │ TS · 78 🟢 ▲+2.3│  │
│  │ Debt: 3h 20m     │  │
│  │ 3 open PRs       │  │
│  │ ▔▔▔╱╲▔▔▔▔▔▔▔▔▔▔ │  │  ← mini sparkline
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ 📁 api-service   │  │
│  │ Py · 62 🟠 ▼-5.1│  │
│  │ Debt: 8h 45m     │  │
│  │ 1 open PR        │  │
│  │ ▔▔╲▔▔╱▔╲▔▔▔▔▔▔▔ │  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ 📁 frontend      │  │
│  │ TS · 91 🟢 ▲+1.0│  │
│  │ ...               │  │
│  └─────────────────┘  │
│                       │
├───────────────────────┤
│  🏠    📊    🔔    👤 │  ← Bottom tab bar
│ Home  Repos Notif  Me │
└───────────────────────┘
```

**Components:**
- `GreetingHeader` — user name, avatar, time-based greeting
- `SummaryBadge` — total repos + average score
- `RepoCard` (vertical list, `FlatList`) — name, language badge, score with color dot, delta arrow, debt, open PR count, mini sparkline (last 7 scores)
- `BottomTabNavigator` — Home, Repos, Notifications, Profile

**Interactions:**
- Tap repo card → navigate to Repo Summary (Screen M3)
- Pull-to-refresh → calls `GET /api/mobile/summary`
- Data source: `GET /api/mobile/summary` (single aggregated call)

---

### Screen M2: Notifications

```
┌───────────────────────┐
│  Notifications   Mark │
│                  all  │
├───────────────────────┤
│                       │
│  TODAY                │
│  ┌─────────────────┐  │
│  │ ❌ Gate Failed    │  │
│  │ PR #42 on        │  │
│  │ my-project       │  │
│  │ Score 55 < 60    │  │
│  │ 2 min ago    ●   │  │  ← ● = unread dot
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ ⚠️ Critical Vuln │  │
│  │ SQL injection in │  │
│  │ api-service PR#8 │  │
│  │ 1h ago           │  │
│  └─────────────────┘  │
│                       │
│  YESTERDAY            │
│  ┌─────────────────┐  │
│  │ ✅ Analysis Done  │  │
│  │ my-project PR#41 │  │
│  │ Score: 82 🟢     │  │
│  │ 1d ago           │  │
│  └─────────────────┘  │
│                       │
├───────────────────────┤
│  🏠    📊    🔔    👤 │
└───────────────────────┘
```

**Push Notification Types:**

| Event | Title | Body | Tap Action |
|---|---|---|---|
| `gate_fail` | "Quality Gate Failed ❌" | "PR #42 on user/my-project scored 55/100 (min: 60)" | Navigate to repo summary |
| `analysis_complete` | "Analysis Complete ✅" | "PR #42 scored 78/100 — 3 new issues" | Navigate to repo summary |
| `score_drop` | "Score Drop ⚠️" | "user/my-project dropped 10+ points to 55" | Navigate to repo summary |
| `critical_vuln` | "Critical Vulnerability 🔴" | "SQL injection found in src/auth.ts (PR #42)" | Navigate to repo summary |

**Components:**
- `NotificationCard` — icon by type, title, body, relative time, unread dot
- `SectionHeader` — "Today", "Yesterday", "Earlier"
- "Mark all read" button in header

**Interactions:**
- Tap notification → mark as read + navigate to relevant repo summary
- Swipe left → mark as read
- Expo Push Notifications handle background/foreground delivery

---

### Screen M3: Repo Quick-View Summary

```
┌───────────────────────┐
│  ← my-project    ⚙   │
├───────────────────────┤
│                       │
│      ┌─────────┐      │
│      │         │      │
│      │   78    │      │  ← Large circular gauge
│      │  /100   │      │
│      │   🟢   │      │
│      └─────────┘      │
│   ▲ +2.3 vs last scan│
│                       │
│  ┌─────────────────┐  │
│  │ Trend (7 days)   │  │
│  │ ╱╲  ╱────────── │  │  ← Simplified line chart
│  │╱  ╲╱            │  │
│  │ [7d] [30d]      │  │
│  └─────────────────┘  │
│                       │
│  ┌── Category Split ─┐│
│  │ 🔴 Vuln    2  60m ││
│  │ 🟠 Cmplx   8  80m ││
│  │ 🟡 Dup     5  50m ││
│  │ 🔵 Smell  23  50m ││
│  │ Total: 3h 20m     ││
│  └────────────────────┘│
│                       │
│  ┌── Top Issues ─────┐│
│  │ 🔴 CRIT · B101    ││
│  │ src/auth.ts:42     ││
│  │ SQL injection  NEW ││
│  │ ─────────────────  ││
│  │ 🟠 HIGH · complx  ││
│  │ src/service.ts:87  ││
│  │ CC=15 (max 10)     ││
│  │ ─────────────────  ││
│  │ 🟡 MED · no-var   ││
│  │ src/utils.ts:120   ││
│  │ Unused variable    ││
│  │ ─────────────────  ││
│  │  View all on web → ││
│  └────────────────────┘│
│                       │
│  ┌── Recent PRs ─────┐│
│  │ #42 Add auth 78 ✅ ││
│  │ #41 Fix bug  82 ✅ ││
│  │ #40 Payments 55 ❌ ││
│  └────────────────────┘│
│                       │
├───────────────────────┤
│  🏠    📊    🔔    👤 │
└───────────────────────┘
```

**Components:**
- `HealthGauge` — large circular SVG gauge (same concept as web, sized for mobile)
- `SparklineChart` — simplified Recharts/Victory Native line chart, just 7d/30d toggle
- `CategoryBreakdown` — colored rows showing category, count, debt minutes (no donut chart — too small on mobile, use horizontal bars instead)
- `TopIssuesList` — top 3-5 findings by severity, showing file:line, message, "NEW" tag
- `RecentPRList` — last 3 PRs with score + gate result
- "View all on web →" link — deep link or just a prompt to use the dashboard

**Interactions:**
- Tap trend chart toggle (7d/30d)
- Tap issue card → show detail bottom sheet with full message
- "View all on web" → opens web dashboard URL in device browser
- ⚙ button → read-only quality gate status (no editing on mobile)
- Data source: `GET /api/mobile/repos/:id/smells` + `GET /api/repos/:id` (or combine)

---

## Component Library Summary

### Web Components to Build

| Component | Used On | Library |
|---|---|---|
| `HealthGauge` (circular) | Repo detail hero | SVG / custom |
| `TrendLineChart` | Repo detail | Recharts `LineChart` |
| `DebtDonutChart` | Repo detail | Recharts `PieChart` |
| `RepoCard` | Dashboard grid | Custom card |
| `FindingCard` | PR drill-down | Custom card |
| `HotspotTable` | Repo detail | HTML table / custom |
| `PRScanTable` | Repo detail | HTML table / custom |
| `SliderInput` | Quality gate | Range input + number |
| `FilterBar` | Findings, repo list | Dropdowns + search |
| `DeltaIndicator` | Everywhere | Inline ▲/▼ badge |
| `NotificationBell` | Top bar | Badge + dropdown |

### Mobile Components to Build

| Component | Used On | Library |
|---|---|---|
| `HealthGauge` (circular) | Repo summary | `react-native-svg` |
| `SparklineChart` | Repo card, summary | `victory-native` or `react-native-chart-kit` |
| `RepoCard` | Home list | Custom card (RN) |
| `NotificationCard` | Notifications | Custom card (RN) |
| `CategoryBar` | Repo summary | Horizontal bar (RN) |
| `IssueCard` | Repo summary | Custom card (RN) |
| `BottomTabNav` | Global | `@react-navigation/bottom-tabs` |

---

## Key Web ↔ Mobile Differences

| Feature | Web | Mobile | Reason |
|---|---|---|---|
| Findings list | Full paginated list with filters | Top 5 + "view on web" link | Screen size; mobile is for awareness, not deep debugging |
| Quality gate config | Full edit form | Read-only status | Editing complex forms on mobile is frustrating; configure once on web |
| Trend chart | Interactive with hover tooltips | Simple sparkline with tap | Touch interaction is coarser; keep charts glanceable |
| Debt breakdown | Donut chart with legend | Horizontal colored bars | Donut labels too small on mobile |
| Hotspot table | Full sortable table | Not shown on mobile | Tables don't work well on narrow screens |
| Navigation | Sidebar + tabs | Bottom tab navigator | Mobile standard pattern |
| Data loading | Per-endpoint calls | `GET /api/mobile/summary` | Minimize network calls on cellular |

---

*These specifications give enough structural detail for Teammate 1 (web) and Teammate 2 (mobile) to start building components immediately. Exact colors, fonts, and spacing should follow the design system established in Sprint 0.*
