## ADDED Requirements

### Requirement: UI label renamed to 图像组匹配
The StepEditor type Select and any step-list rendering of the IMAGE_GROUP type SHALL display the label "图像组匹配". The underlying `StepType` enum value SHALL remain `'IMAGE_GROUP'`.

#### Scenario: Type Select shows new label
- **WHEN** the user opens StepEditor and inspects the type Select options
- **THEN** the option text for `IMAGE_GROUP` is "图像组匹配"

#### Scenario: Step list row shows new label
- **WHEN** a step list renders a step whose `type === 'IMAGE_GROUP'`
- **THEN** the displayed type label is "图像组匹配"

#### Scenario: Persisted type identifier unchanged
- **WHEN** the user creates an "图像组匹配" step and the renderer sends it to the main process
- **THEN** the persisted `type` value is the string `'IMAGE_GROUP'`

### Requirement: Multi-template editor
StepEditor for IMAGE_GROUP SHALL render an editable list of templates, each item exposing `label`, `templatePath`, and `threshold`. The list SHALL support add and remove operations.

#### Scenario: Default has one empty template
- **WHEN** the user creates a new IMAGE_GROUP step
- **THEN** the template list shows one empty row with `threshold` defaulting to 0.8 and an auto-generated label (e.g., "模板 1")

#### Scenario: Add template appends a row
- **WHEN** the user clicks "+ 添加模板"
- **THEN** a new empty row is appended with `threshold = 0.8` and an auto-generated label

#### Scenario: Remove template removes the row
- **WHEN** the user clicks the remove icon on a row, and there are at least two rows
- **THEN** the row is removed from the list

#### Scenario: Last template cannot be removed
- **WHEN** the user clicks the remove icon on the only remaining row
- **THEN** the row is not removed; an inline hint or disabled state communicates the constraint

#### Scenario: Each template path supports the image picker
- **WHEN** the user clicks "选择图片" on any template row
- **THEN** the picker → normalize flow runs (see `template-image-storage` capability) and writes the result into that row's path field

### Requirement: ALL/ANY logic switch
StepEditor for IMAGE_GROUP SHALL render a Radio.Group bound to `config.logic` with two options: ALL (labeled "同时满足（全部匹配）") and ANY (labeled "满足其一（任一匹配）"). The default SHALL be ANY for new steps.

#### Scenario: New step defaults to ANY
- **WHEN** the user creates a new IMAGE_GROUP step
- **THEN** the logic radio is on "满足其一（任一匹配）"

#### Scenario: Selecting ALL persists ALL
- **WHEN** the user selects "同时满足（全部匹配）" and saves the step
- **THEN** the persisted `config.logic` is `'ALL'`

### Requirement: Shared timing and scaling fields
StepEditor for IMAGE_GROUP SHALL expose `delayMs`, `retryCount`, `retryIntervalMs`, and `scaleRange` editors with the same controls used for IMAGE_MATCH.

#### Scenario: Editing applies to the group as a whole
- **WHEN** the user edits any timing/scaling field
- **THEN** the value is written to the top-level `config` object, not per template

### Requirement: Validation before save
StepEditor SHALL block save when the IMAGE_GROUP step has zero templates, or any template is missing a `label` / `templatePath`, or any `threshold` is outside [0, 1].

#### Scenario: Empty path blocks save
- **WHEN** the user tries to save with one template row whose `templatePath` is empty
- **THEN** the save is rejected and the offending row is highlighted

#### Scenario: Invalid threshold blocks save
- **WHEN** any template has `threshold > 1` or `threshold < 0`
- **THEN** the save is rejected with a field-level message

### Requirement: Transition cards mirror IMAGE_MATCH
StepEditor for IMAGE_GROUP SHALL render the onMatch and onMiss transition cards identical to IMAGE_MATCH, sharing the action options and defaults defined in the `transition-defaults` capability.

#### Scenario: New IMAGE_GROUP step has same defaults as IMAGE_MATCH
- **WHEN** the user creates a new IMAGE_GROUP step
- **THEN** `onMatch.action` defaults to `'NEXT_STEP'` and `onMiss.action` defaults to undefined ("无")
