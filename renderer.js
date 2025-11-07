// Renderer Process - UI Logic
class AtombergRemoteController {
    constructor() {
        this.currentDevice = null;
        this.devices = {};
        this.refreshInterval = null;
        this.devicePoweredOn = false;
        this.currentSpeed = 0;
        
        this.initializeUI();
        this.startDeviceRefresh();
    }

    initializeUI() {
        // Get DOM elements
        this.elements = {
            deviceSelect: document.getElementById('device-select'),
            deviceCount: document.getElementById('device-count'),
            deviceInfo: document.getElementById('device-info'),
            refreshBtn: document.getElementById('refresh-btn'),
            statusMessage: document.getElementById('status-message'),
            fanControlSection: document.getElementById('fan-control-section'),
            sleepControlSection: document.getElementById('sleep-control-section'),
            timerControlSection: document.getElementById('timer-control-section'),
            lightControlSection: document.getElementById('light-control-section'),
            brightnessSection: document.getElementById('brightness-section'),
            colorSection: document.getElementById('color-section'),
            brightnessSlider: document.getElementById('brightness-slider'),
            brightnessValue: document.getElementById('brightness-value')
        };

        // Initialize event listeners
        this.setupEventListeners();
        
        // Initial device refresh
        this.refreshDevices();
    }

    setupEventListeners() {
        // Device selection
        this.elements.deviceSelect.addEventListener('change', (e) => {
            this.selectDevice(e.target.value);
        });

        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => {
            this.refreshDevices();
        });

        // Integrated Power/Speed Center Control
        document.getElementById('power-center').addEventListener('click', () => {
            if (!this.devicePoweredOn) {
                // Device is off, turn it on with speed 1
                this.sendCommand({ power: true, speed: 1 });
                this.setDevicePoweredOn(true, 1);
            } else {
                // Device is on, turn it off
                this.sendCommand({ power: false });
                this.setDevicePoweredOn(false, 0);
            }
        });

        // Speed controls
        document.querySelectorAll('.speed-button[data-speed]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.target.dataset.speed);
                
                // If device is off, turn it on with the selected speed
                if (!this.devicePoweredOn) {
                    this.sendCommand({ power: true, speed });
                    this.setDevicePoweredOn(true, speed);
                } else {
                    // Device is on, just change speed
                    this.sendCommand({ speed });
                    this.setCurrentSpeed(speed);
                }
                
                this.updateSpeedButtons(speed);
            });
        });

        document.getElementById('speed-increase').addEventListener('click', () => {
            this.sendCommand({ speedDelta: 1 });
        });

        document.getElementById('speed-decrease').addEventListener('click', () => {
            this.sendCommand({ speedDelta: -1 });
        });

        // Sleep mode
        document.getElementById('sleep-on').addEventListener('click', () => {
            this.sendCommand({ sleep: true });
        });

        document.getElementById('sleep-off').addEventListener('click', () => {
            this.sendCommand({ sleep: false });
        });

        // Timer controls
        document.getElementById('timer-1h').addEventListener('click', () => {
            this.sendCommand({ timer: 1 });
            this.updateTimerButtons(1);
        });
        
        document.getElementById('timer-2h').addEventListener('click', () => {
            this.sendCommand({ timer: 2 });
            this.updateTimerButtons(2);
        });
        
        document.getElementById('timer-4h').addEventListener('click', () => {
            this.sendCommand({ timer: 4 });
            this.updateTimerButtons(4);
        });
        
        document.getElementById('timer-8h').addEventListener('click', () => {
            this.sendCommand({ timer: 8 });
            this.updateTimerButtons(8);
        });
        
        document.getElementById('timer-off').addEventListener('click', () => {
            this.sendCommand({ timer: 0 });
            this.updateTimerButtons(0);
        });

        // Light controls
        document.getElementById('light-on').addEventListener('click', () => {
            this.sendCommand({ led: true });
        });

        document.getElementById('light-off').addEventListener('click', () => {
            this.sendCommand({ led: false });
        });

        // Brightness controls
        if (this.elements.brightnessSlider) {
            this.elements.brightnessSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.elements.brightnessValue.textContent = `${value}%`;
            });

            this.elements.brightnessSlider.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.sendCommand({ brightness: value });
            });
        }

        document.getElementById('brightness-increase').addEventListener('click', () => {
            this.sendCommand({ brightnessDelta: 10 });
        });

        document.getElementById('brightness-decrease').addEventListener('click', () => {
            this.sendCommand({ brightnessDelta: -10 });
        });

        // Color controls
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.sendCommand({ light_mode: color });
                this.updateColorButtons(color);
            });
        });
    }

    async refreshDevices() {
        try {
            this.showStatus('Searching for devices...', 'warning');
            console.log('Refreshing devices...');
            
            // Check if electronAPI is available
            if (!window.electronAPI) {
                console.error('electronAPI not available');
                this.showStatus('Error: electronAPI not available', 'error');
                return;
            }
            
            // Request device refresh from main process
            await window.electronAPI.refreshDevices();
            console.log('Device refresh requested');
            
            // Get updated device list
            this.devices = await window.electronAPI.getAvailableDevices();
            console.log('Devices received:', this.devices);
            this.updateDeviceList();
            
        } catch (error) {
            console.error('Error refreshing devices:', error);
            this.showStatus('Error refreshing devices: ' + error.message, 'error');
        }
    }

    async refreshDevicesPreserveSelection() {
        try {
            // Store current selection
            const currentSelection = this.elements.deviceSelect.value;
            
            // Check if electronAPI is available
            if (!window.electronAPI) {
                console.error('electronAPI not available');
                return;
            }
            
            // Request device refresh from main process (silently)
            await window.electronAPI.refreshDevices();
            
            // Get updated device list
            this.devices = await window.electronAPI.getAvailableDevices();
            
            // Update device list and restore selection
            this.updateDeviceListPreserveSelection(currentSelection);
            
        } catch (error) {
            console.error('Error refreshing devices (background):', error);
        }
    }

    updateDeviceList() {
        const deviceCount = Object.keys(this.devices).length;
        console.log('Updating device list, count:', deviceCount, 'devices:', this.devices);
        this.elements.deviceCount.textContent = `${deviceCount} device${deviceCount !== 1 ? 's' : ''} found`;

        // Clear and populate device select
        this.elements.deviceSelect.innerHTML = '';
        
        if (deviceCount === 0) {
            this.elements.deviceSelect.innerHTML = '<option value="">No devices found</option>';
            this.elements.deviceInfo.classList.remove('visible');
            this.showStatus('No devices found. Make sure your Atomberg fan is connected to the same network.', 'warning');
        } else {
            this.elements.deviceSelect.innerHTML = '<option value="">Select a device...</option>';
            
            Object.entries(this.devices).forEach(([mac, device]) => {
                const option = document.createElement('option');
                option.value = mac;
                option.textContent = `${mac} (${device.ip}) - Series: ${device.series}`;
                this.elements.deviceSelect.appendChild(option);
            });
            
            this.showStatus(`Found ${deviceCount} device${deviceCount !== 1 ? 's' : ''}`, 'success');
        }
    }

    updateDeviceListPreserveSelection(previousSelection) {
        const deviceCount = Object.keys(this.devices).length;
        this.elements.deviceCount.textContent = `${deviceCount} device${deviceCount !== 1 ? 's' : ''} found`;

        // Clear and populate device select
        this.elements.deviceSelect.innerHTML = '';
        
        if (deviceCount === 0) {
            this.elements.deviceSelect.innerHTML = '<option value="">No devices found</option>';
            this.elements.deviceInfo.classList.remove('visible');
            // Reset current device if no devices found
            this.currentDevice = null;
        } else {
            this.elements.deviceSelect.innerHTML = '<option value="">Select a device...</option>';
            
            Object.entries(this.devices).forEach(([mac, device]) => {
                const option = document.createElement('option');
                option.value = mac;
                option.textContent = `${mac} (${device.ip}) - Series: ${device.series}`;
                this.elements.deviceSelect.appendChild(option);
            });
            
            // Restore previous selection if the device is still available
            if (previousSelection && this.devices[previousSelection]) {
                this.elements.deviceSelect.value = previousSelection;
                // Ensure the device info stays visible and updated
                if (this.currentDevice === previousSelection) {
                    const device = this.devices[previousSelection];
                    this.elements.deviceInfo.innerHTML = `
                        <strong>Device:</strong> ${previousSelection}<br>
                        <strong>IP Address:</strong> ${device.ip}<br>
                        <strong>Series:</strong> ${device.series}<br>
                        <strong>Last Seen:</strong> ${device.lastSeen}
                    `;
                }
            } else if (previousSelection && !this.devices[previousSelection]) {
                // Device was disconnected, reset
                this.currentDevice = null;
                this.elements.deviceInfo.classList.remove('visible');
                this.hideAllControls();
                this.updateUIForDevice(null);
            }
        }
    }

    selectDevice(mac) {
        if (!mac || !this.devices[mac]) {
            this.currentDevice = null;
            this.elements.deviceInfo.classList.remove('visible');
            this.hideAllControls();
            this.updateUIForDevice(null);
            return;
        }

        this.currentDevice = mac;
        const device = this.devices[mac];
        
        // Show device info
        this.elements.deviceInfo.innerHTML = `
            <strong>Device:</strong> ${mac}<br>
            <strong>IP Address:</strong> ${device.ip}<br>
            <strong>Series:</strong> ${device.series}<br>
            <strong>Last Seen:</strong> ${device.lastSeen}
        `;
        this.elements.deviceInfo.classList.add('visible');
        
        // Show control sections
        this.showAllControls();
        
        // Update UI based on device capabilities
        this.updateUIForDevice(device);
        
        this.showStatus(`Connected to device ${mac}`, 'success');
    }

    updateUIForDevice(device) {
        if (!device) {
            // Hide all features when no device selected
            this.hideAllControls();
            return;
        }

        // Show/hide features based on device series and model capabilities
        // According to docs: brightness control available for I1, M1, S1 series
        // Color control available for I1 series (Aris Starlight)
        const brightnessSupportedSeries = ['I1', 'M1', 'S1'];
        const colorSupportedSeries = ['I1'];
        
        const series = device.series || '';
        
        if (brightnessSupportedSeries.includes(series)) {
            this.elements.brightnessSection.classList.remove('hidden');
        } else {
            this.elements.brightnessSection.classList.add('hidden');
        }
        
        if (colorSupportedSeries.includes(series)) {
            this.elements.colorSection.classList.remove('hidden');
        } else {
            this.elements.colorSection.classList.add('hidden');
        }
    }

    async sendCommand(command) {
        if (!this.currentDevice) {
            this.showStatus('Please select a device first', 'error');
            return;
        }

        try {
            this.showStatus('Sending command...', 'warning');
            
            const success = await window.electronAPI.sendCommand(this.currentDevice, command);
            
            if (success) {
                this.showStatus(`Command sent: ${JSON.stringify(command)}`, 'success');
            } else {
                this.showStatus('Failed to send command', 'error');
            }
            
        } catch (error) {
            console.error('Error sending command:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }

    updateSpeedButtons(activeSpeed) {
        document.querySelectorAll('.speed-button[data-speed]').forEach(btn => {
            btn.classList.remove('active');
            if (activeSpeed > 0 && parseInt(btn.dataset.speed) === activeSpeed) {
                btn.classList.add('active');
            }
        });
        
        // Update the center display
        const currentSpeedDisplay = document.getElementById('current-speed');
        if (currentSpeedDisplay && activeSpeed > 0) {
            currentSpeedDisplay.textContent = activeSpeed;
        }
    }

    updateTimerButtons(activeTimer) {
        // Remove active class from all timer buttons
        ['timer-1h', 'timer-2h', 'timer-4h', 'timer-8h', 'timer-off'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('active');
        });
        
        // Add active class to the selected timer
        let activeId = '';
        switch(activeTimer) {
            case 1: activeId = 'timer-1h'; break;
            case 2: activeId = 'timer-2h'; break;
            case 4: activeId = 'timer-4h'; break;
            case 8: activeId = 'timer-8h'; break;
            case 0: activeId = 'timer-off'; break;
        }
        
        if (activeId) {
            const activeBtn = document.getElementById(activeId);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    updateColorButtons(activeColor) {
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === activeColor) {
                btn.classList.add('active');
            }
        });
    }

    showAllControls() {
        // Show main control sections
        this.elements.fanControlSection.classList.remove('hidden');
        this.elements.sleepControlSection.classList.remove('hidden');
        this.elements.timerControlSection.classList.remove('hidden');
        this.elements.lightControlSection.classList.remove('hidden');
        // Note: brightness and color sections are controlled by updateUIForDevice based on device capabilities
    }

    hideAllControls() {
        // Hide all control sections
        this.elements.fanControlSection.classList.add('hidden');
        this.elements.sleepControlSection.classList.add('hidden');
        this.elements.timerControlSection.classList.add('hidden');
        this.elements.lightControlSection.classList.add('hidden');
        this.elements.brightnessSection.classList.add('hidden');
        this.elements.colorSection.classList.add('hidden');
    }

    setDevicePoweredOn(isOn, speed = 0) {
        this.devicePoweredOn = isOn;
        this.currentSpeed = speed;
        this.updatePowerCenterDisplay();
        
        // Enable/disable speed buttons based on power state
        document.querySelectorAll('.speed-button').forEach(btn => {
            btn.style.opacity = isOn ? '1' : '0.5';
            btn.style.pointerEvents = isOn ? 'auto' : 'all'; // Keep clickable for turning on
        });
        
        // Update speed button states
        if (isOn && speed > 0) {
            this.updateSpeedButtons(speed);
        } else {
            // Clear all active speed buttons when device is off
            this.updateSpeedButtons(0);
        }
    }

    setCurrentSpeed(speed) {
        this.currentSpeed = speed;
        this.updatePowerCenterDisplay();
    }

    updatePowerCenterDisplay() {
        const powerOffState = document.getElementById('power-off-state');
        const speedDisplayState = document.getElementById('speed-display-state');
        const currentSpeedElement = document.getElementById('current-speed');
        const powerCenter = document.getElementById('power-center');

        if (this.devicePoweredOn && this.currentSpeed > 0) {
            // Show speed display
            powerOffState.classList.add('hidden');
            speedDisplayState.classList.remove('hidden');
            currentSpeedElement.textContent = this.currentSpeed;
            
            // Change center button styling for on state
            powerCenter.classList.remove('hover:border-remote-accent');
            powerCenter.classList.add('border-green-500', 'hover:border-green-400');
            
            this.showStatus(`Fan running at speed ${this.currentSpeed}`, 'success');
        } else {
            // Show power off state
            powerOffState.classList.remove('hidden');
            speedDisplayState.classList.add('hidden');
            
            // Change center button styling for off state
            powerCenter.classList.remove('border-green-500', 'hover:border-green-400');
            powerCenter.classList.add('hover:border-remote-accent');
            
            if (!this.devicePoweredOn) {
                this.showStatus('Fan is off - Click center to turn on', 'info');
            }
        }
    }

    showStatus(message, type = 'info') {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        
        // Auto-hide success/info messages after 3 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (this.elements.statusMessage.classList.contains(type)) {
                    this.elements.statusMessage.textContent = 'Ready';
                    this.elements.statusMessage.className = 'status-message';
                }
            }, 3000);
        }
    }

    startDeviceRefresh() {
        // Refresh device list every 5 seconds, but preserve current selection
        this.refreshInterval = setInterval(() => {
            this.refreshDevicesPreserveSelection();
        }, 5000);
    }

    stopDeviceRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Initialize the remote controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing controller...');
    console.log('electronAPI available:', !!window.electronAPI);
    window.remoteController = new AtombergRemoteController();
});

// Handle app cleanup
window.addEventListener('beforeunload', () => {
    if (window.remoteController) {
        window.remoteController.stopDeviceRefresh();
    }
});