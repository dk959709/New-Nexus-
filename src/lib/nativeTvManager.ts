import { Capacitor, registerPlugin } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { TcpSocket, DataEncoding } from 'capacitor-tcp-socket';
import type {
  DiscoveredNetworkDevice,
  NetworkInfo,
  NetworkScanResult,
  SmartTVInfo,
  TVControlAction,
} from '@/types';

export interface AndroidTvRemotePluginInterface {
  checkStatus(): Promise<{
    isConnected: boolean;
    isPaired: boolean;
    ip?: string;
    port?: number;
    model?: string;
    deviceName?: string;
  }>;
  startPairing(options: {
    ipAddress: string;
    port?: number;
  }): Promise<{
    status: 'NEED_PIN' | 'PAIRED';
    ip: string;
    port: number;
    message?: string;
  }>;
  sendPin(options: {
    pin: string;
  }): Promise<{
    success: boolean;
    status: string;
    isConnected: boolean;
    ip: string;
    deviceName?: string;
    model?: string;
    message?: string;
  }>;
  connectTv(options: {
    ipAddress: string;
    port?: number;
    method?: string;
  }): Promise<{
    success: boolean;
    isConnected: boolean;
    isPaired?: boolean;
    needPairing?: boolean;
    ip?: string;
    port?: number;
    deviceName?: string;
    model?: string;
    error?: string;
  }>;
  sendKey(options: {
    action: string;
    keyCode?: number;
    ipAddress?: string;
  }): Promise<{
    success: boolean;
    action?: string;
    keyCode?: number;
  }>;
  disconnect(): Promise<{ success: boolean }>;
}

export const AndroidTvRemote = registerPlugin<AndroidTvRemotePluginInterface>('AndroidTvRemote');

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
 * Initiates native TLS pairing with Google TV / Android TV on port 6467
 */
export async function pairTvNative(
  ipAddress: string,
  port = 6467,
): Promise<{
  status: 'NEED_PIN' | 'PAIRED';
  ip: string;
  port: number;
  message?: string;
}> {
  if (!isNativeAndroid()) {
    throw new Error('Native TV pairing is available on the Android app on local Wi-Fi.');
  }
  return await AndroidTvRemote.startPairing({
    ipAddress: ipAddress.trim(),
    port: Number(port) || 6467,
  });
}

/**
 * Sends the user-entered PIN to complete TV pairing
 */
export async function sendPinTvNative(
  pin: string,
): Promise<{
  success: boolean;
  status: string;
  isConnected: boolean;
  ip: string;
  deviceName?: string;
  model?: string;
  message?: string;
}> {
  if (!isNativeAndroid()) {
    throw new Error('Native TV pairing is available on the Android app.');
  }
  return await AndroidTvRemote.sendPin({ pin: pin.trim() });
}

/**
 * Connects directly to Smart TV over TLS on port 6466 or ADB on 5555
 */
export async function connectTvNative(
  ipAddress: string,
  port = 6466,
  method = 'google_tv',
): Promise<{
  success: boolean;
  isConnected: boolean;
  isPaired?: boolean;
  needPairing?: boolean;
  ip?: string;
  port?: number;
  deviceName?: string;
  model?: string;
  error?: string;
}> {
  if (!isNativeAndroid()) {
    return {
      success: false,
      isConnected: false,
      error: 'Direct connection available on Android app.',
    };
  }
  return await AndroidTvRemote.connectTv({
    ipAddress: ipAddress.trim(),
    port: Number(port) || 6466,
    method,
  });
}

/**
 * Checks active TV connection status from native plugin
 */
export async function checkTvStatusNative() {
  if (!isNativeAndroid()) {
    return { isConnected: false, isPaired: false };
  }
  return await AndroidTvRemote.checkStatus();
}

/**
 * Disconnects active TV session
 */
export async function disconnectTvNative() {
  if (!isNativeAndroid()) return { success: true };
  return await AndroidTvRemote.disconnect();
}

/**
 * Tests direct TCP connection from the phone to a TV IP:port
 */
export async function testTvConnectionNative(
  ipAddress: string,
  port = 6466,
  method = 'google_tv',
): Promise<{ reachable: boolean; latencyMs: number; error?: string; model?: string }> {
  if (!isNativeAndroid()) {
    return {
      reachable: false,
      latencyMs: 0,
      error: 'Direct TCP socket is only available in the Android app on local Wi-Fi.',
    };
  }

  const startTime = Date.now();
  const cleanIp = ipAddress.trim();
  const numPort = Number(port) || (method === 'android_tv' ? 5555 : 6466);

  try {
    const connRes = await AndroidTvRemote.connectTv({
      ipAddress: cleanIp,
      port: numPort,
      method,
    });

    const latencyMs = Math.max(1, Date.now() - startTime);

    if (connRes.success || connRes.needPairing || connRes.isConnected) {
      return {
        reachable: true,
        latencyMs,
        model: connRes.model || (method === 'google_tv' ? 'Google TV' : 'Android TV'),
      };
    }
  } catch {
    // Fallback to TCP socket probe
  }

  try {
    const connectPromise = TcpSocket.connect({
      ipAddress: cleanIp,
      port: numPort,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out (no response within 3.5s)')), 3500),
    );

    const res = await Promise.race([connectPromise, timeoutPromise]);
    const client = res.client;
    const latencyMs = Math.max(1, Date.now() - startTime);

    try {
      await TcpSocket.disconnect({ client });
    } catch {
      // Ignored
    }

    return {
      reachable: true,
      latencyMs,
      model: method === 'google_tv' ? 'Google TV' : 'Android TV',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Host unreachable on local Wi-Fi.';
    return {
      reachable: false,
      latencyMs: 0,
      error: msg,
    };
  }
}

/**
 * Sends a TV control command using Native TLS Protobuf key injection (Port 6466) or ADB fallback
 */
export async function sendTvCommandNative(
  action: TVControlAction,
  ipAddress: string,
  port = 6466,
  currentTvState?: SmartTVInfo,
): Promise<{ success: boolean; tvState: SmartTVInfo; error?: string }> {
  if (!isNativeAndroid()) {
    return {
      success: false,
      tvState: currentTvState || {},
      error: 'Direct TV remote commands are available in the Android app only.',
    };
  }

  const keyCode = ADB_KEY_MAP[action] ?? 23;
  const cleanIp = ipAddress.trim();

  try {
    // 1. Send via Native AndroidTvRemote Plugin (Protobuf over TLS on port 6466 or ADB on 5555)
    const nativeRes = await AndroidTvRemote.sendKey({
      action,
      keyCode,
      ipAddress: cleanIp,
    });

    if (nativeRes.success) {
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
    }
  } catch {
    // If native plugin failed, fallback to TCP ADB socket
  }

  // Fallback to TCP Socket
  let client: number | null = null;
  try {
    const conn = await Promise.race([
      TcpSocket.connect({
        ipAddress: cleanIp,
        port: Number(port) || 5555,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Could not connect to TV at ${cleanIp}:${port}`)), 3000),
      ),
    ]);

    client = conn.client;

    try {
      await TcpSocket.send({
        client,
        data: `input keyevent ${keyCode}\n`,
        encoding: DataEncoding.UTF8,
      });
    } catch {
      // Ignored
    }

    await new Promise((r) => setTimeout(r, 40));

    try {
      await TcpSocket.disconnect({ client });
    } catch {
      // Ignored
    }

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
    const msg = err instanceof Error ? err.message : 'Failed to send command to TV over socket.';
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
