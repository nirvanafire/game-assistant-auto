# Tasks: Enhance Right Panel

## Task 1: Database Migration & Type Definitions

**Estimated time:** 30 min

Update TypeScript types and database schema to support new fields.

### Steps
1. Extend `TaskGroup` type in `src/shared/types/task-group.ts` with `loopEnabled`, `loopIntervalMs`, `loopMaxIterations`
2. Extend `TaskGroupItem` type with `onSuccess`, `onFailure`
3. Create migration in `src/main/db/` to ALTER TABLE and add new columns
4. Add new IPC channel constants in `src/shared/constants.ts`

### Verification
- App starts without DB errors
- New columns exist in SQLite (check with `PRAGMA table_info`)

---

## Task 2: Storage Service & IPC Handlers

**Estimated time:** 45 min

Extend the storage layer and IPC handlers to support CRUD for new fields.

### Steps
1. Add methods to `StorageService`:
   - `updateTaskGroupLoop(groupId, loopConfig)`
   - `updateTaskGroupItemTarget(itemId, onSuccess, onFailure)`
   - `reorderTaskGroupItems(groupId, itemIds[])`
2. Add IPC handlers in `src/main/ipc/task-group.ts`:
   - `task-group:update-loop`
   - `task-group:update-item-target`
   - `task-group:reorder-items`

### Verification
- IPC calls from renderer return correct data
- Loop settings persist after app restart
- Jump targets persist after app restart

---

## Task 3: TaskGroupEngine Rewrite

**Estimated time:** 1 hour

Rewrite the execution engine to support conditional branching and looping.

### Steps
1. Rewrite `start()` method with loop control (while loop + iteration counter)
2. Implement `runGroupOnce()` with item-by-item execution following jump targets
3. Implement `resolveJumpTarget()` to handle null/END/itemId cases
4. Implement interruptible `delay()` for loop intervals
5. Ensure `stop()` breaks both inner execution and outer loop

### Verification
- Linear group (no jumps configured) runs same as before
- Conditional branching: success path and failure path work correctly
- Loop: group repeats N times with correct interval
- Stop: interrupts execution during task or during loop wait
- Edge case: self-referencing jump targets don't cause infinite loops (max iterations prevents this)

---

## Task 4: Chinese Localization (Right Panel)

**Estimated time:** 30 min

Replace all English strings with Chinese in right-panel components.

### Steps
1. `App.tsx` — tab labels: "辅助", "工具", "网络"; buttons: "任务", "任务组"
2. `TaskList.tsx` — "新建任务", status tags, button labels, confirm messages
3. `TaskGroupList.tsx` — "新建任务组", failure policy labels, button labels
4. `TaskEditor.tsx` — form labels, button labels, step type labels
5. `StepEditor.tsx` — form labels, step type options, action labels
6. `ExecutionStatus.tsx` — status labels
7. `LogViewer.tsx` — column headers, filter labels, button labels
8. `ImageCompare.tsx` — button labels, result labels
9. `ClickTest.tsx` — form labels, button labels
10. `NetworkLog.tsx` — column headers, filter labels, button labels

### Verification
- All user-visible text in right panel is Chinese
- No English strings remain in the right panel (except data values like IDs)
- No broken layouts from longer/shorter Chinese text

---

## Task 5: TaskGroupEditor Redesign

**Estimated time:** 1.5 hours

Redesign the TaskGroupEditor with drag-and-drop, conditional jump config, and loop settings.

### Steps
1. Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
2. Build loop settings section (toggle, interval input, max iterations input)
3. Build sortable task list with `@dnd-kit/sortable`
4. Build per-item jump target Select dropdowns (success/failure)
5. Wire up IPC calls for:
   - Saving loop settings
   - Updating jump targets on change
   - Reordering items on drag-end
6. Handle "添加任务" flow with available task Select

### Verification
- Can drag to reorder tasks, order persists after refresh
- Can set success/failure jump targets per item
- Loop settings save and display correctly
- Adding/removing tasks works
- All text is Chinese

---

## Task 6: Integration Testing

**Estimated time:** 30 min

End-to-end verification of the complete feature.

### Steps
1. Create a task group with 3+ tasks
2. Configure conditional branching (task A success → B, failure → C)
3. Enable looping (interval: few seconds, max: 2 iterations)
4. Run the group and verify:
   - Correct branching on success/failure
   - Loop repeats the expected number of times
   - Stop button interrupts execution
5. Test drag-and-drop reordering
6. Verify all Chinese text displays correctly

### Verification
- All execution paths work as configured
- No runtime errors in console
- UI is responsive and correct
