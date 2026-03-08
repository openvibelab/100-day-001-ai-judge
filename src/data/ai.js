// AI Judge API layer
// Handles: server free quota → quota exceeded → user-provided key fallback

const API_URL = import.meta.env.VITE_AI_API_URL || '/api/judge'

// ---- User API key management ----
export function getUserApiKey() {
  return localStorage.getItem('aj_user_api_key') || ''
}

export function getUserProvider() {
  return localStorage.getItem('aj_user_provider') || 'gemini'
}

export function saveUserApiKey(key, provider) {
  localStorage.setItem('aj_user_api_key', key)
  localStorage.setItem('aj_user_provider', provider)
}

export function clearUserApiKey() {
  localStorage.removeItem('aj_user_api_key')
  localStorage.removeItem('aj_user_provider')
}

export function hasUserApiKey() {
  return !!getUserApiKey()
}

// ---- Request judgment ----
export async function requestJudgment(payload, { useUserKey = false } = {}) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(payload)

  const body = { system: systemPrompt, user: userPrompt }

  // Attach user API key if requested or if stored
  if (useUserKey || hasUserApiKey()) {
    const key = getUserApiKey()
    const provider = getUserProvider()
    if (key) {
      body.userApiKey = key
      body.userProvider = provider
    }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data.code === 'QUOTA_EXCEEDED') {
      const err = new Error(data.error || '免费额度已用完')
      err.code = 'QUOTA_EXCEEDED'
      throw err
    }
    throw new Error(data.error || `请求失败: ${res.status}`)
  }

  const data = await res.json()
  return data.result
}

function buildSystemPrompt() {
  return `你是一个公正客观的争议调解 AI。你的任务是分析争吵/矛盾事件，给出客观评理。

你的输出必须严格按照以下 JSON 格式返回（不要输出其他任何内容）：

{
  "summary": "一句话总结这场争执（10字以内）",
  "winner": "更有理的一方名称，如果势均力敌就写'难分高下'",
  "verdict": "最终裁定：谁更有道理，或者双方各有对错（30字以内）",
  "analysis": "客观分析，分段论述各方的对与错，300字以内",
  "scores": { "甲方": 70, "乙方": 30 },
  "advice": "给双方的建议，如何解决这个矛盾，150字以内"
}

规则：
- scores 是各方"有道理"的比例（总和100）
- 如果有多方（超过2人），scores 包含所有人
- winner 是 scores 中得分最高的人的名字，或"难分高下"（差距小于10分时）
- 保持中立、客观、有理有据
- 用通俗易懂、稍微幽默的中文
- 不要道德绑架
- 如果信息不足以判断，指出缺失的信息`
}

function buildUserPrompt(payload) {
  if (payload.mode === 'single') {
    return `请分析以下争吵事件并给出评理：

${payload.content}`
  }

  let text = `争执主题：${payload.topic}\n\n`
  payload.perspectives.forEach((p) => {
    text += `【${p.name}的视角】\n${p.content}\n\n`
  })
  text += '请综合以上各方视角，给出客观评理。'
  return text
}
