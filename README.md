# Hermes Desktop

Hermes Agent 的桌面客户端，基于 Tauri v2 + React + TypeScript 构建。

## 技术栈

- **前端框架**: React 18
- **语言**: TypeScript
- **构建工具**: Vite
- **桌面框架**: Tauri v2
- **样式**: Tailwind CSS
- **路由**: React Router v6

## 项目结构

```
hermes-desktop/
├── src/                    # 前端源码
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 入口文件
│   ├── pages/             # 页面组件
│   │   ├── Chat.tsx       # 对话页面
│   │   ├── Channels.tsx   # 渠道配置
│   │   ├── Skills.tsx     # 技能管理
│   │   ├── Tasks.tsx      # 定时任务
│   │   └── Settings.tsx   # 设置页面
│   ├── components/        # 通用组件
│   │   └── Layout.tsx     # 底部导航布局
│   ├── hooks/             # 自定义 Hooks
│   ├── utils/             # 工具函数
│   └── styles/            # 样式文件
├── src-tauri/             # Tauri 后端
│   ├── src/
│   │   ├── main.rs        # Rust 入口
│   │   └── lib.rs         # 库文件
│   ├── Cargo.toml         # Rust 依赖
│   ├── tauri.conf.json    # Tauri 配置
│   └── icons/             # 应用图标
└── package.json           # Node.js 依赖
```

## 开发指南

### 环境要求

- Node.js 18+
- Rust 1.73+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

## 功能规划

### P0 - 核心功能
- [x] 安装向导
- [x] 对话界面
- [ ] 模型配置
- [ ] Gateway 管理
- [ ] 消息渠道配置

### P1 - 增强功能
- [ ] 技能管理
- [ ] 定时任务
- [ ] 记忆系统

### P2 - 扩展功能
- [ ] MCP 管理
- [ ] 插件管理
- [ ] 主题设置

## 设计理念

参考 Linear、Notion、Raycast 等现代应用的设计语言，追求：
- 简洁美观
- 年轻活力
- 中文优先
