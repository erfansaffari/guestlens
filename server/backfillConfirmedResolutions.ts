import dotenv from 'dotenv'
import { sql } from 'drizzle-orm'
import { db } from './db'

dotenv.config({ override: true })

async function backfillConfirmedResolutions() {
  const database = db()
  const resolutions = await database.execute(sql`
    INSERT INTO name_resolutions (lookup_key, normalised_name, linkedin_url, confidence, user_confirmed, expires_at, updated_at)
    SELECT DISTINCT ON (normalised_name)
      normalised_name || ':canada', normalised_name, linkedin_url, 'high', true, NOW() + INTERVAL '180 days', NOW()
    FROM people
    WHERE user_confirmed = true AND linkedin_url IS NOT NULL
    ORDER BY normalised_name, last_verified_at DESC NULLS LAST, updated_at DESC
    ON CONFLICT (lookup_key) DO UPDATE SET
      linkedin_url = EXCLUDED.linkedin_url,
      confidence = EXCLUDED.confidence,
      user_confirmed = EXCLUDED.user_confirmed,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at
  `)
  const people = await database.execute(sql`
    WITH confirmed AS (
      SELECT DISTINCT ON (normalised_name) normalised_name, linkedin_url, linkedin_slug, profile
      FROM people
      WHERE user_confirmed = true AND linkedin_url IS NOT NULL
      ORDER BY normalised_name, last_verified_at DESC NULLS LAST, updated_at DESC
    )
    UPDATE people AS pending
    SET linkedin_url = confirmed.linkedin_url,
        linkedin_slug = confirmed.linkedin_slug,
        profile = confirmed.profile,
        status = 'resolved',
        confidence = 'high',
        user_confirmed = true,
        updated_at = NOW()
    FROM confirmed
    WHERE pending.normalised_name = confirmed.normalised_name
      AND pending.linkedin_url IS NULL
      AND pending.user_confirmed = false
  `)
  console.log(JSON.stringify({ resolutions: resolutions.count, people: people.count }))
  process.exit(0)
}

backfillConfirmedResolutions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
