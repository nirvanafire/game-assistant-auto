## ADDED Requirements

### Requirement: 从 TaskEditor 创建步骤组
TaskEditor SHALL暴露"+ 添加步骤组"按钮，打开一个 Modal 收集 `name`（必填）和 `loopCount`（数字，0 表示无限）。提交后，系统调用 `step-group:create` 并刷新组列表。

#### Scenario: 打开创建 Modal
- **当** 用户点击"+ 添加步骤组"时
- **则** Modal 打开，`name` 为空，`loopCount` 默认为 1

#### Scenario: 创建成功
- **当** 用户输入名称并提交时
- **则** 调用 IPC `step-group:create`，参数 `{ taskId, name, loopCount }`；成功后 Modal 关闭，新组出现在步骤列表区域

#### Scenario: 空名称阻止提交
- **当** 用户提交空 `name` 时
- **则** 表单以行内错误拒绝；不调用 IPC

### Requirement: 步骤组编辑和删除
每张步骤组卡片SHALL暴露编辑和删除操作。编辑复用创建 Modal 并预填当前值。删除时确认提示，然后将包含的步骤的 `group_id` 设为 NULL 并删除组行。

#### Scenario: 编辑更新名称和循环次数
- **当** 用户点击步骤组卡片的编辑图标并提交新值时
- **则** 调用 `step-group:update`，参数 `{ stepGroupId, patch }`；卡片显示新值

#### Scenario: 删除确认流程
- **当** 用户点击步骤组卡片的删除图标时
- **则** 出现确认提示，询问是否删除步骤组；组内步骤不会被删除

#### Scenario: 删除使包含的步骤变为未分组
- **当** 用户确认删除一个包含三个步骤的步骤组时
- **则** 三个步骤的 `group_id` 变为 `NULL`；它们出现在"（未分组）"区域；步骤组卡片消失

#### Scenario: 取消删除保持原状
- **当** 用户关闭确认提示时
- **则** 步骤组及其步骤均不变

### Requirement: 步骤列表按组分区展示
TaskEditor SHALL以两层结构渲染步骤：每个步骤组作为一张带标题的卡片，包含其按 `order` 排列的步骤；一个"（未分组）"区域展示 `groupId === null` 的步骤。每张卡片提供"+ 在该组添加步骤"；工具栏提供"+ 添加步骤"用于创建未分组步骤。

#### Scenario: 步骤组卡片展示包含的步骤
- **当** 一个任务有步骤组 `g1`，内含两个步骤时
- **则** 编辑器渲染标题为 `g1.name` 的卡片，两个步骤列在卡片内部

#### Scenario: 循环次数显示为标签
- **当** 组的 `loopCount > 0` 时
- **则** 卡片头部显示类似"循环 ×3"的标签；如果 `loopCount === 0` 则显示"循环 ∞"

#### Scenario: 未分组区域按需出现
- **当** 至少有一个步骤的 `groupId === null` 时
- **则** 标题为"（未分组）"的区域出现并包含这些步骤；当所有步骤都属于某个组时该区域省略

#### Scenario: 步骤组排序按最小步骤 order
- **当** 组 A 的最早步骤 `order = 2`，组 B 的最早步骤 `order = 5` 时
- **则** 组 A 的卡片渲染在组 B 之前；未分组步骤与步骤组卡片按各自的 `order` 在区域边界交错，而非在卡片内部穿插

#### Scenario: 空步骤组渲染在组区域末尾
- **当** 步骤组已创建但尚未包含任何步骤时
- **则** 其卡片出现在所有非空组之后；卡片主体显示空提示和"+ 在该组添加步骤"按钮

### Requirement: 添加步骤按钮限定到正确的组
"+ 在该组添加步骤"按钮SHALL将组的 `id` 传入 StepEditor 实例，使新步骤创建时带有该 `groupId`。工具栏的"+ 添加步骤"SHALL创建 `groupId === undefined` 的步骤。

#### Scenario: 组内添加步骤分配 groupId
- **当** 用户在组 `g1` 点击"+ 在该组添加步骤"并保存新步骤时
- **则** 持久化步骤的 `groupId === 'g1'`

#### Scenario: 工具栏添加步骤保持未分组
- **当** 用户点击工具栏"+ 添加步骤"并保存时
- **则** 持久化步骤的 `groupId` 为 undefined / NULL

#### Scenario: StepEditor 不显示 groupId 字段
- **当** 用户打开 StepEditor（无论新建还是编辑）时
- **则** 没有 UI 控件可以修改步骤的 `groupId`；组上下文仅由入口按钮决定

### Requirement: 步骤组 IPC 通道
系统SHALL暴露四个步骤组管理的 IPC 通道。每个都可从渲染层调用。

#### Scenario: 列出任务的步骤组
- **当** 渲染层调用 `step-group:list`，参数 `{ taskId }` 时
- **则** 响应为 `{ groups: StepGroup[] }`，按创建顺序或 id 排序

#### Scenario: 创建步骤组
- **当** 渲染层调用 `step-group:create`，参数 `{ taskId, name, loopCount }` 时
- **则** 响应为 `{ group: StepGroup }`，包含新 id

#### Scenario: 更新步骤组
- **当** 渲染层调用 `step-group:update`，参数 `{ stepGroupId, patch }` 时
- **则** 行被 patch 字段更新；返回 void

#### Scenario: 删除步骤组前先解组步骤
- **当** 渲染层调用 `step-group:delete`，参数 `{ stepGroupId }` 时
- **则** 所有 `group_id` 匹配的步骤被更新为 `group_id = NULL`，然后删除步骤组行；返回 void

### Requirement: 增删改后重新加载步骤组
每次创建、更新、删除成功后，TaskEditor SHALL重新获取步骤组列表和步骤列表，使 UI 反映新状态。

#### Scenario: 创建触发重新加载
- **当** `step-group:create` resolve 后
- **则** TaskEditor 再次调用 `step-group:list` 和 `step:list`，更新渲染状态

#### Scenario: 删除触发重新加载
- **当** `step-group:delete` resolve 后
- **则** TaskEditor 再次调用 `step-group:list` 和 `step:list`，新变为未分组的步骤出现在"（未分组）"区域
