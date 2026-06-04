## ADDED Requirements

### Requirement: 开关横排布局
对于 IMAGE_MATCH 和 IMAGE_GROUP 步骤类型，StepEditor SHALL将三个执行开关（全新截图、实时比对、缓存坐标）渲染在一行水平排列，等宽标签。

#### Scenario: IMAGE_MATCH 布局
- **当** 用户为 IMAGE_MATCH 步骤打开 StepEditor 时
- **则** 三个开关出现在同一水平行；每个标签位于其 Switch 上方

#### Scenario: IMAGE_GROUP 布局
- **当** 用户为 IMAGE_GROUP 步骤打开 StepEditor 时
- **则** 同样的三开关行以相同结构出现

#### Scenario: 窄屏优雅换行
- **当** 编辑器面板比该行自然宽度窄时
- **则** 开关换行显示，不重叠或截断标签

### Requirement: CLICK 类型隐藏执行开关
对于 CLICK 步骤类型，StepEditor SHALL NOT渲染三个开关中的任何一个。

#### Scenario: CLICK 步骤没有开关行
- **当** 用户将步骤类型 Select 切换为"点击"时
- **则** 全新截图、实时比对、缓存坐标三个开关全部从表单中消失

#### Scenario: 切回 IMAGE_MATCH 后开关恢复
- **当** 用户将类型从 CLICK 切回 IMAGE_MATCH 时
- **则** 水平开关行恢复显示，保留之前的值（如有）或默认值（如为新建）

### Requirement: 缓存坐标默认开启
StepEditor 的新建步骤 initialValues SHALL设置 `cacheCoordinates: true`。现有步骤SHALL保留其持久化的值。

#### Scenario: 新建步骤缓存已启用
- **当** 用户打开 StepEditor 创建新步骤时
- **则** 缓存坐标 Switch 处于开启状态

#### Scenario: 现有步骤保留原值
- **当** 用户为 `cacheCoordinates=false` 的现有步骤打开 StepEditor 时
- **则** Switch 处于关闭状态，与持久化值一致

#### Scenario: 新建 IMAGE_GROUP 步骤也默认开启缓存
- **当** 用户创建 IMAGE_GROUP 步骤时
- **则** 缓存坐标 Switch 默认开启
