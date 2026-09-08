import { Router } from 'express';
import { errorResponse } from '../shared.js';
import {
  registeredDevices,
  activePairingCodes,
  discoveredNetworkDevices,
  type NexusDeviceServer,
  type DiscoveredNetworkDeviceServer,
  savePersistedDevices,
  getFirstConnectedTv,
  executeTvTool,
  testTvSocketConnection,
  getLocalNetworkInfo,
  probeAndIdentifyHost,
  syncPairedStatusToDiscovered,
} from '../state.js';

export const devicesRouter = Router();

devicesRouter.get('/api/devices', (_req, res) => {
  const devicesList = Array.from(registeredDevices.values()).map((d) => {
    // Return safe device representation without internal auth tokens
    const { authToken, ...safeDev } = d;
    void authToken;
    return safeDev;
  });

  const overview = {
    online: devicesList.filter((d) => d.status === 'online').length,
    warning: devicesList.filter((d) => d.status === 'warning').length,
    offline: devicesList.filter((d) => d.status === 'offline').length,
    total: devicesList.length,
  };

  return res.json({
    data: {
      devices: devicesList,
      overview,
    },
  });
});

devicesRouter.post('/api/devices/pair-code/generate', (_req, res) => {
  // Generate clean 6-character code, e.g. NX-8492
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const code = `NX-${randomDigits}`;
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  activePairingCodes.set(code, {
    code,
    createdAt: now,
    expiresAt,
    sampleData: {
      model: 'Pixel 8 Pro',
      brand: 'Google',
      androidVersion: '14',
      sdkVersion: 34,
      batteryLevel: 79,
      isCharging: false,
      networkType: 'Wi-Fi (5 GHz)',
      storageUsedGb: 42.4,
      storageTotalGb: 128,
      ramUsedGb: 5.1,
      ramTotalGb: 12.0,
    },
  });

  return res.json({
    data: {
      pairingCode: code,
      expiresInSeconds: 600,
    },
  });
});

devicesRouter.post('/api/devices/pair', (req, res) => {
  const { pairingCode, name, sampleData } = req.body;
  if (!pairingCode || typeof pairingCode !== 'string' || pairingCode.trim().length < 3) {
    return errorResponse(res, 400, 'Enter a valid pairing code (e.g. NX-1234 or 6-digit APK code).');
  }

  const cleanCode = pairingCode.trim().toUpperCase();
  const active = activePairingCodes.get(cleanCode);

  const devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newDevice: NexusDeviceServer = {
    id: devId,
    type: 'android',
    name: name && typeof name === 'string' && name.trim() ? name.trim() : 'Android Agent',
    status: 'online',
    pairedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.145',
    permissions: {
      batteryInfo: true,
      storageInfo: true,
      networkInfo: true,
      deviceControl: false,
      backgroundMonitoring: false,
    },
    android: {
      model: sampleData?.model || active?.sampleData?.model || 'Pixel 8 Pro',
      brand: sampleData?.brand || active?.sampleData?.brand || 'Google',
      androidVersion: sampleData?.androidVersion || active?.sampleData?.androidVersion || '14',
      sdkVersion: sampleData?.sdkVersion || active?.sampleData?.sdkVersion || 34,
      batteryLevel: sampleData?.batteryLevel ?? active?.sampleData?.batteryLevel ?? 79,
      isCharging: sampleData?.isCharging ?? active?.sampleData?.isCharging ?? false,
      networkType: sampleData?.networkType || active?.sampleData?.networkType || 'Wi-Fi (5 GHz)',
      storageUsedGb: sampleData?.storageUsedGb ?? active?.sampleData?.storageUsedGb ?? 42.4,
      storageTotalGb: sampleData?.storageTotalGb ?? active?.sampleData?.storageTotalGb ?? 128,
      ramUsedGb: sampleData?.ramUsedGb ?? active?.sampleData?.ramUsedGb ?? 5.1,
      ramTotalGb: sampleData?.ramTotalGb ?? active?.sampleData?.ramTotalGb ?? 12.0,
    },
  };

  registeredDevices.set(devId, newDevice);
  if (active) {
    activePairingCodes.delete(cleanCode);
  }
  savePersistedDevices();

  const { authToken, ...safeDev } = newDevice;
  void authToken;
  return res.json({
    data: {
      success: true,
      device: safeDev,
    },
  });
});

devicesRouter.post('/api/devices/agent/report', (req, res) => {
  const { deviceId, batteryLevel, isCharging, networkType, storageUsedGb, storageTotalGb, ramUsedGb, ramTotalGb, androidVersion, model, status } = req.body;
  if (!deviceId || typeof deviceId !== 'string') {
    return errorResponse(res, 400, 'Device ID is required.');
  }

  let dev = registeredDevices.get(deviceId);
  if (!dev) {
    dev = {
      id: deviceId,
      type: 'android',
      name: 'Android Agent',
      status: status || 'online',
      pairedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      permissions: {
        batteryInfo: true,
        storageInfo: true,
        networkInfo: true,
        deviceControl: false,
        backgroundMonitoring: false,
      },
      android: {},
    };
    registeredDevices.set(deviceId, dev);
  }

  dev.lastSeen = new Date().toISOString();
  if (status) dev.status = status;
  dev.android = {
    ...dev.android,
    ...(model ? { model } : {}),
    ...(androidVersion ? { androidVersion } : {}),
    ...(batteryLevel !== undefined ? { batteryLevel: Number(batteryLevel) } : {}),
    ...(isCharging !== undefined ? { isCharging: Boolean(isCharging) } : {}),
    ...(networkType ? { networkType } : {}),
    ...(storageUsedGb !== undefined ? { storageUsedGb: Number(storageUsedGb) } : {}),
    ...(storageTotalGb !== undefined ? { storageTotalGb: Number(storageTotalGb) } : {}),
    ...(ramUsedGb !== undefined ? { ramUsedGb: Number(ramUsedGb) } : {}),
    ...(ramTotalGb !== undefined ? { ramTotalGb: Number(ramTotalGb) } : {}),
  };
  savePersistedDevices();

  return res.json({
    data: {
      success: true,
      lastSeen: dev.lastSeen,
    },
  });
});

// =========================================================================
// REAL NETWORK SCANNER ENDPOINTS
// =========================================================================
devicesRouter.get('/api/devices/network/info', (_req, res) => {
  const netInfo = getLocalNetworkInfo();
  return res.json({ data: netInfo });
});

devicesRouter.get('/api/devices/network/discovered', (_req, res) => {
  syncPairedStatusToDiscovered();
  const list = Array.from(discoveredNetworkDevices.values()).sort((a, b) => {
    if (a.isPaired && !b.isPaired) return -1;
    if (!a.isPaired && b.isPaired) return 1;
    return a.ip.localeCompare(b.ip, undefined, { numeric: true });
  });
  return res.json({
    data: {
      devices: list,
      count: list.length,
    },
  });
});

devicesRouter.post('/api/devices/network/ping', async (req, res) => {
  const { ip, port } = req.body || {};
  const cleanIp = typeof ip === 'string' ? ip.trim() : '';
  const numPort = Number(port) || 80;

  if (!cleanIp) {
    return errorResponse(res, 400, 'IP address is required for ping.');
  }

  const testRes = await testTvSocketConnection(cleanIp, numPort, 1200);
  return res.json({
    data: {
      ip: cleanIp,
      port: numPort,
      reachable: testRes.reachable,
      latencyMs: testRes.latencyMs,
      error: testRes.error,
    },
  });
});

devicesRouter.post('/api/devices/network/scan', async (req, res) => {
  const { subnet, localIp } = req.body || {};
  let targetPrefix: string | null = null;

  if (typeof subnet === 'string' && subnet.includes('.')) {
    const parts = subnet.trim().split('/')[0].split('.');
    if (parts.length >= 3) {
      targetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  } else if (typeof localIp === 'string' && localIp.includes('.')) {
    const lastDot = localIp.trim().lastIndexOf('.');
    if (lastDot > 0) {
      targetPrefix = localIp.trim().substring(0, lastDot);
    }
  }

  if (!targetPrefix) {
    const netInfo = getLocalNetworkInfo();
    if (netInfo.localIp && netInfo.localIp.includes('.')) {
      const lastDot = netInfo.localIp.lastIndexOf('.');
      targetPrefix = netInfo.localIp.substring(0, lastDot);
    }
  }

  if (!targetPrefix) {
    return res.json({
      data: {
        devices: Array.from(discoveredNetworkDevices.values()),
        count: discoveredNetworkDevices.size,
        message: 'No direct local IPv4 subnet found on host container. Discovered devices from Android Agent or previous scans are shown.',
        scannedSubnet: null,
        timestamp: Date.now(),
      },
    });
  }

  const startScanTime = Date.now();
  const discoveredThisScan: DiscoveredNetworkDeviceServer[] = [];
  const BATCH_SIZE = 25;

  // Scan hosts 1 to 254 in safe concurrent batches
  for (let batchStart = 1; batchStart <= 254; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(254, batchStart + BATCH_SIZE - 1);
    const batchIps: string[] = [];
    for (let i = batchStart; i <= batchEnd; i++) {
      batchIps.push(`${targetPrefix}.${i}`);
    }

    const batchResults = await Promise.all(
      batchIps.map(async (ip) => {
        try {
          return await probeAndIdentifyHost(ip);
        } catch {
          return null;
        }
      }),
    );

    for (const dev of batchResults) {
      if (dev) {
        discoveredThisScan.push(dev);
      }
    }
  }

  syncPairedStatusToDiscovered();
  const allDiscovered = Array.from(discoveredNetworkDevices.values()).sort((a, b) => {
    if (a.isPaired && !b.isPaired) return -1;
    if (!a.isPaired && b.isPaired) return 1;
    return a.ip.localeCompare(b.ip, undefined, { numeric: true });
  });

  return res.json({
    data: {
      devices: allDiscovered,
      count: allDiscovered.length,
      newlyDiscoveredCount: discoveredThisScan.length,
      scannedSubnet: `${targetPrefix}.0/24`,
      durationMs: Date.now() - startScanTime,
      timestamp: Date.now(),
    },
  });
});

devicesRouter.post('/api/devices/network/report-scan', (req, res) => {
  const { devices, scannedSubnet } = req.body || {};
  if (!Array.isArray(devices)) {
    return errorResponse(res, 400, 'devices array is required.');
  }

  for (const rawDev of devices) {
    if (!rawDev || typeof rawDev.ip !== 'string') continue;
    const ip = rawDev.ip.trim();
    const id = rawDev.id || `disc_${ip.replace(/\./g, '_')}`;

    let isPaired = false;
    let pairedDeviceId: string | undefined = undefined;
    let devName = rawDev.name || `Device (${ip})`;

    for (const regDev of registeredDevices.values()) {
      if (regDev.ipAddress && regDev.ipAddress.trim() === ip) {
        isPaired = true;
        pairedDeviceId = regDev.id;
        devName = regDev.name;
        break;
      }
    }

    const discDev: DiscoveredNetworkDeviceServer = {
      id,
      ip,
      name: devName,
      macAddress: rawDev.macAddress || 'Unavailable on this Android version',
      type: rawDev.type || 'unknown',
      subType: rawDev.subType || 'Network Device',
      manufacturer: rawDev.manufacturer,
      status: isPaired ? 'paired' : (rawDev.status || 'reachable'),
      detectedServices: Array.isArray(rawDev.detectedServices) ? rawDev.detectedServices : [],
      latencyMs: typeof rawDev.latencyMs === 'number' ? rawDev.latencyMs : undefined,
      lastDiscovered: rawDev.lastDiscovered || new Date().toISOString(),
      isPaired,
      pairedDeviceId,
    };

    discoveredNetworkDevices.set(id, discDev);
  }

  syncPairedStatusToDiscovered();
  const allDiscovered = Array.from(discoveredNetworkDevices.values());

  return res.json({
    data: {
      success: true,
      count: allDiscovered.length,
      scannedSubnet: scannedSubnet || null,
      devices: allDiscovered,
    },
  });
});

// Smart TV Integration Endpoints
devicesRouter.post('/api/devices/tv/test', async (req, res) => {
  const { ipAddress, port, method } = req.body || {};
  const cleanIp = typeof ipAddress === 'string' ? ipAddress.trim() : '';
  const numPort = Number(port) || 5555;

  const testRes = await testTvSocketConnection(cleanIp, numPort);
  const methodStr = typeof method === 'string' ? method : 'android_tv';

  return res.json({
    data: {
      success: testRes.reachable,
      reachable: testRes.reachable,
      error: testRes.error,
      latencyMs: testRes.latencyMs,
      model: testRes.reachable
        ? (methodStr === 'webos' ? 'LG webOS TV' : methodStr === 'google_tv' ? 'Google TV' : 'Android TV')
        : undefined,
    },
  });
});

devicesRouter.post('/api/devices/tv/connect', async (req, res) => {
  const { name, ipAddress, port, method, model } = req.body || {};
  const cleanIp = typeof ipAddress === 'string' ? ipAddress.trim() : '';
  const numPort = Number(port) || 5555;
  const methodStr = method === 'webos' ? 'webos' : method === 'google_tv' ? 'google_tv' : 'android_tv';

  if (!cleanIp) {
    return errorResponse(res, 400, 'TV IP address is required.');
  }

  // Perform REAL socket connection check
  const testRes = await testTvSocketConnection(cleanIp, numPort);
  const now = new Date().toISOString();

  // Remove previous TV entries so single TV remains active
  for (const [key, dev] of registeredDevices.entries()) {
    if (dev.type === 'tv') {
      registeredDevices.delete(key);
    }
  }

  const devId = `tv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newTvDevice: NexusDeviceServer = {
    id: devId,
    type: 'tv',
    name: typeof name === 'string' && name.trim() ? name.trim() : (typeof model === 'string' && model.trim() ? model.trim() : 'Smart TV'),
    status: testRes.reachable ? 'online' : 'offline',
    pairedAt: now,
    lastSeen: now,
    lastSuccessfulConnection: testRes.reachable ? now : undefined,
    connectionError: testRes.reachable ? undefined : (testRes.error || 'Connection failed: Host unreachable'),
    ipAddress: cleanIp,
    permissions: {
      batteryInfo: false,
      storageInfo: false,
      networkInfo: true,
      deviceControl: true,
      backgroundMonitoring: false,
    },
    tv: {
      model: typeof model === 'string' && model.trim()
        ? model.trim()
        : (testRes.reachable
            ? (methodStr === 'webos' ? 'LG webOS TV' : methodStr === 'google_tv' ? 'Google TV' : 'Android TV')
            : 'Model Not Detected (Offline)'),
      powerState: testRes.reachable ? 'ON' : 'STANDBY',
      volume: 24,
      isMuted: false,
      method: methodStr,
      port: numPort,
      ipAddress: cleanIp,
      lastAction: 'connect',
      reachable: testRes.reachable,
      connectionError: testRes.reachable ? undefined : testRes.error,
    },
  };

  registeredDevices.set(devId, newTvDevice);
  savePersistedDevices();

  const { authToken, ...safeDev } = newTvDevice;
  void authToken;

  return res.json({
    data: {
      success: true,
      reachable: testRes.reachable,
      warning: testRes.reachable ? undefined : testRes.error,
      device: safeDev,
    },
  });
});

devicesRouter.post('/api/devices/tv/refresh', async (req, res) => {
  const { deviceId } = req.body || {};
  let targetDev: NexusDeviceServer | null = null;
  if (deviceId && typeof deviceId === 'string') {
    const d = registeredDevices.get(deviceId);
    if (d && d.type === 'tv') targetDev = d;
  }
  if (!targetDev) {
    targetDev = getFirstConnectedTv();
  }

  if (!targetDev || !targetDev.tv) {
    return errorResponse(res, 404, 'No Smart TV configured to refresh.');
  }

  const testRes = await testTvSocketConnection(targetDev.ipAddress || '', targetDev.tv.port || 5555);
  const now = new Date().toISOString();

  if (testRes.reachable) {
    targetDev.status = 'online';
    targetDev.lastSeen = now;
    targetDev.lastSuccessfulConnection = now;
    targetDev.connectionError = undefined;
    targetDev.tv.reachable = true;
    targetDev.tv.connectionError = undefined;
  } else {
    targetDev.status = 'offline';
    targetDev.lastSeen = now;
    targetDev.connectionError = testRes.error || 'Connection failed: Host unreachable';
    targetDev.tv.reachable = false;
    targetDev.tv.connectionError = testRes.error || 'Connection failed: Host unreachable';
  }

  savePersistedDevices();

  const { authToken, ...safeDev } = targetDev;
  void authToken;

  return res.json({
    data: {
      success: true,
      reachable: testRes.reachable,
      device: safeDev,
      message: testRes.reachable ? 'Connection verified successfully.' : (testRes.error || 'TV host unreachable'),
    },
  });
});

devicesRouter.post('/api/devices/tv/control', (req, res) => {
  const { action, deviceId, value } = req.body || {};
  const validActions = [
    'power',
    'volume_up',
    'volume_down',
    'mute',
    'home',
    'back',
    'up',
    'down',
    'left',
    'right',
    'ok',
    'play_pause',
    'get_tv_status',
  ];

  if (!action || typeof action !== 'string' || !validActions.includes(action)) {
    return errorResponse(res, 400, 'Invalid TV command. Only predefined TV actions are allowed.');
  }

  let targetDev: NexusDeviceServer | null = null;
  if (deviceId && typeof deviceId === 'string') {
    const d = registeredDevices.get(deviceId);
    if (d && d.type === 'tv') targetDev = d;
  }
  if (!targetDev) {
    targetDev = getFirstConnectedTv();
  }

  if (!targetDev || !targetDev.tv) {
    return errorResponse(res, 404, 'No Smart TV configured.');
  }

  if (targetDev.status !== 'online' && action !== 'get_tv_status') {
    return errorResponse(
      res,
      400,
      `TV is disconnected (${targetDev.connectionError || 'Host unreachable'}). Cannot execute remote command. Ensure the Smart TV is powered on, connected to the network, and reachable.`,
    );
  }

  const toolName =
    action.startsWith('tv_') || action === 'get_tv_status'
      ? action
      : action === 'power'
        ? 'tv_power'
        : action === 'volume_up'
          ? 'tv_volume_up'
          : action === 'volume_down'
            ? 'tv_volume_down'
            : action === 'mute'
              ? 'tv_mute'
              : action === 'home'
                ? 'tv_home'
                : action === 'back'
                  ? 'tv_back'
                  : action === 'play_pause'
                    ? 'tv_play_pause'
                    : 'tv_navigation';

  const result = executeTvTool(toolName, {
    deviceId: targetDev.id,
    direction: action,
    value: typeof value === 'number' ? value : undefined,
  });

  return res.json({
    data: {
      success: result.success,
      action,
      tvState: result.tv,
      message: result.result,
    },
  });
});

devicesRouter.get('/api/devices/tv/status', (req, res) => {
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
  let targetDev: NexusDeviceServer | null = null;
  if (deviceId) {
    const d = registeredDevices.get(deviceId);
    if (d && d.type === 'tv') targetDev = d;
  }
  if (!targetDev) {
    targetDev = getFirstConnectedTv();
  }

  if (!targetDev || !targetDev.tv) {
    return res.json({
      data: {
        connected: false,
        message: 'No Smart TV is currently configured.',
      },
    });
  }

  targetDev.lastSeen = new Date().toISOString();
  const { authToken, ...safeDev } = targetDev;
  void authToken;

  return res.json({
    data: {
      connected: targetDev.status === 'online',
      device: safeDev,
      tv: targetDev.tv,
    },
  });
});

// Parameterized device routes (must be mounted after static /api/devices/* routes)
devicesRouter.get('/api/devices/:id', (req, res) => {
  const dev = registeredDevices.get(req.params.id);
  if (!dev) {
    return errorResponse(res, 404, 'Device not found.');
  }
  const { authToken, ...safeDev } = dev;
  void authToken;
  return res.json({ data: safeDev });
});

devicesRouter.get('/api/devices/:id/status', (req, res) => {
  const dev = registeredDevices.get(req.params.id);
  if (!dev) {
    return errorResponse(res, 404, 'Device not found.');
  }
  // Refresh heartbeat
  dev.lastSeen = new Date().toISOString();
  const { authToken, ...safeDev } = dev;
  void authToken;
  return res.json({
    data: {
      status: dev.status,
      lastSeen: dev.lastSeen,
      device: safeDev,
    },
  });
});

devicesRouter.post('/api/devices/:id/disconnect', (req, res) => {
  const dev = registeredDevices.get(req.params.id);
  if (!dev) {
    return errorResponse(res, 404, 'Device not found.');
  }
  registeredDevices.delete(req.params.id);
  savePersistedDevices();
  return res.json({ data: { success: true } });
});

devicesRouter.put('/api/devices/:id/permissions', (req, res) => {
  const dev = registeredDevices.get(req.params.id);
  if (!dev) {
    return errorResponse(res, 404, 'Device not found.');
  }
  const incoming = req.body?.permissions;
  if (!incoming || typeof incoming !== 'object') {
    return errorResponse(res, 400, 'Invalid permissions payload.');
  }

  dev.permissions = {
    batteryInfo: Boolean(incoming.batteryInfo),
    storageInfo: Boolean(incoming.storageInfo),
    networkInfo: Boolean(incoming.networkInfo),
    deviceControl: Boolean(incoming.deviceControl),
    backgroundMonitoring: Boolean(incoming.backgroundMonitoring),
  };
  savePersistedDevices();

  return res.json({
    data: {
      success: true,
      permissions: dev.permissions,
    },
  });
});

export default devicesRouter;
