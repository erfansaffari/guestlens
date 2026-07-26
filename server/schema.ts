import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  context: text('context'),
  eventLink: text('event_link'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('events_owner_idx').on(table.ownerId)])

export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  normalisedName: text('normalised_name').notNull(),
  linkedinUrl: text('linkedin_url'),
  linkedinSlug: text('linkedin_slug'),
  profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  matchScore: integer('match_score'),
  confidence: text('confidence'),
  status: text('status').notNull().default('pending'),
  searchProvider: text('search_provider'),
  lastSearchedAt: timestamp('last_searched_at', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  userConfirmed: boolean('user_confirmed').notNull().default(false),
  ...timestamps,
}, (table) => [index('people_name_idx').on(table.normalisedName), index('people_linkedin_idx').on(table.linkedinUrl)])

export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  ordinal: integer('ordinal').notNull(),
  ...timestamps,
}, (table) => [index('event_attendees_event_idx').on(table.eventId, table.ordinal)])

export const searchCandidates = pgTable('search_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  url: text('url').notNull(), title: text('title').notNull(), snippet: text('snippet').notNull(), thumbnailUrl: text('thumbnail_url'),
  score: integer('score').notNull(), rank: integer('rank').notNull(),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  fields: jsonb('fields').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
}, (table) => [index('candidate_person_idx').on(table.personId, table.rank)])

export const searchAttempts = pgTable('search_attempts', {
  id: uuid('id').defaultRandom().primaryKey(), personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }), query: text('query').notNull(), provider: text('provider').notNull(),
  requestType: text('request_type').notNull(), status: text('status').notNull(), resultCount: integer('result_count').notNull().default(0),
  estimatedCost: integer('estimated_cost'), durationMs: integer('duration_ms').notNull(), cacheHit: boolean('cache_hit').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const searchQueryCache = pgTable('search_query_cache', {
  query: text('query').primaryKey(), provider: text('provider').notNull(), result: jsonb('result').$type<unknown>().notNull(),
  status: text('status').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ...timestamps,
})

export const nameResolutions = pgTable('name_resolutions', {
  lookupKey: text('lookup_key').primaryKey(), normalisedName: text('normalised_name').notNull(), linkedinUrl: text('linkedin_url'),
  confidence: text('confidence').notNull(), userConfirmed: boolean('user_confirmed').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }), ...timestamps,
})

export const profileCache = pgTable('profile_cache', {
  linkedinUrl: text('linkedin_url').primaryKey(), profile: jsonb('profile').$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ...timestamps,
})
