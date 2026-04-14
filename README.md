# Hermes Desktop

Hermes Desktop 是一个基于 Tauri 构建的 Hermes Agent 桌面客户端。

它把 Hermes 原本偏 CLI 的使用方式，整理成一个更适合日常使用的桌面端体验，当前已经覆盖这些核心能力：

- 对话优先的聊天界面
- 启动引导与环境检查
- 渠道管理
- 技能管理
- 定时任务管理
- 桌面客户端风格的设置页

这个项目当前的产品方向很明确：  
它不是一个 AI workbench，也不是一个控制台或管理后台，而是一个更安静、更克制的桌面客户端。聊天保持主入口，复杂能力只在需要时露出。

## 当前状态

仓库已经可以直接运行，并且不是纯静态壳子，前后端已经接上了真实的 Hermes 能力。

目前已完成：

- Hermes 安装与环境检测
- 会话加载与基础聊天能力
- 渠道配置界面，包含微信内嵌二维码接入流程
- 技能库存读取、启用/禁用与安装管理
- 定时任务列表、新建与调度状态展示
- 基于 Hermes 配置快照的设置页读写能力

目前仍在继续打磨：

- 模型设置页中更完整的 custom provider / model discovery
- 更完整的中英文支持
- 聊天产物、任务状态、管理页之间的交互细节
- 开源发布所需的截图、图标、License 与仓库门面整理

## 技术栈

- Tauri v2
- React 18
- TypeScript
- Vite
- Tailwind CSS

## 本地运行

### 环境要求

- Node.js 18+
- Rust toolchain
- 本机已安装 Hermes Agent，并且在登录 shell 环境中可用

### 安装依赖

```bash
npm install
```

### 启动桌面应用

```bash
npm run tauri dev
```

### 仅启动前端开发服务

```bash
npm run dev
```

### 生产构建

```bash
npm run build
npm run tauri build
```

## 目录结构

```text
src/
  components/         通用 UI 组件
  hooks/              运行态与状态管理 hooks
  lib/                公共工具函数
  pages/              对话、渠道、技能、任务、设置
  styles/             全局主题与样式
src-tauri/
  src/                Tauri Rust 后端
  icons/              应用图标
docs/plans/           产品与 UI 规划文档
ui/                   高保真静态参考稿
```

## 产品文档

当前这版桌面客户端的页面与产品方向，主要收敛在下面两份文档：

- `docs/plans/2026-04-14-desktop-page-requirements-reset.md`
- `docs/plans/2026-04-14-settings-page-reset-requirements.md`

对应的核心判断是：

- Chat-first
- Simple-first
- Desktop-client-first
- Real-capability-first

## 开源说明

这个项目还处在持续迭代阶段。  
接下来仓库里仍然会继续发生较明显的变化，包括命名、页面结构、交互细节、截图素材和开源资料整理。
