## ADDED Requirements

### Requirement: 编辑按钮和双击打开同一个 Drawer
TaskList 和 TaskGroupList 的编辑按钮和行双击处理器SHALL触发相同的 Drawer 状态。MUST NOT存在单独的全屏编辑器视图。

#### Scenario: 编辑按钮打开 Drawer
- **当** 用户点击任务行的编辑按钮时
- **则** TaskList 的 Drawer 打开，显示该任务的 TaskEditor

#### Scenario: 双击打开同一个 Drawer
- **当** 用户双击同一任务行时
- **则** 打开相同的 Drawer 和相同的 TaskEditor；行为与编辑按钮路径不可区分

#### Scenario: 任务组编辑器同样如此
- **当** 用户点击任务组行的编辑按钮或双击任务组行时
- **则** TaskGroupList 的 Drawer 打开，显示 TaskGroupEditor；两种入口产生相同的 Drawer

### Requirement: 全屏编辑器视图被移除
原先由 `'task-editor'` 和 `'group-editor'` 定位的右侧面板视图SHALL移除。顶部栏切换SHALL仅在任务列表和任务组列表之间切换。

#### Scenario: 顶部栏切换仅限列表
- **当** 用户在顶部栏切换"任务"和"任务组"时
- **则** 右侧面板仅渲染 TaskList 或 TaskGroupList；从顶部栏无法到达其他视图

#### Scenario: Drawer 关闭后不残留编辑器视图
- **当** 用户关闭编辑器 Drawer 时
- **则** 右侧面板返回对应的列表视图；不会出现之前的全屏编辑器路由

### Requirement: Drawer 状态由列表组件管理
Drawer 的打开/关闭状态SHALL是 TaskList / TaskGroupList 的本地状态。父组件不需要协调 Drawer 状态。

#### Scenario: 列表组件自行管理 Drawer
- **当** 用户打开、关闭或重新打开编辑器 Drawer 时
- **则** 所有状态转换在列表组件内部处理；不需要父组件的 `onEdit` 属性

#### Scenario: 关闭 Drawer 不影响列表选中状态
- **当** 用户关闭 Drawer 时
- **则** 列表的滚动位置和任何选中状态被保留
