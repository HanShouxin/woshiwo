import type { AIConfig, ChatTurn } from '../../../shared/constants'

export interface ChatResult {
  ok: boolean
  text: string
  aborted?: boolean
  error?: string
}

export interface ChatHandle {
  requestId: string
  done: Promise<ChatResult>
}

/** 发起一次流式对话：增量通过 onDelta 实时回调，最终结果在 done 里。 */
export function startChat(params: {
  config: AIConfig
  messages: ChatTurn[]
  onDelta?: (text: string) => void
}): ChatHandle {
  const requestId = crypto.randomUUID()
  const off = window.woshiwo.ai.onDelta((payload) => {
    if (payload.requestId === requestId) params.onDelta?.(payload.text)
  })

  const done = window.woshiwo.ai
    .chat({ requestId, config: params.config, messages: params.messages })
    .finally(off)

  return { requestId, done }
}

export function abortChat(requestId: string): void {
  void window.woshiwo.ai.abort(requestId)
}

export const listModels = (config: AIConfig): Promise<{ ok: boolean; models: string[]; error?: string }> =>
  window.woshiwo.ai.listModels(config)
