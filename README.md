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
- **评理记录**：查看自己的历史评理
- **自带 API Key**：支持 Gemini / DeepSeek / OpenAI，用自己的 Key 不限次数

## 路线图

- [x] 完整描述输入
- [x] 多方视角输入（最多 6 方）
- [x] AI 评理 + 结果页（评分、裁定、分析、建议）
- [x] 分享链接
- [x] Supabase 持久化存储
- [x] 评理历史记录
- [x] 用户自带 API Key（Gemini / DeepSeek / OpenAI）
- [x] 免费额度用完后引导配置 Key
- [ ] 公开广场（看别人的吵架） — **欢迎 PR**
- [ ] 投票：你觉得 AI 评得对吗 — **欢迎 PR**
- [ ] 评论：写出你的理由 — **欢迎 PR**
- [ ] 更多 AI 模型支持 — **欢迎 PR**

---

## 技术选型：为什么这样搭？

### 前端：Vue 3 + Vite + Tailwind CSS

快。Vite 启动秒开，Vue 3 Composition API 写起来灵活，Tailwind 不用写 CSS 文件，一个人开发效率拉满。对于 Vibe Coding 这种节奏，这套组合是最快出活的。

### 部署：Vercel

**零配置部署**。Git push 自动构建，全球 CDN 分发，免费额度足够个人项目用。Edge Functions 让 API 代理跑在离用户最近的节点，响应快。最关键的是：不用运维服务器，一个人也能搞定部署。

### AI 代理：Gemini 优先

**因为免费。** Google 的 Gemini API 有慷慨的免费额度，`gemini-2.0-flash` 速度快、质量够用。作为开源项目的默认 AI 后端，零成本是第一优先级。同时支持 DeepSeek（国内推荐）和 OpenAI 作为备选，用户可以配置自己的 Key。

服务端 Key 优先级：Gemini → DeepSeek → OpenAI

### 数据库：Supabase

**免费版够用。** 500MB 数据库 + 5万月活用户 + 实时订阅，对于 MVP 阶段绰绰有余。PostgreSQL 底层，后期扩展没有天花板。REST API 开箱即用，不需要写后端。

同时保留 localStorage 作为 fallback：断网也能用，服务端挂了也不影响本地体验。

### 整体架构

```
用户浏览器
  ↓ 输入争吵内容
Vue 3 前端（Vercel 静态托管）
  ↓ POST /api/judge
Vercel Edge Function（AI 代理）
  ↓ 转发请求
Gemini / DeepSeek / OpenAI API
  ↓ 返回评理结果
  ↓ 存储到 Supabase + localStorage
结果页 → 生成分享链接
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
| `AI_MODEL` | 自定义模型名（默认按 provider 自动选） | 否 |
| `SUPABASE_URL` | Supabase 项目地址 | 否 |
| `SUPABASE_ANON_KEY` | Supabase 匿名 Key | 否 |

## 参与贡献

这个项目欢迎所有形式的贡献：

- 🐛 **发现 bug？** [提 Issue](https://github.com/openvibelab/100-day-001-ai-judge/issues)
- 💡 **有改进建议？** [提 Issue](https://github.com/openvibelab/100-day-001-ai-judge/issues)
- 🔧 **想写代码？** Fork → 改 → PR，路线图中标注"欢迎 PR"的功能特别欢迎
- 📝 **改文案？** UI 文案、提示语、错误信息，任何让体验更好的改动都欢迎

> 详细贡献指南：[CONTRIBUTING.md](https://github.com/openvibelab/openvibelab/blob/main/CONTRIBUTING.md)

## 协议

MIT · [OpenVibeLab](https://openvibelab.com)
