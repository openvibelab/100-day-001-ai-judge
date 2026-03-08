import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ---- Helpers ----

function generateId() {
  // URL-safe, collision-resistant: timestamp + random
  const ts = Date.now().toString(36)
  const rand = crypto.getRandomValues(new Uint8Array(6))
  const randStr = Array.from(rand, b => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
  return `${ts}-${randStr}`
}

const STORAGE_KEY = 'aj_cases'

function getLocalCases() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function setLocalCases(cases) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
  } catch (e) {
    // localStorage quota exceeded — clear old entries
    console.warn('localStorage quota exceeded, clearing old cases')
    const entries = Object.entries(cases)
    if (entries.length > 10) {
      const recent = Object.fromEntries(
        entries.sort((a, b) => b[1].created_at?.localeCompare(a[1].created_at)).slice(0, 10)
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
    }
  }
}

// ---- Data API ----

export async function saveCase(data) {
  const id = generateId()
  const record = { id, ...data, created_at: new Date().toISOString() }

  if (supabase) {
    const { error } = await supabase.from('cases').insert(record)
    if (error) {
      console.error('Supabase save error:', error)
      // Don't throw — fall through to localStorage
    }
  }

  // Always save locally as fallback
  const all = getLocalCases()
  all[id] = record
  setLocalCases(all)
  return id
}

export async function getCase(id) {
  // Try Supabase first
  if (supabase) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single()
    if (data && !error) return data
  }

  // Fallback to localStorage
  const all = getLocalCases()
  return all[id] || null
}

// ---- Phase 2 stubs ----

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

export async function listCases(page = 0, limit = 20) {
  if (!supabase) return []
  const { data } = await supabase
    .from('cases')
    .select('id, result, created_at')
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)
  return data || []
}
