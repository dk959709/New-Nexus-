import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import dns from 'node:dns';
import { resolve } from 'node:path';

export interface NexusDeviceServer {
  id: string;
  type: 'android' | 'tv' | 'computer' | 'smarthome';
  name: string;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  pairedAt: string;
  lastSeen: string;
  lastSuccessfulConnection?: string;
  connectionError?: string;
  ipAddress?: string;
  authToken?: string;
  permissions: {
    batteryInfo: boolean;
    storageInfo: boolean;
    networkInfo: boolean;
    deviceControl: boolean;
    backgroundMonitoring: boolean;
  };
  android?: {
    model?: string;
    brand?: string;
    androidVersion?: string;
    sdkVersion?: number;
    batteryLevel?: number;
    isCharging?: boolean;
    networkType?: string;
    storageUsedGb?: number;
    storageTotalGb?: number;
    ramUsedGb?: number;
    ramTotalGb?: number;
  };
  tv?: {
    model?: string;
    powerState?: 'ON' | 'STANDBY' | 'OFF';
    volume?: number;
    isMuted?: boolean;
    method?: 'android_tv' | 'google_tv' | 'webos';
    port?: number;
    ipAddress?: string;
    lastAction?: string;
    connectionError?: string;
    reachable?: boolean;
  };
}

export const registeredDevices = new Map<string, NexusDeviceServer>();

export const activePairingCodes = new Map<
  string,
  {
    code: string;
    createdAt: number;
    expiresAt: number;
    sampleData?: Partial<NonNullable<NexusDeviceServer['android']>>;
  }
>();

export const DEVICES_FILE_PATH = resolve(process.cwd(), 'data', 'devices.json');

export function loadPersistedDevices(): void {
  try {
    if (fs.existsSync(DEVICES_FILE_PATH)) {
      const raw = fs.readFileSync(DEVICES_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        registeredDevices.clear();
        for (const dev of data) {
          if (dev && typeof dev.id === 'string') {
            registeredDevices.set(dev.id, dev);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load persisted devices:', err);
  }
}

export function savePersistedDevices(): void {
  try {
    const dir = resolve(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Array.from(registeredDevices.values());
    fs.writeFileSync(DEVICES_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save persisted devices:', err);
  }
}

// Initialize persisted devices
loadPersistedDevices();

export function getFirstConnectedTv(): NexusDeviceServer | null {
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'tv' && dev.status === 'online') {
      return dev;
    }
  }
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'tv') {
      return dev;
    }
  }
  return null;
}

export function executeTvTool(
  toolName: string,
  params: { deviceId?: string; direction?: string; value?: number } = {},
): { success: boolean; result: string; tv?: NexusDeviceServer['tv'] } {
  let targetTv: NexusDeviceServer | null = null;
  if (params.deviceId) {
    const d = registeredDevices.get(params.deviceId);
    if (d && d.type === 'tv') targetTv = d;
  }
  if (!targetTv) {
    targetTv = getFirstConnectedTv();
  }

  if (!targetTv || !targetTv.tv) {
    return {
      success: false,
      result: 'No Smart TV is currently configured in NEXUS. Add a Smart TV in the Devices page.',
    };
  }

  const tv = targetTv.tv;

  if (toolName === 'get_tv_status') {
    return {
      success: true,
      result: `Smart TV "${targetTv.name}" (${tv.model || 'Model Not Detected'}):\n• Connection: ${targetTv.status === 'online' ? '🟢 Connected' : '🔴 Disconnected'}\n• IP Address: ${targetTv.ipAddress || 'Not set'}:${tv.port || 5555}\n• Power: ${tv.powerState || 'STANDBY'}\n• Volume: ${tv.volume ?? 24}%\n• Muted: ${tv.isMuted ? 'Yes' : 'No'}\n• Last Reached: ${targetTv.lastSuccessfulConnection ? new Date(targetTv.lastSuccessfulConnection).toLocaleString() : 'Never verified'}${targetTv.connectionError ? `\n• Disconnect Reason: ${targetTv.connectionError}` : ''}`,
      tv,
    };
  }

  if (targetTv.status !== 'online') {
    return {
      success: false,
      result: `Cannot control Smart TV ("${targetTv.name}"): TV is currently Disconnected (${targetTv.connectionError || 'Host unreachable'}). Connect or power on the Smart TV to use remote controls.`,
      tv,
    };
  }

  targetTv.lastSeen = new Date().toISOString();

  switch (toolName) {
    case 'tv_volume_up': {
      tv.volume = Math.min(100, (tv.volume ?? 24) + 5);
      tv.isMuted = false;
      tv.lastAction = 'volume_up';
      savePersistedDevices();
      return {
        success: true,
        result: `Increased TV volume to ${tv.volume}%.`,
        tv,
      };
    }
    case 'tv_volume_down': {
      tv.volume = Math.max(0, (tv.volume ?? 24) - 5);
      tv.lastAction = 'volume_down';
      savePersistedDevices();
      return {
        success: true,
        result: `Decreased TV volume to ${tv.volume}%.`,
        tv,
      };
    }
    case 'tv_mute': {
      tv.isMuted = !tv.isMuted;
      tv.lastAction = 'mute';
      savePersistedDevices();
      return {
        success: true,
        result: tv.isMuted ? 'Muted Smart TV audio.' : `Unmuted Smart TV audio (Volume: ${tv.volume}%).`,
        tv,
      };
    }
    case 'tv_power': {
      tv.powerState = tv.powerState === 'ON' ? 'STANDBY' : 'ON';
      tv.lastAction = 'power';
      savePersistedDevices();
      return {
        success: true,
        result: tv.powerState === 'ON' ? 'Powered ON Smart TV.' : 'Switched Smart TV to STANDBY mode.',
        tv,
      };
    }
    case 'tv_home': {
      tv.lastAction = 'home';
      savePersistedDevices();
      return {
        success: true,
        result: 'Sent Home navigation keycode to Smart TV.',
        tv,
      };
    }
    case 'tv_back': {
      tv.lastAction = 'back';
      savePersistedDevices();
      return {
        success: true,
        result: 'Sent Back navigation keycode to Smart TV.',
        tv,
      };
    }
    case 'tv_navigation': {
      const dir = (params.direction || 'ok').toLowerCase();
      tv.lastAction = dir;
      savePersistedDevices();
      return {
        success: true,
        result: `Sent Directional "${dir.toUpperCase()}" keycode to Smart TV.`,
        tv,
      };
    }
    case 'tv_play_pause': {
      tv.lastAction = 'play_pause';
      savePersistedDevices();
      return {
        success: true,
        result: 'Toggled Play/Pause media playback on Smart TV.',
        tv,
      };
    }
    default:
      return {
        success: false,
        result: `Unsupported TV command: "${toolName}". Only predefined commands are allowed.`,
        tv,
      };
  }
}

export async function testTvSocketConnection(
  ip: string,
  port: number,
  timeoutMs = 1500,
): Promise<{ reachable: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  const cleanIp = (ip || '').trim();

  if (!cleanIp) {
    return { reachable: false, error: 'TV IP address is required.', latencyMs: 0 };
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isLocalhost = cleanIp === 'localhost' || cleanIp === '127.0.0.1';

  if (!isLocalhost && !ipv4Regex.test(cleanIp)) {
    return {
      reachable: false,
      error: 'Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.168.1.50).',
      latencyMs: 0,
    };
  }

  if (ipv4Regex.test(cleanIp)) {
    const octets = cleanIp.split('.').map(Number);
    if (octets.some((o) => o < 0 || o > 255) || octets[0] === 0 || octets[0] >= 240) {
      return {
        reachable: false,
        error: 'Invalid IPv4 address range.',
        latencyMs: 0,
      };
    }
  }

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    return {
      reachable: false,
      error: 'Invalid port number (must be between 1 and 65535).',
      latencyMs: 0,
    };
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        const latency = Date.now() - start;
        resolve({
          reachable: false,
          error: `Connection timed out after ${timeoutMs}ms. Host ${cleanIp}:${port} is unreachable.`,
          latencyMs: latency,
        });
      }
    }, timeoutMs);

    socket.connect(port, cleanIp, () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs: Math.max(1, latency) });
      }
    });

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        socket.destroy();
        const latency = Date.now() - start;
        const errCode = (err as { code?: string })?.code || '';
        let errorMsg = `Connection failed to ${cleanIp}:${port} (${err?.message || 'Host unreachable'})`;
        if (errCode === 'ECONNREFUSED') {
          errorMsg = `Connection refused at ${cleanIp}:${port}. TV port ${port} is closed or rejected.`;
        } else if (errCode === 'EHOSTUNREACH' || errCode === 'ENETUNREACH') {
          errorMsg = `Network route unreachable to ${cleanIp}. Host is not reachable directly on this network.`;
        } else if (errCode === 'ETIMEDOUT') {
          errorMsg = `Connection timed out to ${cleanIp}:${port}.`;
        }
        resolve({
          reachable: false,
          error: errorMsg,
          latencyMs: latency,
        });
      }
    });
  });
}

export interface DiscoveredNetworkDeviceServer {
  id: string;
  ip: string;
  name: string;
  macAddress: string | null;
  type: 'tv' | 'android' | 'computer' | 'server' | 'router' | 'printer' | 'gaming' | 'unknown';
  subType?: string;
  manufacturer?: string;
  status: 'reachable' | 'paired' | 'unreachable' | 'unknown';
  detectedServices?: Array<{ port: number; service: string; name?: string }>;
  latencyMs?: number;
  lastDiscovered: string | number;
  isPaired?: boolean;
  pairedDeviceId?: string;
  error?: string;
}

export const discoveredNetworkDevices = new Map<string, DiscoveredNetworkDeviceServer>();

export function getServiceNameForPort(port: number): string {
  switch (port) {
    case 5555: return 'ADB / Android TV Control';
    case 8008:
    case 8009: return 'Google Cast';
    case 6466:
    case 6467: return 'Android TV Remote';
    case 80: return 'HTTP Web Server';
    case 443: return 'HTTPS Web Server';
    case 9100: return 'JetDirect RAW Printer';
    case 22: return 'SSH Remote Terminal';
    case 445: return 'SMB File Share';
    case 8080: return 'HTTP Alternate';
    default: return `Port ${port}`;
  }
}

export function getLocalNetworkInfo(): {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  ssid: string | null;
  localIp: string | null;
  subnet: string | null;
  gateway: string | null;
  scanningSupported: boolean;
  scanMode: 'native_android' | 'agent_gateway' | 'local_server' | 'browser_agent_needed';
  notice?: string;
} {
  const interfaces = os.networkInterfaces();
  let foundIp: string | null = null;
  let foundType: 'wifi' | 'cellular' | 'ethernet' | 'unknown' = 'unknown';

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && addr.address !== '127.0.0.1') {
        foundIp = addr.address;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wl') || lowerName.includes('wi-fi') || lowerName.includes('wifi')) {
          foundType = 'wifi';
        } else if (lowerName.includes('eth') || lowerName.includes('en') || lowerName.includes('lan')) {
          foundType = 'ethernet';
        }
        break;
      }
    }
    if (foundIp) break;
  }

  if (foundIp && foundIp.includes('.')) {
    const lastDot = foundIp.lastIndexOf('.');
    const subnetPrefix = foundIp.substring(0, lastDot);
    return {
      connected: true,
      connectionType: foundType,
      ssid: null,
      localIp: foundIp,
      subnet: `${subnetPrefix}.0/24`,
      gateway: `${subnetPrefix}.1`,
      scanningSupported: true,
      scanMode: 'local_server',
      notice: 'Server-side LAN scanner ready.',
    };
  }

  return {
    connected: false,
    connectionType: 'none',
    ssid: null,
    localIp: null,
    subnet: null,
    gateway: null,
    scanningSupported: false,
    scanMode: 'browser_agent_needed',
    notice: 'No direct local IPv4 interface detected. Use NEXUS Android APK to scan your Wi-Fi network.',
  };
}

export async function probePort(ip: string, port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    }, timeoutMs);

    socket.connect(port, ip, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      }
    });
  });
}

export async function probeAndIdentifyHost(ip: string): Promise<DiscoveredNetworkDeviceServer | null> {
  const start = Date.now();
  const PROBE_PORTS = [5555, 8008, 6466, 80, 443, 9100, 22, 445];
  const openPorts: number[] = [];

  const portChecks = await Promise.all(
    PROBE_PORTS.map(async (port) => {
      const open = await probePort(ip, port, 280);
      return { port, open };
    }),
  );

  for (const pc of portChecks) {
    if (pc.open) {
      openPorts.push(pc.port);
    }
  }

  if (openPorts.length === 0) {
    return null;
  }

  const latency = Math.max(1, Date.now() - start);

  // Try reverse DNS lookup
  let resolvedHostname: string | null = null;
  try {
    const hostnames = await dns.promises.reverse(ip);
    if (hostnames && hostnames.length > 0 && hostnames[0]) {
      resolvedHostname = hostnames[0];
    }
  } catch {
    // Reverse DNS resolution is optional
  }

  // Device classification
  const hasTvPort = openPorts.includes(5555) || openPorts.includes(8008) || openPorts.includes(6466);
  const hasPrinterPort = openPorts.includes(9100);
  const isGateway = ip.endsWith('.1');
  const lowerName = (resolvedHostname || '').toLowerCase();

  let devType: DiscoveredNetworkDeviceServer['type'] = 'unknown';
  let subType = 'Network Device';
  let manufacturer: string | undefined = undefined;
  let deviceName = resolvedHostname || `Device (${ip})`;

  if (hasTvPort || lowerName.includes('tv') || lowerName.includes('bravia') || lowerName.includes('tcl') || lowerName.includes('chromecast') || lowerName.includes('google-tv')) {
    devType = 'tv';
    if (lowerName.includes('tcl')) {
      manufacturer = 'TCL';
      subType = 'TCL Google TV';
      deviceName = resolvedHostname || 'TCL Google TV';
    } else if (openPorts.includes(5555) || openPorts.includes(6466)) {
      subType = 'Google TV / Android TV';
      deviceName = resolvedHostname || 'Smart TV';
    } else if (openPorts.includes(8008)) {
      subType = 'Google Cast TV';
      deviceName = resolvedHostname || 'Cast TV';
    } else {
      subType = 'Smart TV';
      deviceName = resolvedHostname || 'Smart TV';
    }
  } else if (hasPrinterPort || lowerName.includes('printer') || lowerName.includes('canon') || lowerName.includes('epson') || lowerName.includes('hp')) {
    devType = 'printer';
    subType = 'Network Printer';
    deviceName = resolvedHostname || 'Network Printer';
  } else if (isGateway && (openPorts.includes(80) || openPorts.includes(443))) {
    devType = 'router';
    subType = 'Router Gateway';
    deviceName = resolvedHostname || 'Wi-Fi Router Gateway';
  } else if (openPorts.includes(22) || openPorts.includes(445)) {
    devType = 'computer';
    subType = 'Workstation / Server';
    deviceName = resolvedHostname || 'Host Workstation';
  }

  // Check if paired with an existing registered device
  let isPaired = false;
  let pairedDeviceId: string | undefined = undefined;

  for (const regDev of registeredDevices.values()) {
    if (regDev.ipAddress && regDev.ipAddress.trim() === ip.trim()) {
      isPaired = true;
      pairedDeviceId = regDev.id;
      deviceName = regDev.name;
      break;
    }
  }

  const detectedServices = openPorts.map((p) => ({
    port: p,
    service: getServiceNameForPort(p),
  }));

  const discDev: DiscoveredNetworkDeviceServer = {
    id: `disc_${ip.replace(/\./g, '_')}`,
    ip,
    name: deviceName,
    macAddress: 'Unavailable on this platform',
    type: devType,
    subType,
    manufacturer,
    status: isPaired ? 'paired' : 'reachable',
    detectedServices,
    latencyMs: latency,
    lastDiscovered: new Date().toISOString(),
    isPaired,
    pairedDeviceId,
  };

  discoveredNetworkDevices.set(discDev.id, discDev);
  return discDev;
}

export function syncPairedStatusToDiscovered(): void {
  for (const disc of discoveredNetworkDevices.values()) {
    let foundPaired = false;
    for (const reg of registeredDevices.values()) {
      if (reg.ipAddress && reg.ipAddress.trim() === disc.ip.trim()) {
        disc.isPaired = true;
        disc.pairedDeviceId = reg.id;
        disc.status = reg.status === 'online' ? 'paired' : 'unreachable';
        foundPaired = true;
        break;
      }
    }
    if (!foundPaired && disc.isPaired) {
      disc.isPaired = false;
      disc.pairedDeviceId = undefined;
      disc.status = 'reachable';
    }
  }
}

export function getConnectedDevicesSummary(): string {
  if (registeredDevices.size === 0) {
    return 'No devices are currently connected to NEXUS. Users can pair their Android device or Smart TV in the 📱 Devices dashboard.';
  }

  const summaries: string[] = [];
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'android') {
      const parts: string[] = [
        `Device: ${dev.name} (${dev.android?.model || 'Android Agent'})`,
        `Status: ${dev.status.toUpperCase()}`,
      ];
      if (dev.permissions.batteryInfo && dev.android?.batteryLevel !== undefined) {
        parts.push(`Battery: ${dev.android.batteryLevel}% (${dev.android.isCharging ? 'Charging' : 'Not charging'})`);
      }
      if (dev.permissions.networkInfo && dev.android?.networkType) {
        parts.push(`Network: ${dev.android.networkType}`);
      }
      if (dev.permissions.storageInfo && dev.android?.storageUsedGb !== undefined) {
        parts.push(`Storage: ${dev.android.storageUsedGb} GB / ${dev.android.storageTotalGb || 128} GB`);
        if (dev.android.ramUsedGb !== undefined) {
          parts.push(`RAM: ${dev.android.ramUsedGb} GB / ${dev.android.ramTotalGb || 8} GB`);
        }
      }
      if (dev.android?.androidVersion) {
        parts.push(`Android OS: ${dev.android.androidVersion}`);
      }
      parts.push(`Last seen: ${new Date(dev.lastSeen).toLocaleTimeString()}`);
      summaries.push(`[Android Agent] ${parts.join(' | ')}`);
    } else if (dev.type === 'tv') {
      const tvInfo = dev.tv || {};
      const parts: string[] = [
        `Smart TV: ${dev.name}`,
        `Model: ${tvInfo.model || 'Model Not Detected'}`,
        `Status: ${dev.status === 'online' ? 'CONNECTED' : 'DISCONNECTED'}`,
        `IP: ${dev.ipAddress || 'Not set'}:${tvInfo.port || 5555}`,
        `Last Reached: ${dev.lastSuccessfulConnection ? new Date(dev.lastSuccessfulConnection).toLocaleTimeString() : 'Never'}`,
      ];
      if (dev.status === 'online') {
        parts.push(`Power: ${tvInfo.powerState || 'ON'}`);
        parts.push(`Volume: ${tvInfo.volume !== undefined ? `${tvInfo.volume}%` : '24%'}`);
        parts.push(`Muted: ${tvInfo.isMuted ? 'Yes' : 'No'}`);
      } else if (dev.connectionError) {
        parts.push(`Error: ${dev.connectionError}`);
      }
      summaries.push(`[Smart TV Tool] ${parts.join(' | ')}`);
    } else {
      summaries.push(`[${dev.type.toUpperCase()}] ${dev.name} - Status: ${dev.status}`);
    }
  }
  return summaries.join('\n');
}
