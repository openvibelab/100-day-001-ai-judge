import { createClient } from '@supabase/supabase-js'

let cachedClient

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('supabase-timeout'), 8000)

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal || controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export function getServiceSupabase() {
  if (cachedClient) return cachedClient

  const url = process.env.SUPABASE_URL || process.env.supabase_url || process.env.VITE_SUPABASE_URL || ''
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.service_role_key ||
    process.env.supabase_service_role_key ||
    ''

  if (!url || !serviceRoleKey) return null

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  })
  return cachedClient
}

export function isTimeoutError(error) {
  const message = String(error?.message || error || '')
  return error?.name === 'AbortError' || message.includes('supabase-timeout') || message.includes('timed out')
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
