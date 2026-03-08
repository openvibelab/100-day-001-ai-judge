const API_URL = import.meta.env.VITE_AI_API_URL || '/api/judge'

const KEY_STORAGE = 'aj_user_api_key'
const PROVIDER_STORAGE = 'aj_user_provider'

export function getUserApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function getUserProvider() {
  return localStorage.getItem(PROVIDER_STORAGE) || 'gemini'
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

function buildRequestBody(payload, options = {}) {
  const body = {
    system: buildSystemPrompt(),
    user: buildUserPrompt(payload),
  }

  if (options.useUserKey) {
    const userKey = getUserApiKey()
    if (userKey) {
      body.userApiKey = userKey
      body.userProvider = getUserProvider()
    }
  }

  return body
}

function buildRequestError(data, status) {
  if (data.code === 'QUOTA_EXCEEDED') {
    const err = new Error(data.error || '默认额度已用完')
    err.code = 'QUOTA_EXCEEDED'
    err.provider = data.provider || ''
    err.detail = data.detail || ''
    err.status = status
    return err
  }

  if (data.code === 'INVALID_KEY') {
    const err = new Error(data.error || 'API Key 无效，请检查后重试')
    err.code = 'INVALID_KEY'
    err.provider = data.provider || ''
    err.detail = data.detail || ''
    err.status = status
    return err
  }

  const err = new Error(data.error || `请求失败: ${status}`)
  err.code = data.code || 'REQUEST_FAILED'
  err.provider = data.provider || ''
  err.detail = data.detail || ''
  err.status = status
  return err
}

export async function requestJudgment(payload, options = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(payload, options)),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw buildRequestError(data, res.status)
  }

  const data = await res.json()
  return data.result
}

export async function requestJudgmentStream(payload, callbacks = {}, options = {}) {
  const res = await fetch(`${API_URL}?stream=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(payload, options)),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw buildRequestError(data, res.status)
  }

  if (!res.body) {
    return requestJudgment(payload, options)
  }

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ''
  let fallbackText = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')

      const dataLine = block
        .split('\n')
        .find((line) => line.startsWith('data:'))

      if (!dataLine) continue

      const raw = dataLine.slice(5).trim()
      if (!raw) continue

      const event = JSON.parse(raw)
      if (event.type === 'meta') {
        callbacks.onMeta?.(event)
      } else if (event.type === 'status') {
        callbacks.onStatus?.(event)
      } else if (event.type === 'delta') {
        fallbackText += event.text || ''
        callbacks.onChunk?.(event)
      } else if (event.type === 'result') {
        callbacks.onComplete?.(event)
        return event.result
      } else if (event.type === 'error') {
        throw buildRequestError(event, event.status || 500)
      }
    }

    if (done) break
  }

  if (fallbackText.trim()) {
    try {
      return JSON.parse(fallbackText)
    } catch {
      throw new Error('流式响应已结束，但没有拿到完整结果')
    }
  }

  throw new Error('流式响应已结束，但没有拿到结果')
}

function buildSystemPrompt() {
  return `你是一个公正、克制、会讲人话的争议分析助手。你的任务是分析争吵或矛盾事件，给出清晰、可信、可复核的评理结果。

你必须严格输出 JSON，不要输出 JSON 以外的内容：

{
  "summary": "一句话总结，建议 8 到 20 个字",
  "winner": "更有理的一方名称；如果差距不明显就写'难分高下'",
  "verdict": "最终裁定，建议 20 到 60 个字",
  "analysis": "分点说明为什么这样判断，允许充分展开，但要紧扣事实",
  "scores": { "甲方": 70, "乙方": 30 },
  "advice": "给双方的具体建议，允许 80 到 220 个字"
}

规则：
- scores 表示“有理程度”，总和必须为 100
- 如果有多方，scores 必须覆盖所有人
- 如果第一名与第二名差距小于 10 分，winner 写“难分高下”
- 先基于用户提供的事实判断，不要脑补不存在的证据
- 语言要自然、明确、少废话，不要爹味说教
- 如果信息不足，要在 analysis 中明确指出缺口`
}

function buildUserPrompt(payload) {
  if (payload.mode === 'single') {
    return `请分析以下争议并给出评理结果：\n\n${payload.content}`
  }

  let text = `争议主题：${payload.topic}\n\n`
  payload.perspectives.forEach((item) => {
    text += `【${item.name}的视角】\n${item.content}\n\n`
  })
  text += '请综合以上各方视角，给出客观评理。'
  return text
}
