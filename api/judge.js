// Vercel Edge Function — AI Judge proxy
// Supports: Gemini, DeepSeek, OpenAI
// User-provided keys take priority over server keys

export const config = { runtime: 'edge' }

const MAX_INPUT_LENGTH = 5000
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

// ---- Gemini ----
async function callGemini(apiKey, system, user, model = 'gemini-2.0-flash') {
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
        maxOutputTokens: 2000,
      },
    }),
  })
  return handleAIResponse(res, 'gemini')
}

// ---- OpenAI-compatible (DeepSeek / OpenAI) ----
async function callOpenAI(apiKey, baseUrl, model, system, user, jsonMode = false) {
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
      verdict: parsed.verdict || '请查看分析',
      scores: (parsed.scores && typeof parsed.scores === 'object') ? parsed.scores : { 'A': 50, 'B': 50 },
      advice: parsed.advice || '建议双方冷静沟通',
    }
  } catch {
    return {
      summary: '评理完成',
      winner: '',
      analysis: content,
      verdict: '请查看上方分析',
      scores: { 'A': 50, 'B': 50 },
      advice: '建议双方冷静沟通',
    }
  }
}

// Provider configs
const PROVIDERS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', jsonMode: false },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini', jsonMode: true },
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const { system, user, userApiKey, userProvider } = await req.json()

    if (!user || typeof user !== 'string') return jsonResponse({ error: '缺少评理内容' }, 400)
    if (user.length > MAX_INPUT_LENGTH) return jsonResponse({ error: `内容过长，最多 ${MAX_INPUT_LENGTH} 字` }, 400)

    let content

    try {
      if (userApiKey && userProvider) {
        // ---- User-provided key ----
        if (userProvider === 'gemini') {
          content = await callGemini(userApiKey, system, user)
        } else {
          const cfg = PROVIDERS[userProvider] || PROVIDERS.deepseek
          content = await callOpenAI(userApiKey, cfg.baseUrl, cfg.model, system, user, cfg.jsonMode)
        }
      } else {
        // ---- Server keys: Gemini > DeepSeek > OpenAI ----
        if (process.env.GEMINI_API_KEY) {
          content = await callGemini(process.env.GEMINI_API_KEY, system, user, process.env.AI_MODEL || 'gemini-2.0-flash')
        } else if (process.env.DEEPSEEK_API_KEY) {
          content = await callOpenAI(process.env.DEEPSEEK_API_KEY, 'https://api.deepseek.com', process.env.AI_MODEL || 'deepseek-chat', system, user)
        } else if (process.env.OPENAI_API_KEY) {
          content = await callOpenAI(process.env.OPENAI_API_KEY, 'https://api.openai.com', process.env.AI_MODEL || 'gpt-4o-mini', system, user, true)
        } else {
          return jsonResponse({ error: '服务未配置 API Key' }, 500)
        }
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') {
        return jsonResponse({ error: '额度已用完，请配置自己的 API Key', code: 'QUOTA_EXCEEDED' }, 429)
      }
      if (err.code === 'INVALID_KEY') {
        return jsonResponse({ error: 'API Key 无效或已过期，请检查后重试', code: 'INVALID_KEY' }, 401)
      }
      console.error('AI API error:', err.detail || err)
      return jsonResponse({ error: 'AI 服务暂时不可用，请稍后再试' }, 502)
    }

    return jsonResponse({ result: parseResult(content) })

  } catch (err) {
    console.error('Handler error:', err)
    return jsonResponse({ error: '服务器错误' }, 500)
  }
}
