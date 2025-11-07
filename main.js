const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const UDPService = require('./udp-service');

let mainWindow;
let udpService;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 830,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    title: 'Atomberg Remote Controller',
    icon: path.join(__dirname, 'icon.iconset', 'atomberg.png')
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Initialize UDP service
  udpService = new UDPService();
  udpService.startDeviceDiscovery();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (udpService) {
      udpService.stopDeviceDiscovery();
    }
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-available-devices', () => {
  const devices = udpService ? udpService.getAvailableDevices() : {};
  console.log('Main process - returning devices:', devices);
  return devices;
});

ipcMain.handle('send-command', async (event, deviceMAC, command) => {
  console.log('Main process - sending command:', command, 'to device:', deviceMAC);
  if (udpService) {
    return await udpService.sendCommand(deviceMAC, command);
  }
  return false;
});

ipcMain.handle('refresh-devices', () => {
  console.log('Main process - refresh devices requested');
  if (udpService) {
    udpService.refreshDevices();
  }
});