import { db } from '../db/db'
import { appendMessage } from '../db/chatRepo'
import { newId, now } from '../db/repo'

export const SAMPLE_TITLE = '示例：一次完整的分析'

const SAMPLE_DIALOG: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }> = [
  {
    role: 'user',
    content:
      '最近有点迷茫。工作三年了，工资没怎么涨，身体也变差了，想改变又不知道从哪开始。'
  },
  {
    role: 'assistant',
    content: `先别急着定计划，我帮你把话拆开看。

**你的现状**：工作三年、收入停滞、身体变差。这三件事同时出现，通常意味着你的时间和精力已经被工作吃满了，没有余量分给别的。

**你的目标**：你还没有写下具体目标，但从这句话里能听出两件想要的事——收入涨上去，身体好起来。

**两者的差距**：不是「缺方法」，是「缺余量」。同时抓两件事的人，通常两件都做不成。

**当下的主要矛盾**：收入停滞带来的焦虑，正在不断挤占本该用来恢复身体的精力。焦虑让你加班，加班让身体更差，身体差又让你更焦虑。

**为什么此刻是它**：人的精力有限，一次只能解决一个最核心的问题。先把精力恢复一点，你才有余力去谈收入。

下面是行动草案——你可以改，也可以不采纳。`
  },
  {
    role: 'assistant',
    content: `\`\`\`draft
{"v":1,"goal":"收入明显提升，身体状态变好","contradiction":"收入停滞带来的焦虑，正在不断挤占本该用来恢复身体的精力","actions":[{"type":"step","text":"本周把睡觉时间固定下来，连续七天做到"},{"type":"step","text":"把简历更新一遍，先只改不投"},{"type":"habit","text":"每天走 20 分钟"}],"rationale":"先恢复精力，才有力气谈收入"}
\`\`\``
  }
]

let pending: Promise<void> | null = null

/** 首次运行（没有任何会话）时，放一段示例对话，让用户先看到「这个 AI 是怎么工作的」。 */
export function ensureSampleSession(): Promise<void> {
  // React StrictMode 下 effect 会跑两次：共享同一个 Promise，避免建出两个示例会话
  if (!pending) pending = runOnce()
  return pending
}

async function runOnce(): Promise<void> {
  // 已有示例：清理历史遗留的重复（只保留最早一条），不再新建
  const samples = await db.chatSessions.where('kind').equals('sample').toArray()
  if (samples.length > 0) {
    const sorted = [...samples].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const extra of sorted.slice(1)) {
      await db.chatMessages.where('sessionId').equals(extra.id).delete()
      await db.chatSessions.delete(extra.id)
    }
    return
  }

  const count = await db.chatSessions.count()
  if (count > 0) return

  const t = now()
  const sessionId = newId()
  await db.chatSessions.add({
    id: sessionId,
    title: SAMPLE_TITLE,
    kind: 'sample',
    createdAt: t,
    updatedAt: t
  })

  for (const item of SAMPLE_DIALOG) {
    await appendMessage({ sessionId, role: item.role, content: item.content })
  }
}
