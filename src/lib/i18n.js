import { ref } from 'vue'

const LOCALE_KEY = 'judge_locale'
export const locale = ref(localStorage.getItem(LOCALE_KEY) || 'en')

export function setLocale(l) {
  locale.value = l
  localStorage.setItem(LOCALE_KEY, l)
}

const T = {
  // App.vue
  appLogo: { en: 'J', zh: '判' },
  appTitle: { en: 'AI Argument Judge', zh: 'AI 吵架评理' },
  appSubtitle: { en: 'Had a fight? Let AI be the judge.', zh: '吵完架，让 AI 说句公道话' },
  navCommunity: { en: 'Community', zh: '社区' },
  navHistory: { en: 'History', zh: '历史' },
  footerOpenSource: { en: 'Open source & free', zh: '开源免费' },

  // InputPage - loading
  loading1: { en: 'Organizing content', zh: '正在整理内容' },
  loading2: { en: 'Connecting to AI', zh: '正在连接 AI' },
  loading3: { en: 'Generating result', zh: '正在生成结果' },

  // InputPage - quick prompts
  quickPrompt1: { en: 'When did the argument start?', zh: '什么时候开始吵的？' },
  quickPrompt2: { en: 'Who said what first?', zh: '谁先说了什么？' },
  quickPrompt3: { en: 'How did the other person respond?', zh: '对方怎么回应的？' },
  quickPrompt4: { en: 'What bothers you the most?', zh: '你最介意的点是什么？' },

  // InputPage - single steps
  singleStep1Title: { en: 'Start with the cause', zh: '先写起因' },
  singleStep1Desc: { en: 'What triggered the argument? Explain the root cause clearly.', zh: '因为什么吵起来，先把导火索交代清楚。' },
  singleStep2Title: { en: 'Then the sequence', zh: '再写经过' },
  singleStep2Desc: { en: 'Who said or did what first? Try to write in chronological order.', zh: '谁先说了什么、做了什么，尽量按时间顺序写。' },
  singleStep3Title: { en: 'Highlight the disagreement', zh: '点出分歧' },
  singleStep3Desc: { en: 'What do you think went wrong? What might the other person think?', zh: '你觉得哪里不对，对方可能又会怎么想。' },
  singleStep4Title: { en: 'Describe the current state', zh: '写明现状' },
  singleStep4Desc: { en: 'Where are you stuck now? What do you want AI to focus on?', zh: '现在卡在哪里，想让 AI 重点判断什么。' },

  // InputPage - multi steps
  multiStep1Title: { en: 'Define the topic', zh: '先定主题' },
  multiStep1Desc: { en: 'Summarize the core dispute in one sentence. Keep it focused.', zh: '用一句话写清争议核心，别把主题写散。' },
  multiStep2Title: { en: 'Each side writes', zh: '各自陈述' },
  multiStep2Desc: { en: 'Each person writes only what they saw and how they felt.', zh: '每个人只写自己看到的事实和自己的感受。' },
  multiStep3Title: { en: 'Don\'t write for others', zh: '避免代写' },
  multiStep3Desc: { en: 'Don\'t summarize or polish for the other party.', zh: '不要替对方总结，不要帮对方润色。' },
  multiStep4Title: { en: 'Include your expectations', zh: '补足诉求' },
  multiStep4Desc: { en: 'Besides who\'s right, also state how you\'d like to resolve it.', zh: '除了谁对谁错，也写清楚各自希望怎么解决。' },

  // InputPage - main
  inputTitle: { en: 'Write down what happened', zh: '把吵架经过写下来' },
  inputSubtitle: { en: 'Describe the argument. AI will analyze who\'s more reasonable and generate a shareable verdict.', zh: '写清楚怎么吵的，AI 帮你分析谁更有理，生成一页可以发给对方看的结果。' },
  myGenerated: { en: 'My generated results', zh: '我的已生成' },
  chooseMode: { en: 'Choose a mode', zh: '选一种方式' },
  modeSingle: { en: 'I\'ll write', zh: '我来写' },
  modeMulti: { en: 'Each party writes', zh: '各方分别写' },
  seeExample: { en: 'See an example', zh: '看一个示例' },
  aiStyle: { en: 'AI Style', zh: 'AI 的风格' },
  writeDown: { en: 'Write it down', zh: '写下经过' },
  chronological: { en: 'Recommended: chronological order', zh: '建议按时间顺序写' },
  editing: { en: 'Editing', zh: '编辑中' },
  fullDesc: { en: 'Full description', zh: '完整描述' },
  minChars: { en: 'min', zh: '最低' },
  chars: { en: 'chars', zh: '字' },
  singlePlaceholder: { en: 'e.g.: Last night at 10pm, we started arguing about weekend plans. I wanted to visit my parents, but they suddenly said they wanted to play games with friends...', zh: '例如：昨天晚上 10 点，我们因为周末安排吵起来。我想去见父母，对方临时说想和朋友打游戏。后面我说了什么、对方怎么回、最后怎么僵住了，都可以继续写。' },
  singleHint: { en: 'Write the timeline, behaviors, disagreements, and where you\'re stuck now.', zh: '写清时间线、行为、分歧和现在卡住的地方。' },
  howToWrite: { en: 'How to write well', zh: '怎么写比较好' },
  dontKnow: { en: 'Not sure how to write?', zh: '不知道怎么写？' },
  collapse: { en: 'Collapse', zh: '收起' },
  expand: { en: 'Expand', zh: '展开' },
  submitHint: { en: 'After submitting, you can watch AI\'s analysis in real time.', zh: '提交后可以实时看到 AI 的分析进度，不用干等。' },
  multiTitle: { en: 'Each party\'s account', zh: '各方说法' },
  multiSubtitle: { en: 'Each person writes their own version, AI judges comprehensively', zh: '每个人分别写自己的版本，AI 综合判断' },
  topicLabel: { en: 'Topic of dispute', zh: '争议主题' },
  topicPlaceholder: { en: 'e.g.: Should you get angry for canceling plans to play games?', zh: '例如：是否应该临时爽约去打游戏' },
  addParty: { en: 'Add a party', zh: '添加一方' },
  nickname: { en: 'Nickname', zh: '昵称' },
  deleteParty: { en: 'Delete', zh: '删除' },
  multiHowTo: { en: 'How to write (multi-party)', zh: '多人怎么写' },
  howAIJudges: { en: 'How AI judges', zh: 'AI 怎么判' },
  howAIJudgesDesc: { en: 'AI considers all accounts together. It won\'t favor whoever writes more \u2014 it focuses on whether facts align.', zh: 'AI 会综合所有人的说法一起判断，不会因为谁写得多就偏向谁，重点看事实是否对得上。' },
  readySubmit: { en: 'Done? Submit now.', zh: '写完了就可以提交。' },
  freeHint: { en: 'Free to use. If quota runs out, you\'ll be prompted to use your own key.', zh: '免费使用，如果遇到额度限制会提示你用自己的 Key。' },
  submitBtn: { en: 'Start Judging', zh: '开始评理' },
  collapseSettings: { en: 'Collapse settings', zh: '收起设置' },
  customApiKey: { en: 'Custom API Key', zh: '自定义 API Key' },
  customModelLabel: { en: 'Custom Model / API Key', zh: '自定义模型 / API Key' },
  defaultFree: { en: 'Free by default. You can also enter your own key \u2014 it\'ll be used when quota runs out.', zh: '默认免费使用。你也可以填自己的 Key，额度不够时会自动切换。' },
  keySaved: { en: 'Key saved', zh: '已保存' },
  noKeySet: { en: 'No custom key set, using free quota', zh: '未设置自定义 Key，使用默认免费额度' },
  browserKeySaved: { en: 'Browser key saved.', zh: '浏览器 Key 已保存。' },
  saveKey: { en: 'Save Key', zh: '保存 Key' },
  clearKey: { en: 'Clear', zh: '清除' },
  keyDisclaimer: { en: 'Key is stored only in your browser, never in our database. When used, it\'s sent with the request to our server, which forwards it to the AI provider.', zh: 'Key 只保存在你的浏览器里，不会被写入数据库；真正调用时会随这次请求发到本站后端，再由后端转发给模型服务。' },
  quotaExhausted: { en: 'Free quota exhausted', zh: '免费额度用完了' },
  quotaDesc: { en: 'After entering your own API key, this request will be sent through your browser to our server, then forwarded to the AI provider. Your key is never stored in our database.', zh: '填入你自己的 API Key 后，这次请求会通过你的浏览器发给本站后端，再由后端转给模型服务。Key 不会写入数据库。' },
  cancel: { en: 'Cancel', zh: '取消' },
  continueJudging: { en: 'Continue Judging', zh: '继续评理' },
  narrator: { en: 'Narrator', zh: '当事人' },
  analysisComplete: { en: 'Analysis complete', zh: '分析完成' },
  processingProgress: { en: 'Processing', zh: '处理进度' },
  aiWriting: { en: 'AI is writing', zh: 'AI 正在写' },
  analyzingWait: { en: 'Analyzing, just a moment.', zh: '正在分析中，稍等一下就好。' },
  connectedProvider: { en: 'Connected to', zh: '已连接' },
  analyzing: { en: 'analyzing', zh: '分析中' },

  // Demo example
  demoTopic: { en: 'Partner plays games and doesn\'t answer calls \u2014 should you be upset?', zh: '对象打游戏不接电话，该不该生气' },
  demoPartyA: { en: 'Her', zh: '女方' },
  demoPartyB: { en: 'Him', zh: '男方' },
  demoPartyAText: { en: 'I called three times in a row and got no answer. No WeChat reply either. Over an hour later, he said he was gaming. I\'m not saying he can\'t play, but at least give me a heads up. Otherwise I worry and feel like I\'m not a priority.', zh: '我连续打了三个电话都没接，微信也没回。一个多小时后他才说在打游戏。我不是不让他玩，而是至少该告诉我一声，不然我会担心，也会觉得自己被排在很后面。' },
  demoPartyBText: { en: 'I was in a ranked game with my phone on silent. I replied as soon as it ended. I feel like she escalates every late reply into "you don\'t care about me," and that\'s a lot of pressure. I need some uninterrupted time too.', zh: '我开了一局排位，手机静音没看到。结束后第一时间回了消息。我觉得她把每次没及时回都上升到"不重视"，压力很大，我也需要一点不被打断的时间。' },

  // ResultPage
  resultTitle: { en: 'This Verdict', zh: '本次判断' },
  resultId: { en: 'ID', zh: '编号' },
  resultIncomplete: { en: 'Incomplete result', zh: '结果不完整' },
  resultReady: { en: 'Verdict ready', zh: '已出结果' },
  resultViewHint: { en: 'Please review this verdict along with the evidence and original content below.', zh: '请结合下方依据和原始内容查看这次判断。' },
  resultIncompleteHint: { en: 'This result wasn\'t fully generated. Only partial data was recovered. We recommend regenerating \u2014 don\'t share this version.', zh: '这次结果没有完整生成，系统只恢复了部分字段。建议你重新生成一次，不要直接拿这版发给对方。' },
  resultLocalOnly: { en: 'This result is only saved in this browser and hasn\'t synced to the server yet.', zh: '这条结果当前只保存在这个浏览器里，还没有成功同步到服务器。' },
  submitMode: { en: 'Submission mode', zh: '提交方式' },
  whoRight: { en: 'Who\'s more right', zh: '谁更有理' },
  currentLead: { en: 'Currently leading', zh: '当前占优' },
  leadMargin: { en: 'Lead margin', zh: '领先幅度' },
  points: { en: 'pts', zh: '分' },
  generatedAt: { en: 'Generated at', zh: '生成于' },
  evidence: { en: 'Evidence', zh: '判断依据' },
  noEvidence: { en: 'No displayable evidence summary was generated. Try regenerating.', zh: '这次结果没有生成可直接展示的依据摘要，建议重新生成一次。' },
  yourContent: { en: 'Your submission', zh: '你提交的内容' },
  yourContentHint: { en: 'Verify that AI received what you wrote.', zh: '确认一下 AI 看到的是不是你写的那些。' },
  disputeTopic: { en: 'Dispute topic', zh: '争议主题' },
  scoreDistribution: { en: 'Score distribution', zh: '倾向分布' },
  detailedAnalysis: { en: 'Detailed analysis', zh: '详细分析' },
  advice: { en: 'Advice for you', zh: '给你们的建议' },
  shareTitle: { en: 'Share with the other party', zh: '发给对方看' },
  shareDesc: { en: 'Copy the link and send it \u2014 let them see what AI thinks.', zh: '复制链接发过去，让对方也看看 AI 怎么说。' },
  copied: { en: 'Copied!', zh: '已复制' },
  shareResult: { en: 'Share result', zh: '分享结果' },
  judgeAgain: { en: 'Judge again', zh: '再评一次' },
  voteTitle: { en: 'How was this verdict?', zh: '你觉得判得怎样？' },
  voteDesc: { en: 'Upvote or downvote \u2014 one vote per case.', zh: '点赞或点踩，每条只能投一次。' },
  voteUp: { en: 'Helpful', zh: '有帮助' },
  voteDown: { en: 'Disagree', zh: '不认可' },
  alreadyVoted: { en: 'You\'ve already voted.', zh: '你已经投过票了。' },
  communityTitle: { en: 'See others', zh: '看看别人的' },
  communityDesc: { en: 'Check out what others are arguing about and how AI judged.', zh: '去社区看看别人都在吵什么，AI 又是怎么判的。' },
  goToCommunity: { en: 'Visit community', zh: '去社区看看' },
  loading: { en: 'Loading result...', zh: '正在加载结果' },
  notFound: { en: 'Record not found', zh: '找不到这条记录' },
  notFoundDesc: { en: 'Link may be wrong, or data wasn\'t saved successfully.', zh: '链接可能有误，或者数据没有成功保存。' },
  backHome: { en: 'Back to home', zh: '返回首页' },
  resultModeSingle: { en: 'Single', zh: '单方' },
  resultModeMulti: { en: 'Multi-party', zh: '多方' },
  tooClose: { en: 'Too close to call', zh: '难分高下' },
  noScore: { en: 'No reliable score available \u2014 distribution bar hidden.', zh: '这次结果没有拿到可信分数，所以不展示分布条。' },
  evenScore: { en: 'Scores are nearly even. Don\'t force a winner.', zh: '这次更接近平分，没有拉开明确差距，不建议硬分输赢。' },
  noAnalysis: { en: 'No displayable analysis was generated.', zh: '这次结果没有生成可直接展示的分析。' },
  tryMoreDetail: { en: 'Try adding more key details and regenerate.', zh: '建议补充更多关键细节后再试一次。' },
  notProvided: { en: 'Not provided', zh: '未提供' },
  incompleteWarning: { en: 'This result wasn\'t fully generated. Only partial data was recovered. Try regenerating.', zh: '这次结果没有完整生成，系统只恢复了部分字段，建议重新生成一次。' },
  verdictGenerated: { en: 'Verdict generated', zh: '本次判断已生成' },

  // HistoryPage
  historyTitle: { en: 'My History', zh: '我的历史记录' },
  historyEmpty: { en: 'No records yet', zh: '还没有记录' },
  historyEmptyDesc: { en: 'Every verdict you submit is automatically saved here.', zh: '你每次提交后的裁定页，都会自动保存在这里。' },
  goJudge: { en: 'Go judge', zh: '去评理' },
  filterAll: { en: 'All', zh: '全部' },
  filterSingle: { en: 'Single', zh: '单方' },
  filterMulti: { en: 'Multi', zh: '多方' },
  caseRecord: { en: 'case record', zh: '评理记录' },
  noSummary: { en: 'No summary', zh: '暂无摘要' },
  topScore: { en: 'Top score', zh: '最高分' },
  historyLoading: { en: 'Loading', zh: '正在加载' },

  // CommunityPage
  communityPageTitle: { en: 'What\'s everyone arguing about?', zh: '大家都在吵什么' },
  communityPageSubtitle: { en: 'Recent verdicts \u2014 see what others argue about and how AI judges.', zh: '最近的评理记录，看看别人怎么吵、AI 怎么判。' },
  communityLoading: { en: 'Loading community records...', zh: '正在加载社区记录' },
  communityEmpty: { en: 'No community records yet', zh: '还没有社区记录' },
  communityEmptyDesc: { en: 'Submit the first case and it\'ll appear here.', zh: '提交第一条案例后，这里就会出现。' },
  sortNewest: { en: 'Newest', zh: '最新' },
  sortHottest: { en: 'Hottest', zh: '最热' },
  multiDispute: { en: 'Multi-party dispute', zh: '多方争议' },
  singleDesc: { en: 'Single description', zh: '单方描述' },
  score: { en: 'Score', zh: '得分' },
  hotScore: { en: 'Hot score', zh: '热度分' },

  // ai.js - Judge styles (UI labels only)
  styleSharp: { en: 'Blunt', zh: '锐评' },
  styleSharpDesc: { en: 'No mercy, straight verdict', zh: '不留情面，直接判' },
  styleGentle: { en: 'Gentle', zh: '温和' },
  styleGentleDesc: { en: 'Understand both sides, focus on resolution', zh: '理解双方，重在化解' },
  styleParent: { en: 'Parent', zh: '家长' },
  styleParentDesc: { en: 'Elder\'s tone, with attitude', zh: '过来人口吻，有态度' },
  styleMelon: { en: 'Bystander', zh: '吃瓜' },
  styleMelonDesc: { en: 'Internet commenter, spicy takes', zh: '网友围观，辣评吐槽' },
  styleRational: { en: 'Rational', zh: '理性' },
  styleRationalDesc: { en: 'Logical breakdown, stick to facts', zh: '逻辑拆解，就事论事' },
}

export function t(key) {
  const entry = T[key]
  if (!entry) return key
  return entry[locale.value] || entry.en || key
}

/**
 * Get party label by index (0-based)
 */
export function partyLabel(i) {
  const en = ['Party A', 'Party B', 'Party C', 'Party D', 'Party E', 'Party F']
  const zh = ['甲方', '乙方', '丙方', '丁方', '戊方', '己方']
  return locale.value === 'zh' ? (zh[i] || `第${i + 1}方`) : (en[i] || `Party ${i + 1}`)
}

/**
 * Get party count description
 */
export function partyCountDesc(n) {
  return locale.value === 'zh'
    ? `至少 2 方，最多 ${n} 方。每个人只写自己的版本。`
    : `At least 2, up to ${n} parties. Each person writes their own version.`
}

/**
 * Get party N label
 */
export function partyN(n) {
  return locale.value === 'zh' ? `第${n}方` : `Party ${n}`
}

/**
 * Get party placeholder
 */
export function partyPlaceholder(name, index) {
  const fallback = partyN(index + 1)
  const n = name || fallback
  return locale.value === 'zh'
    ? `从${n}的角度，把事实、感受和诉求写完整。`
    : `From ${n}'s perspective, write the facts, feelings, and what you want.`
}

/**
 * Get party hint
 */
export function partyHint(min) {
  return locale.value === 'zh'
    ? `最低 ${min} 字，不要替对方总结。`
    : `Min ${min} chars. Don't summarize for the other person.`
}

/**
 * Get evidence point label
 */
export function evidenceN(n) {
  return locale.value === 'zh' ? `第${n}点` : `Point ${n}`
}
