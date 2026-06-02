import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
