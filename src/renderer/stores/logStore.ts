import { create } from 'zustand';
import type { LogEntry, LogLevel, LogSource } from '@shared/types/log';

interface LogState {
  logs: LogEntry[];
  debugEnabled: boolean;
  levelFilter: LogLevel | null;
  sourceFilter: LogSource | null;
  searchText: string;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setDebug: (enabled: boolean) => void;
  setLevelFilter: (level: LogLevel | null) => void;
  setSourceFilter: (source: LogSource | null) => void;
  setSearchText: (text: string) => void;
  filteredLogs: LogEntry[];
}

const MAX_LOG_ENTRIES = 5000;

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  debugEnabled: false,
  levelFilter: null,
  sourceFilter: null,
  searchText: '',
  filteredLogs: [],
  addLog: (entry) => set((state) => {
    const logs = state.logs.length >= MAX_LOG_ENTRIES
      ? [...state.logs.slice(state.logs.length - MAX_LOG_ENTRIES + 1), entry]
      : [...state.logs, entry];
    return { logs, filteredLogs: filterLogs(logs, state) };
  }),
  clearLogs: () => set({ logs: [], filteredLogs: [] }),
  setDebug: (enabled) => set({ debugEnabled: enabled }),
  setLevelFilter: (level) => set((state) => ({ levelFilter: level, filteredLogs: filterLogs(state.logs, { ...state, levelFilter: level }) })),
  setSourceFilter: (source) => set((state) => ({ sourceFilter: source, filteredLogs: filterLogs(state.logs, { ...state, sourceFilter: source }) })),
  setSearchText: (text) => set((state) => ({ searchText: text, filteredLogs: filterLogs(state.logs, { ...state, searchText: text }) })),
}));

function filterLogs(logs: LogEntry[], state: { levelFilter: LogLevel | null; sourceFilter: LogSource | null; searchText: string }): LogEntry[] {
  return logs.filter((log) => {
    if (state.levelFilter && log.level !== state.levelFilter) return false;
    if (state.sourceFilter && log.source !== state.sourceFilter) return false;
    if (state.searchText && !log.message.toLowerCase().includes(state.searchText.toLowerCase())) return false;
    return true;
  });
}
