package com.nexus.intelligence;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NexusNetworkScanner")
public class NetworkScannerPlugin extends Plugin {

    private final AtomicBoolean isScanning = new AtomicBoolean(false);
    private final AtomicBoolean cancelScanRequested = new AtomicBoolean(false);
    private ExecutorService scanExecutor = null;

    @PluginMethod
    public void getNetworkInfo(PluginCall call) {
        try {
            Context context = getContext();
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);

            JSObject res = new JSObject();
            boolean isConnected = false;
            String connectionType = "none";
            String ssid = null;
            String localIp = null;
            String subnet = null;
            String gateway = null;

            if (cm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Network activeNetwork = cm.getActiveNetwork();
                    if (activeNetwork != null) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
                        if (caps != null) {
                            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                                isConnected = true;
                                connectionType = "wifi";
                            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                                isConnected = true;
                                connectionType = "cellular";
                            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                                isConnected = true;
                                connectionType = "ethernet";
                            }
                        }
                    }
                } else {
                    NetworkInfo netInfo = cm.getActiveNetworkInfo();
                    if (netInfo != null && netInfo.isConnected()) {
                        isConnected = true;
                        int type = netInfo.getType();
                        if (type == ConnectivityManager.TYPE_WIFI) {
                            connectionType = "wifi";
                        } else if (type == ConnectivityManager.TYPE_MOBILE) {
                            connectionType = "cellular";
                        } else if (type == ConnectivityManager.TYPE_ETHERNET) {
                            connectionType = "ethernet";
                        }
                    }
                }
            }

            localIp = getLocalIpAddress();

            if (wm != null && "wifi".equals(connectionType)) {
                WifiInfo wifiInfo = wm.getConnectionInfo();
                if (wifiInfo != null) {
                    String rawSsid = wifiInfo.getSSID();
                    if (rawSsid != null && !rawSsid.equals("<unknown ssid>") && !rawSsid.isEmpty()) {
                        ssid = rawSsid.replaceAll("^\"|\"$", "");
                    }
                    int dhcpGateway = wm.getDhcpInfo() != null ? wm.getDhcpInfo().gateway : 0;
                    if (dhcpGateway != 0) {
                        gateway = (dhcpGateway & 0xFF) + "." + ((dhcpGateway >> 8) & 0xFF) + "." + ((dhcpGateway >> 16) & 0xFF) + "." + ((dhcpGateway >> 24) & 0xFF);
                    }
                }
            }

            if (localIp != null && localIp.contains(".")) {
                int lastDot = localIp.lastIndexOf('.');
                subnet = localIp.substring(0, lastDot) + ".0/24";
                if (gateway == null) {
                    gateway = localIp.substring(0, lastDot) + ".1";
                }
            }

            res.put("connected", isConnected);
            res.put("connectionType", connectionType);
            res.put("ssid", ssid);
            res.put("localIp", localIp);
            res.put("subnet", subnet);
            res.put("gateway", gateway);
            res.put("scanningSupported", "wifi".equals(connectionType) || "ethernet".equals(connectionType));
            res.put("scanMode", "native_android");

            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to retrieve network info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelScan(PluginCall call) {
        cancelScanRequested.set(true);
        if (scanExecutor != null && !scanExecutor.isShutdown()) {
            scanExecutor.shutdownNow();
        }
        isScanning.set(false);
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void pingDevice(PluginCall call) {
        String ip = call.getString("ip");
        Integer port = call.getInt("port", 80);

        if (ip == null || ip.trim().isEmpty()) {
            call.reject("IP address is required");
            return;
        }

        final String cleanIp = ip.trim();
        final int targetPort = (port != null && port > 0) ? port : 80;

        new Thread(() -> {
            long start = System.currentTimeMillis();
            boolean reachable = false;
            String error = null;

            try {
                // Try TCP socket first
                Socket socket = new Socket();
                SocketAddress addr = new InetSocketAddress(cleanIp, targetPort);
                socket.connect(addr, 1200);
                socket.close();
                reachable = true;
            } catch (Exception e) {
                // Try ICMP / InetAddress isReachable
                try {
                    InetAddress inet = InetAddress.getByName(cleanIp);
                    if (inet.isReachable(1000)) {
                        reachable = true;
                    } else {
                        error = e.getMessage() != null ? e.getMessage() : "Host unreachable";
                    }
                } catch (Exception e2) {
                    error = e2.getMessage() != null ? e2.getMessage() : "Host unreachable";
                }
            }

            long latency = Math.max(1, System.currentTimeMillis() - start);

            JSObject res = new JSObject();
            res.put("ip", cleanIp);
            res.put("port", targetPort);
            res.put("reachable", reachable);
            res.put("latencyMs", latency);
            if (error != null) {
                res.put("error", error);
            }
            call.resolve(res);
        }).start();
    }

    @PluginMethod
    public void scanNetwork(PluginCall call) {
        if (isScanning.get()) {
            call.reject("A network scan is already in progress");
            return;
        }

        String localIp = getLocalIpAddress();
        if (localIp == null || !localIp.contains(".")) {
            call.reject("No active local Wi-Fi / LAN IP address found to scan");
            return;
        }

        int lastDot = localIp.lastIndexOf('.');
        final String subnetPrefix = localIp.substring(0, lastDot);

        isScanning.set(true);
        cancelScanRequested.set(false);

        new Thread(() -> {
            List<JSObject> discovered = Collections.synchronizedList(new ArrayList<>());
            scanExecutor = Executors.newFixedThreadPool(16);
            List<Future<?>> futures = new ArrayList<>();

            // Safe, non-invasive standard discovery ports
            final int[] SAFE_PROBE_PORTS = new int[]{ 5555, 8008, 6466, 80, 443, 9100, 22 };

            for (int i = 1; i <= 254; i++) {
                if (cancelScanRequested.get()) break;
                final int hostIndex = i;
                final String targetIp = subnetPrefix + "." + hostIndex;

                futures.add(scanExecutor.submit(() -> {
                    if (cancelScanRequested.get()) return;

                    long start = System.currentTimeMillis();
                    boolean reachable = false;
                    String detectedName = null;
                    String deviceType = "unknown";
                    String subType = "Unknown Device";
                    String manufacturer = null;
                    List<Integer> openPorts = new ArrayList<>();

                    // 1. Check socket probes on safe ports
                    for (int port : SAFE_PROBE_PORTS) {
                        if (cancelScanRequested.get()) return;
                        try {
                            Socket s = new Socket();
                            s.connect(new InetSocketAddress(targetIp, port), 250);
                            s.close();
                            reachable = true;
                            openPorts.add(port);
                        } catch (Exception ignored) {
                        }
                    }

                    // 2. If no ports responded, try InetAddress reachable
                    if (!reachable) {
                        try {
                            InetAddress inet = InetAddress.getByName(targetIp);
                            if (inet.isReachable(350)) {
                                reachable = true;
                            }
                        } catch (Exception ignored) {
                        }
                    }

                    if (reachable && !cancelScanRequested.get()) {
                        long latency = Math.max(1, System.currentTimeMillis() - start);

                        // Try to resolve hostname
                        try {
                            InetAddress inet = InetAddress.getByName(targetIp);
                            String host = inet.getCanonicalHostName();
                            if (host != null && !host.equals(targetIp)) {
                                detectedName = host;
                            }
                        } catch (Exception ignored) {
                        }

                        // Classify device type based on actual detected signatures
                        boolean hasTvPort = openPorts.contains(5555) || openPorts.contains(8008) || openPorts.contains(6466);
                        boolean hasPrinterPort = openPorts.contains(9100);
                        boolean isGateway = hostIndex == 1;

                        String lowerName = (detectedName != null ? detectedName.toLowerCase() : "");

                        if (hasTvPort || lowerName.contains("tv") || lowerName.contains("bravia") || lowerName.contains("tcl") || lowerName.contains("chromecast") || lowerName.contains("google-tv")) {
                            deviceType = "tv";
                            if (lowerName.contains("tcl")) {
                                manufacturer = "TCL";
                                subType = "TCL Google TV";
                                if (detectedName == null) detectedName = "TCL Google TV";
                            } else if (openPorts.contains(5555) || openPorts.contains(6466)) {
                                subType = "Google TV / Android TV";
                                if (detectedName == null) detectedName = "Smart TV (" + targetIp + ")";
                            } else if (openPorts.contains(8008)) {
                                subType = "Google Cast TV";
                                if (detectedName == null) detectedName = "Cast TV (" + targetIp + ")";
                            } else {
                                subType = "Smart TV";
                                if (detectedName == null) detectedName = "Smart TV (" + targetIp + ")";
                            }
                        } else if (hasPrinterPort || lowerName.contains("printer") || lowerName.contains("canon") || lowerName.contains("epson") || lowerName.contains("hp")) {
                            deviceType = "printer";
                            subType = "Network Printer";
                            if (detectedName == null) detectedName = "Printer (" + targetIp + ")";
                        } else if (isGateway && (openPorts.contains(80) || openPorts.contains(443))) {
                            deviceType = "router";
                            subType = "Router Gateway";
                            if (detectedName == null) detectedName = "Wi-Fi Router Gateway";
                        } else if (openPorts.contains(22) || openPorts.contains(445)) {
                            deviceType = "computer";
                            subType = "Workstation / Server";
                            if (detectedName == null) detectedName = "Host (" + targetIp + ")";
                        } else {
                            deviceType = "unknown";
                            subType = "Network Device";
                            if (detectedName == null) detectedName = "Device (" + targetIp + ")";
                        }

                        JSObject dev = new JSObject();
                        dev.put("id", "disc_" + targetIp.replace('.', '_'));
                        dev.put("ip", targetIp);
                        dev.put("name", detectedName);
                        // On Android 10+, MAC addresses are restricted by OS privacy
                        dev.put("macAddress", "Unavailable on this Android version");
                        dev.put("type", deviceType);
                        dev.put("subType", subType);
                        if (manufacturer != null) {
                            dev.put("manufacturer", manufacturer);
                        }
                        dev.put("status", "reachable");
                        dev.put("latencyMs", latency);
                        dev.put("lastDiscovered", System.currentTimeMillis());

                        JSArray portsArr = new JSArray();
                        for (int p : openPorts) {
                            JSObject pObj = new JSObject();
                            pObj.put("port", p);
                            pObj.put("service", getServiceName(p));
                            portsArr.put(pObj);
                        }
                        dev.put("detectedServices", portsArr);

                        discovered.add(dev);
                    }
                }));
            }

            for (Future<?> f : futures) {
                try {
                    f.get(15, TimeUnit.SECONDS);
                } catch (Exception ignored) {
                }
            }

            scanExecutor.shutdown();
            isScanning.set(false);

            if (cancelScanRequested.get()) {
                JSObject cancelRet = new JSObject();
                cancelRet.put("cancelled", true);
                cancelRet.put("devices", new JSArray());
                call.resolve(cancelRet);
                return;
            }

            JSObject result = new JSObject();
            JSArray devicesArr = new JSArray();
            for (JSObject d : discovered) {
                devicesArr.put(d);
            }
            result.put("devices", devicesArr);
            result.put("count", discovered.size());
            result.put("scannedSubnet", subnetPrefix + ".0/24");
            result.put("timestamp", System.currentTimeMillis());

            call.resolve(result);
        }).start();
    }

    private String getServiceName(int port) {
        switch (port) {
            case 5555: return "ADB / Android TV Control";
            case 8008:
            case 8009: return "Google Cast";
            case 6466:
            case 6467: return "Android TV Remote";
            case 80: return "HTTP Web";
            case 443: return "HTTPS Web";
            case 9100: return "JetDirect Printer";
            case 22: return "SSH";
            case 445: return "SMB File Sharing";
            default: return "Port " + port;
        }
    }

    private String getLocalIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                if (intf.isLoopback() || !intf.isUp()) continue;
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress() && addr instanceof java.net.Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
