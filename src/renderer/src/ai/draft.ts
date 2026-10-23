import { DRAFT_BLOCK_LANG } from '../../../shared/constants'
import type { DraftAction, DraftPayload } from '../../../shared/constants'

export interface ParsedMessage {
  /** 去掉草案块之后给人看的正文 */
  text: string
  /** 最多一个（协议规定单条消息只取第一个草案块） */
  drafts: DraftPayload[]
}

function isDraftAction(value: unknown): value is DraftAction {
  if (typeof value !== 'object' || value === null) return false
  const action = value as Record<string, unknown>
  return (
    (action.type === 'step' || action.type === 'habit') && typeof action.text === 'string'
  )
}

function isDraftPayload(value: unknown): value is DraftPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    payload.v === 1 &&
    typeof payload.contradiction === 'string' &&
    payload.contradiction.trim().length > 0 &&
    Array.isArray(payload.actions) &&
    payload.actions.every(isDraftAction) &&
    (payload.goal === undefined || typeof payload.goal === 'string') &&
    (payload.rationale === undefined || typeof payload.rationale === 'string')
  )
}

/**
 * 解析 AI 回复中的草案块（协议 v1，见 shared/constants.ts）。
 *
 * 规则：
 * 1. 只识别 ```draft 代码块，单条消息最多取第一个；
 * 2. JSON 坏掉或 schema 不合法 → 不产出草案，正文保留原样（降级纯文本，无确认入口）；
 * 3. 正文 = 原文去掉草案块。
 */
export function parseDraftBlocks(content: string): ParsedMessage {
  const pattern = new RegExp('```' + DRAFT_BLOCK_LANG + '\\s*\\n([\\s\\S]*?)```', 'g')
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    blocks.push(match[1])
  }

  const drafts: DraftPayload[] = []
  if (blocks.length > 0) {
    try {
      const parsed: unknown = JSON.parse(blocks[0].trim())
      if (isDraftPayload(parsed)) drafts.push(parsed)
    } catch {
      // 坏 JSON：静默降级为纯文本
    }
  }

  const text = content.replace(pattern, '').trim()
  return { text, drafts }
}
