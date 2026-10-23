/** 现状页预设分类（两字标签）+ 输入框示范句。 */
export interface CategoryPreset {
  category: string
  example: string
}

export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  { category: '技能', example: '会用 Python 写脚本' },
  { category: '学习', example: '正在学英语，目标是日常对话' },
  { category: '职业', example: '前端工程师' },
  { category: '项目', example: '在做一款个人 App' },
  { category: '收入', example: '月薪 5000' },
  { category: '财务', example: '存款 1 万元' },
  { category: '资产', example: '有一辆电瓶车' },
  { category: '身体', example: '每天久坐约 10 小时' },
  { category: '作息', example: '经常凌晨 1 点后睡' },
  { category: '兴趣', example: '喜欢打台球' },
  { category: '生活', example: '租房在城郊，通勤 40 分钟' },
  { category: '人际', example: '有个可以请教的设计师朋友' },
  { category: '责任', example: '每月给家里 2000 元' }
] as const

export const DEFAULT_CATEGORY = CATEGORY_PRESETS[0].category
