## ADDED Requirements

### Requirement: 模板图片存放在管理目录下
主进程SHALL在 `app.getPath('userData')` 下维护一个 `templates/` 目录。如果缺失，该目录SHALL在应用启动时创建。

#### Scenario: 启动时初始化目录
- **当** 应用启动时
- **则** `<userData>/templates/` 目录存在；如果之前不存在，则以默认权限创建

#### Scenario: 目录内容在应用重启后持久化
- **当** 应用重启时
- **则** `templates/` 目录及其内容完好无损

### Requirement: 保存时归一化模板路径
每次步骤保存时，每个 `templatePath` 值（IMAGE_MATCH 的 `config.templatePath` 和 IMAGE_GROUP 的 `config.templates[].templatePath`）都SHALL归一化到 `<userData>/templates/` 内的路径。

#### Scenario: 外部路径被复制并重新生成文件名
- **当** 用户保存一个 `templatePath = "C:/users/alice/desktop/btn.png"` 的步骤时
- **则** 文件被复制到 `<userData>/templates/<uuid>.png`，持久化的 `templatePath` 是新路径

#### Scenario: 已管理路径保持不变
- **当** 保存的 `templatePath` 已经指向 `<userData>/templates/` 内部时
- **则** 不执行复制；路径原样持久化

#### Scenario: 单个步骤中的多个模板都归一化
- **当** 用户保存一个 IMAGE_GROUP 步骤，包含三个模板，其中两个外部、一个已管理时
- **则** 两个外部文件被复制，已管理路径保持不变，保存的配置反映这三个路径

### Requirement: 图片选择器 IPC 通道
系统SHALL暴露 IPC 通道 `image:pick`，打开限定为 PNG/JPG/JPEG/BMP 的系统文件选择对话框，返回 `{ sourcePath: string | null }`。null 结果表示用户取消。

#### Scenario: 用户选择文件
- **当** 渲染层调用 `image:pick` 且用户选择了 `C:/img/x.png`
- **则** 响应为 `{ sourcePath: "C:/img/x.png" }`

#### Scenario: 用户取消对话框
- **当** 渲染层调用 `image:pick` 且用户取消
- **则** 响应为 `{ sourcePath: null }`

### Requirement: 图片归一化 IPC 通道
系统SHALL暴露 IPC 通道 `image:normalize`，接受 `{ sourcePath: string }`，返回 `{ savedPath: string }`。处理器SHALL将外部文件复制到 `templates/`，已管理路径原样返回。

#### Scenario: 归一化外部文件
- **当** 渲染层使用外部路径调用 `image:normalize` 时
- **则** 文件被复制到 `<userData>/templates/<uuid><ext>`；`savedPath` 是新路径

#### Scenario: 归一化已管理路径
- **当** `sourcePath` 已在 `<userData>/templates/` 内时
- **则** `savedPath === sourcePath`；不执行任何文件操作

#### Scenario: 源文件缺失时拒绝
- **当** `sourcePath` 指向不存在的文件时
- **则** IPC 以描述性错误拒绝；渲染层内联显示错误，不提交步骤保存

### Requirement: StepEditor 的选择按钮和保存流程
StepEditor SHALL在每个 `templatePath` 输入框旁边渲染"选择图片"按钮。保存操作SHALL在调用 `step:create` 或 `step:update` 之前对每个模板路径调用 `image:normalize`。

#### Scenario: 选择按钮填充输入框
- **当** 用户点击"选择图片"并选择文件时
- **则** 渲染层串联 `image:pick` 和 `image:normalize`，将返回的 `savedPath` 写入输入框

#### Scenario: 保存时归一化所有路径
- **当** 用户提交步骤表单（含手动输入的路径）时
- **则** 渲染层通过 `image:normalize` 归一化每个路径；只有所有归一化成功后才持久化步骤

#### Scenario: 归一化失败中止保存
- **当** 任何 `image:normalize` 调用拒绝时
- **则** 表单不提交；在对应字段旁显示错误消息
