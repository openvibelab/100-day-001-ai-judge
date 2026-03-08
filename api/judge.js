export const config = { runtime: 'edge' }

const MAX_INPUT_LENGTH = 12000
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

async function callGemini(apiKey, system, user, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 2400,
      },
    }),
  })
  return handleAIResponse(res, 'gemini')
}

async function callOpenAI(apiKey, baseUrl, model, system, user, jsonMode = false) {
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    max_tokens: 2400,
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
  return handleAIResponse(res, 'openai')
}

async function handleAIResponse(res, type) {
  if (!res.ok) {
    const status = res.status
    if (status === 429) throw { code: 'QUOTA_EXCEEDED' }
    if (status === 401 || status === 403) throw { code: 'INVALID_KEY' }
    throw { code: 'API_ERROR', status, detail: await res.text().catch(() => '') }
  }

  const data = await res.json()
  if (type === 'gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  return data.choices?.[0]?.message?.content || ''
}

function parseResult(content) {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim())
    return {
      summary: parsed.summary || '评理完成',
      winner: parsed.winner || '',
      analysis: parsed.analysis || content,
      verdict: parsed.verdict || '请查看详细分析',
      scores: parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : { A: 50, B: 50 },
      advice: parsed.advice || '建议双方先冷静，再继续沟通。',
    }
  } catch {
    return {
      summary: '评理完成',
      winner: '',
      analysis: content,
      verdict: '请查看详细分析',
      scores: { A: 50, B: 50 },
      advice: '建议双方先冷静，再继续沟通。',
    }
  }
}

const PROVIDERS = {
  gemini: {
    apiKey: () => getEnv('GEMINI_API_KEY', 'gemini_api_key'),
    model: () => getEnv('GEMINI_MODEL', 'gemini_model') || 'gemini-2.0-flash',
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const { system, user, userApiKey, userProvider } = await req.json()

    if (!user || typeof user !== 'string') {
      return jsonResponse({ error: '缺少评理内容' }, 400)
    }
    if (user.length > MAX_INPUT_LENGTH) {
      return jsonResponse({ error: `内容过长，最多 ${MAX_INPUT_LENGTH} 字` }, 400)
    }

    let content = ''
    let providerUsed = ''

    try {
      if (userApiKey && userProvider) {
        if (userProvider === 'gemini') {
          content = await callGemini(userApiKey, system, user, PROVIDERS.gemini.model())
          providerUsed = 'gemini'
        } else {
          const cfg = PROVIDERS[userProvider] || PROVIDERS.deepseek
          content = await callOpenAI(userApiKey, cfg.baseUrl(), cfg.model(), system, user, cfg.jsonMode)
          providerUsed = userProvider
        }
      } else if (PROVIDERS.gemini.apiKey()) {
        content = await callGemini(PROVIDERS.gemini.apiKey(), system, user, PROVIDERS.gemini.model())
        providerUsed = 'gemini'
      } else if (PROVIDERS.deepseek.apiKey()) {
        content = await callOpenAI(
          PROVIDERS.deepseek.apiKey(),
          PROVIDERS.deepseek.baseUrl(),
          PROVIDERS.deepseek.model(),
          system,
          user,
          PROVIDERS.deepseek.jsonMode
        )
        providerUsed = 'deepseek'
      } else if (PROVIDERS.openai.apiKey()) {
        content = await callOpenAI(
          PROVIDERS.openai.apiKey(),
          PROVIDERS.openai.baseUrl(),
          PROVIDERS.openai.model(),
          system,
          user,
          PROVIDERS.openai.jsonMode
        )
        providerUsed = 'openai'
      } else {
        return jsonResponse({ error: '服务端未配置可用的 API Key' }, 500)
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') {
        return jsonResponse({ error: '默认额度已用完，请配置你自己的 API Key', code: 'QUOTA_EXCEEDED', provider: providerUsed }, 429)
      }
      if (err.code === 'INVALID_KEY') {
        return jsonResponse({ error: 'API Key 无效、权限不足或已过期，请检查后重试', code: 'INVALID_KEY', provider: providerUsed }, 401)
      }
      console.error('AI API error:', err.detail || err)
      return jsonResponse({ error: 'AI 服务暂时不可用，请稍后再试', code: 'API_ERROR', provider: providerUsed }, 502)
    }

    return jsonResponse({ result: parseResult(content), provider: providerUsed })
  } catch (err) {
    console.error('Handler error:', err)
    return jsonResponse({ error: '服务器错误' }, 500)
  }
}
