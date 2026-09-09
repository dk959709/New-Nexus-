package com.nexus.intelligence;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;

import dadb.AdbKeyPair;
import dadb.AdbShellResponse;
import dadb.AdbShellStream;
import dadb.Dadb;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import javax.crypto.Cipher;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@CapacitorPlugin(name = "AndroidTvRemote")
public class AndroidTvRemotePlugin extends Plugin {

    private static final String TAG = "AndroidTvRemote";
    private static final String PREFS_NAME = "nexus_tv_remote_prefs";
    private static final String KEY_CLIENT_CERT = "tv_client_cert_der_b64";
    private static final String KEY_PRIVATE_KEY = "tv_client_privkey_pkcs8_b64";
    private static final String KEY_ADB_PUB_KEY = "tv_adb_pub_key_b64";
    private static final String KEY_ADB_PRIV_KEY = "tv_adb_priv_key_pkcs8_b64";
    private static final String KEY_LAST_PAIRED_IP = "tv_last_paired_ip";
    private static final String KEY_LAST_TV_MODEL = "tv_last_tv_model";

    // Active Remote Connection (Port 6466)
    private SSLSocket remoteControlSocket = null;
    private OutputStream remoteControlOut = null;
    private InputStream remoteControlIn = null;
    private String connectedTvIp = null;
    private int connectedTvPort = 6466;
    private String connectedTvModel = "Android TV";
    private boolean isTvConnected = false;

    // Active ADB Connection (Port 5555 via dadb)
    private Dadb activeDadb = null;
    private String activeDadbIp = null;
    private int activeDadbPort = 5555;

    // Active Pairing Session (Port 6467)
    private SSLSocket pairingSocket = null;
    private OutputStream pairingOut = null;
    private InputStream pairingIn = null;
    private String pendingPairingIp = null;
    private int pendingPairingPort = 6467;
    private X509Certificate serverCertificate = null;

    // Key Codes
    public static final int KEYCODE_POWER = 26;
    public static final int KEYCODE_VOLUME_UP = 24;
    public static final int KEYCODE_VOLUME_DOWN = 25;
    public static final int KEYCODE_VOLUME_MUTE = 164;
    public static final int KEYCODE_HOME = 3;
    public static final int KEYCODE_BACK = 4;
    public static final int KEYCODE_DPAD_UP = 19;
    public static final int KEYCODE_DPAD_DOWN = 20;
    public static final int KEYCODE_DPAD_LEFT = 21;
    public static final int KEYCODE_DPAD_RIGHT = 22;
    public static final int KEYCODE_DPAD_CENTER = 23;
    public static final int KEYCODE_MEDIA_PLAY_PAUSE = 85;

    @PluginMethod
    public void checkStatus(PluginCall call) {
        final JSObject res = new JSObject();
        final boolean socketAlive = isRemoteSocketAlive() || (isTvConnected && activeDadb != null);
        res.put("isConnected", socketAlive);
        res.put("isPaired", getSavedPairedIp() != null);
        res.put("ip", connectedTvIp != null ? connectedTvIp : getSavedPairedIp());
        res.put("port", connectedTvPort);
        res.put("model", connectedTvModel != null ? connectedTvModel : getSavedTvModel());
        res.put("deviceName", connectedTvModel != null ? connectedTvModel : "Android TV");
        call.resolve(res);
    }

    @PluginMethod
    public void startPairing(PluginCall call) {
        final String ip = call.getString("ipAddress");
        final Integer portVal = call.getInt("port", 6467);
        final String targetIp = (ip != null && !ip.trim().isEmpty()) ? ip.trim() : getSavedPairedIp();
        final int targetPort = (portVal != null && portVal > 0) ? portVal : 6467;

        if (targetIp == null || targetIp.isEmpty()) {
            call.reject("TV IP address is required for pairing");
            return;
        }

        final PluginCall savedCall = call;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Starting TLS pairing with TV at " + targetIp + ":" + targetPort);
                    closePairingSession();

                    ensureClientCertificate();

                    SSLContext sslContext = createSSLContext();
                    SSLSocketFactory factory = sslContext.getSocketFactory();
                    
                    Socket plainSocket = new Socket();
                    plainSocket.connect(new InetSocketAddress(targetIp, targetPort), 4000);
                    
                    pairingSocket = (SSLSocket) factory.createSocket(plainSocket, targetIp, targetPort, true);
                    pairingSocket.setUseClientMode(true);
                    pairingSocket.setNeedClientAuth(true);
                    pairingSocket.setSoTimeout(10000);
                    pairingSocket.startHandshake();

                    Certificate[] serverCerts = pairingSocket.getSession().getPeerCertificates();
                    if (serverCerts != null && serverCerts.length > 0 && serverCerts[0] instanceof X509Certificate) {
                        serverCertificate = (X509Certificate) serverCerts[0];
                    }

                    pairingOut = pairingSocket.getOutputStream();
                    pairingIn = pairingSocket.getInputStream();
                    pendingPairingIp = targetIp;
                    pendingPairingPort = targetPort;

                    byte[] pairingReqMsg = buildPairingRequestMessage("nexus.remote", "Nexus Remote");
                    writeDelimitedMessage(pairingOut, pairingReqMsg);

                    byte[] ack1 = readDelimitedMessage(pairingIn);
                    Log.d(TAG, "Received PairingRequestAck (" + (ack1 != null ? ack1.length : 0) + " bytes)");

                    byte[] optionMsg = buildPairingOptionMessage();
                    writeDelimitedMessage(pairingOut, optionMsg);

                    byte[] ack2 = readDelimitedMessage(pairingIn);
                    Log.d(TAG, "Received PairingOptionAck. TV is now displaying PIN!");

                    byte[] configMsg = buildPairingConfigurationMessage();
                    writeDelimitedMessage(pairingOut, configMsg);

                    byte[] ack3 = readDelimitedMessage(pairingIn);
                    Log.d(TAG, "Received PairingConfigurationAck");

                    JSObject res = new JSObject();
                    res.put("status", "NEED_PIN");
                    res.put("ip", targetIp);
                    res.put("port", targetPort);
                    res.put("message", "Enter the 6-character code displayed on your TV screen");
                    savedCall.resolve(res);

                } catch (Exception e) {
                    Log.e(TAG, "Pairing handshake failed", e);
                    closePairingSession();
                    savedCall.reject("Failed to initiate TV pairing: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void sendPin(PluginCall call) {
        String pinRaw = call.getString("pin");
        if (pinRaw == null || pinRaw.trim().isEmpty()) {
            call.reject("PIN is required");
            return;
        }

        final String pin = pinRaw.trim().toUpperCase(Locale.US);
        final PluginCall savedCall = call;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (pairingSocket == null || pairingOut == null || pairingIn == null) {
                        savedCall.reject("No active pairing session. Please click Connect to start pairing first.");
                        return;
                    }

                    X509Certificate clientCert = getClientCertificate();
                    if (clientCert == null || serverCertificate == null) {
                        savedCall.reject("Certificate exchange incomplete during pairing.");
                        return;
                    }

                    byte[] clientCertBytes = clientCert.getEncoded();
                    byte[] serverCertBytes = serverCertificate.getEncoded();

                    byte[] pinBytes;
                    if (pin.length() % 2 == 0 && pin.matches("^[0-9A-F]+$")) {
                        pinBytes = hexStringToByteArray(pin);
                    } else {
                        pinBytes = pin.getBytes("UTF-8");
                    }

                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    md.update(clientCertBytes);
                    md.update(serverCertBytes);
                    md.update(pinBytes);
                    byte[] secretHash = md.digest();

                    byte[] secretMsg = buildPairingSecretMessage(secretHash);
                    writeDelimitedMessage(pairingOut, secretMsg);

                    byte[] secretAck = readDelimitedMessage(pairingIn);
                    Log.d(TAG, "Received PairingSecretAck (" + (secretAck != null ? secretAck.length : 0) + " bytes)");

                    savePairedIp(pendingPairingIp);
                    closePairingSession();

                    boolean controlConnected = connectControlSocketInternal(pendingPairingIp, 6466);

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("status", "PAIRED");
                    res.put("isConnected", controlConnected);
                    res.put("ip", pendingPairingIp);
                    res.put("deviceName", connectedTvModel);
                    res.put("model", connectedTvModel);
                    res.put("message", "Smart TV paired and connected successfully!");
                    savedCall.resolve(res);

                } catch (Exception e) {
                    Log.e(TAG, "Failed to complete PIN verification", e);
                    closePairingSession();
                    savedCall.reject("PIN verification failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void connectTv(PluginCall call) {
        final String ip = call.getString("ipAddress");
        final Integer portVal = call.getInt("port", 6466);
        final String method = call.getString("method", "google_tv");
        final String targetIp = (ip != null && !ip.trim().isEmpty()) ? ip.trim() : getSavedPairedIp();
        final int targetPort = (portVal != null && portVal > 0) ? portVal : (method != null && method.equals("android_tv") ? 5555 : 6466);

        if (targetIp == null || targetIp.isEmpty()) {
            call.reject("TV IP address is required");
            return;
        }

        final PluginCall savedCall = call;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    // If targetPort is 5555 or method is android_tv, perform real authenticated ADB handshake via dadb!
                    if (targetPort == 5555 || (method != null && method.equals("android_tv"))) {
                        closeRemoteControlSession();
                        closeAdbSession();

                        try {
                            AdbKeyPair keyPair = getOrCreateAdbKeyPair();
                            Log.i(TAG, "Initiating ADB connection & test shell command to " + targetIp + ":" + targetPort + " using dadb...");

                            Dadb dadb = Dadb.create(targetIp, targetPort, keyPair);
                            String verifiedModel = null;
                            Exception testException = null;

                            // Test ADB shell connection with a real command (getprop ro.product.model).
                            // Dadb.create is lazy and does NOT connect immediately. Calling dadb.shell()
                            // forces the TCP socket to open, executes the A_CNXN handshake, exchanges A_AUTH,
                            // and sends the RSA public key payload if the TV is not yet authorized.
                            // That transmission is what displays the "Allow USB/Network debugging?" popup on the TV screen.
                            try {
                                AdbShellResponse shellRes = dadb.shell("getprop ro.product.model");
                                verifiedModel = shellRes.getAllOutput().trim();
                                Log.i(TAG, "ADB shell test verified successfully! TV model: " + verifiedModel);
                            } catch (Exception e1) {
                                testException = e1;
                                Log.w(TAG, "First ADB test execution failed on " + targetIp + ":" + targetPort + ": " + e1.getMessage());

                                // When dadb connects to an unauthorized TV, it transmits the RSA public key to the TV.
                                // The TV screen displays the authorization popup. If the user accepts immediately,
                                // we pause 3.5 seconds and attempt one retry.
                                String eMsg = e1.getMessage() != null ? e1.getMessage() : "";
                                boolean likelyAuthChallenge = eMsg.contains("failed") || eMsg.contains("EOF") || eMsg.contains("closed");
                                if (likelyAuthChallenge) {
                                    try {
                                        Log.i(TAG, "Authorization popup dispatched to TV. Pausing 3.5s for user prompt acceptance...");
                                        Thread.sleep(3500);
                                        dadb.close();
                                        dadb = Dadb.create(targetIp, targetPort, keyPair);
                                        AdbShellResponse retryRes = dadb.shell("getprop ro.product.model");
                                        verifiedModel = retryRes.getAllOutput().trim();
                                        testException = null;
                                        Log.i(TAG, "ADB retry succeeded! TV model: " + verifiedModel);
                                    } catch (Exception e2) {
                                        testException = e2;
                                        Log.w(TAG, "ADB retry also waiting for authorization on " + targetIp + ":" + targetPort + ": " + e2.getMessage());
                                    }
                                }
                            }

                            if (verifiedModel != null) {
                                String finalModel = !verifiedModel.isEmpty() ? verifiedModel : "Android TV";
                                activeDadb = dadb;
                                activeDadbIp = targetIp;
                                activeDadbPort = targetPort;
                                connectedTvIp = targetIp;
                                connectedTvPort = targetPort;
                                connectedTvModel = finalModel;
                                isTvConnected = true;
                                savePairedIp(targetIp);
                                saveTvModel(finalModel);

                                Log.i(TAG, "Android TV ADB connection fully verified and active: " + finalModel + " (" + targetIp + ":" + targetPort + ")");

                                JSObject res = new JSObject();
                                res.put("success", true);
                                res.put("isConnected", true);
                                res.put("isPaired", true);
                                res.put("ip", targetIp);
                                res.put("port", targetPort);
                                res.put("deviceName", finalModel + " (ADB)");
                                res.put("model", finalModel);
                                savedCall.resolve(res);
                                return;
                            } else {
                                // Shell command failed: connection was NOT authorized or failed!
                                closeAdbSession();
                                isTvConnected = false;

                                String rawError = testException != null ? (testException.getMessage() != null ? testException.getMessage() : testException.toString()) : "Unknown error";
                                String userFriendlyError;

                                if (rawError.contains("Connection refused")) {
                                    userFriendlyError = "Connection refused on " + targetIp + ":" + targetPort + ". Please ensure 'Network debugging' (or ADB debugging) is enabled in Developer Options in your TV Settings.";
                                } else if (rawError.contains("timed out") || rawError.contains("ETIMEDOUT") || rawError.contains("No route")) {
                                    userFriendlyError = "Connection timed out connecting to " + targetIp + ":" + targetPort + ". Ensure TV is powered on and connected to the same Wi-Fi network.";
                                } else {
                                    userFriendlyError = "TV authorization required. An authorization prompt has been sent to your TV screen. Please look at your TV, check 'Always allow from this computer', select OK with your TV remote, and then tap Connect again.";
                                }

                                Log.w(TAG, "ADB connection not authorized or failed: " + userFriendlyError + " (detail: " + rawError + ")");

                                JSObject res = new JSObject();
                                res.put("success", false);
                                res.put("isConnected", false);
                                res.put("isPaired", false);
                                res.put("needPairing", true);
                                res.put("ip", targetIp);
                                res.put("port", targetPort);
                                res.put("deviceName", "Android TV (ADB)");
                                res.put("model", "Android TV");
                                res.put("error", userFriendlyError);
                                res.put("errorDetail", rawError);
                                savedCall.resolve(res);
                                return;
                            }

                        } catch (Exception e) {
                            Log.e(TAG, "Unexpected error establishing ADB connection: " + e.getMessage(), e);
                            closeAdbSession();
                            isTvConnected = false;

                            JSObject res = new JSObject();
                            res.put("success", false);
                            res.put("isConnected", false);
                            res.put("isPaired", false);
                            res.put("needPairing", true);
                            res.put("ip", targetIp);
                            res.put("port", targetPort);
                            res.put("deviceName", "Android TV (ADB)");
                            res.put("model", "Android TV");
                            res.put("error", "ADB connection failed: " + e.getMessage());
                            res.put("errorDetail", e.toString());
                            savedCall.resolve(res);
                            return;
                        }
                    }

                    // Otherwise connect over TLS to Port 6466
                    boolean connected = connectControlSocketInternal(targetIp, targetPort);
                    if (connected) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("isConnected", true);
                        res.put("isPaired", true);
                        res.put("ip", targetIp);
                        res.put("port", targetPort);
                        res.put("deviceName", connectedTvModel);
                        res.put("model", connectedTvModel);
                        savedCall.resolve(res);
                    } else {
                        JSObject res = new JSObject();
                        res.put("success", false);
                        res.put("needPairing", true);
                        res.put("error", "Pairing required with TV");
                        savedCall.resolve(res);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Connection to TV failed", e);
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("needPairing", true);
                    res.put("error", e.getMessage());
                    savedCall.resolve(res);
                }
            }
        }).start();
    }

    @PluginMethod
    public void sendKey(PluginCall call) {
        final String action = call.getString("action");
        final Integer keyCodeVal = call.getInt("keyCode", 0);
        String ip = call.getString("ipAddress");
        final String targetIp = (ip != null && !ip.trim().isEmpty()) ? ip.trim() : (connectedTvIp != null ? connectedTvIp : getSavedPairedIp());
        final int keyCode = (keyCodeVal != null && keyCodeVal > 0) ? keyCodeVal : mapActionToKeyCode(action);

        final PluginCall savedCall = call;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    // 1. If currently connected via ADB (Port 5555 or activeDadb)
                    if (activeDadb != null || (connectedTvPort == 5555 && targetIp != null && !targetIp.isEmpty())) {
                        boolean adbSent = sendAdbKeyWithDadb(targetIp, connectedTvPort == 5555 ? 5555 : (activeDadbPort > 0 ? activeDadbPort : 5555), keyCode);
                        if (adbSent) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("action", action);
                            res.put("keyCode", keyCode);
                            savedCall.resolve(res);
                            return;
                        }
                    }

                    // 2. Try TLS Remote Control Socket (Port 6466)
                    if (isRemoteSocketAlive()) {
                        boolean sent = sendRemoteKeyInject(keyCode);
                        if (sent) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("action", action);
                            res.put("keyCode", keyCode);
                            savedCall.resolve(res);
                            return;
                        }
                    }

                    // 3. If TLS socket not connected, try re-connecting to 6466 (only if not port 5555)
                    if (targetIp != null && !targetIp.isEmpty() && connectedTvPort != 5555) {
                        boolean reconnected = connectControlSocketInternal(targetIp, connectedTvPort > 0 ? connectedTvPort : 6466);
                        if (reconnected && isRemoteSocketAlive()) {
                            boolean sent = sendRemoteKeyInject(keyCode);
                            if (sent) {
                                JSObject res = new JSObject();
                                res.put("success", true);
                                res.put("action", action);
                                res.put("keyCode", keyCode);
                                savedCall.resolve(res);
                                return;
                            }
                        }
                    }

                    // 4. Fallback to Authenticated ADB Socket on Port 5555 via dadb
                    if (targetIp != null && !targetIp.isEmpty()) {
                        boolean adbSent = sendAdbKeyWithDadb(targetIp, connectedTvPort > 0 && connectedTvPort != 6466 ? connectedTvPort : 5555, keyCode);
                        if (adbSent) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("action", action);
                            res.put("keyCode", keyCode);
                            savedCall.resolve(res);
                            return;
                        }
                    }

                    savedCall.reject("Cannot send key: TV is not authorized or not connected. Please connect and approve debugging on your TV screen.");

                } catch (Exception e) {
                    Log.e(TAG, "Error sending key command", e);
                    savedCall.reject("Failed to send key to TV: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeRemoteControlSession();
        closeAdbSession();
        isTvConnected = false;
        connectedTvIp = null;
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    // =========================================================================
    // REAL ADB AUTHENTICATION & SHELL KEY INJECTION (PORT 5555 via dadb)
    // =========================================================================
    private synchronized AdbKeyPair getOrCreateAdbKeyPair() throws Exception {
        File dir = getContext().getFilesDir();
        File privKeyFile = new File(dir, "nexus_adbkey");
        File pubKeyFile = new File(dir, "nexus_adbkey.pub");

        if (!privKeyFile.exists() || !pubKeyFile.exists()) {
            Log.d(TAG, "Generating persistent ADB KeyPair using dadb...");
            AdbKeyPair.generate(privKeyFile, pubKeyFile);
        }
        return AdbKeyPair.read(privKeyFile, pubKeyFile);
    }

    private synchronized boolean sendAdbKeyWithDadb(String ip, int port, int keyCode) {
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                if (activeDadb == null || !ip.equals(activeDadbIp) || activeDadbPort != port) {
                    closeAdbSession();
                    AdbKeyPair keyPair = getOrCreateAdbKeyPair();
                    activeDadb = Dadb.create(ip, port, keyPair);
                    activeDadbIp = ip;
                    activeDadbPort = port;
                }

                Log.d(TAG, "Dispatching ADB keyevent " + keyCode + " to " + ip + ":" + port + " (attempt " + attempt + ")");
                AdbShellResponse res = activeDadb.shell("input keyevent " + keyCode);
                Log.d(TAG, "ADB shell keyevent result: exitCode=" + res.getExitCode() + ", output=" + res.getAllOutput().trim());
                if (res.getExitCode() == 0) {
                    isTvConnected = true;
                    return true;
                }
            } catch (Exception e) {
                Log.w(TAG, "ADB key attempt " + attempt + " failed for " + ip + ":" + port + ": " + e.getMessage());
                closeAdbSession();
                isTvConnected = false;
                if (attempt == 2) {
                    Log.e(TAG, "All ADB key attempts failed for " + ip + ":" + port, e);
                    return false;
                }
            }
        }
        return false;
    }

    private synchronized void closeAdbSession() {
        if (activeDadb != null) {
            try {
                activeDadb.close();
            } catch (Exception ignored) {}
            activeDadb = null;
            activeDadbIp = null;
        }
    }

    // =========================================================================
    // TLS CONTROL SOCKET (PORT 6466)
    // =========================================================================
    private synchronized boolean connectControlSocketInternal(String ip, int port) {
        try {
            closeRemoteControlSession();
            ensureClientCertificate();

            SSLContext sslContext = createSSLContext();
            SSLSocketFactory factory = sslContext.getSocketFactory();

            Socket plainSocket = new Socket();
            plainSocket.connect(new InetSocketAddress(ip, port), 3500);

            remoteControlSocket = (SSLSocket) factory.createSocket(plainSocket, ip, port, true);
            remoteControlSocket.setUseClientMode(true);
            remoteControlSocket.setNeedClientAuth(true);
            remoteControlSocket.setSoTimeout(5000);
            remoteControlSocket.startHandshake();

            remoteControlOut = remoteControlSocket.getOutputStream();
            remoteControlIn = remoteControlSocket.getInputStream();
            connectedTvIp = ip;
            connectedTvPort = port;
            isTvConnected = true;

            byte[] configMsg = buildRemoteConfigureMessage(622, "Nexus Remote", "Nexus", "1.0.0");
            writeDelimitedMessage(remoteControlOut, configMsg);

            try {
                byte[] tvConfig = readDelimitedMessage(remoteControlIn);
                String extractedModel = parseTvModelFromRemoteConfigure(tvConfig);
                if (extractedModel != null && !extractedModel.isEmpty()) {
                    connectedTvModel = extractedModel;
                    saveTvModel(extractedModel);
                    Log.d(TAG, "Identified TV Model: " + extractedModel);
                }
            } catch (Exception e) {
                Log.w(TAG, "Non-fatal: could not parse TV model response", e);
            }

            byte[] activeMsg = buildRemoteSetActiveMessage(622);
            writeDelimitedMessage(remoteControlOut, activeMsg);

            remoteControlSocket.setSoTimeout(0);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Control connection to " + ip + ":" + port + " failed", e);
            closeRemoteControlSession();
            return false;
        }
    }

    private synchronized boolean sendRemoteKeyInject(int keyCode) {
        if (remoteControlOut == null || remoteControlSocket == null || remoteControlSocket.isClosed()) {
            return false;
        }
        try {
            byte[] keyMsg = buildRemoteKeyInjectMessage(keyCode, 1);
            writeDelimitedMessage(remoteControlOut, keyMsg);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to write key to TLS socket", e);
            closeRemoteControlSession();
            return false;
        }
    }

    private boolean isRemoteSocketAlive() {
        return isTvConnected && remoteControlSocket != null && !remoteControlSocket.isClosed() && remoteControlSocket.isConnected();
    }

    private synchronized void closeRemoteControlSession() {
        isTvConnected = false;
        if (remoteControlSocket != null) {
            try { remoteControlSocket.close(); } catch (Exception ignored) {}
            remoteControlSocket = null;
        }
        remoteControlOut = null;
        remoteControlIn = null;
    }

    private synchronized void closePairingSession() {
        if (pairingSocket != null) {
            try { pairingSocket.close(); } catch (Exception ignored) {}
            pairingSocket = null;
        }
        pairingOut = null;
        pairingIn = null;
    }

    private int mapActionToKeyCode(String action) {
        if (action == null) return KEYCODE_DPAD_CENTER;
        switch (action.toLowerCase(Locale.US)) {
            case "power": return KEYCODE_POWER;
            case "volume_up": return KEYCODE_VOLUME_UP;
            case "volume_down": return KEYCODE_VOLUME_DOWN;
            case "mute": return KEYCODE_VOLUME_MUTE;
            case "home": return KEYCODE_HOME;
            case "back": return KEYCODE_BACK;
            case "up": return KEYCODE_DPAD_UP;
            case "down": return KEYCODE_DPAD_DOWN;
            case "left": return KEYCODE_DPAD_LEFT;
            case "right": return KEYCODE_DPAD_RIGHT;
            case "ok": return KEYCODE_DPAD_CENTER;
            case "play_pause": return KEYCODE_MEDIA_PLAY_PAUSE;
            default: return KEYCODE_DPAD_CENTER;
        }
    }

    // =========================================================================
    // CRYPTOGRAPHY: X.509 CERTIFICATE & RSA KEY GENERATION
    // =========================================================================
    private synchronized void ensureClientCertificate() throws Exception {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String certB64 = prefs.getString(KEY_CLIENT_CERT, null);
        String keyB64 = prefs.getString(KEY_PRIVATE_KEY, null);

        if (certB64 != null && keyB64 != null) {
            return;
        }

        Log.d(TAG, "Generating new 2048-bit RSA KeyPair and self-signed X.509 Certificate for Google TV Remote...");
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048, new SecureRandom());
        KeyPair keyPair = kpg.generateKeyPair();

        X509Certificate cert = generateSelfSignedCertificate(keyPair);

        byte[] certDer = cert.getEncoded();
        byte[] keyPkcs8 = keyPair.getPrivate().getEncoded();

        prefs.edit()
            .putString(KEY_CLIENT_CERT, Base64.encodeToString(certDer, Base64.NO_WRAP))
            .putString(KEY_PRIVATE_KEY, Base64.encodeToString(keyPkcs8, Base64.NO_WRAP))
            .apply();
    }

    private X509Certificate getClientCertificate() throws Exception {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String certB64 = prefs.getString(KEY_CLIENT_CERT, null);
        if (certB64 == null) return null;
        byte[] certDer = Base64.decode(certB64, Base64.DEFAULT);
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certDer));
    }

    private PrivateKey getClientPrivateKey() throws Exception {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String keyB64 = prefs.getString(KEY_PRIVATE_KEY, null);
        if (keyB64 == null) return null;
        byte[] keyBytes = Base64.decode(keyB64, Base64.DEFAULT);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePrivate(spec);
    }

    private SSLContext createSSLContext() throws Exception {
        X509Certificate cert = getClientCertificate();
        PrivateKey privKey = getClientPrivateKey();

        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        ks.load(null, null);
        ks.setKeyEntry("client", privKey, "".toCharArray(), new Certificate[]{ cert });

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(ks, "".toCharArray());

        TrustManager[] trustAll = new TrustManager[]{
            new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
            }
        };

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(kmf.getKeyManagers(), trustAll, new SecureRandom());
        return sslContext;
    }

    private X509Certificate generateSelfSignedCertificate(KeyPair keyPair) throws Exception {
        long now = System.currentTimeMillis();
        Date notBefore = new Date(now - 86400000L);
        Date notAfter = new Date(now + 10L * 365 * 24 * 3600 * 1000L);

        SimpleDateFormat sdf = new SimpleDateFormat("yyMMddHHmmss'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        byte[] notBeforeBytes = sdf.format(notBefore).getBytes("US-ASCII");
        byte[] notAfterBytes = sdf.format(notAfter).getBytes("US-ASCII");

        ByteArrayOutputStream validityBaos = new ByteArrayOutputStream();
        validityBaos.write(derEncode(0x17, notBeforeBytes));
        validityBaos.write(derEncode(0x17, notAfterBytes));
        byte[] validity = derEncode(0x30, validityBaos.toByteArray());

        byte[] cnValue = derEncode(0x0C, "NexusRemote".getBytes("UTF-8"));
        byte[] cnOid = new byte[]{ 0x06, 0x03, 0x55, 0x04, 0x03 };
        ByteArrayOutputStream atvBaos = new ByteArrayOutputStream();
        atvBaos.write(cnOid);
        atvBaos.write(cnValue);
        byte[] rdn = derEncode(0x31, derEncode(0x30, atvBaos.toByteArray()));
        byte[] name = derEncode(0x30, rdn);

        byte[] sigAlg = new byte[]{
            0x30, 0x0D,
            0x06, 0x09, 0x2A, (byte)0x86, 0x48, (byte)0x86, (byte)0xF7, 0x0D, 0x01, 0x01, 0x0B,
            0x05, 0x00
        };

        byte[] pubKeyInfo = keyPair.getPublic().getEncoded();

        ByteArrayOutputStream tbsBaos = new ByteArrayOutputStream();
        tbsBaos.write(new byte[]{ (byte)0xA0, 0x03, 0x02, 0x01, 0x02 });
        tbsBaos.write(new byte[]{ 0x02, 0x01, 0x01 });
        tbsBaos.write(sigAlg);
        tbsBaos.write(name);
        tbsBaos.write(validity);
        tbsBaos.write(name);
        tbsBaos.write(pubKeyInfo);

        byte[] tbsBytes = derEncode(0x30, tbsBaos.toByteArray());

        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initSign(keyPair.getPrivate());
        sig.update(tbsBytes);
        byte[] signatureBytes = sig.sign();

        ByteArrayOutputStream certBaos = new ByteArrayOutputStream();
        certBaos.write(tbsBytes);
        certBaos.write(sigAlg);
        byte[] bitString = new byte[signatureBytes.length + 1];
        bitString[0] = 0x00;
        System.arraycopy(signatureBytes, 0, bitString, 1, signatureBytes.length);
        certBaos.write(derEncode(0x03, bitString));

        byte[] fullCertDer = derEncode(0x30, certBaos.toByteArray());
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(fullCertDer));
    }

    private byte[] derEncode(int tag, byte[] content) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        baos.write(tag);
        int length = content.length;
        if (length < 128) {
            baos.write(length);
        } else if (length < 256) {
            baos.write(0x81);
            baos.write(length);
        } else if (length < 65536) {
            baos.write(0x82);
            baos.write((length >> 8) & 0xFF);
            baos.write(length & 0xFF);
        } else {
            baos.write(0x83);
            baos.write((length >> 16) & 0xFF);
            baos.write((length >> 8) & 0xFF);
            baos.write(length & 0xFF);
        }
        baos.write(content);
        return baos.toByteArray();
    }

    // =========================================================================
    // PROTOBUF ENCODING & PARSING
    // =========================================================================
    private byte[] buildPairingRequestMessage(String serviceName, String clientName) throws IOException {
        ByteArrayOutputStream reqBaos = new ByteArrayOutputStream();
        writeString(reqBaos, 1, serviceName);
        writeString(reqBaos, 2, clientName);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2);
        writeInt32(msgBaos, 2, 200);
        writeMessage(msgBaos, 3, reqBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildPairingOptionMessage() throws IOException {
        ByteArrayOutputStream encBaos = new ByteArrayOutputStream();
        writeInt32(encBaos, 1, 1);
        writeInt32(encBaos, 2, 6);

        ByteArrayOutputStream optBaos = new ByteArrayOutputStream();
        writeInt32(optBaos, 1, 1);
        writeMessage(optBaos, 2, encBaos.toByteArray());

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2);
        writeInt32(msgBaos, 2, 200);
        writeMessage(msgBaos, 5, optBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildPairingConfigurationMessage() throws IOException {
        ByteArrayOutputStream encBaos = new ByteArrayOutputStream();
        writeInt32(encBaos, 1, 1);
        writeInt32(encBaos, 2, 6);

        ByteArrayOutputStream cfgBaos = new ByteArrayOutputStream();
        writeInt32(cfgBaos, 1, 1);
        writeMessage(cfgBaos, 2, encBaos.toByteArray());

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2);
        writeInt32(msgBaos, 2, 200);
        writeMessage(msgBaos, 7, cfgBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildPairingSecretMessage(byte[] secretHash) throws IOException {
        ByteArrayOutputStream secBaos = new ByteArrayOutputStream();
        writeBytes(secBaos, 1, secretHash);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2);
        writeInt32(msgBaos, 2, 200);
        writeMessage(msgBaos, 9, secBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildRemoteConfigureMessage(int code1, String model, String vendor, String appVersion) throws IOException {
        ByteArrayOutputStream devBaos = new ByteArrayOutputStream();
        writeString(devBaos, 1, model);
        writeString(devBaos, 2, vendor);
        writeInt32(devBaos, 3, 1);
        writeString(devBaos, 4, appVersion);

        ByteArrayOutputStream cfgBaos = new ByteArrayOutputStream();
        writeInt32(cfgBaos, 1, code1);
        writeMessage(cfgBaos, 2, devBaos.toByteArray());

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeMessage(msgBaos, 1, cfgBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildRemoteSetActiveMessage(int activeCode) throws IOException {
        ByteArrayOutputStream actBaos = new ByteArrayOutputStream();
        writeInt32(actBaos, 1, activeCode);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeMessage(msgBaos, 2, actBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private byte[] buildRemoteKeyInjectMessage(int keyCode, int direction) throws IOException {
        ByteArrayOutputStream keyBaos = new ByteArrayOutputStream();
        writeInt32(keyBaos, 1, keyCode);
        writeInt32(keyBaos, 2, direction);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeMessage(msgBaos, 3, keyBaos.toByteArray());
        return msgBaos.toByteArray();
    }

    private String parseTvModelFromRemoteConfigure(byte[] data) {
        if (data == null || data.length == 0) return null;
        try {
            String raw = new String(data, "UTF-8");
            if (raw.contains("BRAVIA")) return "Sony BRAVIA TV";
            if (raw.contains("Chromecast")) return "Chromecast with Google TV";
            if (raw.contains("TCL")) return "TCL Google TV";
            if (raw.contains("Google TV")) return "Google TV";
            if (raw.contains("Android TV")) return "Android TV";
            if (raw.contains("Mi TV") || raw.contains("Xiaomi")) return "Xiaomi Smart TV";
            if (raw.contains("Hisense")) return "Hisense Google TV";
            if (raw.contains("Philips")) return "Philips Android TV";
        } catch (Exception ignored) {}
        return "Google TV";
    }

    private void writeTag(OutputStream os, int fieldNumber, int wireType) throws IOException {
        writeVarint(os, (fieldNumber << 3) | wireType);
    }

    private void writeInt32(OutputStream os, int fieldNumber, int value) throws IOException {
        writeTag(os, fieldNumber, 0);
        writeVarint(os, value);
    }

    private void writeString(OutputStream os, int fieldNumber, String str) throws IOException {
        byte[] bytes = str.getBytes("UTF-8");
        writeTag(os, fieldNumber, 2);
        writeVarint(os, bytes.length);
        os.write(bytes);
    }

    private void writeBytes(OutputStream os, int fieldNumber, byte[] bytes) throws IOException {
        writeTag(os, fieldNumber, 2);
        writeVarint(os, bytes.length);
        os.write(bytes);
    }

    private void writeMessage(OutputStream os, int fieldNumber, byte[] msgBytes) throws IOException {
        writeTag(os, fieldNumber, 2);
        writeVarint(os, msgBytes.length);
        os.write(msgBytes);
    }

    private void writeVarint(OutputStream os, long value) throws IOException {
        while (true) {
            if ((value & ~0x7FL) == 0) {
                os.write((int) value);
                return;
            } else {
                os.write((int) ((value & 0x7F) | 0x80));
                value >>>= 7;
            }
        }
    }

    private void writeDelimitedMessage(OutputStream os, byte[] message) throws IOException {
        writeVarint(os, message.length);
        os.write(message);
        os.flush();
    }

    private byte[] readDelimitedMessage(InputStream is) throws IOException {
        int length = readVarint(is);
        if (length < 0 || length > 65536) {
            throw new IOException("Invalid message length: " + length);
        }
        byte[] buf = new byte[length];
        int totalRead = 0;
        while (totalRead < length) {
            int read = is.read(buf, totalRead, length - totalRead);
            if (read < 0) throw new IOException("Unexpected EOF while reading message payload");
            totalRead += read;
        }
        return buf;
    }

    private int readVarint(InputStream is) throws IOException {
        int result = 0;
        int shift = 0;
        while (shift < 32) {
            int b = is.read();
            if (b < 0) throw new IOException("Unexpected EOF while reading varint length");
            result |= (b & 0x7F) << shift;
            if ((b & 0x80) == 0) return result;
            shift += 7;
        }
        throw new IOException("Malformed varint length");
    }

    private byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                                 + Character.digit(s.charAt(i+1), 16));
        }
        return data;
    }

    // =========================================================================
    // PERSISTENCE HELPERS
    // =========================================================================
    private void savePairedIp(String ip) {
        if (ip == null) return;
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LAST_PAIRED_IP, ip.trim()).apply();
    }

    private String getSavedPairedIp() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LAST_PAIRED_IP, null);
    }

    private void saveTvModel(String model) {
        if (model == null) return;
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LAST_TV_MODEL, model.trim()).apply();
    }

    private String getSavedTvModel() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LAST_TV_MODEL, "Google TV");
    }
}
