# Settings Page Reset Requirements

**Date:** 2026-04-14  
**Scope:** `设置` 页面，优先重构 `模型与路由` 子页  
**Goal:** 把当前“信息过多、心智负担过高、风格不像桌面客户端”的设置页，重置为一个**简单优先、桌面客户端风格、贴合 Hermes 现有真实能力**的偏好设置页面。

---

## 1. 背景与问题

当前设置页存在三类问题：

### 1.1 产品建模问题

此前的设计把 `Build / Debug / Review / Planning / Research` 这些概念当作 Hermes 已有的一等配置实体来表达，这是不准确的。

Hermes 当前真实可配置的模型相关能力主要是：

- 主模型：`model.default / provider / base_url / api_key`
- 压缩模型：`compression.summary_*` 与 `auxiliary.compression`
- 辅助模型：`auxiliary.vision / web_extract / session_search / approval / mcp / flush_memories`
- 子代理模型：`delegation.*`
- 简单请求智能路由：`smart_model_routing`
- Fallback：`fallback_providers` / `fallback_model`
- 自定义 provider：`custom_providers`

也就是说，Hermes 当前并没有现成的“任务路由实体”可以直接映射成设置页中的一等对象。

### 1.2 用户心智问题

普通用户并不想理解：

- compression model
- auxiliary models
- delegation model
- smart routing
- custom provider catalog

他们更自然的心智是：

> “我默认用哪个模型？”

如果设置页一上来就暴露过多内部模型层级，会显著提高上手门槛。

### 1.3 界面风格问题

此前方案的问题不是“细节不够好”，而是风格方向错误：

- 太像网页后台
- 太像控制台 / 工作台
- 概览区过多
- 信息摘要卡过多
- 产品在向用户解释设计，而不是让用户完成配置

目标应是：**更像桌面客户端偏好设置窗口，而不是 SaaS 管理后台。**

---

## 2. 产品目标

新的设置页必须同时满足以下三点：

### 2.1 简单优先

默认状态下，用户只需要完成一个最小配置闭环：

1. 选择 Provider 类型
2. 填写接口 URL / 登录凭证
3. 自动获取模型列表
4. 选择一个主模型
5. 保存并开始使用

### 2.2 高级能力可达

Hermes 现有的高级模型能力不能消失，但必须收纳在高级层中：

- 压缩模型
- 辅助模型
- 子代理模型
- Fallback
- Smart model routing
- 自定义 provider 的高级字段

### 2.3 桌面客户端风格

新的页面必须更像：

- macOS / Windows 桌面客户端的 Preferences / Settings
- 原生应用的分栏式偏好设置窗口

而不是：

- dashboard
- control center
- workbench
- 管理后台

---

## 3. 页面定位

新的设置页不是“系统运行态总览页”，也不是“AI 配置知识中心”。

它的定位应该是：

> 用户快速完成 Hermes Desktop 的首要配置，并且在需要时能逐步进入高级设置。

因此设置页的优先级应是：

### 第一优先级

- 把主模型配置好
- 测试连接成功
- 开始使用

### 第二优先级

- 管理自定义 provider
- 调整高级模型策略

### 低优先级

- 展示大量内部配置树
- 解释 Hermes 的内部实现
- 展示调试性状态信息

---

## 4. 页面范围

本次重构只针对设置页中的 **模型** 相关部分。

建议把当前的 `模型与路由` 命名收敛为：

- 一级菜单名称：`模型`

在该页面内部，再用轻量分段表达：

- `基础`
- `高级`
- `Provider`

不要默认使用“路由”这个词作为一级入口名，因为它会放大复杂度。

---

## 5. 信息架构

## 5.1 顶层结构

设置页使用三栏式桌面偏好设置结构：

### 左栏：设置分类

建议包含：

- 通用
- 助手
- 模型
- 语音与记忆
- 高级

当前聚焦 `模型`

### 中栏：当前分类下的配置对象

在 `模型` 下，中栏顶部使用轻量 segmented control：

- 基础
- 高级
- Provider

### 右栏：当前对象详情

右侧永远展示当前中栏选中对象的具体表单。

这意味着：

- 选中项和表单必须同屏
- 不能做成“上面点一个概念，下面另一个区域再找表单”

---

## 6. 模型页的产品结构

## 6.1 基础模式

这是默认打开时应该看到的内容。

目标是让普通用户在最短路径内完成可用配置。

### 中栏对象

基础模式下，中栏只保留一个对象：

- 主模型

如果产品需要，也可以保留最多两个对象：

- 主模型
- 回退模型

但默认不建议出现更多对象。

### 右栏字段

主模型页只显示：

- Provider 类型
- 接入方式
  - 官方 API
  - 自定义 OpenAI-compatible 接口
- Base URL
- API Key / 登录态
- 自动探测模型按钮
- 模型选择器
- 测试连接
- 保存更改

### 默认行为

用户填完 URL 和 Key 后：

1. 页面自动探测 `/models`
2. 如果成功，填充模型下拉
3. 默认选择一个推荐模型
4. 用户可以直接保存

如果失败：

1. 不阻塞配置流程
2. 降级为手动填写模型名称
3. 给出短提示：`未能自动获取模型，可手动填写`

### 基础模式必须隐藏的内容

不要在基础模式显示：

- compression model
- auxiliary models
- delegation model
- smart model routing
- provider catalog 细节
- models 勾选列表
- per-model context_length

---

## 6.2 高级模式

高级模式用于暴露 Hermes 当前真实存在的内部模型配置。

这里必须和 Hermes 真实配置结构对齐，而不是发明新的任务路由抽象。

高级模式中栏对象建议为：

- 压缩
- 辅助任务
- 子代理
- 回退策略
- 智能路由

### 右栏对应字段

#### 压缩

- `compression.summary_model`
- `compression.summary_provider`
- `compression.summary_base_url`
- `compression.enabled`

#### 辅助任务

用列表分组展示：

- `auxiliary.vision`
- `auxiliary.web_extract`
- `auxiliary.compression`
- `auxiliary.session_search`
- `auxiliary.approval`
- `auxiliary.mcp`
- `auxiliary.flush_memories`

每项只暴露必要字段：

- provider
- model
- base_url
- timeout

#### 子代理

- `delegation.model`
- `delegation.provider`
- `delegation.base_url`
- `delegation.reasoning_effort`
- `delegation.max_iterations`

#### 回退策略

- `fallback_providers`
- 或 `fallback_model.provider / model`

#### 智能路由

- `smart_model_routing.enabled`
- `max_simple_chars`
- `max_simple_words`
- `cheap_model`

### 高级模式的原则

- 这是给少数高级用户的
- 必须可用，但不抢默认注意力
- 不需要华丽，不需要摘要卡，不需要概念营销

---

## 6.3 Provider 模式

这是模型页里第二重要的部分。

它的目标不是让用户理解抽象设计，而是把“自定义接口”真正产品化。

### 产品定义

Provider 是一个可复用配置实体。

一个 Provider Profile 包含：

- 名称
- provider 类型
- base_url
- api_key
- api_mode
- 默认 model
- models catalog
- 能力标签（可选）
- context_length 元信息（可选）

多个模型配置或高级模型策略可以复用同一个 Provider Profile。

### 中栏对象

Provider 模式下，中栏显示：

- 已保存的 custom providers
- 官方 provider
- 新建 provider

例如：

- DMX API / Coding
- OpenAI Official
- Anthropic
- OpenRouter
- 新增自定义接口

### 右栏字段

当选中某个 provider 时，右栏显示：

- Profile Name
- Provider Type
- Base URL
- API Key（掩码）
- API Mode
- Default Model
- 自动探测模型
- 模型目录（高级折叠）
- 测试连接
- 保存

---

## 7. 自动探测模型能力

这是本次模型页必须支持的能力。

## 7.1 是否要支持

要支持。

原因：

- Hermes 底层已经具备探测 `/models` 的逻辑
- 用户不应该手动记忆大量 model id
- 能显著降低自定义接口接入门槛

## 7.2 默认体验

自动探测应该是**帮助用户降低门槛**，而不是新增配置步骤。

默认流程：

1. 用户输入 URL / API Key
2. 点击“测试连接”或“获取模型”
3. 系统自动请求 `/models`
4. 成功则填充模型列表
5. 默认选一个主模型

如果失败：

- 不中断流程
- 允许手动输入 model id

## 7.3 模型列表管理

普通用户默认只需要：

- 选一个主模型

高级用户才需要：

- 查看 endpoint 提供的全部模型
- 勾选要保存到 Provider Catalog 的模型
- 全选 / 清空
- 编辑某模型的 context_length

## 7.4 配置结构认知

前端表达层面可以把它设计成“模型目录”。

但实现上应对齐 Hermes 当前真实能力：

- `custom_providers[].model`
- `custom_providers[].models`

其中 `models` 更适合按对象字典处理，而不是仅当作简单字符串数组。

---

## 8. 命名策略

为了降低复杂度，页面命名必须收敛。

### 推荐用词

- `主模型`
- `高级模型策略`
- `Provider`
- `自定义接口`
- `回退策略`
- `子代理`
- `压缩`
- `辅助任务`

### 不推荐默认暴露的用词

- task route
- routing matrix
- workbench
- control center
- auxiliary client
- delegation channel
- smart turn routing

这些词可以存在于开发文档里，但不应默认出现在普通用户的设置页。

---

## 9. 视觉与交互要求

## 9.1 视觉方向

必须更像桌面客户端偏好设置窗口，而不是后台管理系统。

要求：

- 默认亮色
- 清爽、明亮、克制
- 低噪音
- 轻边框
- 小阴影
- 小圆角
- 列表式结构优先
- 表单式结构优先

避免：

- 概览卡片墙
- 工作台摘要区
- stage strip
- 控制台感
- 海报感
- 运营后台感

## 9.2 交互要求

- 左栏切换设置分类
- 中栏切换当前对象
- 右栏即时对应当前对象
- 不做花哨动效
- hover / selected / focus 要细微
- 顶部只保留少量动作：
  - 测试连接
  - 保存更改
  - 可选：恢复默认

---

## 10. 页面必须回答的产品问题

新的模型设置页必须帮助用户快速回答下面几个问题：

### 对普通用户

- 我现在默认用哪个模型？
- 我这个接口连通了吗？
- 如果自动获取不到模型，我怎么手动填？

### 对高级用户

- 压缩模型是什么？
- 辅助任务模型在哪里改？
- 子代理模型在哪里改？
- 这个自定义 provider 保存在哪？
- 我能不能缓存一批模型目录？

---

## 11. 实现建议

## 11.1 第一阶段

先实现一个真实可用的简单版本：

- 主模型配置
- URL / API Key
- 自动探测 models
- 主模型下拉
- 保存

## 11.2 第二阶段

再补高级模式：

- compression
- auxiliary
- delegation
- fallback
- smart routing

## 11.3 第三阶段

再补 provider catalog 管理：

- custom_providers list
- models catalog
- per-model metadata

---

## 12. 结论

新的设置页需求必须建立在这条总原则上：

> 默认配置只解决“让用户尽快开始使用”，高级配置才暴露 Hermes 内部真实能力树。

因此：

- 不再把“任务路由”当作当前 Hermes 已有的一等配置实体
- 不再让普通用户面对过多模型层级
- 不再让设置页长得像工作台或后台系统
- 以“主模型优先、自动探测优先、高级折叠、Provider 可复用”作为产品主线

