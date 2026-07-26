# GuestLens

GuestLens imports an attendee list, queues public LinkedIn candidate enrichment, and progressively shows high-confidence or reviewable profile matches. It does not scrape LinkedIn and it does not infer gender or other sensitive traits.

## Production services

GuestLens requires PostgreSQL, Redis, Clerk, and a server-side search-provider key. Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgres://...
REDIS_URL=redis://...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
SERPAPI_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

Run database migrations before starting the services:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

`npm run dev` starts the Express API, BullMQ worker, and Vite UI. Worker/provider configuration, CORS, rate limits, import maximums, concurrency, and daily/monthly search budgets are all environment-controlled; see `.env.example`.

## Enrichment behavior

- The first search is `site:linkedin.com/in "Full Name" "Canada"`; Waterloo/Toronto and unrestricted searches are fallbacks only.
- Only canonical `/in/<slug>` URLs participate in matching. Results are automatically resolved only at high confidence with a clear lead over the next candidate.
- Ambiguous people retain up to three candidates for an authenticated user to confirm or correct.
- Profile image search is lazy and accepts only images tied to the exact selected LinkedIn URL.
- Ask AI is authenticated and rate limited. It uses only the event's stored public search metadata, never invents profile facts, and requires `OPENAI_API_KEY`.
- Query, resolution, and profile information use PostgreSQL TTL records. Redis coordinates workers, queue locks, budgets, and live event updates.
