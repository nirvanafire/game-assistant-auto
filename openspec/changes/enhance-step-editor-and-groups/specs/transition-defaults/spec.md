## ADDED Requirements

### Requirement: NEXT_STEP transition action
`StepTransition.action` SHALL accept the value `'NEXT_STEP'`. The TaskEngine SHALL interpret `NEXT_STEP` as "advance to the next ordered step", scoped to the current step group if the step is inside one.

#### Scenario: NEXT_STEP advances ungrouped step
- **WHEN** an IMAGE_MATCH step (no `groupId`) matches and `onMatch.action === 'NEXT_STEP'`
- **THEN** the engine advances to the step whose `order` is the next-higher value among non-grouped steps in this task

#### Scenario: NEXT_STEP advances within group
- **WHEN** an IMAGE_MATCH step inside group `g1` matches and `onMatch.action === 'NEXT_STEP'`
- **THEN** the engine advances to the next step in `g1` ordered after the current one; if none remains, the group iteration completes and the next loop iteration starts (or the group exits if loopCount is reached)

#### Scenario: nextStepId overrides action
- **WHEN** `onMatch.nextStepId === 's5'` and `onMatch.action === 'NEXT_STEP'`
- **THEN** the engine jumps to step `s5` (nextStepId wins over action when both are set)

#### Scenario: NEXT_STEP at end of task completes
- **WHEN** an ungrouped IMAGE_MATCH step is the last step in `order` and its outcome's transition is `NEXT_STEP`
- **THEN** the task status becomes `completed`

#### Scenario: NEXT_STEP at end of group continues looping
- **WHEN** a grouped step is the last step within its group and its outcome's transition is `NEXT_STEP`, and the group still has remaining loop iterations
- **THEN** the engine starts the next loop iteration of the group from its first step

#### Scenario: NEXT_STEP at end of last group iteration exits group
- **WHEN** a grouped step is the last step within its group, its outcome's transition is `NEXT_STEP`, and no loop iterations remain
- **THEN** the engine advances past the group to the next ungrouped step in `order`; if none exists, the task completes

### Requirement: Undefined transition halts the task
The TaskEngine SHALL treat `transition === undefined` (and `transition.action === undefined && transition.nextStepId === undefined`) as a halt signal. The task SHALL transition to `completed`.

#### Scenario: Undefined onMiss halts on failure
- **WHEN** an IMAGE_MATCH step misses and `onMiss` is undefined
- **THEN** the engine sets the task status to `completed` and runs no further steps

#### Scenario: Undefined onMatch halts on success
- **WHEN** an IMAGE_MATCH step matches and `onMatch` is undefined
- **THEN** the engine sets the task status to `completed`

#### Scenario: Undefined inside a group halts
- **WHEN** a grouped step's relevant transition is undefined
- **THEN** the engine halts the task; the group loop is not re-entered

### Requirement: CLICK steps unchanged
CLICK steps SHALL continue to advance to the next ordered step regardless of any onMatch/onMiss configuration. The new transition semantics SHALL NOT apply to CLICK.

#### Scenario: CLICK does not halt
- **WHEN** a CLICK step finishes
- **THEN** the engine advances to the next ordered step, ignoring any persisted onMatch/onMiss fields

### Requirement: New-step defaults
StepEditor's initialValues for a new IMAGE_MATCH or IMAGE_GROUP step SHALL set `onMatchAction = 'NEXT_STEP'` and leave `onMissAction` undefined.

#### Scenario: Match action defaulted in form
- **WHEN** the user opens StepEditor to create an IMAGE_MATCH step
- **THEN** the "匹配时 / 动作" Select shows "下一个步骤"

#### Scenario: Miss action blank in form
- **WHEN** the user opens StepEditor to create a new IMAGE_MATCH step
- **THEN** the "未匹配时 / 动作" Select shows "（无）"

### Requirement: Transition action options include 下一个步骤
StepEditor's transition action Select SHALL list at minimum: 「（无）」(undefined), 「下一个步骤」(`NEXT_STEP`), 「结束任务」(`END_TASK`), 「结束步骤组」(`END_STEP_GROUP`).

#### Scenario: Options visible to user
- **WHEN** the user opens the transition action Select
- **THEN** all four options are present with the listed labels

#### Scenario: 结束步骤组 disabled for ungrouped steps
- **WHEN** the step has no `groupId`
- **THEN** the "结束步骤组" option is either hidden or disabled with a hint

## MODIFIED Requirements

### Requirement: Migration v4 backfills existing transitions
The persistence layer SHALL apply migration v4, which backfills `on_match` and `on_miss` columns for existing IMAGE_MATCH and IMAGE_GROUP rows where both `action` and `nextStepId` are absent, setting them to `'{"action":"NEXT_STEP"}'`. CLICK rows SHALL be skipped.

#### Scenario: Pre-existing IMAGE_MATCH step preserves advance behavior
- **WHEN** an IMAGE_MATCH row has `on_match = '{}'` before migration
- **THEN** after migration the value is `'{"action":"NEXT_STEP"}'` and the engine continues to advance on match exactly as before

#### Scenario: Pre-existing CLICK step is untouched
- **WHEN** a CLICK row has `on_match = '{}'`
- **THEN** the migration leaves it as `'{}'`; the engine continues to ignore it

#### Scenario: Row with existing action is untouched
- **WHEN** an IMAGE_MATCH row already has `on_match = '{"action":"END_TASK"}'`
- **THEN** the migration leaves it unchanged

#### Scenario: Row with nextStepId is untouched
- **WHEN** an IMAGE_MATCH row has `on_match = '{"nextStepId":"s3"}'`
- **THEN** the migration leaves it unchanged

#### Scenario: Schema version becomes 4
- **WHEN** migrations run
- **THEN** `getCurrentVersion(db) === 4`
