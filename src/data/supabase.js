import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ---- Helpers ----

function generateId() {
  const ts = Date.now().toString(36)
  const rand = crypto.getRandomValues(new Uint8Array(6))
  const randStr = Array.from(rand, b => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
  return `${ts}-${randStr}`
}

const CASES_KEY = 'aj_cases'
const HISTORY_KEY = 'aj_my_history'

function getLocalCases() {
  try { return JSON.parse(localStorage.getItem(CASES_KEY) || '{}') } catch { return {} }
}

function setLocalCases(cases) {
  try {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases))
  } catch {
    // Quota exceeded — keep only recent 20
    const entries = Object.entries(cases)
    if (entries.length > 20) {
      const recent = Object.fromEntries(
        entries.sort((a, b) => (b[1].created_at || '').localeCompare(a[1].created_at || '')).slice(0, 20)
      )
      try { localStorage.setItem(CASES_KEY, JSON.stringify(recent)) } catch { /* give up */ }
    }
  }
}

function addToHistory(id) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    history.unshift(id)
    // Keep last 50
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)))
  } catch { /* ignore */ }
}

// ---- Data API ----

export async function saveCase(data) {
  const id = generateId()
  const record = { id, ...data, created_at: new Date().toISOString() }

  if (supabase) {
    const { error } = await supabase.from('cases').insert(record)
    if (error) console.error('Supabase save error:', error)
  }

  const all = getLocalCases()
  all[id] = record
  setLocalCases(all)
  addToHistory(id)
  return id
}

export async function getCase(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single()
    if (data && !error) return data
  }
  const all = getLocalCases()
  return all[id] || null
}

export async function getCaseCount() {
  if (supabase) {
    const { count, error } = await supabase.from('cases').select('*', { count: 'exact', head: true })
    if (!error && count !== null) return count
  }
  return Object.keys(getLocalCases()).length
}

export function getMyHistoryIds() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export async function getMyHistory() {
  const ids = getMyHistoryIds()
  if (ids.length === 0) return []

  if (supabase) {
    const { data } = await supabase
      .from('cases')
      .select('id, mode, result, created_at')
      .in('id', ids.slice(0, 20))
      .order('created_at', { ascending: false })
    if (data && data.length > 0) return data
  }

  // Fallback to localStorage
  const all = getLocalCases()
  return ids.slice(0, 20).map(id => all[id]).filter(Boolean)
}

export async function getRecentPublicCases(limit = 10) {
  if (!supabase) return []
  const { data } = await supabase
    .from('cases')
    .select('id, result, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function voteCase(id, vote /* 'up' | 'down' */) {
  if (!supabase) return
  const { error } = await supabase.from('votes').insert({ case_id: id, vote })
  if (error) console.error('Vote error:', error)
}

export async function getVotes(id) {
  if (!supabase) return { up: 0, down: 0 }
  const { data } = await supabase
    .from('votes')
    .select('vote')
    .eq('case_id', id)
  const up = data?.filter(v => v.vote === 'up').length || 0
  const down = data?.filter(v => v.vote === 'down').length || 0
  return { up, down }
}
