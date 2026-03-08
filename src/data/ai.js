// AI Judge API layer
// Priority: user-provided key (encouraged) > server free quota (fallback)

const API_URL = import.meta.env.VITE_AI_API_URL || '/api/judge'

// ---- User API key management ----

const KEY_STORAGE = 'aj_user_api_key'
const PROVIDER_STORAGE = 'aj_user_provider'

export function getUserApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function getUserProvider() {
  return localStorage.getItem(PROVIDER_STORAGE) || 'deepseek'
}

export function saveUserApiKey(key, provider) {
  localStorage.setItem(KEY_STORAGE, key)
  localStorage.setItem(PROVIDER_STORAGE, provider)
}

export function clearUserApiKey() {
  localStorage.removeItem(KEY_STORAGE)
  localStorage.removeItem(PROVIDER_STORAGE)
}

export function hasUserApiKey() {
  return !!getUserApiKey()
}

// ---- Request judgment ----

export async function requestJudgment(payload) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(payload)

  const body = { system: systemPrompt, user: userPrompt }

  // Always send user key if available
  const userKey = getUserApiKey()
  if (userKey) {
    body.userApiKey = userKey
    body.userProvider = getUserProvider()
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
    if (data.code === 'INVALID_KEY') {
      const err = new Error(data.error || 'API Key 无效，请检查后重试')
      err.code = 'INVALID_KEY'
      throw err
    }
    throw new Error(data.error || `请求失败: ${res.status}`)
  }

  const data = await res.json()
  return data.result
}

function buildSystemPrompt() {
  return `你是一个公正客观、说话有趣的争议调解 AI。你的任务是分析争吵/矛盾事件，给出客观评理。

你的输出必须严格按照以下 JSON 格式（不要输出其他内容）：

{
  "summary": "一句话总结（8字以内，要有趣）",
  "winner": "更有理的一方名称。如果势均力敌就写'难分高下'",
  "verdict": "最终裁定（25字以内，简洁有力）",
  "analysis": "客观分析各方对错，有理有据，250字以内。分段论述。",
  "scores": { "甲方": 70, "乙方": 30 },
  "advice": "给双方的实用建议，如何化解矛盾，120字以内"
}

规则：
- scores 是各方"有道理"的比例，总和为100
- 如果有多方，scores 包含所有人
- winner 是 scores 最高的人名。差距小于10分时写"难分高下"
- 保持中立客观，但语气可以稍微幽默
- 用通俗生动的中文，像朋友聊天一样
- 不要道德绑架
- 如果信息不足以判断，在 analysis 中指出`
}

function buildUserPrompt(payload) {
  if (payload.mode === 'single') {
    return `请分析以下争吵事件并给出评理：\n\n${payload.content}`
  }
  let text = `争执主题：${payload.topic}\n\n`
  payload.perspectives.forEach((p) => {
    text += `【${p.name}的视角】\n${p.content}\n\n`
  })
  text += '请综合以上各方视角，给出客观评理。'
  return text
}
