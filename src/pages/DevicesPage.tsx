import { useCallback, useEffect, useState } from 'react';
import {
  Smartphone,
  Tv,
  Monitor,
  Music,
  Sliders,
  BatteryCharging,
  Battery,
  Wifi,
  HardDrive,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  Shield,
  Power,
  Volume2,
  Volume1,
  VolumeX,
  Home,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Play,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { api } from '@/services/api';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import type { NexusDevice, DevicePermissions, DeviceStatus, TVConnectionMethod, TVControlAction } from '@/types';

export function DevicesPage() {
  const [settings] = useSettings();
  const [devices, setDevices] = useState<NexusDevice[]>([]);
  const [overview, setOverview] = useState({ online: 0, warning: 0, offline: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Panels state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailsModalDevice, setDetailsModalDevice] = useState<NexusDevice | null>(null);
  const [comingSoonNotice, setComingSoonNotice] = useState<string | null>(null);

  // Smart TV state & modal
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const [tvIpInput, setTvIpInput] = useState('');
  const [tvPortInput, setTvPortInput] = useState('5555');
  const [tvMethodInput, setTvMethodInput] = useState<TVConnectionMethod>('google_tv');
  const [tvNameInput, setTvNameInput] = useState('');
  const [tvTesting, setTvTesting] = useState(false);
  const [tvTestStatus, setTvTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [tvTestError, setTvTestError] = useState<string | null>(null);
  const [tvTestLatency, setTvTestLatency] = useState<number | null>(null);
  const [isTvConnecting, setIsTvConnecting] = useState(false);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [activeTvAction, setActiveTvAction] = useState<string | null>(null);
  const [tvActionLoading, setTvActionLoading] = useState(false);
  const [tvRefreshing, setTvRefreshing] = useState(false);

  // Add Device wizard state
  const [addStep, setAddStep] = useState<'select' | 'android-pair'>('select');
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState(false);
  const [generatedTestCode, setGeneratedTestCode] = useState<string | null>(null);

  // Permissions state for details modal
  const [editingPermissions, setEditingPermissions] = useState<DevicePermissions>({
    batteryInfo: true,
    storageInfo: true,
    networkInfo: true,
    deviceControl: false,
    backgroundMonitoring: false,
  });
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsSavedSuccess, setPermissionsSavedSuccess] = useState(false);

  // Disconnect Confirmation Modal state
  const [deviceToDisconnect, setDeviceToDisconnect] = useState<NexusDevice | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchDevices = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await api.getDevices();
      setDevices(res.devices || []);
      setOverview(res.overview || { online: 0, warning: 0, offline: 0, total: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch connected devices.';
      setError(msg);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    // Poll status every 30 seconds
    const interval = setInterval(() => {
      fetchDevices(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleRefresh = () => {
    if (settings.sound !== false) playTapSound();
    setRefreshing(true);
    fetchDevices(true);
  };

  const openTvPairingModal = () => {
    if (settings.sound !== false) playTapSound();
    setTvIpInput('');
    setTvPortInput('5555');
    setTvMethodInput('google_tv');
    setTvNameInput('');
    setTvTestStatus('idle');
    setTvTestError(null);
    setTvTestLatency(null);
    setTvModalOpen(true);
  };

  const handleOpenAddModal = () => {
    if (settings.sound !== false) playTapSound();
    setAddStep('select');
    setPairingCodeInput('');
    setDeviceNameInput('');
    setPairError(null);
    setPairSuccess(false);
    setGeneratedTestCode(null);
    setAddModalOpen(true);
  };

  const handleSelectDeviceType = (type: 'android' | 'tv' | 'computer' | 'smarthome') => {
    if (settings.sound !== false) playTapSound();
    if (type === 'android') {
      setAddStep('android-pair');
    } else if (type === 'tv') {
      setAddModalOpen(false);
      openTvPairingModal();
    } else if (type === 'computer') {
      setComingSoonNotice('Computer/Cloud Agent daemon integration coming soon.');
    } else {
      setComingSoonNotice('Smart Home ecosystem integrations coming soon.');
    }
  };

  const handleTestTvConnection = async () => {
    if (settings.sound !== false) playTapSound();
    setTvTesting(true);
    setTvTestStatus('testing');
    setTvTestError(null);
    try {
      const res = await api.testTVConnection(tvIpInput.trim(), Number(tvPortInput) || 5555, tvMethodInput);
      if (res.reachable) {
        setTvTestStatus('connected');
        setTvTestLatency(res.latencyMs || 12);
      } else {
        setTvTestStatus('failed');
        setTvTestError(res.error || 'Connection failed: Host unreachable');
      }
    } catch (err: unknown) {
      setTvTestStatus('failed');
      const msg = err instanceof Error ? err.message : 'Connection failed. TV host unreachable.';
      setTvTestError(msg);
    } finally {
      setTvTesting(false);
    }
  };

  const handleConnectTv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.sound !== false) playTapSound();
    if (!tvIpInput.trim()) {
      setTvTestStatus('failed');
      setTvTestError('Please enter a TV IP address.');
      return;
    }

    setIsTvConnecting(true);
    setTvTestStatus('testing');
    setTvTestError(null);

    try {
      const res = await api.connectTV({
        name: tvNameInput.trim() || undefined,
        ipAddress: tvIpInput.trim(),
        port: Number(tvPortInput) || 5555,
        method: tvMethodInput,
      });
      if (res.success) {
        setTvTestStatus('connected');
        setTimeout(() => {
          setTvModalOpen(false);
          setAddModalOpen(false);
          fetchDevices(true);
        }, 900);
      }
    } catch (err: unknown) {
      setTvTestStatus('failed');
      const msg = err instanceof Error ? err.message : 'Connection failed. Please verify TV IP and port.';
      setTvTestError(msg);
    } finally {
      setIsTvConnecting(false);
    }
  };

  const handleTvControl = async (action: TVControlAction, value?: unknown) => {
    if (settings.sound !== false) playTapSound();
    const currentTv = devices.find((d) => d.type === 'tv');
    if (!currentTv) return;

    if (currentTv.status !== 'online') {
      setError(`Cannot send "${action}" command: TV is Disconnected (${currentTv.connectionError || 'Host unreachable'}). Ensure the TV is powered on, connected to the local network, and reachable.`);
      return;
    }

    setActiveTvAction(action);
    setTvActionLoading(true);

    try {
      const res = await api.controlTV(action, currentTv.id, value);
      if (res.success && res.tvState) {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === currentTv.id
              ? {
                  ...d,
                  lastSeen: new Date().toISOString(),
                  tv: {
                    ...d.tv,
                    ...res.tvState,
                  },
                }
              : d,
          ),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send TV command.';
      setError(msg);
    } finally {
      setTvActionLoading(false);
      setTimeout(() => {
        setActiveTvAction((prev) => (prev === action ? null : prev));
      }, 1800);
    }
  };

  const handleTvRefresh = async () => {
    if (settings.sound !== false) playTapSound();
    const currentTv = devices.find((d) => d.type === 'tv');
    if (!currentTv) return;

    setTvRefreshing(true);
    try {
      const res = await api.refreshTV(currentTv.id);
      if (res.success && res.device) {
        setDevices((prev) =>
          prev.map((d) => (d.id === currentTv.id ? { ...res.device } : d)),
        );
      } else {
        await fetchDevices(true);
      }
    } catch {
      await fetchDevices(true);
    } finally {
      setTvRefreshing(false);
    }
  };

  const handleGenerateTestCode = async () => {
    if (settings.sound !== false) playTapSound();
    try {
      const res = await api.generatePairingCode();
      setGeneratedTestCode(res.pairingCode);
      setPairingCodeInput(res.pairingCode);
      setPairError(null);
    } catch {
      setPairError('Failed to generate test pairing code.');
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.sound !== false) playTapSound();
    if (!pairingCodeInput.trim()) {
      setPairError('Please enter a pairing code.');
      return;
    }

    setIsPairing(true);
    setPairError(null);

    try {
      const res = await api.pairDevice(
        pairingCodeInput.trim(),
        deviceNameInput.trim() || undefined,
      );
      if (res.success) {
        setPairSuccess(true);
        setTimeout(() => {
          setAddModalOpen(false);
          fetchDevices(true);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pairing failed. Please verify your code.';
      setPairError(msg);
    } finally {
      setIsPairing(false);
    }
  };

  const handleOpenDetails = (device: NexusDevice) => {
    if (settings.sound !== false) playTapSound();
    setDetailsModalDevice(device);
    setEditingPermissions({ ...device.permissions });
    setPermissionsSavedSuccess(false);
  };

  const handleSavePermissions = async () => {
    if (!detailsModalDevice) return;
    if (settings.sound !== false) playTapSound();
    setSavingPermissions(true);
    setPermissionsSavedSuccess(false);
    try {
      const res = await api.updateDevicePermissions(detailsModalDevice.id, editingPermissions);
      if (res.success) {
        setPermissionsSavedSuccess(true);
        setDetailsModalDevice((prev) => (prev ? { ...prev, permissions: res.permissions } : null));
        fetchDevices(true);
        setTimeout(() => setPermissionsSavedSuccess(false), 2500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update permissions.';
      setError(msg);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleOpenDisconnectModal = (device: NexusDevice) => {
    if (settings.sound !== false) playTapSound();
    setDeviceToDisconnect(device);
  };

  const handleConfirmDisconnect = async () => {
    if (!deviceToDisconnect) return;
    if (settings.sound !== false) playTapSound();
    setIsDisconnecting(true);

    try {
      await api.disconnectDevice(deviceToDisconnect.id);
      const disconnectedId = deviceToDisconnect.id;
      setDevices((prev) => prev.filter((d) => d.id !== disconnectedId));
      if (detailsModalDevice?.id === disconnectedId) {
        setDetailsModalDevice(null);
      }
      setDeviceToDisconnect(null);
      fetchDevices(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect device.';
      setError(msg);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Warning
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Unknown
          </span>
        );
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Never';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-mono text-cyan-400">Device Ecosystem</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <span>📱</span> NEXUS Devices
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Manage and monitor your connected devices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors disabled:opacity-50"
            title="Refresh device statuses"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Connected Devices</div>
          <div className="text-2xl font-bold text-white mt-1.5 flex items-baseline gap-2">
            <span>{overview.total}</span>
            <span className="text-xs text-slate-400 font-normal">registered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 backdrop-blur-md">
          <div className="text-xs font-medium text-emerald-400/90 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{overview.online}</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 backdrop-blur-md">
          <div className="text-xs font-medium text-amber-400/90 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Warning
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1.5">{overview.warning}</div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-500/[0.04] border border-rose-500/20 backdrop-blur-md">
          <div className="text-xs font-medium text-rose-400/90 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Offline
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1.5">{overview.offline}</div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} className="text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Coming Soon Alert Banner */}
      {comingSoonNotice && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info size={17} className="text-cyan-400 flex-shrink-0" />
            <span>{comingSoonNotice}</span>
          </div>
          <button onClick={() => setComingSoonNotice(null)} className="text-cyan-300 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Content Sections */}
      <div className="space-y-8">
        {/* Section 1: Connected Android Devices Grid / Empty State */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Smartphone size={18} className="text-cyan-400" />
              <span>📱 Android Agent Devices</span>
            </h2>
            <span className="text-xs text-slate-400">
              {devices.filter((d) => d.type === 'android').length} phone{devices.filter((d) => d.type === 'android').length === 1 ? '' : 's'} paired
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10">
              <RefreshCw size={24} className="animate-spin text-cyan-400 mx-auto mb-3" />
              <p className="text-sm text-slate-300">Loading connected devices...</p>
            </div>
          ) : devices.filter((d) => d.type === 'android').length === 0 ? (
            /* Empty State */
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-md">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-inner">
                <Smartphone size={30} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">📱 No Android devices connected</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                Pair your Android Agent APK to monitor battery telemetry, available storage, network speed, and live health metrics directly in NEXUS.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30 transition-all hover:scale-[1.02]"
              >
                <Plus size={16} />
                <span>＋ Add Android Agent</span>
              </button>
            </div>
          ) : (
            /* Connected Android Devices Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices
                .filter((d) => d.type === 'android')
                .map((device) => {
                  const android = device.android || {};
                  const battery = android.batteryLevel;
                  const isCharging = android.isCharging;
                  const network = android.networkType;
                  const storageUsed = android.storageUsedGb;
                  const storageTotal = android.storageTotalGb || 128;
                  const androidVer = android.androidVersion;
                  const model = android.model || 'Android Agent';

                  return (
                    <div
                      key={device.id}
                      className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/10 backdrop-blur-md flex flex-col justify-between gap-5 hover:border-cyan-500/30 transition-all shadow-lg"
                    >
                      {/* Device Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                            <Smartphone size={22} />
                          </div>
                          <div>
                            <div className="font-bold text-white text-base leading-snug">{device.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{model}</span>
                              {androidVer && <span>• Android {androidVer}</span>}
                            </div>
                          </div>
                        </div>
                        <div>{getStatusBadge(device.status)}</div>
                      </div>

                      {/* Telemetry Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 border-y border-white/5 text-xs">
                        {battery !== undefined && (
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="text-slate-400 flex items-center gap-1 mb-1">
                              {isCharging ? (
                                <BatteryCharging size={14} className="text-emerald-400" />
                              ) : (
                                <Battery size={14} className="text-cyan-400" />
                              )}
                              <span>Battery</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {battery}%
                              {isCharging && <span className="text-[10px] text-emerald-400 ml-1 font-normal">(Charging)</span>}
                            </div>
                          </div>
                        )}

                        {network && (
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="text-slate-400 flex items-center gap-1 mb-1">
                              <Wifi size={14} className="text-cyan-400" />
                              <span>Network</span>
                            </div>
                            <div className="font-bold text-white text-sm truncate" title={network}>
                              {network}
                            </div>
                          </div>
                        )}

                        {storageUsed !== undefined && (
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="text-slate-400 flex items-center gap-1 mb-1">
                              <HardDrive size={14} className="text-cyan-400" />
                              <span>Storage</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {storageUsed} <span className="text-slate-400 font-normal text-xs">/ {storageTotal} GB</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Info & Actions */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <div className="text-[11px] text-slate-400">
                          Last seen: <span className="text-slate-300">{formatTimestamp(device.lastSeen)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDisconnectModal(device)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                            title="Disconnect device"
                          >
                            Disconnect
                          </button>

                          <button
                            onClick={() => handleOpenDetails(device)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors flex items-center gap-1"
                          >
                            <span>View Details</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Section 2: Smart TV Section */}
        {(() => {
          const connectedTv = devices.find((d) => d.type === 'tv');

          if (!connectedTv) {
            return (
              <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Tv size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">📺 Smart TV</h3>
                      <p className="text-xs text-slate-400">Android TV / Google TV / webOS TV</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                      No Smart TV connected
                    </span>
                    <button
                      onClick={openTvPairingModal}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus size={14} />
                      <span>+ Add Smart TV</span>
                    </button>
                  </div>
                </div>

                {/* Locked Preview Keypad */}
                <div className="border border-white/5 rounded-xl p-5 bg-black/20">
                  <div className="flex items-center gap-2 mb-3 text-xs text-purple-300/90 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                    <Lock size={14} className="flex-shrink-0 text-purple-400" />
                    <span>No Smart TV is currently connected. Click <strong>+ Add Smart TV</strong> to enter your TV's IP address and pair your screen.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center opacity-40">
                    {/* Directional Pad */}
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-2">Directional Remote Pad</div>
                      <div className="relative w-44 h-44 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center shadow-inner cursor-not-allowed">
                        <button disabled className="absolute top-2 text-slate-400 p-2"><ChevronUp size={20} /></button>
                        <button disabled className="absolute bottom-2 text-slate-400 p-2"><ChevronDown size={20} /></button>
                        <button disabled className="absolute left-2 text-slate-400 p-2"><ChevronLeft size={20} /></button>
                        <button disabled className="absolute right-2 text-slate-400 p-2"><ChevronRight size={20} /></button>
                        <button disabled className="w-14 h-14 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-300 flex items-center justify-center shadow">
                          OK
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons Pad */}
                    <div className="space-y-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Control Keypad</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <Power size={15} className="text-rose-400" />
                          <span>Power</span>
                        </button>
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <Volume2 size={15} className="text-cyan-400" />
                          <span>Vol +</span>
                        </button>
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <VolumeX size={15} className="text-amber-400" />
                          <span>Mute</span>
                        </button>
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <Home size={15} className="text-purple-400" />
                          <span>Home</span>
                        </button>
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <Volume1 size={15} className="text-cyan-400" />
                          <span>Vol -</span>
                        </button>
                        <button disabled className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 flex flex-col items-center gap-1 cursor-not-allowed">
                          <ArrowLeft size={15} className="text-slate-400" />
                          <span>Back</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const isOnline = connectedTv.status === 'online' && connectedTv.tv?.reachable !== false;

          return (
            <div className={`p-6 rounded-2xl border backdrop-blur-md shadow-xl transition-colors ${
              isOnline
                ? 'bg-gradient-to-b from-purple-950/20 to-white/[0.02] border-purple-500/30'
                : 'bg-gradient-to-b from-rose-950/15 to-white/[0.02] border-rose-500/30'
            }`}>
              {/* TV Device Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner ${
                    isOnline
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  }`}>
                    <Tv size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg">📺 Smart TV</h3>
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          Disconnected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span><span className="text-slate-400">Device name:</span> <strong className="text-white">{connectedTv.name}</strong></span>
                      <span>•</span>
                      <span><span className="text-slate-400">Model:</span> <strong className={isOnline ? 'text-purple-300' : 'text-slate-400'}>{connectedTv.tv?.model || 'Model Not Detected'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* TV Card Buttons: [Control TV], [Refresh], [Disconnect] */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsRemoteExpanded((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isRemoteExpanded
                        ? 'bg-purple-500/30 text-purple-200 border-purple-400/50 shadow-md shadow-purple-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                    }`}
                  >
                    <Sliders size={14} className="text-purple-400" />
                    <span>{isRemoteExpanded ? 'Hide Remote' : 'Control TV'}</span>
                  </button>

                  <button
                    onClick={handleTvRefresh}
                    disabled={tvRefreshing}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={tvRefreshing ? 'animate-spin text-purple-400' : 'text-slate-400'} />
                    <span>{tvRefreshing ? 'Checking...' : 'Refresh'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDisconnectModal(connectedTv)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>

              {/* Offline Diagnostic Reason Banner */}
              {!isOnline && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">
                      TV is Disconnected: {connectedTv.connectionError || 'Host unreachable'}
                    </p>
                    <p className="text-rose-300/80 text-[11px]">
                      NEXUS could not establish a connection to <code className="font-mono text-white bg-black/40 px-1.5 py-0.5 rounded">{connectedTv.ipAddress}:{connectedTv.tv?.port || 5555}</code>. Ensure the TV is turned ON, connected to the same local network, and allows control on port {connectedTv.tv?.port || 5555}. Click <strong>Refresh</strong> to re-check.
                    </p>
                  </div>
                </div>
              )}

              {/* TV Telemetry Status Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-white/10 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-slate-400 font-mono text-[11px]">Connection</div>
                  <div className={`text-sm font-semibold flex items-center gap-1.5 mt-0.5 ${
                    isOnline ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {isOnline ? 'Connected' : 'Disconnected'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-slate-400 font-mono text-[11px]">IP &amp; Port</div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">
                    {connectedTv.ipAddress ? `${connectedTv.ipAddress}:${connectedTv.tv?.port || 5555}` : 'Not configured'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-slate-400 font-mono text-[11px]">Power &amp; Volume</div>
                  <div className="text-sm font-semibold text-purple-300 mt-0.5">
                    {isOnline
                      ? `${connectedTv.tv?.powerState || 'ON'} • ${connectedTv.tv?.isMuted ? 'Muted' : `${connectedTv.tv?.volume ?? 24}%`}`
                      : 'Offline'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-slate-400 font-mono text-[11px]">Last Verified</div>
                  <div className="text-sm font-semibold text-slate-300 mt-0.5">
                    {connectedTv.lastSuccessfulConnection ? formatTimestamp(connectedTv.lastSuccessfulConnection) : 'Not verified yet'}
                  </div>
                </div>
              </div>

              {/* TV Predefined Controls Remote */}
              {isRemoteExpanded && (
                <div className="pt-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs uppercase tracking-wider text-purple-300/80 font-mono font-semibold flex items-center gap-2">
                      <Sliders size={14} className="text-purple-400" />
                      <span>Predefined TV Controls</span>
                    </div>
                    {activeTvAction && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span>Command: {activeTvAction.toUpperCase()}</span>
                      </span>
                    )}
                  </div>

                  {!isOnline && (
                    <div className="mb-4 p-3 rounded-xl bg-black/40 border border-white/5 text-slate-400 text-xs flex items-center gap-2">
                      <Lock size={14} className="text-rose-400 flex-shrink-0" />
                      <span>Remote control actions are disabled while the Smart TV is disconnected. Verify network connection and click <strong>Refresh</strong>.</span>
                    </div>
                  )}

                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-5 rounded-2xl bg-black/30 border border-white/5 ${
                    !isOnline ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    {/* Directional Pad */}
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-3">
                        Navigation D-Pad
                      </div>
                      <div className="relative w-48 h-48 rounded-full bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 flex items-center justify-center shadow-2xl">
                        {/* Up */}
                        <button
                          onClick={() => handleTvControl('up')}
                          disabled={!isOnline || tvActionLoading}
                          className="absolute top-2 w-12 h-10 rounded-t-xl bg-white/5 hover:bg-purple-500/20 active:bg-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
                          title="Up"
                        >
                          <ChevronUp size={22} />
                        </button>

                        {/* Down */}
                        <button
                          onClick={() => handleTvControl('down')}
                          disabled={!isOnline || tvActionLoading}
                          className="absolute bottom-2 w-12 h-10 rounded-b-xl bg-white/5 hover:bg-purple-500/20 active:bg-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
                          title="Down"
                        >
                          <ChevronDown size={22} />
                        </button>

                        {/* Left */}
                        <button
                          onClick={() => handleTvControl('left')}
                          disabled={!isOnline || tvActionLoading}
                          className="absolute left-2 w-10 h-12 rounded-l-xl bg-white/5 hover:bg-purple-500/20 active:bg-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
                          title="Left"
                        >
                          <ChevronLeft size={22} />
                        </button>

                        {/* Right */}
                        <button
                          onClick={() => handleTvControl('right')}
                          disabled={!isOnline || tvActionLoading}
                          className="absolute right-2 w-10 h-12 rounded-r-xl bg-white/5 hover:bg-purple-500/20 active:bg-purple-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
                          title="Right"
                        >
                          <ChevronRight size={22} />
                        </button>

                        {/* OK Center Button */}
                        <button
                          onClick={() => handleTvControl('ok')}
                          disabled={!isOnline || tvActionLoading}
                          className="w-16 h-16 rounded-full bg-gradient-to-b from-purple-500/30 to-purple-600/20 hover:from-purple-500/50 hover:to-purple-600/40 active:scale-95 border border-purple-400/40 text-sm font-bold text-white flex items-center justify-center shadow-lg transition-all disabled:opacity-50"
                          title="OK / Select"
                        >
                          OK
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons Keypad */}
                    <div className="space-y-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                        Control Keypad
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {/* ⏻ Power */}
                        <button
                          onClick={() => handleTvControl('power')}
                          disabled={!isOnline || tvActionLoading}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                            connectedTv.tv?.powerState === 'ON'
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                          }`}
                          title="Power"
                        >
                          <Power size={18} />
                          <span>Power</span>
                        </button>

                        {/* 🔊 Volume + */}
                        <button
                          onClick={() => handleTvControl('volume_up')}
                          disabled={!isOnline || tvActionLoading}
                          className="p-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/30 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-300 flex flex-col items-center gap-1.5 transition-all text-xs font-semibold"
                          title="Volume Up"
                        >
                          <Volume2 size={18} className="text-cyan-400" />
                          <span>Vol +</span>
                        </button>

                        {/* 🔇 Mute */}
                        <button
                          onClick={() => handleTvControl('mute')}
                          disabled={!isOnline || tvActionLoading}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                            connectedTv.tv?.isMuted
                              ? 'bg-amber-500/25 border-amber-500/50 text-amber-200 shadow-md shadow-amber-500/10'
                              : 'bg-white/5 hover:bg-amber-500/20 border-white/10 hover:border-amber-500/30 text-slate-200 hover:text-amber-300'
                          }`}
                          title="Mute / Unmute"
                        >
                          <VolumeX size={18} className="text-amber-400" />
                          <span>{connectedTv.tv?.isMuted ? 'Muted' : 'Mute'}</span>
                        </button>

                        {/* 🏠 Home */}
                        <button
                          onClick={() => handleTvControl('home')}
                          disabled={!isOnline || tvActionLoading}
                          className="p-3 rounded-xl bg-white/5 hover:bg-purple-500/20 active:bg-purple-500/30 border border-white/10 hover:border-purple-500/30 text-slate-200 hover:text-purple-300 flex flex-col items-center gap-1.5 transition-all text-xs font-semibold"
                          title="Home"
                        >
                          <Home size={18} className="text-purple-400" />
                          <span>Home</span>
                        </button>

                        {/* 🔉 Volume - */}
                        <button
                          onClick={() => handleTvControl('volume_down')}
                          disabled={!isOnline || tvActionLoading}
                          className="p-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/30 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-300 flex flex-col items-center gap-1.5 transition-all text-xs font-semibold"
                          title="Volume Down"
                        >
                          <Volume1 size={18} className="text-cyan-400" />
                          <span>Vol -</span>
                        </button>

                        {/* ◀ Back */}
                        <button
                          onClick={() => handleTvControl('back')}
                          disabled={!isOnline || tvActionLoading}
                          className="p-3 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-slate-200 flex flex-col items-center gap-1.5 transition-all text-xs font-semibold"
                          title="Back"
                        >
                          <ArrowLeft size={18} className="text-slate-400" />
                          <span>Back</span>
                        </button>
                      </div>

                      {/* ⏯ Play/Pause Full Width Action */}
                      <button
                        onClick={() => handleTvControl('play_pause')}
                        disabled={!isOnline || tvActionLoading}
                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-slate-200 hover:text-purple-300 flex items-center justify-center gap-2 transition-all text-xs font-semibold"
                        title="Play / Pause"
                      >
                        <Play size={15} className="text-purple-400" />
                        <span>Play / Pause</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Section 3: Prepared Ecosystem Cards (Computer, Media, Automations) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Computer / Cloud Card */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Monitor size={18} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  Not connected
                </span>
              </div>
              <h4 className="font-bold text-white text-sm">🖥️ Computer / Cloud</h4>
              <p className="text-xs text-slate-400">
                Monitor workstation CPU/GPU load, storage disk spaces, and headless daemon telemetry.
              </p>
            </div>

            <button
              onClick={() => setComingSoonNotice('Computer/Cloud Agent coming soon. Cross-platform daemon in development.')}
              className="w-full py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
            >
              ＋ Add Computer
            </button>
          </div>

          {/* Media Card */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                  <Music size={18} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  Not connected
                </span>
              </div>
              <h4 className="font-bold text-white text-sm">🎵 Media</h4>
              <p className="text-xs text-slate-400">
                Unified playback routing across Google Cast, Spotify Connect, and local audio hardware.
              </p>
            </div>

            <button
              onClick={() => setComingSoonNotice('Media device routing integrations coming soon.')}
              className="w-full py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
            >
              Connect Media Device
            </button>
          </div>

          {/* Automations Card */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Sliders size={18} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  0 active
                </span>
              </div>
              <h4 className="font-bold text-white text-sm">⚙️ Automations</h4>
              <p className="text-xs text-slate-400">
                Trigger routines when battery drops &lt; 20%, manage notifications, or automate device sync.
              </p>
            </div>

            <button
              onClick={() => setComingSoonNotice('Device automations engine ready for paired agents.')}
              className="w-full py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
            >
              ＋ Create Automation
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD DEVICE & PAIRING WIZARD */}
      {/* ========================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-cyan-500/30 shadow-2xl p-6 relative overflow-hidden">
            {/* Background glow accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400"><Smartphone size={20} /></span>
                <h3 className="font-bold text-lg text-white">Add Device to NEXUS</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {addStep === 'select' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">Choose the type of device you would like to connect:</p>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Android Agent Option */}
                  <button
                    onClick={() => handleSelectDeviceType('android')}
                    className="p-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-left flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">📱 Android Agent</div>
                        <div className="text-xs text-slate-300">Link your smartphone via the NEXUS Agent APK</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-cyan-300 px-2 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/30">
                      Pair Now
                    </span>
                  </button>

                  {/* Smart TV Option */}
                  <button
                    onClick={() => handleSelectDeviceType('tv')}
                    className="p-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Tv size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">📺 Smart TV</div>
                        <div className="text-xs text-purple-200/80">Android TV / Google TV / webOS TV</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-300 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-400/30">
                      Pair TV
                    </span>
                  </button>

                  {/* Computer Option */}
                  <button
                    onClick={() => handleSelectDeviceType('computer')}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-left flex items-center justify-between opacity-80 hover:opacity-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Monitor size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">🖥️ Computer / Cloud</div>
                        <div className="text-xs text-slate-400">Workstations, Linux daemons, & servers</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-white/5">Coming soon</span>
                  </button>

                  {/* Smart Home Option */}
                  <button
                    onClick={() => handleSelectDeviceType('smarthome')}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-left flex items-center justify-between opacity-80 hover:opacity-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Home size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">🏠 Smart Home</div>
                        <div className="text-xs text-slate-400">Lights, thermostats, and IoT hubs</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-white/5">Coming soon</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Android Pairing Workflow */
              <form onSubmit={handlePairDevice} className="space-y-4">
                <button
                  type="button"
                  onClick={() => setAddStep('select')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mb-1"
                >
                  <ArrowLeft size={13} />
                  <span>Back to device selection</span>
                </button>

                {/* Numbered Steps */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs text-slate-300">
                  <div className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                    <Shield size={14} className="text-cyan-400" />
                    <span>Android Agent Pairing Steps:</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>Install the NEXUS Agent APK on your Android device.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>Open the APK and generate a secure pairing code.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>Enter the pairing code below to link your device with NEXUS.</span>
                  </div>
                </div>

                {/* Pairing Code Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">Pairing Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pairingCodeInput}
                      onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. NX-4892 or 6-digit code"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white font-mono text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder:text-slate-500"
                      maxLength={12}
                    />
                  </div>
                </div>

                {/* Device Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">Device Name (Optional)</label>
                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    placeholder="e.g. My Pixel 8 Pro"
                    className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder:text-slate-500"
                  />
                </div>

                {/* Testing helper */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateTestCode}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Sparkles size={13} />
                    <span>Generate APK Test Code</span>
                  </button>
                  {generatedTestCode && (
                    <span className="text-xs font-mono text-emerald-400">Generated: {generatedTestCode}</span>
                  )}
                </div>

                {/* Error / Success feedback */}
                {pairError && (
                  <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <span>{pairError}</span>
                  </div>
                )}

                {pairSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-semibold animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>✓ Android Agent connected successfully!</span>
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPairing || pairSuccess}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPairing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Pairing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Pair Device</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DEVICE DETAILS & PERMISSIONS */}
      {/* ========================================================================= */}
      {detailsModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-[#0f172a] border border-cyan-500/30 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{detailsModalDevice.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{detailsModalDevice.android?.model || 'Android Agent'}</span>
                    <span>•</span>
                    <span>{getStatusBadge(detailsModalDevice.status)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDetailsModalDevice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Device Telemetry Specs */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2">Live Device Telemetry</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">Device Model</span>
                    <span className="font-semibold text-white">{detailsModalDevice.android?.model || 'Unknown'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">Android Version</span>
                    <span className="font-semibold text-white">Android {detailsModalDevice.android?.androidVersion || '14'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">Battery</span>
                    <span className="font-semibold text-white">
                      {detailsModalDevice.android?.batteryLevel ?? '--'}%
                      {detailsModalDevice.android?.isCharging && ' (Charging)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">Active Network</span>
                    <span className="font-semibold text-white truncate block">{detailsModalDevice.android?.networkType || 'Wi-Fi'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">Storage</span>
                    <span className="font-semibold text-white">
                      {detailsModalDevice.android?.storageUsedGb ?? 0} GB / {detailsModalDevice.android?.storageTotalGb ?? 128} GB
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-slate-400 block text-[11px]">RAM Memory</span>
                    <span className="font-semibold text-white">
                      {detailsModalDevice.android?.ramUsedGb ?? 0} GB / {detailsModalDevice.android?.ramTotalGb ?? 8} GB
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span>Paired: {new Date(detailsModalDevice.pairedAt).toLocaleDateString()}</span>
                <span>Last Heartbeat: {formatTimestamp(detailsModalDevice.lastSeen)}</span>
              </div>

              {/* Permissions Management Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <Shield size={13} className="text-cyan-400" />
                    <span>Tool Permissions &amp; Data Access</span>
                  </h4>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                  Configure which telemetry and capabilities NEXUS AI Assistant is authorized to query:
                </p>

                <div className="space-y-2 text-xs">
                  {/* Battery Permission */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors">
                    <div>
                      <div className="font-semibold text-white">Battery Information</div>
                      <div className="text-[11px] text-slate-400">Authorize NEXUS AI to query battery level &amp; charging status</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissions.batteryInfo}
                      onChange={(e) =>
                        setEditingPermissions((prev) => ({ ...prev, batteryInfo: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-white/20 bg-black/40"
                    />
                  </label>

                  {/* Storage Permission */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors">
                    <div>
                      <div className="font-semibold text-white">Storage Information</div>
                      <div className="text-[11px] text-slate-400">Authorize NEXUS AI to query internal storage &amp; RAM allocation</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissions.storageInfo}
                      onChange={(e) =>
                        setEditingPermissions((prev) => ({ ...prev, storageInfo: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-white/20 bg-black/40"
                    />
                  </label>

                  {/* Network Permission */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors">
                    <div>
                      <div className="font-semibold text-white">Network Information</div>
                      <div className="text-[11px] text-slate-400">Authorize NEXUS AI to query connection type &amp; Wi-Fi link</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissions.networkInfo}
                      onChange={(e) =>
                        setEditingPermissions((prev) => ({ ...prev, networkInfo: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-white/20 bg-black/40"
                    />
                  </label>

                  {/* Device Control Permission */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors">
                    <div>
                      <div className="font-semibold text-white">Device Control</div>
                      <div className="text-[11px] text-slate-400">Prepared for remote action routines (default: disabled)</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissions.deviceControl}
                      onChange={(e) =>
                        setEditingPermissions((prev) => ({ ...prev, deviceControl: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-white/20 bg-black/40"
                    />
                  </label>

                  {/* Background Monitoring */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors">
                    <div>
                      <div className="font-semibold text-white">Background Monitoring</div>
                      <div className="text-[11px] text-slate-400">Allow periodic telemetry sync in background</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissions.backgroundMonitoring}
                      onChange={(e) =>
                        setEditingPermissions((prev) => ({ ...prev, backgroundMonitoring: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-white/20 bg-black/40"
                    />
                  </label>
                </div>
              </div>

              {permissionsSavedSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Permissions saved successfully.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleOpenDisconnectModal(detailsModalDevice)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Disconnect Device</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsModalDevice(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    disabled={savingPermissions}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20 border border-cyan-400/30 transition-all disabled:opacity-50"
                  >
                    {savingPermissions ? 'Saving...' : 'Save Permissions'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SMART TV PAIRING & CONNECTION WIZARD */}
      {/* ========================================================================= */}
      {tvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-purple-500/30 shadow-2xl p-6 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                  <Tv size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Connect Smart TV</h3>
                  <p className="text-xs text-purple-200/70">Android TV / Google TV / webOS TV</p>
                </div>
              </div>
              <button
                onClick={() => setTvModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConnectTv} className="space-y-4">
              {/* Device Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Device Name
                </label>
                <input
                  type="text"
                  value={tvNameInput}
                  onChange={(e) => setTvNameInput(e.target.value)}
                  placeholder="e.g. Living Room TV"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-400/50"
                />
              </div>

              {/* IP Address & Port Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    TV IP address <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tvIpInput}
                    onChange={(e) => setTvIpInput(e.target.value)}
                    placeholder="e.g. 192.168.1.50"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-purple-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Port
                  </label>
                  <input
                    type="number"
                    value={tvPortInput}
                    onChange={(e) => setTvPortInput(e.target.value)}
                    placeholder="5555"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-purple-400/50"
                  />
                </div>
              </div>

              {/* Connection Method Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Connection method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'google_tv', label: 'Google TV', icon: '📺' },
                    { id: 'android_tv', label: 'Android TV', icon: '📱' },
                    { id: 'webos', label: 'webOS TV', icon: '🖥️' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setTvMethodInput(method.id as TVConnectionMethod)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                        tvMethodInput === method.id
                          ? 'bg-purple-500/25 border-purple-400/60 text-purple-200 shadow-md shadow-purple-500/20'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-sm">{method.icon}</span>
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Socket Test Banner & Feedback */}
              {tvTestStatus === 'testing' && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-purple-400 flex-shrink-0" />
                  <span>Probing socket on {tvIpInput}:{tvPortInput}...</span>
                </div>
              )}

              {tvTestStatus === 'connected' && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                    <span>Socket verified &amp; reachable</span>
                  </div>
                  {tvTestLatency && (
                    <span className="font-mono text-[11px] text-emerald-300">
                      {tvTestLatency}ms latency
                    </span>
                  )}
                </div>
              )}

              {tvTestStatus === 'failed' && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{tvTestError || 'Could not reach TV. Ensure TV is powered on and reachable on your local LAN.'}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleTestTvConnection}
                  disabled={tvTesting || isTvConnecting || !tvIpInput.trim()}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={tvTesting ? 'animate-spin' : ''} />
                  <span>{tvTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTvModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isTvConnecting || !tvIpInput.trim()}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Tv size={14} />
                    <span>{isTvConnecting ? 'Connecting...' : 'Connect'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DISCONNECT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deviceToDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-rose-500/30 shadow-2xl p-6 relative overflow-hidden">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Disconnect {deviceToDisconnect.name}?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to disconnect this {deviceToDisconnect.type === 'tv' ? 'Smart TV' : 'device'} from NEXUS Intelligence? Live telemetry and controls will be severed.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 space-y-1 mb-5 font-mono">
              <div><span className="text-slate-400">Device:</span> {deviceToDisconnect.name}</div>
              <div><span className="text-slate-400">ID:</span> {deviceToDisconnect.id}</div>
              {deviceToDisconnect.ipAddress && (
                <div><span className="text-slate-400">IP:</span> {deviceToDisconnect.ipAddress}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeviceToDisconnect(null)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 border border-rose-400/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirm Disconnect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
