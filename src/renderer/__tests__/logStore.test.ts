import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore } from '../stores/logStore';

describe('useLogStore', () => {
  beforeEach(() => {
    useLogStore.setState({ logs: [], filteredLogs: [], debugEnabled: false, levelFilter: null, sourceFilter: null, searchText: '' });
  });

  it('adds a log entry', () => {
    const { addLog } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'hello' });

    const { logs } = useLogStore.getState();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('hello');
  });

  it('filters by level', () => {
    const { addLog, setLevelFilter } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'info' });
    addLog({ timestamp: '2025-01-01T00:00:01.000Z', level: 'ERROR', source: 'App', message: 'error' });
    setLevelFilter('ERROR');

    const { filteredLogs } = useLogStore.getState();
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].message).toBe('error');
  });

  it('filters by search text', () => {
    const { addLog, setSearchText } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'task started' });
    addLog({ timestamp: '2025-01-01T00:00:01.000Z', level: 'INFO', source: 'App', message: 'match found' });
    setSearchText('task');

    const { filteredLogs } = useLogStore.getState();
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].message).toBe('task started');
  });

  it('clears logs', () => {
    const { addLog, clearLogs } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'hello' });
    clearLogs();

    expect(useLogStore.getState().logs).toHaveLength(0);
  });
});
