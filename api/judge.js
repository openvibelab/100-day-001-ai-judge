// Vercel Edge Function — AI Judge proxy
// Supports: Gemini (free default), OpenAI, DeepSeek
// Accepts user-provided API keys when free quota is exhausted

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

// ---- Gemini API ----
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
  if (!res.ok) {
    const status = res.status
    if (status === 429) throw { code: 'QUOTA_EXCEEDED', status: 429 }
    throw { code: 'API_ERROR', status, detail: await res.text() }
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ---- OpenAI-compatible API ----
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
  if (!res.ok) {
    const status = res.status
    if (status === 429) throw { code: 'QUOTA_EXCEEDED', status: 429 }
    throw { code: 'API_ERROR', status, detail: await res.text() }
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ---- Parse AI response to structured JSON ----
function parseResult(content) {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim())
    // Validate required fields
    if (parsed.summary && parsed.scores && typeof parsed.scores === 'object') {
      return parsed
    }
    return {
      summary: parsed.summary || '评理完成',
      analysis: parsed.analysis || content,
      verdict: parsed.verdict || '请查看分析',
      scores: parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : { 'A': 50, 'B': 50 },
      advice: parsed.advice || '建议双方冷静沟通',
    }
  } catch {
    return {
      summary: '评理完成',
      analysis: content,
      verdict: '请查看上方分析',
      scores: { 'A': 50, 'B': 50 },
      advice: '建议双方冷静沟通',
    }
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { system, user, userApiKey, userProvider } = await req.json()

    if (!user || typeof user !== 'string') {
      return jsonResponse({ error: '缺少评理内容' }, 400)
    }
    if (user.length > MAX_INPUT_LENGTH) {
      return jsonResponse({ error: `输入内容过长，最多 ${MAX_INPUT_LENGTH} 字` }, 400)
    }

    let content

    try {
      if (userApiKey && userProvider) {
        // ---- User-provided key ----
        if (userProvider === 'gemini') {
          content = await callGemini(userApiKey, system, user)
        } else {
          const baseUrl = userProvider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com'
          const model = userProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'
          const jsonMode = userProvider === 'openai'
          content = await callOpenAI(userApiKey, baseUrl, model, system, user, jsonMode)
        }
      } else {
        // ---- Server keys (priority: Gemini > OpenAI > DeepSeek) ----
        if (process.env.GEMINI_API_KEY) {
          content = await callGemini(process.env.GEMINI_API_KEY, system, user, process.env.AI_MODEL || 'gemini-2.0-flash')
        } else if (process.env.OPENAI_API_KEY) {
          content = await callOpenAI(
            process.env.OPENAI_API_KEY,
            process.env.AI_BASE_URL || 'https://api.openai.com',
            process.env.AI_MODEL || 'gpt-4o-mini',
            system, user, true
          )
        } else if (process.env.DEEPSEEK_API_KEY) {
          content = await callOpenAI(
            process.env.DEEPSEEK_API_KEY,
            process.env.AI_BASE_URL || 'https://api.deepseek.com',
            process.env.AI_MODEL || 'deepseek-chat',
            system, user, false
          )
        } else {
          return jsonResponse({ error: 'No API key configured' }, 500)
        }
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') {
        return jsonResponse({ error: '免费额度已用完，请使用自己的 API Key', code: 'QUOTA_EXCEEDED' }, 429)
      }
      console.error('AI API error:', err.detail || err)
      return jsonResponse({ error: 'AI 服务暂时不可用，请稍后再试' }, 502)
    }

    const result = parseResult(content)
    return jsonResponse({ result })

  } catch (err) {
    console.error('Handler error:', err)
    return jsonResponse({ error: '服务器错误，请稍后再试' }, 500)
  }
}
