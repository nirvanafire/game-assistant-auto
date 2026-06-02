import { create } from 'zustand';
import type { Task, Step } from '@shared/types/task';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  steps: Step[];
  setTasks: (tasks: Task[]) => void;
  selectTask: (taskId: string | null) => void;
  setSteps: (steps: Step[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  selectedTaskId: null,
  steps: [],
  setTasks: (tasks) => set({ tasks }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setSteps: (steps) => set({ steps }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
  })),
  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId),
    selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
  })),
}));
