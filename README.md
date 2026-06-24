# GuestLens

Paste a Luma guest list you are allowed to view, normalize the attendees, estimate aggregate men/women/unknown counts, and search Google for likely LinkedIn profile candidates.

The app does not scrape Luma or LinkedIn. LinkedIn lookup is done through SerpAPI Google search queries, and gender presentation is shown only as aggregate counts.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## API keys

Add these to `.env`:

```bash
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5
SERPAPI_KEY=...
```

Without `ANTHROPIC_API_KEY`, the app uses a small local fallback name list for aggregate estimates. Without `SERPAPI_KEY`, LinkedIn candidate search is skipped and the UI shows that search is not configured.

### SerpAPI setup (LinkedIn lookup)

GuestLens uses [SerpAPI](https://serpapi.com/) to run Google searches like `"Jane Doe" site:linkedin.com/in`.

1. Create an account at [serpapi.com](https://serpapi.com/)
2. Copy your API key from [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key)
3. Add it to `.env` as `SERPAPI_KEY=...`
4. Restart `npm run dev`

On startup, the API logs whether SerpAPI is working. You can also check `GET /api/health` for a live probe result.

SerpAPI bills per search. Enriching a guest list runs **one search per attendee**, so a list of 100 people uses 100 SerpAPI searches.

GuestLens caches LinkedIn search results on disk in `.cache/linkedin-search.json`. Re-enriching the same people reuses cached results and does not spend SerpAPI credits. AI ask responses and aggregate estimates are cached too.

Startup uses SerpAPI's free Account API (no search credit spent). Profile photos are fetched with a Google Images search (via SerpAPI) after the LinkedIn profile match is found, then cached in `.cache/linkedin-images.json`. Optional `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` are used for images first when configured.

## Input format

CSV works best:

```csv
Name,Company,Title,Location
Sarah Chen,Northstar Labs,Product Lead,Toronto
```

Copied rows or one guest per line also work.
