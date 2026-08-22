import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { api } from '@/services/api';

function getDeviceId(): string {
  const key = 'nexus-agent-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'agent_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

async function reportOnce() {
  try {
    const deviceId = getDeviceId();
    const info = await Device.getInfo();
    const battery = await Device.getBatteryInfo();
    const net = await Network.getStatus();

    let networkType = 'Unknown';
    if (net.connected) {
      networkType = net.connectionType === 'wifi' ? 'Wi-Fi' : net.connectionType === 'cellular' ? 'Mobile Data' : net.connectionType;
    } else {
      networkType = 'Offline';
    }

    // Real storage usage/quota, in GB
    let storageUsedGb: number | undefined;
    let storageTotalGb: number | undefined;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined) storageUsedGb = Math.round((est.usage / 1e9) * 10) / 10;
        if (est.quota !== undefined) storageTotalGb = Math.round((est.quota / 1e9) * 10) / 10;
      }
    } catch {
      // storage estimate not supported, skip
    }

    // Approximate total device RAM (Chrome-only, no "used" value available for privacy reasons)
    const ramTotalGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

    await api.reportAgentTelemetry({
      deviceId,
      model: info.model,
      androidVersion: info.osVersion,
      batteryLevel: battery.batteryLevel !== undefined ? Math.round(battery.batteryLevel * 100) : undefined,
      isCharging: battery.isCharging,
      networkType,
      storageUsedGb,
      storageTotalGb,
      ramTotalGb,
      status: 'online',
    });
  } catch (err) {
    console.warn('[DeviceAgent] Failed to report telemetry:', err);
  }
}

export function startDeviceAgent() {
  if (!Capacitor.isNativePlatform()) return; // Only run on real Android app, not website
  reportOnce();
  setInterval(reportOnce, 60000); // Report every 60 seconds
}
