const dgram = require('dgram');

class UDPService {
  constructor() {
    this.UDP_LISTEN_PORT = 5625;
    this.UDP_COMMAND_PORT = 5600;
    this.BUFFER_SIZE = 4096;
    this.TIMEOUT = 5; // seconds
    
    this.availableDevices = {};
    this.discoverySocket = null;
    this.cleanupInterval = null;
    this.isDiscovering = false;
  }

  startDeviceDiscovery() {
    if (this.isDiscovering) {
      return;
    }

    try {
      // Create UDP socket for listening to beacon packets
      this.discoverySocket = dgram.createSocket('udp4');
      
      this.discoverySocket.on('message', (data, remote) => {
        this.handleBeaconPacket(data, remote);
      });

      this.discoverySocket.on('error', (err) => {
        console.error('Discovery socket error:', err);
      });

      // Bind to listen for beacon packets
      this.discoverySocket.bind(this.UDP_LISTEN_PORT, '0.0.0.0', () => {
        console.log(`Listening for device beacons on port ${this.UDP_LISTEN_PORT}`);
        this.isDiscovering = true;
      });

      // Start cleanup service for inactive devices
      this.startCleanupService();

    } catch (error) {
      console.error('Failed to start device discovery:', error);
    }
  }

  stopDeviceDiscovery() {
    if (this.discoverySocket) {
      try {
        this.discoverySocket.close();
      } catch (error) {
        console.warn('Error closing discovery socket:', error.message);
      }
      this.discoverySocket = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.isDiscovering = false;
    this.availableDevices = {};
  }

  handleBeaconPacket(data, remote) {
    try {
      const content = data.toString('utf8', 0, Math.min(data.length, 15));
      
      // Beacon packets should be 12-15 characters (MAC + series info)
      if (content.length >= 12 && content.length <= 15) {
        const mac = content.substring(0, 12);
        const series = content.length > 12 ? content.substring(12) : '';
        
        // Validate MAC format (basic check)
        if (this.isValidMAC(mac)) {
          this.availableDevices[mac] = {
            ip: remote.address,
            timestamp: Date.now(),
            series: series || 'Unknown',
            lastSeen: new Date().toLocaleTimeString()
          };
          
          console.log(`Device discovered: ${mac} at ${remote.address} (Series: ${series || 'Unknown'})`);
          console.log('Available devices now:', Object.keys(this.availableDevices));
        } else {
          console.log(`Invalid MAC format: ${mac}`);
        }
      }
    } catch (error) {
      console.error('Error handling beacon packet:', error);
    }
  }

  isValidMAC(mac) {
    // Basic MAC validation - should be 12 hex characters
    return /^[0-9A-Fa-f]{12}$/.test(mac);
  }

  startCleanupService() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeoutMs = this.TIMEOUT * 1000;
      
      Object.keys(this.availableDevices).forEach(mac => {
        const device = this.availableDevices[mac];
        const age = now - device.timestamp;
        if (age > timeoutMs) {
          console.log(`Removing inactive device: ${mac} (age: ${age}ms, timeout: ${timeoutMs}ms)`);
          delete this.availableDevices[mac];
        }
      });
    }, 1000);
  }

  getAvailableDevices() {
    return { ...this.availableDevices };
  }

  refreshDevices() {
    // This method is called when UI requests a refresh
    // Don't clear devices - they are managed by the cleanup service
    console.log('Refresh requested, current devices:', this.availableDevices);
  }

  async sendCommand(deviceMAC, command) {
    return new Promise((resolve, reject) => {
      const device = this.availableDevices[deviceMAC];
      if (!device) {
        reject(new Error('Device not found or not available'));
        return;
      }

      try {
        // Create command socket
        const commandSocket = dgram.createSocket('udp4');
        
        // Convert command to JSON string and encode
        const message = JSON.stringify(command);
        const buffer = Buffer.from(message, 'utf8');

        let isResolved = false;

        // Send command to device
        commandSocket.send(buffer, this.UDP_COMMAND_PORT, device.ip, (error) => {
          if (isResolved) return;
          isResolved = true;
          
          try {
            commandSocket.close();
          } catch (closeError) {
            console.warn('Socket already closed:', closeError.message);
          }
          
          if (error) {
            console.error(`Failed to send command to ${deviceMAC}:`, error);
            reject(error);
          } else {
            console.log(`Command sent to ${deviceMAC} (${device.ip}):`, command);
            resolve(true);
          }
        });

        // Set timeout for sending
        const timeoutId = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          
          try {
            commandSocket.close();
          } catch (closeError) {
            console.warn('Socket already closed on timeout:', closeError.message);
          }
          reject(new Error('Command timeout'));
        }, 5000);

      } catch (error) {
        console.error('Error sending command:', error);
        reject(error);
      }
    });
  }

  // Predefined commands based on documentation
  static getCommands() {
    return {
      power: {
        on: { power: true },
        off: { power: false }
      },
      speed: {
        1: { speed: 1 },
        2: { speed: 2 },
        3: { speed: 3 },
        4: { speed: 4 },
        5: { speed: 5 },
        6: { speed: 6 },
        increase: { speedDelta: 1 },
        decrease: { speedDelta: -1 }
      },
      sleep: {
        on: { sleep: true },
        off: { sleep: false }
      },
      timer: {
        off: { timer: 0 },
        1: { timer: 1 },
        2: { timer: 2 },
        3: { timer: 3 },
        6: { timer: 4 } // 4 means 6 hours according to docs
      },
      light: {
        on: { led: true },
        off: { led: false }
      },
      brightness: {
        set: (value) => ({ brightness: Math.max(10, Math.min(100, value)) }),
        increase: (delta = 10) => ({ brightnessDelta: Math.max(-90, Math.min(90, delta)) }),
        decrease: (delta = 10) => ({ brightnessDelta: Math.max(-90, Math.min(90, -delta)) })
      },
      color: {
        warm: { light_mode: 'warm' },
        cool: { light_mode: 'cool' },
        daylight: { light_mode: 'daylight' }
      }
    };
  }
}

module.exports = UDPService;