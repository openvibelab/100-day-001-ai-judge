import { createClient } from '@supabase/supabase-js'

let cachedClient

export function getServiceSupabase() {
  if (cachedClient) return cachedClient

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!url || !serviceRoleKey) return null

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export function badMethod(req, methods) {
  return jsonResponse({ error: `Method not allowed. Use: ${methods.join(', ')}` }, 405)
}
