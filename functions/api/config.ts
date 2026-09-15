/**
 * GET /api/config: runtime client configuration (DECISIONS §5). The Turnstile site key is a
 * plain Pages var, so adding it later needs no rebuild; the client reads this once, lazily.
 *
 *   200 { "turnstileSiteKey": string | null }     Cache-Control: public, max-age=300
 */
import type { Handler } from '../_lib/env'
import { json } from '../_lib/respond'

export const onRequest: Handler = ({ request, env }) => {
  const res = json(
    { turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || null },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
  return request.method === 'HEAD' ? new Response(null, res) : res
}
