# GuestLens Code Guide

GuestLens is a local networking assistant for Luma guest lists. It parses pasted attendee names, enriches them with Google Custom Search LinkedIn results, and lets the user search people with fast local text matching plus optional Claude semantic suggestions.

## Commands

- `npm run dev`: starts both local servers.
- `npm run dev:web`: starts Vite at `http://localhost:5173`.
- `npm run dev:api`: starts the Express API at `http://localhost:8787`.
- `npm run lint`: ESLint.
- `npm test`: Vitest.
- `npm run build`: TypeScript build plus Vite production build.

The browser uses `http://localhost:5173`. Vite proxies `/api/*` to `http://127.0.0.1:8787`.

## Environment

`.env` is local-only and ignored by git.

Required for enrichment:

```bash
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5
SERPAPI_KEY=...
PORT=8787
```

Without SerpAPI config, LinkedIn lookup returns no profile. Without Anthropic config, `/api/ask` fails and `/api/enrich` falls back for aggregate gender counts, though the UI currently does not render aggregate gender.

## Data Flow

1. `src/guestParser.ts` parses pasted guest text.
   - CSV rows are supported.
   - Luma rows like `Profile picture for Jane Doe` are normalized to `Jane Doe`.
   - Duplicate names are removed.
2. `src/App.tsx` builds the people directory from parsed attendees and enrichment results.
3. `POST /api/enrich` receives attendees and event context.
   - Builds Google queries like `"Name" site:linkedin.com/in "Canada"` when no location is provided.
   - Uses SerpAPI Google search only; it does not scrape LinkedIn.
   - Returns the first LinkedIn result per person as `profile`.
   - Profile data may include title, URL, snippet, public description, experience signal, and image URL from Google metadata.
4. `POST /api/ask` receives a user question plus compact person context.
   - Claude returns strict JSON: `{ answer, matches: [{ id, reason }] }`.
   - The UI merges AI matches with local text matches.

## UI State

Main state lives in `src/App.tsx`.

- `guestText`: raw pasted/imported guest list.
- `eventContext`: context used to broaden LinkedIn Google search.
- `result`: enrichment response from `/api/enrich`.
- `question`: search input value.
- `answer`: AI semantic search response.
- `selectedId`: person shown in the profile inspector/drawer.

Search is hybrid:

- Typing filters locally without an API call.
- Local index fields: name, source context, profile title, description, snippet, and experience signal.
- Clearing the search input restores the full people list.
- Pressing Enter or the search button calls `/api/ask` only after enrichment exists.
- AI-only matches are marked as `AI suggested`.

## Privacy And Boundaries

- Do not bypass Luma access controls.
- Do not scrape LinkedIn pages.
- Do not show individual guessed gender labels.
- Profile photos and descriptions are only from SerpAPI Google search metadata.
- The app is a local research tool; it does not persist attendee data to a database.

## UX Expectations

- The guest list starts empty.
- Parsed people appear immediately after paste/import.
- Enriched people show image or initials, name, title/headline, and LinkedIn link.
- Clicking a person card selects that person.
- Desktop uses an independent profile inspector so list scrolling does not move the profile.
- Mobile opens the selected profile in a drawer.
