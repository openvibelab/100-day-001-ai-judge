import { badMethod, getServiceSupabase, jsonResponse } from './_lib/supabase.js'

export default async function handler(req) {
  if (req.method === 'POST') {
    return createVote(req)
  }

  if (req.method === 'GET') {
    return getVotes(req)
  }

  return badMethod(req, ['GET', 'POST'])
}

async function createVote(req) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return jsonResponse({ error: 'Supabase server configuration is missing' }, 500)
  }

  try {
    const body = await req.json()
    const caseId = typeof body?.case_id === 'string' ? body.case_id.trim() : ''
    const vote = typeof body?.vote === 'string' ? body.vote.trim() : ''

    if (!caseId || !['up', 'down'].includes(vote)) {
      return jsonResponse({ error: 'Invalid vote payload' }, 400)
    }

    const { error } = await supabase.from('votes').insert({ case_id: caseId, vote })
    if (error) {
      console.error('Create vote error:', error)
      return jsonResponse({ error: 'Failed to save vote' }, 502)
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Create vote handler error:', error)
    return jsonResponse({ error: 'Server error' }, 500)
  }
}

async function getVotes(req) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return jsonResponse({ error: 'Supabase server configuration is missing' }, 500)
  }

  try {
    const url = new URL(req.url)
    const caseId = url.searchParams.get('case_id') || ''
    if (!caseId) return jsonResponse({ error: 'Missing case_id' }, 400)

    const { data, error } = await supabase
      .from('votes')
      .select('vote')
      .eq('case_id', caseId)

    if (error) {
      console.error('Get votes error:', error)
      return jsonResponse({ error: 'Failed to load votes' }, 502)
    }

    const up = data?.filter((entry) => entry.vote === 'up').length || 0
    const down = data?.filter((entry) => entry.vote === 'down').length || 0
    return jsonResponse({ up, down })
  } catch (error) {
    console.error('Get votes handler error:', error)
    return jsonResponse({ error: 'Server error' }, 500)
  }
}
