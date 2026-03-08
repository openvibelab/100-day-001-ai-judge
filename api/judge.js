// Vercel Edge Function — AI Judge proxy
// Supports: OpenAI-compatible API (OpenAI / DeepSeek / any compatible provider)

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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { system, user } = await req.json()

    if (!user || typeof user !== 'string') {
      return jsonResponse({ error: '缺少评理内容' }, 400)
    }

    if (user.length > MAX_INPUT_LENGTH) {
      return jsonResponse({ error: `输入内容过长，最多 ${MAX_INPUT_LENGTH} 字` }, 400)
    }

    // Priority: OPENAI_API_KEY > DEEPSEEK_API_KEY
    const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
    const isDeepSeek = !process.env.OPENAI_API_KEY && !!process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.AI_BASE_URL || (isDeepSeek ? 'https://api.deepseek.com' : 'https://api.openai.com')
    const model = process.env.AI_MODEL || (isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini')

    if (!apiKey) {
      return jsonResponse({ error: 'No API key configured' }, 500)
    }

    const requestBody = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }

    // Use JSON mode for OpenAI models that support it
    if (!isDeepSeek && !process.env.AI_BASE_URL) {
      requestBody.response_format = { type: 'json_object' }
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI API error:', response.status, errText)
      return jsonResponse({ error: 'AI 服务暂时不可用，请稍后再试' }, 502)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Try to parse JSON from the response
    let result
    try {
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      result = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim())
    } catch {
      // If AI didn't return valid JSON, wrap it
      result = {
        summary: '评理完成',
        analysis: content,
        verdict: '请查看上方分析',
        scores: { 'A': 50, 'B': 50 },
        advice: '建议双方冷静沟通',
      }
    }

    // Validate result structure
    if (!result.summary || !result.scores || typeof result.scores !== 'object') {
      result = {
        summary: result.summary || '评理完成',
        analysis: result.analysis || content,
        verdict: result.verdict || '请查看上方分析',
        scores: result.scores && typeof result.scores === 'object' ? result.scores : { 'A': 50, 'B': 50 },
        advice: result.advice || '建议双方冷静沟通',
      }
    }

    return jsonResponse({ result })

  } catch (err) {
    console.error('Handler error:', err)
    return jsonResponse({ error: '服务器错误，请稍后再试' }, 500)
  }
}
