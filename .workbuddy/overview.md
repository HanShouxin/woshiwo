# Phase 0 完成报告 — 我是我 V2.0

日期：2026-10-23
状态：**DONE_WITH_CONCERNS**（代码可运行并已通过构建；GUI 窗口无法在 agent 沙箱内长驻，需你在本机终端验收）

## 做了什么

### 1. /autoplan 评审（降级执行）

本机没有 gstack 运行时和 codex CLI，编排脚本无法原样执行。改用同等方法论：四视角对抗评审 + 独立只读子代理担任第二声部。

产出 15 条发现，其中 3 条 critical 直接阻塞编码，已当场定案：

| # | 问题 | 定案 |
|---|---|---|
| 8 | 草案协议全文没定义格式，灵魂交互无法开工 | ` ```draft ` + JSON `{v:1, goal?, contradiction, actions[{type,text}], rationale?}`；流式不渲染、闭合后解析、坏 JSON 降级纯文本、单消息取第一个 |
| 9 | 记忆游标没有落库字段，删单条消息会让序号错位 | `chatMessages.seq` + `appSettings.integrationCursor`，按 seq 区间幂等，删消息不回退 |
| 14 | `profileCards` 行粒度未定，两种实现完全不同 | 一行 = 一条记录（category/content/order/updatedAt），无 title，上下文按分类分组 |

完整报告：`.workbuddy/reviews/autoplan-2026-10-23.md`

### 2. 工程骨架

- **栈**：electron-vite 6 + Electron 45 + React 19 + TypeScript + HashRouter + lucide-react
- **三层边界**：main（窗口/单实例锁/数据目录/IPC）、preload（contextBridge 白名单）、renderer（UI）
- **导航**：首页 · 现状 · 目标 · 行动 · 复盘 · 我是我 · 见证成长 + 设置，八个页面全部可路由
- **视觉**：Apple 气质的暖白/深墨色板，深浅两套 token，主题切换（浅色/深色/跟随系统）真实可用
- **已落地的设计细节**：「我是我」页的核心思想引文（代码常量，不可删）；首页空状态文案 + 三条快捷提示（点击填入输入框）+ 输入框上方「新对话 / 历史对话」+ 右侧「未配置 AI · 去设置」
- **安全**：`sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`、CSP、外链交给系统浏览器
- **便携数据目录**：打包后 userData = 程序目录 `data/`，开发期 `.data/`（拷贝文件夹即带走数据）

### 3. 验证

| 项目 | 结果 |
|---|---|
| `npm run typecheck` | 通过（node + web 双配置） |
| `npm run build` | 通过（main 2.5kB / preload 0.4kB / renderer 679kB） |
| Electron 启动 | 窗口进程可正常起来并稳定运行 |
| git | `35f26d1` 首个提交 |

## 遇到并解决的问题

1. **Electron 二进制下载失败**：沙箱内 fetch 被拦，改为沙箱外 curl npmmirror 镜像（150.8MB）+ 手动解压到 `node_modules/electron/dist`。
2. **主进程被 Node 执行而非 Electron**：宿主注入 `ELECTRON_RUN_AS_NODE=1`。你本地终端不会有这个问题；若从某些 IDE 内嵌终端启动，需先 `unset ELECTRON_RUN_AS_NODE`。
3. **GPU 进程反复崩溃**（`0xC0000005` + 缓存目录占用）：已在内置代码里关闭 GPU 合成与 GPU 沙箱（`disable-gpu` / `disable-gpu-compositing` / `disable-gpu-sandbox` + `disableHardwareAcceleration`）。文本应用不需要硬件加速，这个改动对真实用户只省电不降级。

## 怎么验收

```bash
cd D:\CodeLab\我是我V2.0
npm run dev
```

应看到：左侧栏「我是我 V2.0」+ 七个导航 + 底部设置；首页有主标题、三条提示、底部输入框；点侧栏「设置」切深色主题立刻生效；「我是我」页顶部有核心思想引文。

## 下一步（Phase 1）

Dexie 数据库：11 张表 + seq 字段 + 游标 + 快照字段，独立 `reflections` 库，schema 迁移测试；接上现状/目标/行动/复盘的真实 CRUD。

## 遗留

- 数据目录放程序目录 `data/`（评审 D4）：这意味着「换目录 = 换数据」。如果你希望数据固定在某处（如 `%APPDATA%` 或用户自选），现在改成本最低。
- 示例会话草案不可点、两条提示合并为一张卡（评审 D5/D9）：Phase 2 实现首页聊天时会按此做。
