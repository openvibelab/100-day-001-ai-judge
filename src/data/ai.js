// AI Judge API layer
// Phase 1: calls Vercel Edge Function proxy
// Phase 2: can switch to direct Supabase Edge Function

const API_URL = import.meta.env.VITE_AI_API_URL || '/api/judge'

export async function requestJudgment(payload) {
  /*
   * payload for single mode:
   * { mode: 'single', content: string }
   *
   * payload for multi mode:
   * { mode: 'multi', topic: string, perspectives: [{ name: string, content: string }] }
   */

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(payload)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: systemPrompt, user: userPrompt }),
  })

  if (!res.ok) {
    throw new Error(`AI 请求失败: ${res.status}`)
  }

  const data = await res.json()
  return data.result
}

function buildSystemPrompt() {
  return `你是一个公正客观的争议调解 AI。你的任务是分析争吵/矛盾事件，给出客观评理。

你的输出必须严格按照以下 JSON 格式返回（不要输出其他任何内容）：

{
  "summary": "一句话总结这场争执",
  "analysis": "客观分析，分段论述各方的对与错，200字以内",
  "verdict": "最终裁定：谁更有道理，或者双方各有对错",
  "scores": { "A": 70, "B": 30 },
  "advice": "给双方的建议，如何解决这个矛盾"
}

rules:
- scores 是各方"有道理"的比例（总和100）
- 如果有多方（超过2人），scores 包含所有人
- 保持中立、客观、有理有据
- 用通俗易懂的中文
- 不要道德绑架
- 如果信息不足以判断，指出缺失的信息`
}

function buildUserPrompt(payload) {
  if (payload.mode === 'single') {
    return `请分析以下争吵事件并给出评理：

${payload.content}`
  }

  // multi mode
  let text = `争执主题：${payload.topic}\n\n`
  payload.perspectives.forEach((p, i) => {
    text += `【${p.name}的视角】\n${p.content}\n\n`
  })
  text += '请综合以上各方视角，给出客观评理。'
  return text
}
