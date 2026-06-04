## ADDED Requirements

### Requirement: UI 标签重命名为"图像组匹配"
StepEditor 的类型 Select 以及步骤列表中 IMAGE_GROUP 类型的显示SHALL使用标签"图像组匹配"。底层 `StepType` 枚举值保持 `'IMAGE_GROUP'`。

#### Scenario: 类型 Select 显示新标签
- **当** 用户打开 StepEditor 并查看类型 Select 选项时
- **则** `IMAGE_GROUP` 的选项文本为"图像组匹配"

#### Scenario: 步骤列表行显示新标签
- **当** 步骤列表渲染 `type === 'IMAGE_GROUP'` 的步骤时
- **则** 显示的类型标签为"图像组匹配"

#### Scenario: 持久化的类型标识不变
- **当** 用户创建"图像组匹配"步骤且渲染层发送到主进程时
- **则** 持久化的 `type` 值为字符串 `'IMAGE_GROUP'`

### Requirement: 多模板编辑器
IMAGE_GROUP 的 StepEditor SHALL渲染一个可编辑的模板列表，每项暴露 `label`、`templatePath` 和 `threshold`。列表SHALL支持添加和移除操作。

#### Scenario: 默认有一个空模板
- **当** 用户创建新的 IMAGE_GROUP 步骤时
- **则** 模板列表显示一行空行，`threshold` 默认 0.8，标签自动生成（如"模板 1"）

#### Scenario: 添加模板追加一行
- **当** 用户点击"+ 添加模板"时
- **则** 一行新的空行被追加，`threshold = 0.8`，标签自动生成

#### Scenario: 移除模板删除该行
- **当** 用户点击某行的移除图标，且列表至少有两行时
- **则** 该行从列表中移除

#### Scenario: 最后一个模板不可移除
- **当** 用户点击唯一剩余行的移除图标时
- **则** 该行不被移除；通过内联提示或禁用状态传达约束

#### Scenario: 每个模板路径支持图片选择器
- **当** 用户在任一模板行点击"选择图片"时
- **则** 执行选择器→归一化流程（参见 `template-image-storage` 能力），将结果写入该行的路径字段

### Requirement: ALL/ANY 逻辑切换
IMAGE_GROUP 的 StepEditor SHALL渲染绑定到 `config.logic` 的 Radio.Group，两个选项：ALL（标签"同时满足（全部匹配）"）和 ANY（标签"满足其一（任一匹配）"）。新建步骤默认 ANY。

#### Scenario: 新建步骤默认 ANY
- **当** 用户创建新的 IMAGE_GROUP 步骤时
- **则** 逻辑单选选中"满足其一（任一匹配）"

#### Scenario: 选择 ALL 后持久化为 ALL
- **当** 用户选择"同时满足（全部匹配）"并保存步骤时
- **则** 持久化的 `config.logic` 为 `'ALL'`

### Requirement: 共享的时间和缩放字段
IMAGE_GROUP 的 StepEditor SHALL暴露 `delayMs`、`retryCount`、`retryIntervalMs` 和 `scaleRange` 编辑器，控件与 IMAGE_MATCH 相同。

#### Scenario: 编辑作用于整个组
- **当** 用户编辑任何时间/缩放字段时
- **则** 值写入顶层 `config` 对象，而非每个模板

### Requirement: 保存前校验
当 IMAGE_GROUP 步骤没有模板、或任何模板缺少 `label` / `templatePath`、或任何 `threshold` 超出 [0, 1] 范围时，StepEditor SHALL阻止保存。

#### Scenario: 空路径阻止保存
- **当** 用户尝试保存只有一行 `templatePath` 为空的模板的步骤时
- **则** 保存被拒绝，对应行高亮提示

#### Scenario: 无效阈值阻止保存
- **当** 任何模板的 `threshold > 1` 或 `threshold < 0` 时
- **则** 保存被拒绝，显示字段级错误消息

### Requirement: 转场卡片与 IMAGE_MATCH 一致
IMAGE_GROUP 的 StepEditor SHALL渲染与 IMAGE_MATCH 相同的 onMatch 和 onMiss 转场卡片，共享 `transition-defaults` 能力中定义的动作选项和默认值。

#### Scenario: 新建 IMAGE_GROUP 步骤与 IMAGE_MATCH 默认值相同
- **当** 用户创建新的 IMAGE_GROUP 步骤时
- **则** `onMatch.action` 默认为 `'NEXT_STEP'`，`onMiss.action` 默认为 undefined（"无"）
