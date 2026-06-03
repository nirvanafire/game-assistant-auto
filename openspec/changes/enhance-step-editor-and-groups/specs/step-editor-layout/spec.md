## ADDED Requirements

### Requirement: Horizontal toggle row
For IMAGE_MATCH and IMAGE_GROUP step types, StepEditor SHALL render the three execution toggles (fresh screenshot, realtime match, cache coordinates) in a single horizontal row with equal-width labels.

#### Scenario: IMAGE_MATCH layout
- **WHEN** the user opens StepEditor for an IMAGE_MATCH step
- **THEN** the three toggles appear in one horizontal row; each label sits above its Switch

#### Scenario: IMAGE_GROUP layout
- **WHEN** the user opens StepEditor for an IMAGE_GROUP step
- **THEN** the same three-toggle row appears with identical structure

#### Scenario: Narrow screen wraps gracefully
- **WHEN** the editor panel is narrower than the row's natural width
- **THEN** the toggles wrap to the next line without overlapping or truncating labels

### Requirement: CLICK type hides execution toggles
For CLICK step type, StepEditor SHALL NOT render any of the three toggles.

#### Scenario: CLICK step has no toggle row
- **WHEN** the user switches the step type Select to "点击"
- **THEN** the fresh-screenshot, realtime-match, and cache-coordinates toggles all disappear from the form

#### Scenario: Switching back to IMAGE_MATCH restores toggles
- **WHEN** the user changes type from CLICK back to IMAGE_MATCH
- **THEN** the horizontal toggle row reappears with the previously held values (if any) or defaults (if new)

### Requirement: cacheCoordinates defaults to true for new steps
StepEditor's initialValues for a new step (no `step` prop) SHALL set `cacheCoordinates: true`. Existing steps SHALL retain their persisted value.

#### Scenario: New step has caching enabled
- **WHEN** the user opens StepEditor to create a new step
- **THEN** the cache-coordinates Switch is in the ON position

#### Scenario: Existing step preserves its value
- **WHEN** the user opens StepEditor for an existing step with `cacheCoordinates=false`
- **THEN** the Switch is OFF, matching the persisted value

#### Scenario: New IMAGE_GROUP step also defaults caching on
- **WHEN** the user creates an IMAGE_GROUP step
- **THEN** the cache-coordinates Switch is ON by default
