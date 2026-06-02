import { create } from 'zustand';

interface NetworkLogEntry {
  id?: number;
  timestamp: string;
  method?: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  resourceType?: string;
  size?: number;
}

interface NetworkState {
  logs: NetworkLogEntry[];
  capturing: boolean;
  methodFilter: string | null;
  urlFilter: string;
  addLog: (entry: NetworkLogEntry) => void;
  clearLogs: () => void;
  setCapturing: (capturing: boolean) => void;
  setMethodFilter: (method: string | null) => void;
  setUrlFilter: (url: string) => void;
  filteredLogs: NetworkLogEntry[];
}

export const useNetworkStore = create<NetworkState>((set) => ({
  logs: [],
  capturing: false,
  methodFilter: null,
  urlFilter: '',
  filteredLogs: [],
  addLog: (entry) => set((state) => {
    const logs = [entry, ...state.logs];
    return { logs, filteredLogs: filterLogs(logs, state) };
  }),
  clearLogs: () => set({ logs: [], filteredLogs: [] }),
  setCapturing: (capturing) => set({ capturing }),
  setMethodFilter: (method) => set((state) => ({ methodFilter: method, filteredLogs: filterLogs(state.logs, { ...state, methodFilter: method }) })),
  setUrlFilter: (url) => set((state) => ({ urlFilter: url, filteredLogs: filterLogs(state.logs, { ...state, urlFilter: url }) })),
}));

function filterLogs(logs: NetworkLogEntry[], state: { methodFilter: string | null; urlFilter: string }): NetworkLogEntry[] {
  return logs.filter((log) => {
    if (state.methodFilter && log.method !== state.methodFilter) return false;
    if (state.urlFilter && !log.url.toLowerCase().includes(state.urlFilter.toLowerCase())) return false;
    return true;
  });
}
