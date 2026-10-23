/**
 * 全局常量与共享契约。
 * 这里的东西 = 产品的"宪法"：导航、核心思想、AI 协议。
 * 修改前请对照《设计定稿 v2.2》。
 */

/** 导航项（顺序即侧边栏顺序，见定稿 §3） */
export interface NavItem {
  /** 路由路径（HashRouter） */
  path: string
  /** 两字导航名；「我是我」「见证成长」例外 */
  label: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: '首页' },
  { path: '/current', label: '现状' },
  { path: '/goals', label: '目标' },
  { path: '/actions', label: '行动' },
  { path: '/reviews', label: '复盘' },
  { path: '/self', label: '我是我' },
  { path: '/growth', label: '见证成长' }
] as const

export const SETTINGS_PATH = '/settings'

/**
 * 产品核心思想（《矛盾论》）。
 * 这是代码常量，不入库、不可删除、不可拖动 —— 见定稿 §4.6。
 */
export const CORE_THOUGHT =
  '研究任何过程，如果是存在着两个以上矛盾的复杂过程的话，就要用全力找出它的主要矛盾。捉住了这个主要矛盾，一切问题就迎刃而解了。'

/**
 * 草案协议 v1（定稿 §5 的落地契约，评审 #8 定案）。
 *
 * AI 回复中通过 fenced code block 携带机器可读草案：
 * ```draft
 * { "v": 1, "goal": "…", "contradiction": "…", "actions": [{ "type": "step", "text": "…" }], "rationale": "…" }
 * ```
 *
 * 解析规则（实现方必须遵守）：
 * 1. 只识别语言标记为 `draft` 的 block；一条消息最多取第一个；
 * 2. 流式输出期间不渲染确认卡片，block 闭合后才解析渲染；
 * 3. JSON 解析失败或 schema 不合法 → 降级为纯文本展示，不提供确认入口；
 * 4. 卡片内的文本才是用户可见内容，原始 block 永不直接展示。
 */
export const DRAFT_BLOCK_LANG = 'draft'

export interface DraftAction {
  type: 'step' | 'habit'
  text: string
}

export interface DraftPayload {
  v: 1
  /** 可选：该矛盾服务的短期/长期目标 */
  goal?: string
  /** 主要矛盾表述（现状与目标之间的卡点） */
  contradiction: string
  /** 行动草案：step = 当前步骤，habit = 长期习惯 */
  actions: DraftAction[]
  /** 为什么此刻是它（精力有限论证） */
  rationale?: string
}

/** 应用版本信息（渲染进程通过 IPC 读取） */
export interface AppInfo {
  version: string
  dataDir: string
  isPackaged: boolean
}

/* ---------------- AI 连接 ---------------- */

export type AIProvider = 'openai' | 'ollama'

/** 一次请求要用的连接参数（不含 Key 明文，Key 只在主进程） */
export interface AIConfig {
  provider: AIProvider
  baseUrl: string
  model: string
}

/**
 * 一条已保存的配置（存在 appSettings.aiConfigs 里）。
 * Key 不在这里 —— 主进程按 id 单独加密保存。
 */
export interface AIConfigEntry extends AIConfig {
  id: string
  /** 配置名称，比如「百炼」「公司 Ollama」 */
  name: string
  updatedAt: string
}

export const DEFAULT_OLLAMA_BASE = 'http://localhost:11434/v1'
export const OPENAI_BASE_PLACEHOLDER = 'https://api.deepseek.com/v1'

/** 当前会话送进模型的最近消息条数 */
export const MAX_CONTEXT_MESSAGES = 20

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 长期记忆类型 */
export type MemoryType = 'fact' | 'preference' | 'decision' | 'other'
