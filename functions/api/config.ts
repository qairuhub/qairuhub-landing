/**
 * GET /api/config: runtime client configuration (DECISIONS §5). The Turnstile site key is a
 * plain Pages var, so adding it later needs no rebuild; the client reads this once, lazily.
 *
 *   200 { "turnstileSiteKey": string | null }
 *   Cache-Control: public, max-age=300, stale-while-revalidate=600
 *
 * Cached in the browser only (src/lib/turnstile.ts no longer asks for `no-store`), so a repeat view
 * within 5–15 min makes no request. It is not worth caching at the edge: the Function runs on
 * every request anyway, and this handler does no real work.
 *
 * Turnstile rollout order, because browsers may keep a cached `null` key for up to 15 min:
 *   1. set TURNSTILE_SITE_KEY (plain var) and deploy;
 *   2. wait at least 15 minutes (max-age + stale-while-revalidate);
 *   3. only then set the TURNSTILE_SECRET_KEY secret, which makes the server enforce Turnstile.
 * The other way round, a visitor holding the cached `null` key sends no token and gets
 * `verify_required` from /api/join and /api/ask until the cache runs out.
 */
import type { Handler } from '../_lib/env'
import { json } from '../_lib/respond'

const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600'

export const onRequest: Handler = ({ request, env }) => {
  const res = json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || null }, { headers: { 'Cache-Control': CACHE_CONTROL } })
  return request.method === 'HEAD' ? new Response(null, res) : res
}
