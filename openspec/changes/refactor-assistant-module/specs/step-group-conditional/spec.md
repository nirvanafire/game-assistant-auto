## ADDED Requirements

### Requirement: IMAGE_MATCH steps can branch on match/miss within a step group
IMAGE_MATCH and IMAGE_GROUP steps within a step group SHALL support onMatch and onMiss transitions that target different steps, enabling conditional execution paths.

#### Scenario: Match routes to one path, miss routes to another
- **WHEN** step 1 (IMAGE_MATCH, in group) has onMatch.target=step2 and onMiss.target=step3
- **THEN** if step 1 matches, execution continues to step 2; if step 1 misses, execution continues to step 3

#### Scenario: Match ends group loop, miss continues
- **WHEN** step 1 (IMAGE_MATCH, in group) has onMatch.action=END_STEP_GROUP and onMiss.target=step2
- **THEN** if step 1 matches, the group loop ends; if step 1 misses, execution continues to step 2

### Requirement: CLICK steps have no explicit transitions
CLICK steps SHALL NOT have onMatch or onMiss transitions. After execution, a CLICK step always proceeds to the next step in order.

#### Scenario: CLICK proceeds to next ordered step
- **WHEN** step 2 (CLICK, order=2) executes and step 3 (order=3) exists in the same scope
- **THEN** execution continues to step 3

#### Scenario: CLICK at end of group ends the group loop
- **WHEN** step 2 (CLICK, order=2) is the last step in a step group
- **THEN** the group loop iteration ends

#### Scenario: CLICK at end of task ends the task
- **WHEN** step 2 (CLICK, order=2) is the last step in the task (not in any group)
- **THEN** the task completes

### Requirement: Transition targets within step group scope
onMatch and onMiss transitions SHALL be able to target any step within the same task, not limited to the current step group.

#### Scenario: Jump from group step to a step outside the group
- **WHEN** step 1 (IMAGE_MATCH, in group A) has onMiss.target=step5 (outside group A)
- **THEN** execution leaves group A and continues to step 5

### Requirement: END_STEP_GROUP transition action
A new transition action END_STEP_GROUP SHALL be available for steps inside a step group. When triggered, it exits the current group loop and continues to the step after the group.

#### Scenario: END_STEP_GROUP exits loop and continues
- **WHEN** step 1 (IMAGE_MATCH, in group with loopCount=3) has onMatch.action=END_STEP_GROUP during iteration 2
- **THEN** the group loop ends after iteration 2, and execution continues to the step following the group

#### Scenario: END_STEP_GROUP only available inside groups
- **WHEN** configuring a step that is not inside any step group
- **THEN** END_STEP_GROUP is not available as a transition action option

### Requirement: Conditional paths can converge
Multiple conditional paths within a step group SHALL be able to converge back to the same step.

#### Scenario: Both match and miss paths lead to same CLICK step
- **WHEN** step 1 (IMAGE_MATCH) has onMatch.target=step3 and onMiss.target=step3, and step 3 is a CLICK step
- **THEN** regardless of match result, execution proceeds to step 3

### Requirement: Step group execution respects order within paths
Steps within a step group SHALL execute in order unless redirected by a transition. Conditional branches follow their target step's order for subsequent execution.

#### Scenario: Conditional branch then sequential
- **WHEN** step 1 (IMAGE_MATCH) misses and onMiss targets step 4 (order=4), and steps 4, 5 are in sequential order
- **THEN** execution runs step 4, then step 5
