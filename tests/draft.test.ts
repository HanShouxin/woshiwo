import { describe, expect, it } from 'vitest'
import { parseDraftBlocks } from '../src/renderer/src/ai/draft'

const goodDraft = JSON.stringify({
  v: 1,
  contradiction: '简历缺乏亮点，投递没有回音',
  actions: [
    { type: 'step', text: '重写项目经历' },
    { type: 'habit', text: '每周复盘一次投递反馈' }
  ],
  rationale: '先解决简历，投递才有意义'
})

describe('草案解析', () => {
  it('解析出草案，并从正文中移除代码块', () => {
    const content = `先说结论：你的卡点在简历。\n\n\`\`\`draft\n${goodDraft}\n\`\`\``
    const result = parseDraftBlocks(content)

    expect(result.drafts).toHaveLength(1)
    expect(result.drafts[0].contradiction).toContain('简历')
    expect(result.drafts[0].actions).toHaveLength(2)
    expect(result.drafts[0].actions[1].type).toBe('habit')
    expect(result.text).toBe('先说结论：你的卡点在简历。')
    expect(result.text).not.toContain('draft')
  })

  it('坏 JSON 降级为纯文本，不产出草案', () => {
    const content = `一段分析\n\`\`\`draft\n{ 这不是 json\n\`\`\``
    const result = parseDraftBlocks(content)

    expect(result.drafts).toHaveLength(0)
    expect(result.text).toContain('一段分析')
  })

  it('schema 不合法（缺少 contradiction）时拒绝', () => {
    const content = `分析\n\`\`\`draft\n${JSON.stringify({ v: 1, actions: [] })}\n\`\`\``
    expect(parseDraftBlocks(content).drafts).toHaveLength(0)
  })

  it('一条消息里多个草案块时只取第一个', () => {
    const second = JSON.stringify({
      v: 1,
      contradiction: '第二个',
      actions: [{ type: 'step', text: '不该出现' }]
    })
    const content = `\`\`\`draft\n${goodDraft}\n\`\`\`\n中间的话\n\`\`\`draft\n${second}\n\`\`\``
    const result = parseDraftBlocks(content)

    expect(result.drafts).toHaveLength(1)
    expect(result.drafts[0].contradiction).toContain('简历')
  })

  it('没有草案块时正文原样返回', () => {
    const content = '就是普通的一句话，没有任何代码块。'
    const result = parseDraftBlocks(content)
    expect(result.drafts).toHaveLength(0)
    expect(result.text).toBe(content)
  })
})
