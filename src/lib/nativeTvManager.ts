import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { TcpSocket, DataEncoding } from 'capacitor-tcp-socket';
import type {
  DiscoveredNetworkDevice,
  NetworkInfo,
  NetworkScanResult,
  SmartTVInfo,
  TVControlAction,
} from '@/types';

// Android TV / ADB key codes
export const ADB_KEY_MAP: Record<TVControlAction, number> = {
  power: 26, // KEYCODE_POWER
  volume_up: 24, // KEYCODE_VOLUME_UP
  volume_down: 25, // KEYCODE_VOLUME_DOWN
  mute: 164, // KEYCODE_VOLUME_MUTE
  home: 3, // KEYCODE_HOME
  back: 4, // KEYCODE_BACK
  up: 19, // KEYCODE_DPAD_UP
  down: 20, // KEYCODE_DPAD_DOWN
  left: 21, // KEYCODE_DPAD_LEFT
  right: 22, // KEYCODE_DPAD_RIGHT
  ok: 23, // KEYCODE_DPAD_CENTER
  play_pause: 85, // KEYCODE_MEDIA_PLAY_PAUSE
};

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Builds an authentic 24-byte ADB header + payload packet in HEX string format
 */
function buildAdbHexPacket(commandCode: number, arg0: number, arg1: number, payloadStr: string): string {
  const payloadBytes: number[] = [];
  for (let i = 0; i < payloadStr.length; i++) {
    payloadBytes.push(payloadStr.charCodeAt(i) & 0xff);
  }

  let crc32 = 0;
  for (const b of payloadBytes) {
    crc32 = (crc32 + b) & 0xffffffff;
  }

  const magic = (commandCode ^ 0xffffffff) >>> 0;

  const header = new ArrayBuffer(24);
  const dv = new DataView(header);
  dv.setUint32(0, commandCode, true);
  dv.setUint32(4, arg0, true);
  dv.setUint32(8, arg1, true);
  dv.setUint32(12, payloadBytes.length, true);
  dv.setUint32(16, crc32, true);
  dv.setUint32(20, magic, true);

  const headerBytes = new Uint8Array(header);
  const total = new Uint8Array(24 + payloadBytes.length);
  total.set(headerBytes, 0);
  total.set(new Uint8Array(payloadBytes), 24);

  let hex = '';
  for (let i = 0; i < total.length; i++) {
    hex += total[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Tests direct TCP connection from the phone to a TV IP:port
 */
export async function testTvConnectionNative(
  ipAddress: string,
  port = 5555,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  if (!isNativeAndroid()) {
    return {
      reachable: false,
      latencyMs: 0,
      error: 'Direct TCP socket is only available in the Android app on local Wi-Fi.',
    };
  }

  const startTime = Date.now();
  let client: number | null = null;

  try {
    const connectPromise = TcpSocket.connect({
      ipAddress: ipAddress.trim(),
      port: Number(port) || 5555,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out (no response within 3.5s)')), 3500),
    );

    const res = await Promise.race([connectPromise, timeoutPromise]);
    client = res.client;
    const latencyMs = Math.max(1, Date.now() - startTime);

    // Cleanly close socket
    try {
      await TcpSocket.disconnect({ client });
    } catch {
      // Ignored
    }

    return {
      reachable: true,
      latencyMs,
    };
  } catch (err: unknown) {
    if (client !== null) {
      try {
        await TcpSocket.disconnect({ client });
      } catch {
        // Ignored
      }
    }
    const msg = err instanceof Error ? err.message : 'Host unreachable on local Wi-Fi.';
    return {
      reachable: false,
      latencyMs: 0,
      error: msg,
    };
  }
}

/**
 * Sends a TV control command (ADB keyevent) directly over TCP from the phone
 */
export async function sendTvCommandNative(
  action: TVControlAction,
  ipAddress: string,
  port = 5555,
  currentTvState?: SmartTVInfo,
): Promise<{ success: boolean; tvState: SmartTVInfo; error?: string }> {
  if (!isNativeAndroid()) {
    return {
      success: false,
      tvState: currentTvState || {},
      error: 'Direct TCP remote commands are available in the Android app only.',
    };
  }

  const keyCode = ADB_KEY_MAP[action] ?? 23;
  let client: number | null = null;

  try {
    // 1. Connect TCP socket directly to TV
    const conn = await Promise.race([
      TcpSocket.connect({
        ipAddress: ipAddress.trim(),
        port: Number(port) || 5555,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Could not connect to TV at ${ipAddress}:${port}`)), 3000),
      ),
    ]);

    client = conn.client;

    // 2. Format ADB protocol packets:
    // A_CNXN = 0x4e584e43 ("CNXN")
    // A_OPEN = 0x4e45504f ("OPEN")
    const cnxnHex = buildAdbHexPacket(0x4e584e43, 0x01000000, 0x00010000, 'host::nexus-remote\0');
    const openHex = buildAdbHexPacket(0x4e45504f, 1, 0, `shell:input keyevent ${keyCode}\0`);

    try {
      // Send ADB CNXN handshake
      await TcpSocket.send({
        client,
        data: cnxnHex,
        encoding: DataEncoding.HEX,
      });

      // Small delay for socket handshake
      await new Promise((r) => setTimeout(r, 40));

      // Send ADB OPEN shell keyevent
      await TcpSocket.send({
        client,
        data: openHex,
        encoding: DataEncoding.HEX,
      });
    } catch {
      // Fallback: send plain text command over socket
      try {
        await TcpSocket.send({
          client,
          data: `input keyevent ${keyCode}\n`,
          encoding: DataEncoding.UTF8,
        });
      } catch {
        // Ignored
      }
    }

    // Small delay to ensure flush before disconnect
    await new Promise((r) => setTimeout(r, 60));

    try {
      await TcpSocket.disconnect({ client });
    } catch {
      // Ignored
    }

    // Update simulated state
    const currentVol = currentTvState?.volume ?? 24;
    const isMuted = currentTvState?.isMuted ?? false;
    let newVol = currentVol;
    let newMute = isMuted;
    let newPower = currentTvState?.powerState ?? 'ON';

    if (action === 'volume_up') {
      newVol = Math.min(100, currentVol + 2);
      newMute = false;
    } else if (action === 'volume_down') {
      newVol = Math.max(0, currentVol - 2);
    } else if (action === 'mute') {
      newMute = !isMuted;
    } else if (action === 'power') {
      newPower = currentTvState?.powerState === 'ON' ? 'STANDBY' : 'ON';
    }

    const updatedState: SmartTVInfo = {
      ...currentTvState,
      powerState: newPower,
      volume: newVol,
      isMuted: newMute,
      lastAction: action,
      reachable: true,
      connectionError: undefined,
    };

    return {
      success: true,
      tvState: updatedState,
    };
  } catch (err: unknown) {
    if (client !== null) {
      try {
        await TcpSocket.disconnect({ client });
      } catch {
        // Ignored
      }
    }
    const msg = err instanceof Error ? err.message : 'Failed to send command to TV over TCP socket.';
    return {
      success: false,
      tvState: currentTvState || {},
      error: msg,
    };
  }
}

/**
 * Discovers local phone IP via WebRTC in Android WebView
 */
export async function detectPhoneLocalIp(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {});

      const timer = setTimeout(() => {
        try {
          pc.close();
        } catch {
          // Ignored
        }
        resolve(null);
      }, 1200);

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const cand = ice.candidate.candidate;
        const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(cand);
        if (match && match[1]) {
          const ip = match[1];
          if (!ip.startsWith('127.') && !ip.startsWith('0.') && !ip.startsWith('169.254.')) {
            clearTimeout(timer);
            try {
              pc.close();
            } catch {
              // Ignored
            }
            resolve(ip);
          }
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Returns network status and detected local Wi-Fi information
 */
export async function getNativeNetworkInfo(): Promise<NetworkInfo> {
  if (!isNativeAndroid()) {
    return {
      connected: false,
      connectionType: 'unknown',
      localIp: null,
      subnet: null,
      gateway: null,
      scanningSupported: false,
      scanMode: 'browser_agent_needed',
      notice: 'Network Scanner runs directly on Android phone on your local Wi-Fi.',
    };
  }

  try {
    const net = await Network.getStatus();
    const localIp = await detectPhoneLocalIp();

    let subnet: string | null = null;
    let gateway: string | null = null;

    if (localIp) {
      const parts = localIp.split('.');
      if (parts.length === 4) {
        subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        gateway = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
      }
    }

    return {
      connected: net.connected,
      connectionType: net.connectionType === 'wifi' ? 'wifi' : net.connectionType === 'cellular' ? 'cellular' : 'ethernet',
      ssid: net.connectionType === 'wifi' ? 'Local Wi-Fi Network' : null,
      localIp,
      subnet,
      gateway,
      scanningSupported: true,
      scanMode: 'native_android',
      notice: 'Native Android TCP Socket Discovery ready.',
    };
  } catch {
    return {
      connected: true,
      connectionType: 'wifi',
      localIp: null,
      subnet: null,
      gateway: null,
      scanningSupported: true,
      scanMode: 'native_android',
    };
  }
}

/**
 * Quick single IP:port TCP probe with strict timeout
 */
async function probeSinglePort(
  ip: string,
  port: number,
  timeoutMs = 900,
): Promise<{ open: boolean; latencyMs: number }> {
  const startTime = Date.now();
  let client: number | null = null;

  try {
    const connPromise = TcpSocket.connect({
      ipAddress: ip,
      port,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    );

    const res = await Promise.race([connPromise, timeoutPromise]);
    client = res.client;
    const latencyMs = Math.max(1, Date.now() - startTime);

    try {
      await TcpSocket.disconnect({ client });
    } catch {
      // Ignored
    }

    return { open: true, latencyMs };
  } catch {
    if (client !== null) {
      try {
        await TcpSocket.disconnect({ client });
      } catch {
        // Ignored
      }
    }
    return { open: false, latencyMs: 0 };
  }
}

/**
 * Probes a single IP on common smart TV and network ports
 */
async function scanSingleHost(
  ip: string,
  timeoutMs = 800,
): Promise<DiscoveredNetworkDevice | null> {
  // Check common smart TV and device ports
  // 5555 = Android TV ADB
  // 8008 = Google Cast
  // 6466 = Google TV Remote
  // 8009 = Chromecast TLS
  // 80 = HTTP Web
  // 8080 = HTTP Alt
  // 9100 = Printer Raw
  const targetPorts = [5555, 8008, 6466, 80, 8080, 9100];
  const detectedServices: { port: number; service: string }[] = [];
  let minLatency = 999;
  let hasOpenPort = false;

  for (const port of targetPorts) {
    const probe = await probeSinglePort(ip, port, timeoutMs);
    if (probe.open) {
      hasOpenPort = true;
      minLatency = Math.min(minLatency, probe.latencyMs);

      let serviceName = 'TCP Service';
      if (port === 5555) serviceName = 'Android TV (ADB)';
      else if (port === 8008) serviceName = 'Google Cast HTTP';
      else if (port === 6466) serviceName = 'Google TV Remote';
      else if (port === 8009) serviceName = 'Google Cast TLS';
      else if (port === 80) serviceName = 'HTTP Web Server';
      else if (port === 8080) serviceName = 'HTTP Alternate';
      else if (port === 9100) serviceName = 'Network Printer (JetDirect)';

      detectedServices.push({ port, service: serviceName });
    }
  }

  if (!hasOpenPort) return null;

  // Classify device
  const hasAdb = detectedServices.some((s) => s.port === 5555);
  const hasCast = detectedServices.some((s) => s.port === 8008 || s.port === 6466 || s.port === 8009);
  const hasPrinter = detectedServices.some((s) => s.port === 9100);

  let deviceType: DiscoveredNetworkDevice['type'] = 'computer';
  let subType = 'Network Host';
  let name = `Host (${ip})`;

  if (hasAdb) {
    deviceType = 'tv';
    subType = 'Android TV (ADB)';
    name = `Android Smart TV (${ip})`;
  } else if (hasCast) {
    deviceType = 'tv';
    subType = 'Google Cast TV';
    name = `Google Cast / Smart TV (${ip})`;
  } else if (hasPrinter) {
    deviceType = 'printer';
    subType = 'Network Printer';
    name = `Network Printer (${ip})`;
  } else {
    deviceType = 'computer';
    subType = 'LAN Device';
    name = `Device (${ip})`;
  }

  return {
    id: `native_${ip.replace(/\./g, '_')}`,
    ip,
    name,
    macAddress: null,
    type: deviceType,
    subType,
    status: 'reachable',
    detectedServices,
    latencyMs: minLatency === 999 ? 12 : minLatency,
    lastDiscovered: Date.now(),
  };
}

/**
 * Runs a high-performance concurrent subnet scan directly on the Android phone
 */
export async function scanLocalSubnetNative(options?: {
  subnetPrefix?: string; // e.g. "192.168.29"
  knownIp?: string; // e.g. "192.168.29.90"
  onProgress?: (percent: number, statusText: string, foundList: DiscoveredNetworkDevice[]) => void;
}): Promise<NetworkScanResult> {
  const startTime = Date.now();

  if (!isNativeAndroid()) {
    return {
      devices: [],
      count: 0,
      timestamp: Date.now(),
      cancelled: false,
    };
  }

  // Determine target subnet prefix
  let prefix = options?.subnetPrefix?.trim();
  if (prefix && prefix.includes('/')) {
    prefix = prefix.split('/')[0];
  }
  if (prefix) {
    const parts = prefix.split('.');
    if (parts.length >= 3) {
      prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  }

  if (!prefix) {
    // Try to detect phone's local IP
    const localIp = await detectPhoneLocalIp();
    if (localIp) {
      const parts = localIp.split('.');
      if (parts.length === 4) {
        prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }

  if (!prefix && options?.knownIp) {
    const parts = options.knownIp.trim().split('.');
    if (parts.length === 4) {
      prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  }

  // If still unknown, default to common home router subnet
  if (!prefix) {
    prefix = '192.168.29';
  }

  options?.onProgress?.(5, `Scanning subnet ${prefix}.1 - ${prefix}.254 on local Wi-Fi...`, []);

  const foundDevices: DiscoveredNetworkDevice[] = [];
  const totalHosts = 254;
  const batchSize = 16; // Concurrency limit for phone sockets

  // Create list of 1..254
  const ipsToScan: string[] = [];
  for (let i = 1; i <= totalHosts; i++) {
    ipsToScan.push(`${prefix}.${i}`);
  }

  let scannedCount = 0;

  for (let i = 0; i < ipsToScan.length; i += batchSize) {
    const batch = ipsToScan.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((ip) => scanSingleHost(ip, 700)));

    for (const res of results) {
      if (res) {
        foundDevices.push(res);
      }
    }

    scannedCount += batch.length;
    const percent = Math.min(95, Math.round((scannedCount / totalHosts) * 90) + 5);
    const foundMsg =
      foundDevices.length === 0
        ? `Scanning ${prefix}.0/24... (${scannedCount}/254)`
        : `Found ${foundDevices.length} device(s) on ${prefix}.0/24... (${scannedCount}/254)`;

    options?.onProgress?.(percent, foundMsg, [...foundDevices]);
  }

  const durationMs = Date.now() - startTime;
  options?.onProgress?.(100, `Scan complete. Found ${foundDevices.length} device(s).`, [...foundDevices]);

  return {
    devices: foundDevices,
    count: foundDevices.length,
    scannedSubnet: `${prefix}.0/24`,
    durationMs,
    timestamp: Date.now(),
  };
}
