# ⚖️ AI 吵架评理

**Day 001** · [100天 Vibe Coding 挑战](https://github.com/openvibelab/openvibelab)

> 谁对谁错？让 AI 说了算。

输入争吵内容，AI 客观评理，生成分享链接让当事人看。

🔗 **在线体验**：[judge.openvibelab.com](https://judge.openvibelab.com)

---

## 功能

- **完整描述模式**：一个人输入整件事的来龙去脉
- **多方视角模式**：添加多个当事人，每人写自己的视角
- **AI 客观评理**：分析各方对错，给出评分和建议
- **分享链接**：生成唯一链接，发给当事人看结果

## 技术栈

- Vue 3 + Vite + Tailwind CSS
- Vercel Edge Functions（AI 代理）
- 支持 OpenAI / DeepSeek 等兼容 API
- localStorage 存储（Phase 2 → Supabase）

## 本地运行

```bash
git clone https://github.com/openvibelab/100-day-001-ai-judge.git
cd 100-day-001-ai-judge
npm install
cp .env.example .env.local  # 填入你的 API Key
npm run dev
```

## 环境变量

| 变量 | 说明 | 必须 |
|:-----|:-----|:---:|
| `OPENAI_API_KEY` | OpenAI API Key | 二选一 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 二选一 |
| `AI_BASE_URL` | 自定义 API 地址 | 否 |
| `AI_MODEL` | 自定义模型名 | 否 |

## 路线图

- [x] 完整描述输入
- [x] 多方视角输入
- [x] AI 评理 + 结果页
- [x] 分享链接
- [ ] Supabase 持久化存储
- [ ] 公开广场（看别人的吵架）
- [ ] 投票：你觉得 AI 评得对吗
- [ ] 评论：写出你的理由

## 协议

MIT · [OpenVibeLab](https://openvibelab.com)
