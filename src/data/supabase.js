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
  const record = { id, ...data, created_at: new Date().toISOString(), _serverSynced: false }

  try {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('Server save error:', errorData.error || res.status)
    } else {
      record._serverSynced = true
    }
  } catch (error) {
    console.error('Server save request failed:', error)
  }

  const all = getLocalCases()
  all[id] = record
  setLocalCases(all)
  addToHistory(id)
  return id
}

export async function getCase(id) {
  try {
    const res = await fetch(`/api/cases?id=${encodeURIComponent(id)}`)
    if (res.ok) {
      const payload = await res.json()
      if (payload.data) return payload.data
    }
  } catch (error) {
    console.error('Server get case request failed:', error)
  }
  const all = getLocalCases()
  return all[id] || null
}

export async function getCaseCount() {
  try {
    const res = await fetch('/api/cases?count=1')
    if (res.ok) {
      const payload = await res.json()
      if (typeof payload.count === 'number') return payload.count
    }
  } catch (error) {
    console.error('Server count request failed:', error)
  }
  return Object.keys(getLocalCases()).length
}

export function getMyHistoryIds() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export async function getMyHistory() {
  const ids = getMyHistoryIds()
  if (ids.length === 0) return []

  try {
    const query = ids.slice(0, 20).map(encodeURIComponent).join(',')
    const res = await fetch(`/api/cases?ids=${query}`)
    if (res.ok) {
      const payload = await res.json()
      if (Array.isArray(payload.data) && payload.data.length > 0) return payload.data
    }
  } catch (error) {
    console.error('Server history request failed:', error)
  }

  // Fallback to localStorage
  const all = getLocalCases()
  return ids.slice(0, 20).map(id => all[id]).filter(Boolean)
}

export async function getRecentPublicCases(limit = 10) {
  try {
    const res = await fetch(`/api/cases?recent=${encodeURIComponent(limit)}`)
    if (res.ok) {
      const payload = await res.json()
      return payload.data || []
    }
  } catch (error) {
    console.error('Server recent cases request failed:', error)
  }
  return []
}

export async function voteCase(id, vote /* 'up' | 'down' */) {
  try {
    const res = await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: id, vote }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      console.error('Vote error:', payload.error || res.status)
    }
  } catch (error) {
    console.error('Vote request failed:', error)
  }
}

export async function getVotes(id) {
  try {
    const res = await fetch(`/api/votes?case_id=${encodeURIComponent(id)}`)
    if (res.ok) {
      return await res.json()
    }
  } catch (error) {
    console.error('Get votes request failed:', error)
  }
  return { up: 0, down: 0 }
}
