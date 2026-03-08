# ⚖️ AI 吵架评理

**Day 001** · [100天 Vibe Coding 挑战](https://github.com/openvibelab/openvibelab)

> 吵完架，让 AI 说句公道话。

把吵架经过写下来，AI 帮你分析谁更有理，生成一页可以发给对方看的结果。

🔗 **在线体验**：[judge.openvibelab.com](https://judge.openvibelab.com)

---

## 功能

- **我来写**：一个人把整件事的来龙去脉写清楚
- **各方分别写**：最多 6 方，每人写自己的版本，AI 综合判断
- **AI 评理**：分析各方对错，打分、给结论、给建议
- **流式输出**：提交后实时看到 AI 的分析进度，不用干等
- **分享结果**：生成链接发给对方看
- **社区**：看看别人都在吵什么，给结果点赞点踩
- **历史记录**：随时回看自己的评理
- **自定义 API Key**：支持 Gemini / DeepSeek / OpenAI，用自己的 Key 不限次数

## 路线图

- [x] 单方 / 多方输入（最多 6 方）
- [x] AI 评理 + 结果页（得分、结论、分析、建议）
- [x] 流式输出（SSE）
- [x] 分享链接
- [x] Supabase 持久化存储
- [x] 历史记录
- [x] 社区广场 + 投票
- [x] 自定义 API Key（Gemini / DeepSeek / OpenAI）
- [x] 免费额度用完后引导配置 Key
- [ ] 评论功能 — **欢迎 PR**
- [ ] 更多 AI 模型支持 — **欢迎 PR**

---

## 技术栈

| 层 | 选型 | 为什么 |
|:--|:--|:--|
| 前端 | Vue 3 + Vite + Tailwind CSS | 快，一个人开发效率最高 |
| 部署 | Vercel | 零配置，push 即上线，Edge Functions 响应快 |
| AI | Gemini（默认）/ DeepSeek / OpenAI | Gemini 免费额度大，DeepSeek 国内快，OpenAI 兜底 |
| 数据库 | Supabase | 免费版够用，PostgreSQL 底层，后期能扩展 |
| 备用存储 | localStorage | 断网也能用，服务端挂了不影响本地体验 |

服务端 Key 优先级：Gemini → DeepSeek → OpenAI

### 架构

```
用户浏览器
  ↓ 写下吵架经过
Vue 3 前端（Vercel 静态托管）
  ↓ POST /api/judge?stream=1
Vercel Edge Function（AI 代理，SSE 流式输出）
  ↓ 转发到 AI API
Gemini / DeepSeek / OpenAI
  ↓ 流式返回评理结果
  ↓ 存到 Supabase + localStorage
结果页 → 分享链接
```

---

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
| `GEMINI_API_KEY` | Google Gemini API Key | 三选一 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 三选一 |
| `OPENAI_API_KEY` | OpenAI API Key | 三选一 |
| `DEEPSEEK_MODEL` | DeepSeek 模型名（默认 `deepseek-chat`） | 否 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址（默认 `https://api.deepseek.com`） | 否 |
| `OPENAI_MODEL` | OpenAI 模型名（默认 `gpt-4o-mini`） | 否 |
| `OPENAI_BASE_URL` | OpenAI API 地址（默认 `https://api.openai.com`） | 否 |
| `SUPABASE_URL` | Supabase 项目地址 | 否 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | 否 |

## 参与贡献

这个项目欢迎所有形式的贡献：

- 🐛 **发现 bug？** [提 Issue](https://github.com/openvibelab/100-day-001-ai-judge/issues)
- 💡 **有改进建议？** [提 Issue](https://github.com/openvibelab/100-day-001-ai-judge/issues)
- 🔧 **想写代码？** Fork → 改 → PR，路线图中标注"欢迎 PR"的功能特别欢迎
- 📝 **改文案？** UI 文案、提示语、错误信息，任何让体验更好的改动都欢迎

> 详细贡献指南：[CONTRIBUTING.md](https://github.com/openvibelab/openvibelab/blob/main/CONTRIBUTING.md)

## 协议

MIT · [OpenVibeLab](https://openvibelab.com)
