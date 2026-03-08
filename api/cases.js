export const config = { runtime: 'edge' }

import { badMethod, getServiceSupabase, isTimeoutError, jsonResponse } from './_lib/supabase.js'

export default async function handler(req) {
  if (req.method === 'POST') {
    return createCase(req)
  }

  if (req.method === 'GET') {
    return queryCases(req)
  }

  return badMethod(req, ['GET', 'POST'])
}

async function createCase(req) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return jsonResponse({ error: 'Supabase server configuration is missing' }, 500)
  }

  try {
    const body = await req.json()
    const record = sanitizeCaseRecord(body)

    if (!record) {
      return jsonResponse({ error: 'Invalid case payload' }, 400)
    }

    const { error } = await supabase.from('cases').insert(record)
    if (error) {
      console.error('Create case error:', error)
      return jsonResponse({ error: 'Failed to save case' }, 502)
    }

    return jsonResponse({ id: record.id })
  } catch (error) {
    console.error('Create case handler error:', error)
    if (isTimeoutError(error)) {
      return jsonResponse({ error: 'Supabase request timed out' }, 504)
    }
    return jsonResponse({ error: 'Server error' }, 500)
  }
}

async function queryCases(req) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return jsonResponse({ error: 'Supabase server configuration is missing' }, 500)
  }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const idsParam = url.searchParams.get('ids')
    const recentParam = url.searchParams.get('recent')
    const wantCount = url.searchParams.get('count') === '1'

    if (id) {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Get case error:', error)
        return jsonResponse({ error: 'Failed to load case' }, 502)
      }

      return jsonResponse({ data: data || null })
    }

    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20)

      if (ids.length === 0) return jsonResponse({ data: [] })

      const { data, error } = await supabase
        .from('cases')
        .select('id, mode, result, created_at')
        .in('id', ids)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Get history error:', error)
        return jsonResponse({ error: 'Failed to load history' }, 502)
      }

      return jsonResponse({ data: data || [] })
    }

    if (wantCount) {
      const { count, error } = await supabase
        .from('cases')
        .select('id', { count: 'planned', head: true })

      if (error) {
        console.error('Get count error:', error)
        return jsonResponse({ error: 'Failed to load count' }, 502)
      }

      return jsonResponse({ count: count || 0 })
    }

    if (recentParam) {
      const limit = Math.min(Math.max(Number.parseInt(recentParam, 10) || 10, 1), 50)
      const { data, error } = await supabase
        .from('cases')
        .select('id, mode, input, result, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Get recent cases error:', error)
        return jsonResponse({ error: 'Failed to load recent cases' }, 502)
      }

      return jsonResponse({ data: data || [] })
    }

    return jsonResponse({ error: 'Missing query parameters' }, 400)
  } catch (error) {
    console.error('Query cases handler error:', error)
    if (isTimeoutError(error)) {
      return jsonResponse({ error: 'Supabase request timed out' }, 504)
    }
    return jsonResponse({ error: 'Server error' }, 500)
  }
}

function sanitizeCaseRecord(body) {
  if (!body || typeof body !== 'object') return null

  const { id, mode, input, result, created_at: createdAt } = body
  if (!id || typeof id !== 'string') return null
  if (!['single', 'multi'].includes(mode)) return null
  if (!input || typeof input !== 'object') return null
  if (!result || typeof result !== 'object') return null

  return {
    id: id.slice(0, 80),
    mode,
    input,
    result,
    created_at: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
  }
}
