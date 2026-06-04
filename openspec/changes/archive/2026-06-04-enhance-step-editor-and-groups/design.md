## 背景

本轮改动建立在正在进行的 `refactor-assistant-module` 基础之上。该变更已引入 Drawer 编辑、逐步骤实时比对、坐标缓存和 CLICK 简化。本轮聚焦于上述功能落地后暴露的编辑器 UX 缺口：编辑入口不统一、手动输入路径无资产管理、开关垂直堆叠、IMAGE_GROUP 编辑器为空、转场动作无默认值、步骤组无管理界面。改动集中在 StepEditor、TaskEditor、两个列表组件、新的 template-storage 服务以及一处引擎语义调整。

## 目标 / 非目标

**目标：**
- 统一编辑入口：编辑按钮和双击都打开同一个 Drawer。
- 将模板图片作为 `userData/templates/` 下的一等公民资产进行管理。
- 让三个步骤开关更紧凑（横排），并为 `cacheCoordinates` 采用合理的默认值。
- 为 IMAGE_GROUP 步骤类型提供完整编辑器，包括 ALL/ANY 逻辑。
- 给转场动作设置有意义的默认值；明确"无"表示"停止"，而非"继续推进"。
- 在 TaskEditor 中暴露步骤组的创建、编辑、删除；按 `groupId` 分组展示步骤。

**非目标：**
- 不支持步骤在组间拖拽。
- 不做孤儿图片清理。
- 不改动匹配服务。
- 不新增 `NEXT_STEP` 以外的转场动作类型。
- 不做图片去重（同一来源选两次会产生两份拷贝）。

## 决策

### 1. 编辑按钮和双击收敛到同一个 Drawer

列表组件拥有 `drawerXxxId` 状态。编辑按钮的 `onClick` 和行的 `onDoubleClick` 都调用 `setDrawerXxxId(id)`。`onEdit` 属性移除（或保留为父组件的空操作回调）。`App.tsx` 废弃 `'task-editor'` 和 `'group-editor'` 视图分支，顶部栏仅保留 `'tasks'` / `'groups'` 切换。

**考虑过的备选方案：**
- 用 Modal 代替 Drawer：被否决——TaskEditor 和 TaskGroupEditor 是纵向表单；Drawer 的侧边面板格式更匹配其高度，且已在使用中。
- 保留两种编辑模式（按钮=全屏视图，双击=Drawer）：被否决——用户明确要求统一，不一致正是本轮要修复的问题。

### 2. 模板图片在保存时归一化，而非输入时

无论用户粘贴路径还是选择文件，渲染层都将 `templatePath` 收集为字符串。在步骤保存时（发送 `step:create` / `step:update` 之前），渲染层对每个模板路径调用 `image:normalize`。主进程检查路径是否已在 `templates/` 下；若在则原样返回，否则复制到 `templates/<uuid><ext>` 并返回新路径。

选择按钮复用同一流程：调用 `image:pick` 获取源路径，再调用 `image:normalize` 复制进来，然后写入表单字段。

**理由**：在保存时（而非失焦时）归一化，避免表单显示一个路径而磁盘上是另一个的不一致状态。也使选择按钮的代码路径与手动输入完全一致。

**考虑过的备选方案：**
- 输入失焦时复制：被否决——在编辑中途隐式复制会让用户意外；增加撤销的复杂度。
- 仅通过选择器复制，手动输入保留为外部引用：被否决——用户明确要求手动输入也要复制。

### 3. 横排开关行使用 Space + 等宽 Form.Item

三个开关放在 antd `Space`（horizontal, `wrap`）容器内。每个 `Form.Item` 标签在上、`Switch` 在下，通过 flex 等宽分配。`shouldUpdate` 表单项已按步骤类型有条件渲染——将其扩展为包裹所有三个开关的共享条件块，保持逻辑集中。

**`cacheCoordinates` 默认值变更**：新建步骤的 initialValues 设为 `cacheCoordinates: true`。现有行不回溯翻转——它们保留原有值——因为静默改变现有行为有风险，且用户只要求新步骤的默认值。

### 4. IMAGE_GROUP_MATCH 使用现有配置结构

`ImageGroupMatchConfig` 已支持 `templates: Array<{label, templatePath, threshold}>` 和 `logic: 'ALL' | 'ANY'`。编辑器暴露：
- `templates` 的 `Form.List`，每项含标签 / 路径（+ 选择按钮） / 阈值。
- `logic` 的 `Radio.Group`，标签为"同时满足（全部匹配）" / "满足其一（任一匹配）"。默认 `ANY`。
- 模板列表下方的共享时间/缩放字段（`delayMs`、`retryCount`、`retryIntervalMs`、`scaleRange`）。
- 与 IMAGE_MATCH 相同的转场卡片（onMatch/onMiss）。

UI 标签"图像组匹配"替换类型 Select 和步骤列表中的"图像组"。底层 `StepType` 值保持 `'IMAGE_GROUP'` 以避免数据迁移。校验规则：至少一个模板；每个模板要求有 label、templatePath 和有效阈值。

### 5. 转场语义：显式 NEXT_STEP，undefined 表示停止

当前引擎将 undefined 转场视为"推进到下一个有序步骤"。新模型：

| 转场状态                                      | 引擎行为                                |
|-----------------------------------------------|-----------------------------------------|
| `transition === undefined` 或 `action === undefined` | 任务完成（不再运行后续步骤）        |
| `action === 'NEXT_STEP'`                      | 推进到下一个有序步骤（组内时推进到组内下一步） |
| `action === 'END_TASK'`                       | 任务完成                                 |
| `action === 'END_STEP_GROUP'`                 | 跳出当前组循环，继续组之后的步骤       |
| `nextStepId` 已设置                            | 跳转到指定步骤（两者都设置时 nextStepId 优先） |

**理由**：用户明确说"无 = 不执行后续步骤"。undefined 映射为"推进"是一个隐式默认值，隐藏了意图。让"推进"和"停止"都显式化，迫使步骤编辑者声明应该发生什么。

**新步骤默认值**：`onMatch.action = 'NEXT_STEP'`（常见场景），`onMiss.action = undefined`（未配置的未匹配时停止）。

### 6. Migration v4 保留现有步骤行为

不做迁移的话，现有 `on_match`/`on_miss` 为 `'{}'`（当前的"undefined"表示）的 IMAGE_MATCH/IMAGE_GROUP 步骤会突然停止而非继续推进——破坏所有现有任务。

Migration v4 遍历 `steps` 表：
- 对每个 `type IN ('IMAGE_MATCH', 'IMAGE_GROUP')` 的行：
  - 若 `on_match` 为 `NULL`、`''`、`'{}'`，或 `json_extract(on_match, '$.action')` 为 null 且 `json_extract(on_match, '$.nextStepId')` 为 null → 设置 `on_match = '{"action":"NEXT_STEP"}'`。
  - `on_miss` 同理。
- CLICK 行跳过（其转场本来就被引擎忽略）。

因此现有任务在迁移后行为完全一致。只有新步骤才会使用新默认值。

### 7. 步骤组：先建组，再分配

TaskEditor 的步骤区域分为：
- 工具栏：`+ 添加步骤组` 和 `+ 添加步骤` 按钮。
- 步骤组卡片列表，每张卡片有头部（组名 + 循环标签 + 编辑/删除图标）、组内步骤，以及底部的 `+ 在该组添加步骤` 按钮。
- "（未分组）"区域，结构相同，但没有组管理图标。

步骤组的创建/编辑使用小 Modal（name + loopCount）。删除时确认提示，然后将该组所有步骤的 `group_id` 设为 NULL，再从 `step_groups` 表删除该行。步骤本身不被删除。

每个"添加步骤"按钮将目标 `groupId`（或 undefined）传入 StepEditor，以便新步骤在正确的组中创建。StepEditor 本身不暴露 `groupId` 选择器——由入口按钮决定。

**展示排序**：步骤组按其成员步骤的最小 `order` 排序（即组在列表中的位置反映其第一个步骤的位置）。这避免了在 `step_groups` 表上新增"组排序"列。未分组步骤按 `order` 自然穿插。

**新增 IPC 通道**：
- `step-group:list` — `{ taskId } → { groups: StepGroup[] }`
- `step-group:create` — `{ taskId, name, loopCount } → { group: StepGroup }`
- `step-group:update` — `{ stepGroupId, patch: Partial<StepGroup> } → void`
- `step-group:delete` — `{ stepGroupId } → void`

`step-group:delete` 是唯一有非平凡逻辑的（必须先将引用该组的步骤的 `group_id` 置空，再删除组行）。渲染层在每次增删改后重新加载组列表。

## 风险 / 权衡

- **[undefined 转场行为变更]** → 如果 migration v4 漏掉了某行（例如 NULL 处理在不同 SQLite 版本间有差异），受影响的步骤会意外停止。**缓解措施**：迁移测试覆盖 NULL、空字符串、`'{}'`、部分填充的 JSON 和已有 action 的行。发布前在开发库上做手动冒烟测试。

- **[模板目录无限增长]** → 每次保存都复制新文件；孤儿文件会累积。**缓解措施**：本轮不做；作为未来的清理工具跟踪。

- **[步骤组按 min(step.order) 排序是隐式的]** → 重命名或重组时如果步骤顺序变化，用户可能感到意外。**缓解措施**：已在设计中记录；如有后续需求可新增显式 `group_order` 列。

- **[跨组顺序歧义]** → 如果两个组的顺序交错（如组 A 的步骤在 order 1,3，组 B 在 order 2），按 min(order) 渲染会让 A 排在 B 前面，但 B 的步骤会视觉上"穿插"在 A 的步骤之间。**缓解措施**：本轮将组卡片连续渲染（A 的所有步骤在一起，然后 B 的），接受与全局 order 字段的轻微不一致。引擎仍按 `order` 遍历，执行不受影响。

- **[输入不存在的文件路径]** → 保存时归一化失败；用户收到错误提示。**缓解措施**：清晰的内联错误消息；表单不提交直到路径解析成功。

## 迁移计划

1. **Schema**：不新增列；`template-storage` 目录在应用启动时自动创建。
2. **Migration v4**：回填 IMAGE_MATCH 和 IMAGE_GROUP 行中 action 和 nextStepId 都缺失的 `on_match`/`on_miss` 为 `'{"action":"NEXT_STEP"}'`。Schema 版本更新到 4。
3. **模板图片无需迁移**：现有 `templatePath` 值原样保留。仅在步骤重新保存时才归一化（惰性迁移）。
4. **回滚**：回退 migration v4（删除回填的 action 键）；回退渲染器/主进程代码；`templates/` 目录留在磁盘上无害。

## 待定问题

- StepEditor 是否应在保存时提示模板路径已被归一化（即文件被复制了），让资产管理对用户可见？
- `step-group:delete` 是否应提供一个破坏性变体，同时删除包含的步骤？
- Migration v4 中，CLICK 行是否也应归一化为哨兵值，让其未使用的转场在数据库中更明显，还是保持原样？
