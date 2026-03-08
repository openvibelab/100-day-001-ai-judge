export const config = { runtime: 'edge' }

const MAX_INPUT_LENGTH = 12000
const MAX_OUTPUT_TOKENS = 2400
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const STREAM_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return ''
}

function normalizeProvider(provider) {
  if (provider === 'gemini' || provider === 'deepseek' || provider === 'openai') return provider
  return 'deepseek'
}

function providerLabel(provider) {
  if (provider === 'gemini') return 'Gemini'
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'openai') return 'OpenAI'
  return 'AI'
}

async function throwForBadAIResponse(res, provider) {
  if (res.ok) return

  const detail = await res.text().catch(() => '')
  if (res.status === 429) {
    throw { code: 'QUOTA_EXCEEDED', provider, detail, status: 429 }
  }
  if (res.status === 401 || res.status === 403) {
    throw { code: 'INVALID_KEY', provider, detail, status: res.status }
  }
  throw { code: 'API_ERROR', provider, detail, status: res.status }
}

function parseGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || ''
}

function parseOpenAIText(data) {
  return data?.choices?.[0]?.message?.content || ''
}

function extractJsonString(content) {
  if (typeof content !== 'string') return ''
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  return jsonMatch ? jsonMatch[1].trim() : content.trim()
}

function tryParseStructuredResult(content) {
  const raw = extractJsonString(content)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function extractQuotedField(raw, field) {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"])*)"`, 's'))
  if (!match?.[1]) return ''

  try {
    return JSON.parse(`"${match[1]}"`)
  } catch {
    return match[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim()
  }
}

function extractScores(raw) {
  const block = raw.match(/"scores"\s*:\s*\{([\s\S]*?)\}/)
  if (!block?.[1]) return {}

  const scores = {}
  const entryPattern = /"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)/g
  let match = entryPattern.exec(block[1])

  while (match) {
    scores[match[1]] = Number(match[2])
    match = entryPattern.exec(block[1])
  }

  return scores
}

function sanitizeSalvagedText(text) {
  return String(text || '')
    .replace(/^[{\s"]+/, '')
    .replace(/[}\s"]+$/, '')
    .trim()
}

function salvageStructuredResult(content) {
  const raw = extractJsonString(content)
  if (!raw) return null

  const summary = sanitizeSalvagedText(extractQuotedField(raw, 'summary'))
  const winner = sanitizeSalvagedText(extractQuotedField(raw, 'winner'))
  const verdict = sanitizeSalvagedText(extractQuotedField(raw, 'verdict'))
  const analysis = sanitizeSalvagedText(extractQuotedField(raw, 'analysis'))
  const advice = sanitizeSalvagedText(extractQuotedField(raw, 'advice'))
  const scores = extractScores(raw)

  if (!summary && !winner && !verdict && !analysis && !advice && Object.keys(scores).length === 0) {
    return null
  }

  const fallbackAnalysis = [summary, verdict, analysis]
    .filter(Boolean)
    .join('\n\n')
    .trim()

  return {
    summary: summary || '本次结果未完整生成',
    winner,
    verdict: verdict || '这次输出不完整，请结合下方内容查看。',
    analysis: fallbackAnalysis || '这次返回的是不完整结果，系统只救回了部分字段。',
    scores,
    advice: advice || '建议补充更多事实后再试一次，或稍后重新生成。',
    partial: true,
  }
}

function mergeTextSnapshot(snapshot, incoming) {
  if (!incoming) return { snapshot, delta: '' }
  if (!snapshot) return { snapshot: incoming, delta: incoming }
  if (incoming.startsWith(snapshot)) {
    return { snapshot: incoming, delta: incoming.slice(snapshot.length) }
  }
  if (snapshot.endsWith(incoming)) {
    return { snapshot, delta: '' }
  }
  return { snapshot: snapshot + incoming, delta: incoming }
}

function extractSSEBlocks(buffer) {
  buffer = buffer.replace(/\r\n?/g, '\n')
  const blocks = []
  let next = buffer.indexOf('\n\n')

  while (next !== -1) {
    blocks.push(buffer.slice(0, next))
    buffer = buffer.slice(next + 2)
    next = buffer.indexOf('\n\n')
  }

  return { blocks, rest: buffer }
}

function getSSEData(block) {
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)

  return dataLines.join('\n')
}

async function callGemini(apiKey, system, user, model) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.45,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
  })

  await throwForBadAIResponse(res, 'gemini')
  const data = await res.json()
  return parseGeminiText(data)
}

async function callOpenAI(apiKey, baseUrl, model, system, user, jsonMode = false, provider = 'openai') {
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.45,
    max_tokens: MAX_OUTPUT_TOKENS,
  }

  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  await throwForBadAIResponse(res, provider)
  const data = await res.json()
  return parseOpenAIText(data)
}

async function streamGemini(apiKey, system, user, model, hooks) {
  hooks.onStatus?.('正在连接 Gemini')

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.45,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
  })

  await throwForBadAIResponse(res, 'gemini')
  hooks.onStatus?.('Gemini 已开始输出')

  const reader = res.body?.getReader()
  if (!reader) return callGemini(apiKey, system, user, model)

  const decoder = new TextDecoder()
  let buffer = ''
  let snapshot = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    const { blocks, rest } = extractSSEBlocks(buffer)
    buffer = rest

    for (const block of blocks) {
      const raw = getSSEData(block)
      if (!raw || raw === '[DONE]') continue

      const payload = JSON.parse(raw)
      const incoming = parseGeminiText(payload)
      const merged = mergeTextSnapshot(snapshot, incoming)
      snapshot = merged.snapshot
      if (merged.delta) hooks.onDelta?.(merged.delta)
    }

    if (done) break
  }

  if (!tryParseStructuredResult(snapshot)) {
    hooks.onStatus?.('流式结果不完整，正在补一次完整裁定')
    return callGemini(apiKey, system, user, model)
  }

  return snapshot
}

async function streamOpenAICompatible(provider, apiKey, baseUrl, model, system, user, jsonMode, hooks) {
  hooks.onStatus?.(`正在连接 ${providerLabel(provider)}`)

  const body = {
    model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.45,
    max_tokens: MAX_OUTPUT_TOKENS,
  }

  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  await throwForBadAIResponse(res, provider)
  hooks.onStatus?.(`${providerLabel(provider)} 已开始输出`)

  const reader = res.body?.getReader()
  if (!reader) return callOpenAI(apiKey, baseUrl, model, system, user, jsonMode, provider)

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    const { blocks, rest } = extractSSEBlocks(buffer)
    buffer = rest

    for (const block of blocks) {
      const raw = getSSEData(block)
      if (!raw || raw === '[DONE]') continue

      const payload = JSON.parse(raw)
      const delta = payload?.choices?.[0]?.delta?.content || ''
      if (delta) {
        text += delta
        hooks.onDelta?.(delta)
      }
    }

    if (done) break
  }

  if (!tryParseStructuredResult(text)) {
    hooks.onStatus?.('流式结果不完整，正在补一次完整裁定')
    return callOpenAI(apiKey, baseUrl, model, system, user, jsonMode, provider)
  }

  return text
}

function parseResult(content) {
  const parsed = tryParseStructuredResult(content)
  if (parsed) {
    return {
      summary: parsed.summary || '评理完成',
      winner: parsed.winner || '',
      analysis: parsed.analysis || content,
      verdict: parsed.verdict || '请查看详细分析',
      scores: parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : {},
      advice: parsed.advice || '建议双方先冷静，再继续沟通。',
      partial: false,
    }
  }

  const salvaged = salvageStructuredResult(content)
  if (salvaged) return salvaged

  return {
    summary: '评理完成',
    winner: '',
    analysis: content,
    verdict: '请查看详细分析',
    scores: {},
    advice: '建议双方先冷静，再继续沟通。',
    partial: true,
  }
}

const PROVIDERS = {
  gemini: {
    apiKey: () => getEnv('GEMINI_API_KEY', 'gemini_api_key'),
    model: () => getEnv('GEMINI_MODEL', 'gemini_model') || 'gemini-2.5-flash',
  },
  deepseek: {
    apiKey: () => getEnv('DEEPSEEK_API_KEY', 'deepseek_api_key'),
    baseUrl: () => getEnv('DEEPSEEK_BASE_URL', 'deepseek_base_url') || 'https://api.deepseek.com',
    model: () => getEnv('DEEPSEEK_MODEL', 'deepseek_model') || 'deepseek-chat',
    jsonMode: false,
  },
  openai: {
    apiKey: () => getEnv('OPENAI_API_KEY', 'openai_api_key'),
    baseUrl: () => getEnv('OPENAI_BASE_URL', 'openai_base_url') || 'https://api.openai.com',
    model: () => getEnv('OPENAI_MODEL', 'openai_model') || 'gpt-4o-mini',
    jsonMode: true,
  },
}

function getRequestAttempts(userApiKey, userProvider) {
  if (userApiKey && userProvider) {
    const provider = normalizeProvider(userProvider)
    return [{ provider, apiKey: userApiKey, source: 'browser' }]
  }

  return ['gemini', 'deepseek', 'openai']
    .filter((provider) => !!PROVIDERS[provider].apiKey())
    .map((provider) => ({
      provider,
      apiKey: PROVIDERS[provider].apiKey(),
      source: 'server',
    }))
}

async function requestWithProvider(attempt, system, user) {
  if (attempt.provider === 'gemini') {
    return callGemini(attempt.apiKey, system, user, PROVIDERS.gemini.model())
  }

  const config = PROVIDERS[attempt.provider]
  return callOpenAI(attempt.apiKey, config.baseUrl(), config.model(), system, user, config.jsonMode, attempt.provider)
}

async function streamWithProvider(attempt, system, user, hooks) {
  if (attempt.provider === 'gemini') {
    return streamGemini(attempt.apiKey, system, user, PROVIDERS.gemini.model(), hooks)
  }

  const config = PROVIDERS[attempt.provider]
  return streamOpenAICompatible(
    attempt.provider,
    attempt.apiKey,
    config.baseUrl(),
    config.model(),
    system,
    user,
    config.jsonMode,
    hooks
  )
}

function buildErrorPayload(error, provider) {
  const resolvedProvider = error.provider || provider || ''
  if (error.code === 'QUOTA_EXCEEDED') {
    return {
      status: 429,
      body: {
        error: `${providerLabel(resolvedProvider)} 当前额度或频率受限，请稍后再试或更换 Key`,
        code: 'QUOTA_EXCEEDED',
        provider: resolvedProvider,
        detail: error.detail || '',
      },
    }
  }

  if (error.code === 'INVALID_KEY') {
    return {
      status: 401,
      body: {
        error: 'API Key 无效、权限不足或已过期，请检查后重试',
        code: 'INVALID_KEY',
        provider: resolvedProvider,
        detail: error.detail || '',
      },
    }
  }

  return {
    status: 502,
    body: {
      error: 'AI 服务暂时不可用，请稍后再试',
      code: 'API_ERROR',
      provider: resolvedProvider,
      detail: error.detail || '',
    },
  }
}

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function streamResponse(run) {
  const encoder = new TextEncoder()

  return new Response(new ReadableStream({
    async start(controller) {
      const send = (payload) => controller.enqueue(encoder.encode(sseEvent(payload)))

      try {
        await run(send)
      } catch (error) {
        const failure = buildErrorPayload(error, error.provider)
        send({
          type: 'error',
          ...failure.body,
          status: failure.status,
        })
      } finally {
        controller.close()
      }
    },
  }), { headers: STREAM_HEADERS })
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const url = new URL(req.url)
    const wantsStream = url.searchParams.get('stream') === '1'
    const { system, user, userApiKey, userProvider } = await req.json()

    if (!user || typeof user !== 'string') {
      return jsonResponse({ error: '缺少评理内容' }, 400)
    }
    if (user.length > MAX_INPUT_LENGTH) {
      return jsonResponse({ error: `内容过长，最多 ${MAX_INPUT_LENGTH} 字` }, 400)
    }

    const attempts = getRequestAttempts(userApiKey, userProvider)
    if (attempts.length === 0) {
      return jsonResponse({ error: '服务端未配置可用的 API Key' }, 500)
    }

    if (!wantsStream) {
      let lastError = null

      for (const attempt of attempts) {
        try {
          const content = await requestWithProvider(attempt, system, user)
          return jsonResponse({ result: parseResult(content), provider: attempt.provider })
        } catch (error) {
          lastError = { ...error, provider: error.provider || attempt.provider }
          if (error.code !== 'QUOTA_EXCEEDED') break
        }
      }

      const failure = buildErrorPayload(lastError || {}, lastError?.provider)
      return jsonResponse(failure.body, failure.status)
    }

    return streamResponse(async (send) => {
      send({ type: 'status', message: '请求已收到，准备分配模型' })

      let lastError = null

      for (const attempt of attempts) {
        send({
          type: 'meta',
          provider: attempt.provider,
          source: attempt.source,
          message: `${attempt.source === 'browser' ? '浏览器 Key' : '服务端 Key'} · ${providerLabel(attempt.provider)}`,
        })

        try {
          const content = await streamWithProvider(attempt, system, user, {
            onStatus(message) {
              send({ type: 'status', provider: attempt.provider, message })
            },
            onDelta(text) {
              send({ type: 'delta', provider: attempt.provider, text })
            },
          })

          send({ type: 'status', provider: attempt.provider, message: '正在整理裁定结果' })
          send({ type: 'result', provider: attempt.provider, result: parseResult(content) })
          return
        } catch (error) {
          lastError = { ...error, provider: error.provider || attempt.provider }
          if (error.code === 'QUOTA_EXCEEDED' && attempts.length > 1) {
            send({
              type: 'status',
              provider: attempt.provider,
              message: `${providerLabel(attempt.provider)} 当前受限，正在切换下一路`,
            })
            continue
          }
          throw lastError
        }
      }

      throw lastError || { code: 'API_ERROR', provider: '' }
    })
  } catch (error) {
    console.error('Handler error:', error)
    return jsonResponse({ error: '服务器错误' }, 500)
  }
}
