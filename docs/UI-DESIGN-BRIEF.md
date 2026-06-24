# GuestLens — UI / Product Design Brief

**Document purpose:** Give a UI designer everything needed to understand what GuestLens does, what the interface must support today, and what the planned public version will require. This document describes **features, sections, states, data, and flows only** — not visual direction, color palettes, or layout aesthetics.

**Product name:** GuestLens  
**Working repo name:** crackup  
**Last updated:** June 2026

---

## 1. Product summary

GuestLens is a **local networking research tool** for event organizers and attendees who have access to a Luma (or similar) guest list.

The user pastes a guest list, optionally adds event location context, and the app:

1. Parses attendee names (and optional company/title/location from CSV).
2. Looks up likely **LinkedIn profiles** via Google search (SerpAPI) — it does **not** scrape LinkedIn directly.
3. Shows enriched people in a searchable directory with profile previews.
4. Lets the user **search locally** as they type, or **ask AI** (Claude) for semantic matches (“who works in AI”, “founders”, etc.).
5. Shows **aggregate name-based estimates** (men / women / unknown counts only — never per-person gender labels).
6. Exports results to CSV.

**Core value proposition:** Before or during an event, quickly figure out **who to talk to** based on public LinkedIn/search metadata — without manually Googling every name.

**Important privacy / ethics constraints the UI must respect:**

- Do **not** show individual guessed gender labels.
- Profile data comes from **public search snippets only**, not full LinkedIn scraping.
- The app does **not** persist guest data to a cloud database in the current version (session + server-side disk cache only).
- Users are expected to only paste guest lists they are **allowed to access** (e.g. their own event’s Luma page).

---

## 2. Primary user personas

| Persona | Goal |
|---------|------|
| **Event host / organizer** | Scan 50–200 guests before a meetup; find founders, investors, engineers, etc. |
| **Attendee** | Paste the public guest list; prep who to introduce themselves to. |
| **Community manager** | Export enriched CSV for internal notes or follow-up. |

**Typical session:** 5–20 minutes, one guest list, many quick profile glances, a few searches.

---

## 3. Information architecture (current app)

The app is a **single-page application** with these top-level regions:

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER — brand, tagline, primary actions                   │
├─────────────────────────────────────────────────────────────┤
│  STATS BAR (visible after “Build network” completes)        │
├──────────────┬──────────────────────────┬─────────────────┤
│  SOURCE      │  PEOPLE / SEARCH         │  PROFILE          │
│  PANEL       │  PANEL                   │  INSPECTOR        │
│  (left)      │  (center)                │  (right desktop)  │
└──────────────┴──────────────────────────┴─────────────────┘
                              │
                    PROFILE DRAWER (mobile / small screens)
```

### 3.1 Header section

**Purpose:** Global identity and the main action to start enrichment.

**Content:**
- Product name: **GuestLens**
- Tagline: **“Find the right people to meet.”**
- **“Luma sample”** button — fills the guest textarea with example Luma-formatted names (for demo/onboarding).
- **“Build network”** primary button — triggers LinkedIn lookup + aggregate stats for all parsed guests.

**States:**
| State | Behavior |
|-------|----------|
| Idle | Build network enabled when ≥1 parsed guest exists |
| Loading | Build network shows spinner; disabled |
| Complete | Stats bar appears; people list populated |
| Error | Error message in source panel |

**Notes for designer:**
- Build network is the **main CTA**; everything else depends on it.
- Header should remain visible while scrolling (sticky optional — not implemented today).

---

### 3.2 Stats bar section

**Visibility:** Only after a successful **Build network** run.

**Purpose:** At-a-glance session metrics.

**Four stat cards (left to right):**

| Label | Example value | Meaning |
|-------|---------------|---------|
| **Guests** | `12` | Total parsed names in the list |
| **LinkedIn found** | `9 / 12` | Profiles matched vs total guests |
| **Serp cache** | `6 hit · 0 new` or `12 searched` | How many lookups used cached results vs new API searches |
| **Name estimate** | `7M · 4F · 1?` | Aggregate men / women / unknown from first names only |

**Important UI rules:**
- Name estimate shows **counts only** — no methodology text, no per-person breakdown, no labels on individuals.
- Cache stat helps users understand API usage; in a public version this may become “usage remaining” instead.

---

### 3.3 Source panel (left column)

**Purpose:** Input guest data and event context; handle errors; export.

**Sub-sections:**

#### A. Panel title
- Title: **“Source”**
- Count badge: **`{n} names`** — updates live as user pastes/parses text

#### B. Event context field
- Single-line text input
- Label: **“Event context”**
- Placeholder: `Waterloo, ON (optional — defaults to Canada)`
- **Function:** Broadens LinkedIn Google search when guest has no location. Defaults to **Canada** if empty.

#### C. Guest list textarea
- Multi-line, primary input
- Label: **“Guest list”**
- Placeholder: `Paste the Luma guest list here...`
- **Live parsing:** Names appear in count immediately; no API call until Build network.

**Supported paste formats:**
- **CSV** with headers: `Name, Company, Title, Location`
- **Luma copy-paste:** lines like `Profile picture for Jane Doe` normalized to `Jane Doe`
- **Plain lines:** one name per line
- **Tab / pipe / double-space separated** columns on plain lines
- Duplicate names removed automatically

**Clearing guest text resets:** enrichment results, AI answer, search query, selected person.

#### D. Source actions row
- **Clear** — empties guest textarea
- **Export** — downloads CSV (disabled until enrichment has run once)

**Export CSV columns:** Name, Headline, Company, School, Location, Summary, LinkedIn URL

#### E. Error / warning messages (conditional)

**Error box (enrichment failed):**
- Red-style alert with message (e.g. API down, server not running)

**Warning box (LinkedIn lookup unavailable):**
- Title: `LinkedIn lookup unavailable`
- Message + hint from API (e.g. missing SerpAPI key, quota exhausted)
- People list still shows parsed names but without LinkedIn enrichment

---

### 3.4 People / search panel (center column)

**Purpose:** Browse all guests; search/filter; view AI answers.

**Sub-sections:**

#### A. AI search bar
- Icon + text input + submit button
- Placeholder examples: `Ask: who studies computer science, who is a founder, who works in AI...`
- **Enter key** or button triggers AI search
- Disabled until enrichment has completed at least once

**Search behavior (hybrid — designer must communicate this clearly):**

| User action | What happens |
|-------------|--------------|
| **Typing in search box** | Instant **local text filter** across names, headlines, company, school, location, bio, etc. No API call. |
| **Enter / search button** | Calls **AI semantic search** (`/api/ask`). Merges AI matches with local matches. |
| **Clear search input** | Restores full people list; clears AI answer |

#### B. AI answer block (conditional)
Visible after AI search completes.

**Content:**
- Strong line: `{n} AI suggested` or `No AI-only matches`
- Body: short natural-language **answer** from Claude explaining the result

**Cached responses:** API may return `fromCache: true` (not shown in UI today — optional indicator for v2).

#### C. Panel title (dynamic)
- Default title: **“People”**
- During active search: **“Search results”**
- Count badge examples:
  - `12 shown`
  - `5 shown · 6 from cache` (when cache hits exist from enrichment)

#### D. People list

**Person card contents:**
| Element | Source |
|---------|--------|
| Avatar | LinkedIn image URL, or **initials fallback** on load error |
| Name | Parsed guest name |
| Subtitle | Headline from LinkedIn, else guest title/company, else “Profile pending” |
| Match reason badge | When searching: `Text match in {field}` or `AI suggested: {reason}` |
| LinkedIn icon link | Opens profile URL in new tab; click does not select card |

**Card interaction:**
- Click / Enter / Space → **selects person** and opens profile (drawer on mobile)
- Selected state visually distinct
- Keyboard accessible (`role="button"`, `tabIndex={0}`)

#### E. Empty states

**No guests pasted:**
- Title: `Paste a guest list to start.`
- Body: explains that after Build network, people appear with photos, titles, LinkedIn links

**Search active but zero matches:**
- Title: `No text matches for “{query}”.`
- Body: prompts to press Enter for AI if enrichment exists; otherwise build network first

---

### 3.5 Profile inspector (right column desktop)

**Purpose:** Full detail view for one selected person.

**Empty state (no selection):**
- Icon + `No profile selected`
- `Build the network, then open a person profile from the list.`

**Filled state structure:**

#### A. Profile hero
- Large avatar (image or initials)
- **Full name** (h2)
- **Headline** (from LinkedIn parser; hidden if only “Profile pending”)

#### B. Profile meta rows (only non-empty fields shown)
| Label | Data |
|-------|------|
| Location | Parsed from search |
| Company | Parsed from search |
| School | Parsed from search |
| Role | Parsed from search (often job title from rich snippet) |
| Followers | e.g. `50+ followers`, `2.6K+ followers` |

#### C. LinkedIn link
- **“Open LinkedIn”** — external link with icon

#### D. Bio section
- Label: **“Bio”**
- **Limited preview notice** (conditional): when Google returned truncated/boilerplate snippet only — explains full LinkedIn bio was not available from search
- Body: full bio text from parser (may still be truncated if Google truncated at source)

#### E. From guest list section (conditional)
- Label: **“From guest list”**
- Shows company · title · location from **original pasted data** (not LinkedIn)

**Data quality states the UI must handle:**
- Profile found with image + rich fields
- Profile found but **preview limited** (weak Google snippet)
- Profile **not found** — card shows “Profile pending”; inspector may only show guest list context
- Wrong-person match is possible — no explicit “report wrong profile” flow today

---

### 3.6 Profile drawer (mobile / narrow viewport)

**Purpose:** Same content as profile inspector, but overlay.

**Behavior:**
- Opens when user selects a person on small screens (also opens on desktop today when clicking list — desktop also has side panel)
- Backdrop click closes
- Close button (X) top corner
- `role="dialog"`, `aria-modal="true"`, labeled with person name

**Designer decision needed:** On desktop, list selection updates side panel **without** forcing drawer; on mobile, drawer is primary. Current code opens drawer on every select — v2 may refine.

---

## 4. User flows (step by step)

### Flow 1: First-time use
1. Land on empty app → center shows empty state
2. Optional: click **Luma sample** → textarea fills
3. Source panel shows `{n} names` immediately
4. Optional: enter event context
5. Click **Build network** → loading
6. Stats bar appears; people list fills with cards
7. First person auto-selected (optional — currently selects first guest)
8. Profile inspector shows first person

### Flow 2: Local search while typing
1. After enrichment, user types `founder` in search bar
2. List filters instantly — no loading spinner
3. Matching cards show `Text match in {field}` badge
4. Panel title → “Search results”
5. Clearing input restores full list

### Flow 3: AI semantic search
1. User types question, presses Enter
2. Ask loading state on button
3. AI answer block appears above list
4. List shows union of local + AI matches
5. AI-only matches badge: `AI suggested: {reason}`
6. Changing question text clears previous AI answer

### Flow 4: Export
1. After enrichment, Export enabled
2. Click → CSV download `networking-people.csv`

### Flow 5: LinkedIn unavailable
1. Build network runs but SerpAPI missing/failed
2. Warning in source panel
3. People list still shows names from paste
4. Cards show “Profile pending”
5. AI ask still requires enrichment response object (works with null profiles but weaker)

---

## 5. Data model (what the UI displays)

### 5.1 Guest / attendee (from paste)
```typescript
{
  id: string           // guest-1, guest-2, ...
  fullName: string
  company?: string     // from CSV or columns
  title?: string
  location?: string
  raw: string          // original line (not shown in UI today)
}
```

### 5.2 LinkedIn profile (from enrichment)
```typescript
{
  title: string
  url: string
  headline: string
  location: string
  company: string
  school: string
  role: string
  followers: string
  bio: string
  summary: string          // same as bio
  snippet: string          // raw Serp snippet
  description: string
  experienceSignal: string // used for search indexing
  imageUrl: string
  previewLimited: boolean  // true = show limited preview notice
}
```

### 5.3 Enrichment response
```typescript
{
  aggregate: { men, women, unknown, method }
  linkedIn: Array<{
    attendeeId: string
    query: string        // not shown in UI today
    status: string       // not shown in UI today
    profile: LinkedInProfile | null
  }>
  search: { ok: true } | { ok: false, message, hint, ... }
  cache: { hits, misses }
  stats: {
    guests, profilesFound, profilesMissing,
    cacheHits, cacheMisses
  }
}
```

### 5.4 AI ask response
```typescript
{
  answer: string
  matches: [{ id: string, reason: string }]
  fromCache?: boolean
}
```

---

## 6. Backend capabilities the UI depends on

| Endpoint | Purpose | When called |
|----------|---------|-------------|
| `POST /api/enrich` | LinkedIn lookup + aggregate stats | Build network |
| `POST /api/ask` | Claude semantic search | Enter / search button |
| `GET /api/health` | SerpAPI / Anthropic status | Not exposed in UI today |

**External services:**
- **SerpAPI** — ~1 Google search per guest (+ optional image search per new profile)
- **Anthropic Claude** — aggregate name estimate + each AI ask
- **Caching** — disk cache reduces repeat API cost (transparent via stats bar)

**Limits today:**
- Max **250 attendees** per enrich request (server enforced)
- No authentication
- No per-user rate limits

---

## 7. Responsive / layout requirements

| Breakpoint | Layout |
|------------|--------|
| **Desktop (wide)** | 3 columns: Source \| People \| Profile inspector |
| **Tablet / mobile** | Source + People stack; profile in **drawer overlay** |

**Scroll behavior:**
- People list scrolls independently within its panel
- Profile inspector scrolls if content is long (bio can be lengthy)
- Stats bar spans full width above columns

**Accessibility requirements:**
- All interactive cards keyboard operable
- Dialog drawer with aria labels
- Error/warning messages readable by screen readers
- Avatar alt text currently empty (`alt=""`) — designer/dev should treat as decorative with name nearby

---

## 8. Loading, error, and edge-case states (checklist)

The UI must account for:

- [ ] Empty guest list
- [ ] Guest list parsing → 0 valid names
- [ ] Build network loading (global)
- [ ] Enrichment error (network, 500, server down)
- [ ] SerpAPI not configured / quota exhausted (warning, partial UI)
- [ ] Profile not found for some guests (mixed list)
- [ ] Profile image failed to load (initials fallback)
- [ ] Limited Google preview (`previewLimited`)
- [ ] Search: no local matches
- [ ] AI ask loading
- [ ] AI ask error (no API key, failure)
- [ ] AI ask: zero matches with explanatory answer
- [ ] Export disabled before enrichment
- [ ] Very long guest lists (100+ cards — performance/list virtualization may be needed in v2)
- [ ] Very long headlines/bios (wrap text, no arbitrary truncation in profile view)

---

## 9. Planned v2 (public deployment) — UI requirements

These features are **planned but not fully built**. The designer should leave room for them in the information architecture.

### 9.1 Authentication & accounts
- Sign in (Google / email — TBD)
- User avatar / account menu in header
- Sign out

### 9.2 Usage limits & quotas
Public version will cap API usage. UI needs:

| Element | Purpose |
|---------|---------|
| **Usage meter** | e.g. “34 / 50 searches today” |
| **Limit reached state** | Block Build network / AI ask with clear message |
| **Upgrade / wait** CTA | If paid tiers added later |

Likely replaces or supplements **“Serp cache”** stat for public users.

### 9.3 Onboarding
- First-visit explanation: paste Luma list → Build network → search
- Privacy note: only paste lists you’re allowed to use
- Optional guided tour

### 9.4 Landing / marketing page (if separate from app)
- What GuestLens does
- How it differs from scraping LinkedIn
- Pricing / free tier limits
- Sign in to app

### 9.5 Settings panel (new section)
- Default event context / location
- API status indicators (optional, admin)
- Clear local session data
- Export preferences

### 9.6 Improved profile quality UX
- **“Wrong person?”** feedback (future)
- **Refresh profile** for one guest (future, costs search credit)
- Confidence indicator when name match is weak (future backend field)

### 9.7 Search improvements
- Search history / suggested queries
- Filter chips: “Has LinkedIn”, “Has photo”, “Founders”, etc.
- Sort: name, match score, followers

### 9.8 Event / list management (future)
- Save named guest lists (requires backend DB)
- Reload previous event
- Share read-only link within team (optional)

### 9.9 Legal / trust footer
- Privacy policy link
- Terms of use
- Disclaimer: data from public search results; not affiliated with Luma or LinkedIn

---

## 10. Explicit non-goals (do not design for)

- Individual gender labels on person cards
- Scraping full LinkedIn profiles or bypassing Luma access controls
- In-app messaging or CRM pipeline
- Persistent cloud storage of guest lists in v1 (session-only today)
- Native mobile app (web responsive only for now)

---

## 11. Copy / terminology reference

| Term in UI | Meaning |
|------------|---------|
| **Build network** | Run enrichment (LinkedIn lookup + stats) |
| **Guest list** | Pasted attendee text |
| **Event context** | Location hint for search |
| **People** | Enriched directory |
| **Name estimate** | Aggregate M/F/? counts — not individual |
| **AI suggested** | Match from Claude, not text filter |
| **Profile pending** | No LinkedIn match yet |
| **From guest list** | Data from paste, not LinkedIn |
| **Preview limited** | Google snippet was incomplete |

---

## 12. Files for designer reference

| File | Relevance |
|------|-----------|
| `src/App.tsx` | All UI sections and states |
| `src/App.css` | Current layout structure (reference only) |
| `src/guestParser.ts` | Input format behavior |
| `src/api.ts` | API response shapes |
| `README.md` | Setup and API key docs |
| `CLAUDE.md` | Engineering context |

---

## 13. Open questions for product + design

1. Should desktop keep **both** side panel and drawer, or side panel only?
2. Should **Name estimate** remain visible in public version or move behind opt-in?
3. How to show **per-guest enrichment progress** for large lists (100+)?
4. Should **AI search** and **text filter** be visually separate controls?
5. Brand name final: **GuestLens** vs other?
6. Is a **landing page** separate from the app, or single URL?

---

*End of brief. For implementation questions, see `CLAUDE.md` and `README.md`.*
