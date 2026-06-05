## 1. Shared Types Update

- [x] 1.1 Add `realtimeMatch: boolean` and `cacheCoordinates: boolean` to Step interface in `src/shared/types/task.ts`
- [x] 1.2 Add `END_STEP_GROUP` to StepTransition action type
- [x] 1.3 Make `onMatch` and `onMiss` optional on Step (only required for IMAGE_MATCH and IMAGE_GROUP)
- [x] 1.4 Remove onMatch/onMiss from ClickConfig or mark as ignored for CLICK type

## 2. Database Migration

- [x] 2.1 Add migration to create `realtime_match` (boolean, default 0) and `cache_coordinates` (boolean, default 0) columns on steps table
- [x] 2.2 Populate `realtime_match` from each task's `settings.screenshotBeforeMatch` value during migration
- [x] 2.3 Register `browser:resized` and `task:clear-coordinate-cache` IPC channel constants in `src/shared/constants.ts`

## 3. IPC Channels

- [x] 3.1 Register `browser:resized` IPC handler in main process (forward to TaskEngine)
- [x] 3.2 Register `task:clear-coordinate-cache` IPC handler in main process
- [x] 3.3 Expose new IPC channels in preload if needed

## 4. Coordinate Cache in TaskEngine

- [x] 4.1 Add `coordinateCache: Map<string, { x: number; y: number }>` to TaskEngine
- [x] 4.2 Implement cache read logic: before IMAGE_MATCH execution, check cache if `cacheCoordinates=true`
- [x] 4.3 Implement cache write logic: after successful IMAGE_MATCH, store coordinates if `cacheCoordinates=true`
- [x] 4.4 Implement cache invalidation: listen for `browser:resized` event, clear cache
- [x] 4.5 Implement manual cache clear: handle `task:clear-coordinate-cache` IPC
- [x] 4.6 Clear cache on task start (initialize empty)

## 5. TaskEngine Execution Changes

- [x] 5.1 Update step execution to check `realtimeMatch` flag — reuse last screenshot when false
- [x] 5.2 Update CLICK step execution: remove onMatch/onMiss handling, always proceed to next ordered step
- [x] 5.3 Add `END_STEP_GROUP` transition handling: exit current group loop, continue to step after group
- [x] 5.4 Update step group execution to support conditional branching (onMatch/onMiss targeting different steps within group)

## 6. StepEditor UI Updates

- [x] 6.1 Add `realtimeMatch` toggle (Switch) to IMAGE_MATCH and IMAGE_GROUP step config forms
- [x] 6.2 Add `cacheCoordinates` toggle (Switch) to IMAGE_MATCH step config form
- [x] 6.3 Remove onMatch/onMiss transition cards from CLICK step type form
- [x] 6.4 Add `END_STEP_GROUP` option to transition action Select (only when step is inside a group)

## 7. Drawer Editing for TaskList

- [x] 7.1 Add double-click handler (onDoubleClick) to TaskList items
- [x] 7.2 Create Drawer wrapper that contains TaskEditor, controlled by double-click state
- [x] 7.3 Ensure existing edit button opens the same Drawer
- [x] 7.4 Handle Drawer close (button, overlay, Escape)

## 8. Drawer Editing for TaskGroupList

- [x] 8.1 Add double-click handler (onDoubleClick) to TaskGroupList items
- [x] 8.2 Create Drawer wrapper that contains TaskGroupEditor, controlled by double-click state
- [x] 8.3 Ensure existing edit button opens the same Drawer
- [x] 8.4 Handle Drawer close (button, overlay, Escape)

## 9. BrowserPanel Resize Event

- [x] 9.1 Detect webview resize in BrowserPanel component
- [x] 9.2 Send `browser:resized` IPC event to main process on resize
- [x] 9.3 Debounce resize events to avoid excessive IPC calls

## 10. UI Cache Clear Button

- [x] 10.1 Add cache clear button to ExecutionStatus component (visible when task is running)
- [x] 10.2 Button invokes `task:clear-coordinate-cache` IPC
- [x] 10.3 Button disabled when no task is running

## 11. Verification

- [x] 11.1 Verify double-click opens editor drawer for tasks and task groups
- [x] 11.2 Verify IMAGE_MATCH with `cacheCoordinates=true` uses cached coordinates on second execution
- [x] 11.3 Verify window resize clears coordinate cache
- [x] 11.4 Verify IMAGE_MATCH with `realtimeMatch=false` reuses previous screenshot
- [x] 11.5 Verify CLICK step always proceeds to next ordered step (no transition config)
- [x] 11.6 Verify END_STEP_GROUP exits group loop and continues after group
- [x] 11.7 Verify conditional branching within step group (match → path A, miss → path B)
- [x] 11.8 Verify manual cache clear button works during task execution
