## 背景

助手模块的编辑器层存在多个不一致之处。编辑入口有两种方式（按钮与双击）行为不同，模板图片路径只能手动输入且无资产管理，三个执行开关垂直堆叠导致表单拥挤，IMAGE_GROUP 类型完全没有编辑界面，转场动作没有默认值（迫使每个步骤都必须手动配置），步骤组在数据模型中存在但在 UI 中没有创建入口。这些问题拖慢了任务编辑的效率，也造成了运行时行为的不一致。

## 改动内容

- **编辑器入口统一**：TaskList 和 TaskGroupList 的编辑按钮和双击操作统一打开同一个 Drawer，废弃全屏编辑器视图。
- **模板图片持久化**：手动路径输入和"选择图片"按钮并存。无论用户使用哪种方式，图片都会被复制到 `userData/templates/` 下的管理目录，文件名按 UUID 重新生成。保存的 `templatePath` 始终指向该目录内的文件。
- **开关横排布局**：三个步骤开关（全新截图、实时比对、缓存坐标）水平排列，等宽显示。新建步骤的缓存坐标默认开启。
- **CLICK 类型精简表单**：CLICK 步骤不显示三个开关，转场卡片保持隐藏（已在进行中）。
- **图像组匹配编辑器**：IMAGE_GROUP 在 UI 中重命名为"图像组匹配"，补齐完整编辑界面：多模板列表（含标签/路径/阈值）、ALL/ANY 逻辑切换。
- **转场动作默认值与"无"语义**：新增 `NEXT_STEP` 动作。新建步骤默认 `onMatch=NEXT_STEP`、`onMiss=undefined`。引擎将 undefined 转场（UI 中的"无"选项）视为"停止任务"，而非"继续推进"。
- **步骤组管理 UI**：TaskEditor 暴露"+ 添加步骤组"按钮，步骤按 `groupId` 分组展示在可折叠卡片中。步骤组的增删改查通过新 IPC 处理器完成；删除步骤组时其下属步骤自动变为未分组。

## 非目标

- 不改动 Python 匹配服务或匹配协议。
- 不支持步骤在组间拖拽（手动重新分配不在本轮范围内）。
- 不做孤儿模板图片清理工具。
- 不在步骤组内并行执行步骤。
- 不改动任务组编排、中断处理器、网络监控或日志。

## 能力清单

### 新增能力

- `editor-drawer-consistency`：TaskList / TaskGroupList 的编辑按钮和双击处理器都打开同一个 Drawer。废弃全屏编辑器视图；顶部栏切换仅在任务列表和任务组列表之间切换。

- `template-image-storage`：主进程的 `template-storage` 服务拥有 `app.getPath('userData')/templates/` 目录。StepEditor 保存的任何 `templatePath` 都会被归一化到该目录；外部路径会被复制并重命名为 UUID + 原扩展名。图片选择和归一化通过 IPC 通道暴露。

- `step-editor-layout`：StepEditor 为 IMAGE_MATCH 和 IMAGE_GROUP 类型水平排列三个执行开关，为 CLICK 类型隐藏全部三个开关，新建步骤默认 `cacheCoordinates=true`。

- `image-group-match`：IMAGE_GROUP 步骤类型获得完整编辑器：可增删的模板列表（含标签/路径/阈值）、ALL/ANY 逻辑单选、共享的时间/缩放字段，以及与 IMAGE_MATCH 相同的转场卡片。UI 标签为"图像组匹配"；数据层类型标识保持 `IMAGE_GROUP`。

- `step-group-management`：TaskEditor 暴露步骤组的创建、编辑、删除。步骤按 `groupId` 分组展示在可折叠卡片中，未分组步骤单独分区。新增 IPC 处理器覆盖步骤组的增删改查。

### 修改能力

- `task-engine`：转场模型新增 `NEXT_STEP` 动作。引擎现在区分"明确在此停止"（undefined 转场）和"明确继续推进"（`NEXT_STEP`）。现有数据通过迁移保持原有行为。

- `persistence`：迁移回填现有 IMAGE_MATCH 和 IMAGE_GROUP 行的 `on_match`/`on_miss`，当 action 缺失且 nextStepId 为空时设为 `{"action":"NEXT_STEP"}`，使现有任务保持当前"匹配/未匹配后继续推进"的行为。CLICK 行跳过处理。

## 影响范围

- **共享类型**：`StepTransition.action` 新增 `'NEXT_STEP'`。
- **数据库**：Migration v4 回填现有 IMAGE_MATCH 和 IMAGE_GROUP 步骤的 `on_match`/`on_miss`，当当前为空/undefined 时设为 `{"action":"NEXT_STEP"}`。不新增列。
- **主进程**：
  - 新服务 `src/main/services/template-storage.ts`。
  - 新 IPC 处理器：`image:pick`、`image:normalize`、`step-group:list`、`step-group:create`、`step-group:update`、`step-group:delete`。
  - `task-engine.ts`：undefined 转场不再自动推进；新增 `NEXT_STEP` 分支。
- **渲染器**：
  - `App.tsx`：移除 `task-editor`/`group-editor` 视图分支。
  - `TaskList.tsx` / `TaskGroupList.tsx`：编辑按钮复用与双击相同的 Drawer 触发逻辑。
  - `StepEditor.tsx`：开关横排、图片选择按钮、IMAGE_GROUP_MATCH 编辑器、NEXT_STEP 选项、新默认值。
  - `TaskEditor.tsx`：步骤列表按组重组；步骤组增删改查 UI；"+ 添加步骤组"按钮。
- **Preload / 常量**：新增图片和步骤组操作的 IPC 通道常量。
