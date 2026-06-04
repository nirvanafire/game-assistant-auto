## ADDED Requirements

### Requirement: NEXT_STEP 转场动作
`StepTransition.action` SHALL接受值 `'NEXT_STEP'`。TaskEngine SHALL将 `NEXT_STEP` 解释为"推进到下一个有序步骤"，当步骤在组内时作用域限定为当前步骤组。

#### Scenario: NEXT_STEP 推进未分组步骤
- **当** IMAGE_MATCH 步骤（无 `groupId`）匹配成功且 `onMatch.action === 'NEXT_STEP'` 时
- **则** 引擎推进到该任务中 `order` 值次高的非分组步骤

#### Scenario: NEXT_STEP 在组内推进
- **当** 组 `g1` 内的 IMAGE_MATCH 步骤匹配成功且 `onMatch.action === 'NEXT_STEP'` 时
- **则** 引擎推进到 `g1` 中排在当前步骤之后的下一个步骤；如果没有了，组迭代完成，开始下一轮循环（或达到 loopCount 时退出组）

#### Scenario: nextStepId 优先于 action
- **当** `onMatch.nextStepId === 's5'` 且 `onMatch.action === 'NEXT_STEP'` 时
- **则** 引擎跳转到步骤 `s5`（两者都设置时 nextStepId 优先）

#### Scenario: NEXT_STEP 到达任务末尾时完成
- **当** 未分组的 IMAGE_MATCH 步骤是 `order` 最后的步骤，且其结果的转场为 `NEXT_STEP` 时
- **则** 任务状态变为 `completed`

#### Scenario: NEXT_STEP 到达组末尾时继续循环
- **当** 组内步骤是组内最后一个步骤，且其结果的转场为 `NEXT_STEP`，且该组还有剩余循环迭代时
- **则** 引擎从该组的第一个步骤开始下一轮循环迭代

#### Scenario: NEXT_STEP 到达最后一轮组迭代时退出组
- **当** 组内步骤是组内最后一个步骤，且其结果的转场为 `NEXT_STEP`，且没有剩余循环迭代时
- **则** 引擎跳出该组，推进到 `order` 中组之后的下一个未分组步骤；如果不存在，任务完成

### Requirement: undefined 转场停止任务
TaskEngine SHALL将 `transition === undefined`（以及 `transition.action === undefined && transition.nextStepId === undefined`）视为停止信号。任务SHALL转为 `completed` 状态。

#### Scenario: undefined onMiss 在未匹配时停止
- **当** IMAGE_MATCH 步骤未匹配且 `onMiss` 为 undefined 时
- **则** 引擎将任务状态设为 `completed`，不运行后续步骤

#### Scenario: undefined onMatch 在匹配成功时停止
- **当** IMAGE_MATCH 步骤匹配成功且 `onMatch` 为 undefined 时
- **则** 引擎将任务状态设为 `completed`

#### Scenario: 组内的 undefined 转场停止
- **当** 组内步骤的相关转场为 undefined 时
- **则** 引擎停止任务；不再重新进入组循环

### Requirement: CLICK 步骤不变
CLICK 步骤SHALL继续推进到下一个有序步骤，无论 onMatch/onMiss 如何配置。新的转场语义不适用于 CLICK。

#### Scenario: CLICK 不停止
- **当** CLICK 步骤执行完毕时
- **则** 引擎推进到下一个有序步骤，忽略任何已持久化的 onMatch/onMiss 字段

### Requirement: 新建步骤默认值
StepEditor 对新建 IMAGE_MATCH 或 IMAGE_GROUP 步骤的 initialValues SHALL设置 `onMatchAction = 'NEXT_STEP'`，`onMissAction` 留空（undefined）。

#### Scenario: 匹配时动作在表单中默认显示
- **当** 用户打开 StepEditor 创建 IMAGE_MATCH 步骤时
- **则** "匹配时 / 动作" Select 显示"下一个步骤"

#### Scenario: 未匹配时动作在表单中为空
- **当** 用户打开 StepEditor 创建新 IMAGE_MATCH 步骤时
- **则** "未匹配时 / 动作" Select 显示"（无）"

### Requirement: 转场动作选项包含"下一个步骤"
StepEditor 的转场动作 Select SHALL至少列出：「（无）」(undefined)、「下一个步骤」(`NEXT_STEP`)、「结束任务」(`END_TASK`)、「结束步骤组」(`END_STEP_GROUP`)。

#### Scenario: 用户可见的选项
- **当** 用户打开转场动作 Select 时
- **则** 四个选项都以上述标签存在

#### Scenario: 未分组步骤禁用"结束步骤组"
- **当** 步骤没有 `groupId` 时
- **则** "结束步骤组"选项被隐藏或禁用并附带提示

## MODIFIED Requirements

### Requirement: Migration v4 回填现有转场
持久化层SHALL应用 migration v4，为现有 IMAGE_MATCH 和 IMAGE_GROUP 行中 `action` 和 `nextStepId` 都缺失的 `on_match` 和 `on_miss` 列回填为 `'{"action":"NEXT_STEP"}'`。CLICK 行跳过。

#### Scenario: 现有 IMAGE_MATCH 步骤保留推进行为
- **当** IMAGE_MATCH 行在迁移前 `on_match = '{}'` 时
- **则** 迁移后值为 `'{"action":"NEXT_STEP"}'`，引擎在匹配后的行为与之前完全一致

#### Scenario: 现有 CLICK 步骤不被修改
- **当** CLICK 行 `on_match = '{}'` 时
- **则** 迁移保持原值 `'{}'`；引擎继续忽略它

#### Scenario: 已有 action 的行不被修改
- **当** IMAGE_MATCH 行已有 `on_match = '{"action":"END_TASK"}'` 时
- **则** 迁移不修改该行

#### Scenario: 已有 nextStepId 的行不被修改
- **当** IMAGE_MATCH 行有 `on_match = '{"nextStepId":"s3"}'` 时
- **则** 迁移不修改该行

#### Scenario: Schema 版本变为 4
- **当** 迁移运行完成后
- **则** `getCurrentVersion(db) === 4`
