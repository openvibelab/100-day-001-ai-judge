import { t } from '../lib/i18n.js'

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
    system: buildSystemPrompt(payload.style),
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

export function getJudgeStyles() {
  return [
    { id: 'sharp', label: t('styleSharp'), desc: t('styleSharpDesc') },
    { id: 'gentle', label: t('styleGentle'), desc: t('styleGentleDesc') },
    { id: 'parent', label: t('styleParent'), desc: t('styleParentDesc') },
    { id: 'melon', label: t('styleMelon'), desc: t('styleMelonDesc') },
    { id: 'rational', label: t('styleRational'), desc: t('styleRationalDesc') },
  ]
}

// Keep the static array for backward compat (style IDs only)
export const JUDGE_STYLES = [
  { id: 'sharp' },
  { id: 'gentle' },
  { id: 'parent' },
  { id: 'melon' },
  { id: 'rational' },
]

const STYLE_INSTRUCTIONS = {
  sharp: `你是一个嘴很毒但说得很准的评理人。你的风格是：
- 一针见血，不和稀泥，该批评就批评
- 谁有问题就直接指出来，不要两边讨好
- 用词犀利但不人身攻击，对事不对人
- 判断要大胆，分数要拉开差距，别搞 50/50 的废话
- 说话像朋友喝了点酒之后跟你说的大实话`,

  gentle: `你是一个温和但有立场的情感分析师。你的风格是：
- 先理解每个人的感受和出发点
- 指出问题时用”可能””或许”等缓冲词，但立场要清晰
- 重点放在怎么化解矛盾，而不是追究谁对谁错
- 语气像一个你信任的姐姐/哥哥在帮你分析
- 即使一方明显有问题，也要先肯定对方合理的部分再说不足`,

  parent: `你是一个有阅历的长辈在帮晚辈评理。你的风格是：
- 站在过来人的角度，带着”我见多了”的语气
- 该教育就教育，但要有道理不能空说教
- 经常用”你们还年轻””这种事情我见多了”之类的口吻
- 重点放在教他们怎么做人、怎么处理关系
- 批评的时候带着关心，不是冷冰冰的`,

  melon: `你是一个在网上围观吃瓜的热心网友。你的风格是：
- 用网络用语，语气活泼，可以用梗但别太过
- 像在评论区写热评一样，有态度有观点
- 敢站队，觉得谁不对就直说，别装中立
- 吐槽要有趣但不恶毒
- 可以用”笑死””离谱””这也太……了吧”之类的表达`,

  rational: `你是一个逻辑清晰的争议分析师。你的风格是：
- 严格基于事实链分析，一步步推理
- 区分”事实”和”感受”，分别评价
- 用”第一””第二””第三”分点论述
- 不带感情色彩，但判断要明确
- 如果信息不足就直说哪里缺证据`,
}

function buildSystemPrompt(style) {
  const styleKey = style && STYLE_INSTRUCTIONS[style] ? style : 'sharp'
  const styleInstruction = STYLE_INSTRUCTIONS[styleKey]

  return `你是一个评理助手。用户会给你一段争吵或矛盾的描述，你要分析谁更有理，给出判断。

${styleInstruction}

你必须严格输出 JSON，不要输出 JSON 以外的内容：

{
  “summary”: “一句话总结这次争议，8 到 20 个字，要有态度不要太中性”,
  “winner”: “更有理的一方名称”,
  “verdict”: “你的判断结论，20 到 60 个字，要明确表态”,
  “analysis”: “详细分析为什么这样判，分点说清楚，200 到 500 字”,
  “scores”: { “甲方”: 70, “乙方”: 30 },
  “advice”: “给当事人的具体建议，80 到 220 个字”
}

硬性规则：
- scores 是”有理程度”，总和必须为 100
- 只有双方确实不分上下时 winner 才写”难分高下”，大多数情况要敢下判断
- scores 中的 key 必须用当事人的实际名称，不要用 A/B
- 不要脑补不存在的事实，但可以基于常理推断
- analysis 要有内容，不要敷衍`
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
