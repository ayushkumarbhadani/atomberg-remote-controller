const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAvailableDevices: () => ipcRenderer.invoke('get-available-devices'),
  sendCommand: (deviceMAC, command) => ipcRenderer.invoke('send-command', deviceMAC, command),
  refreshDevices: () => ipcRenderer.invoke('refresh-devices')
});