## 1. Shared Types Update

- [ ] 1.1 Add `realtimeMatch: boolean` and `cacheCoordinates: boolean` to Step interface in `src/shared/types/task.ts`
- [ ] 1.2 Add `END_STEP_GROUP` to StepTransition action type
- [ ] 1.3 Make `onMatch` and `onMiss` optional on Step (only required for IMAGE_MATCH and IMAGE_GROUP)
- [ ] 1.4 Remove onMatch/onMiss from ClickConfig or mark as ignored for CLICK type

## 2. Database Migration

- [ ] 2.1 Add migration to create `realtime_match` (boolean, default 0) and `cache_coordinates` (boolean, default 0) columns on steps table
- [ ] 2.2 Populate `realtime_match` from each task's `settings.screenshotBeforeMatch` value during migration
- [ ] 2.3 Register `browser:resized` and `task:clear-coordinate-cache` IPC channel constants in `src/shared/constants.ts`

## 3. IPC Channels

- [ ] 3.1 Register `browser:resized` IPC handler in main process (forward to TaskEngine)
- [ ] 3.2 Register `task:clear-coordinate-cache` IPC handler in main process
- [ ] 3.3 Expose new IPC channels in preload if needed

## 4. Coordinate Cache in TaskEngine

- [ ] 4.1 Add `coordinateCache: Map<string, { x: number; y: number }>` to TaskEngine
- [ ] 4.2 Implement cache read logic: before IMAGE_MATCH execution, check cache if `cacheCoordinates=true`
- [ ] 4.3 Implement cache write logic: after successful IMAGE_MATCH, store coordinates if `cacheCoordinates=true`
- [ ] 4.4 Implement cache invalidation: listen for `browser:resized` event, clear cache
- [ ] 4.5 Implement manual cache clear: handle `task:clear-coordinate-cache` IPC
- [ ] 4.6 Clear cache on task start (initialize empty)

## 5. TaskEngine Execution Changes

- [ ] 5.1 Update step execution to check `realtimeMatch` flag — reuse last screenshot when false
- [ ] 5.2 Update CLICK step execution: remove onMatch/onMiss handling, always proceed to next ordered step
- [ ] 5.3 Add `END_STEP_GROUP` transition handling: exit current group loop, continue to step after group
- [ ] 5.4 Update step group execution to support conditional branching (onMatch/onMiss targeting different steps within group)

## 6. StepEditor UI Updates

- [ ] 6.1 Add `realtimeMatch` toggle (Switch) to IMAGE_MATCH and IMAGE_GROUP step config forms
- [ ] 6.2 Add `cacheCoordinates` toggle (Switch) to IMAGE_MATCH step config form
- [ ] 6.3 Remove onMatch/onMiss transition cards from CLICK step type form
- [ ] 6.4 Add `END_STEP_GROUP` option to transition action Select (only when step is inside a group)

## 7. Drawer Editing for TaskList

- [ ] 7.1 Add double-click handler (onDoubleClick) to TaskList items
- [ ] 7.2 Create Drawer wrapper that contains TaskEditor, controlled by double-click state
- [ ] 7.3 Ensure existing edit button opens the same Drawer
- [ ] 7.4 Handle Drawer close (button, overlay, Escape)

## 8. Drawer Editing for TaskGroupList

- [ ] 8.1 Add double-click handler (onDoubleClick) to TaskGroupList items
- [ ] 8.2 Create Drawer wrapper that contains TaskGroupEditor, controlled by double-click state
- [ ] 8.3 Ensure existing edit button opens the same Drawer
- [ ] 8.4 Handle Drawer close (button, overlay, Escape)

## 9. BrowserPanel Resize Event

- [ ] 9.1 Detect webview resize in BrowserPanel component
- [ ] 9.2 Send `browser:resized` IPC event to main process on resize
- [ ] 9.3 Debounce resize events to avoid excessive IPC calls

## 10. UI Cache Clear Button

- [ ] 10.1 Add cache clear button to ExecutionStatus component (visible when task is running)
- [ ] 10.2 Button invokes `task:clear-coordinate-cache` IPC
- [ ] 10.3 Button disabled when no task is running

## 11. Verification

- [ ] 11.1 Verify double-click opens editor drawer for tasks and task groups
- [ ] 11.2 Verify IMAGE_MATCH with `cacheCoordinates=true` uses cached coordinates on second execution
- [ ] 11.3 Verify window resize clears coordinate cache
- [ ] 11.4 Verify IMAGE_MATCH with `realtimeMatch=false` reuses previous screenshot
- [ ] 11.5 Verify CLICK step always proceeds to next ordered step (no transition config)
- [ ] 11.6 Verify END_STEP_GROUP exits group loop and continues after group
- [ ] 11.7 Verify conditional branching within step group (match → path A, miss → path B)
- [ ] 11.8 Verify manual cache clear button works during task execution
