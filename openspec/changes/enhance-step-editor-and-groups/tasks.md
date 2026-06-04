## 1. 共享类型 — NEXT_STEP 转场动作

- [ ] 1.1 在 `src/shared/types/task.ts` 的 `StepTransition.action` 联合类型中添加 `'NEXT_STEP'`
- [ ] 1.2 更新 `src/shared/types/__tests__/task-types.test.ts` 验证新值可用

## 2. IPC 通道常量

- [ ] 2.1 在 `src/shared/constants.ts` 的 `IPC_CHANNELS` 中添加 `IMAGE_PICK`、`IMAGE_NORMALIZE`、`STEP_GROUP_LIST`、`STEP_GROUP_CREATE`、`STEP_GROUP_UPDATE`、`STEP_GROUP_DELETE`

## 3. 模板图片管理服务

- [ ] 3.1 创建 `src/main/services/template-storage.ts`：`TemplateStorage` 类，含 `init()`、`isManaged(path)`、`normalize(sourcePath)` 方法
- [ ] 3.2 创建 `src/main/services/__tests__/template-storage.test.ts`：覆盖目录初始化、已管理路径判断、外部文件复制（UUID 重命名）、已管理路径原样返回、缺失文件拒绝

## 4. StorageService — 步骤组 CRUD

- [ ] 4.1 在 `src/main/services/storage.ts` 中添加 `listStepGroupsByTask(taskId)`、`createStepGroup(data)`、`updateStepGroup(id, patch)`、`deleteStepGroup(id)` 方法
- [ ] 4.2 `deleteStepGroup` 必须先将引用该组的步骤的 `group_id` 置 NULL，再删除组行

## 5. 图片 IPC 处理器

- [ ] 5.1 创建 `src/main/ipc/image.ts`：注册 `IMAGE_PICK`（弹出文件选择器）和 `IMAGE_NORMALIZE`（委托 TemplateStorage）处理器
- [ ] 5.2 创建 `src/main/ipc/__tests__/image-ipc.test.ts`

## 6. 步骤组 IPC 处理器

- [ ] 6.1 创建 `src/main/ipc/step-group.ts`：注册 `STEP_GROUP_LIST`、`STEP_GROUP_CREATE`、`STEP_GROUP_UPDATE`、`STEP_GROUP_DELETE` 处理器
- [ ] 6.2 创建 `src/main/ipc/__tests__/step-group-ipc.test.ts`

## 7. 主进程注册

- [ ] 7.1 在 `src/main/index.ts` 中初始化 `TemplateStorage`、注册图片和步骤组 IPC 处理器

## 8. Migration v4 — 回填转场动作

- [ ] 8.1 在 `src/main/db/migrations.ts` 添加 migration v4：为 IMAGE_MATCH 和 IMAGE_GROUP 行中 action 和 nextStepId 都缺失的 `on_match`/`on_miss` 回填为 `{"action":"NEXT_STEP"}`
- [ ] 8.2 更新 `src/main/db/schema.ts` 版本到 4
- [ ] 8.3 创建 `src/main/db/__tests__/migration-v4.test.ts`：覆盖空 on_match 回填、空 on_miss 回填、CLICK 跳过、已有 action 不修改、已有 nextStepId 不修改、版本号更新

## 9. TaskEngine — NEXT_STEP + undefined 停止语义

- [ ] 9.1 修改 `src/main/services/task-engine.ts`：`NEXT_STEP` 推进到下一步（组内时限定组内），undefined 转场停止任务，CLICK 行为不变
- [ ] 9.2 创建 `src/main/services/__tests__/transition-semantics.test.ts`：覆盖 NEXT_STEP 推进、undefined onMatch 停止、undefined onMiss 停止、CLICK 仍推进

## 10. StepEditor — 开关横排 + CLICK 隐藏 + 新默认值

- [ ] 10.1 将三个开关用 `Space` 水平排列，`cacheCoordinates` 扩展到 IMAGE_GROUP 也显示
- [ ] 10.2 CLICK 类型隐藏全部三个开关和转场卡片
- [ ] 10.3 新建步骤默认 `cacheCoordinates: true`、`onMatchAction: 'NEXT_STEP'`、`onMissAction: undefined`

## 11. StepEditor — 转场动作选项

- [ ] 11.1 `TRANSITION_ACTIONS` 添加 `NEXT_STEP`（标签"下一个步骤"）
- [ ] 11.2 `END_STEP_GROUP` 在步骤无 `groupId` 时隐藏或禁用

## 12. StepEditor — IMAGE_GROUP 编辑器

- [ ] 12.1 类型 Select 标签改为"图像组匹配"
- [ ] 12.2 实现 `ImageGroupFields` 组件：`Form.List` 模板列表（label/path/threshold）、添加/移除按钮、最后一项不可删除
- [ ] 12.3 `logic` Radio.Group（ALL/ANY），默认 ANY
- [ ] 12.4 共享时间/缩放字段（delayMs、retryCount、retryIntervalMs、scaleRange）
- [ ] 12.5 转场卡片与 IMAGE_MATCH 一致
- [ ] 12.6 保存前校验：至少一个模板、label/path 非空、threshold 在 [0,1]
- [ ] 12.7 更新 `buildConfig` IMAGE_GROUP 分支返回表单数据

## 13. StepEditor — 图片选择与归一化

- [ ] 13.1 每个 `templatePath` 输入框旁添加"选择图片"按钮
- [ ] 13.2 按钮流程：`image:pick` → `image:normalize` → 回填输入框
- [ ] 13.3 保存时对所有 `templatePath` 调用 `image:normalize`，失败则中止保存并显示错误

## 14. TaskEditor — 步骤组管理

- [ ] 14.1 创建 `StepGroupCard` 组件：卡片头部（组名 + 循环标签 + 编辑/删除）、组内步骤列表、"+ 在该组添加步骤"按钮
- [ ] 14.2 TaskEditor 加载步骤组列表（`step-group:list`）
- [ ] 14.3 "+ 添加步骤组"按钮 + 创建/编辑 Modal（name + loopCount）
- [ ] 14.4 步骤按 `groupId` 分组展示，未分组步骤单独分区
- [ ] 14.5 组按成员步骤最小 `order` 排序，空组排在末尾
- [ ] 14.6 删除组确认后解组步骤
- [ ] 14.7 增删改后重新加载步骤组和步骤列表

## 15. App.tsx + 列表组件 — 移除全屏编辑器视图

- [ ] 15.1 `App.tsx`：移除 `'task-editor'`/`'group-editor'` 视图分支，仅保留 `'tasks'`/`'groups'` 切换
- [ ] 15.2 `TaskList.tsx`：移除 `onEdit` prop，编辑按钮直接调用 `setDrawerTaskId`
- [ ] 15.3 `TaskGroupList.tsx`：移除 `onEdit` prop，编辑按钮直接调用 `setDrawerGroupId`

## 16. 验证

- [ ] 16.1 运行全部测试（`npx vitest run`）
- [ ] 16.2 构建验证（`npm run build`）
- [ ] 16.3 手动验证清单：双击/编辑按钮打开同一个 Drawer、开关横排、CLICK 无开关、缓存坐标默认开启、图片选择与归一化、IMAGE_GROUP 编辑器、步骤组增删改查、转场默认值
