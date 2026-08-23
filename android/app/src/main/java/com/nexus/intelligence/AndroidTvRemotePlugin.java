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
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.text.SimpleDateFormat;
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
        JSObject res = new JSObject();
        boolean socketAlive = isRemoteSocketAlive();
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
        String ip = call.getString("ipAddress");
        Integer portVal = call.getInt("port", 6467);
        final String targetIp = (ip != null && !ip.trim().isEmpty()) ? ip.trim() : getSavedPairedIp();
        final int targetPort = (portVal != null && portVal > 0) ? portVal : 6467;

        if (targetIp == null || targetIp.isEmpty()) {
            call.reject("TV IP address is required for pairing");
            return;
        }

        new Thread(() -> {
            try {
                Log.d(TAG, "Starting TLS pairing with TV at " + targetIp + ":" + targetPort);
                closePairingSession();

                // 1. Ensure Client Certificate and RSA Key exist
                ensureClientCertificate();

                // 2. Open TLS Socket to Pairing Port (6467)
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

                // Step 1: Send PairingRequest
                // PairingMessage: protocol_version=2, status=STATUS_OK(200), pairing_request { service_name="nexus.remote", client_name="Nexus Remote" }
                byte[] pairingReqMsg = buildPairingRequestMessage("nexus.remote", "Nexus Remote");
                writeDelimitedMessage(pairingOut, pairingReqMsg);

                // Step 2: Read PairingRequestAck
                byte[] ack1 = readDelimitedMessage(pairingIn);
                Log.d(TAG, "Received PairingRequestAck (" + (ack1 != null ? ack1.length : 0) + " bytes)");

                // Step 3: Send PairingOption (preferred_role=1, input_encodings=[HEXADECIMAL, len=6])
                byte[] optionMsg = buildPairingOptionMessage();
                writeDelimitedMessage(pairingOut, optionMsg);

                // Step 4: Read PairingOptionAck -> TV displays the PIN!
                byte[] ack2 = readDelimitedMessage(pairingIn);
                Log.d(TAG, "Received PairingOptionAck. TV is now displaying PIN!");

                // Step 5: Send PairingConfiguration
                byte[] configMsg = buildPairingConfigurationMessage();
                writeDelimitedMessage(pairingOut, configMsg);

                // Step 6: Read PairingConfigurationAck
                byte[] ack3 = readDelimitedMessage(pairingIn);
                Log.d(TAG, "Received PairingConfigurationAck");

                JSObject res = new JSObject();
                res.put("status", "NEED_PIN");
                res.put("ip", targetIp);
                res.put("port", targetPort);
                res.put("message", "Enter the 6-character code displayed on your TV screen");
                call.resolve(res);

            } catch (Exception e) {
                Log.e(TAG, "Pairing handshake failed", e);
                closePairingSession();
                call.reject("Failed to initiate TV pairing: " + e.getMessage(), e);
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

        new Thread(() -> {
            try {
                if (pairingSocket == null || pairingOut == null || pairingIn == null) {
                    call.reject("No active pairing session. Please click Connect to start pairing first.");
                    return;
                }

                X509Certificate clientCert = getClientCertificate();
                if (clientCert == null || serverCertificate == null) {
                    call.reject("Certificate exchange incomplete during pairing.");
                    return;
                }

                // Compute Secret Hash: SHA-256(client_cert_der + server_cert_der + pin_bytes)
                byte[] clientCertBytes = clientCert.getEncoded();
                byte[] serverCertBytes = serverCertificate.getEncoded();

                // Compute PIN bytes (try hex decode if 6 hex chars, or ASCII bytes)
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

                // Send PairingSecret
                byte[] secretMsg = buildPairingSecretMessage(secretHash);
                writeDelimitedMessage(pairingOut, secretMsg);

                // Read PairingSecretAck
                byte[] secretAck = readDelimitedMessage(pairingIn);
                Log.d(TAG, "Received PairingSecretAck (" + (secretAck != null ? secretAck.length : 0) + " bytes)");

                // Save paired IP
                savePairedIp(pendingPairingIp);
                closePairingSession();

                // Connect to Remote Control Port (6466) immediately
                boolean controlConnected = connectControlSocketInternal(pendingPairingIp, 6466);

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("status", "PAIRED");
                res.put("isConnected", controlConnected);
                res.put("ip", pendingPairingIp);
                res.put("deviceName", connectedTvModel);
                res.put("model", connectedTvModel);
                res.put("message", "Smart TV paired and connected successfully!");
                call.resolve(res);

            } catch (Exception e) {
                Log.e(TAG, "Failed to complete PIN verification", e);
                closePairingSession();
                call.reject("PIN verification failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void connectTv(PluginCall call) {
        String ip = call.getString("ipAddress");
        Integer portVal = call.getInt("port", 6466);
        final String targetIp = (ip != null && !ip.trim().isEmpty()) ? ip.trim() : getSavedPairedIp();
        final int targetPort = (portVal != null && portVal > 0) ? portVal : 6466;

        if (targetIp == null || targetIp.isEmpty()) {
            call.reject("TV IP address is required");
            return;
        }

        new Thread(() -> {
            try {
                // If targeting ADB port (5555), test ADB socket
                if (targetPort == 5555) {
                    boolean adbOk = testAdbSocket(targetIp, 5555);
                    JSObject res = new JSObject();
                    res.put("success", adbOk);
                    res.put("isConnected", adbOk);
                    res.put("isPaired", true);
                    res.put("ip", targetIp);
                    res.put("port", 5555);
                    res.put("deviceName", "Android TV (ADB)");
                    res.put("model", "Android TV");
                    call.resolve(res);
                    return;
                }

                // Connect over TLS to Port 6466
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
                    call.resolve(res);
                } else {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("needPairing", true);
                    res.put("error", "Pairing required with TV");
                    call.resolve(res);
                }
            } catch (Exception e) {
                Log.e(TAG, "Connection to TV failed", e);
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("needPairing", true);
                res.put("error", e.getMessage());
                call.resolve(res);
            }
        }).start();
    }

    @PluginMethod
    public void sendKey(PluginCall call) {
        String action = call.getString("action");
        Integer keyCodeVal = call.getInt("keyCode", 0);
        String targetIp = call.getString("ipAddress");
        if (targetIp == null || targetIp.isEmpty()) {
            targetIp = connectedTvIp != null ? connectedTvIp : getSavedPairedIp();
        }

        int keyCode = (keyCodeVal != null && keyCodeVal > 0) ? keyCodeVal : mapActionToKeyCode(action);

        new Thread(() -> {
            try {
                // 1. Try TLS Remote Control Socket (Port 6466)
                if (isRemoteSocketAlive()) {
                    boolean sent = sendRemoteKeyInject(keyCode);
                    if (sent) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("action", action);
                        res.put("keyCode", keyCode);
                        call.resolve(res);
                        return;
                    }
                }

                // 2. If socket not connected, try re-connecting to 6466
                if (targetIp != null && !targetIp.isEmpty()) {
                    boolean reconnected = connectControlSocketInternal(targetIp, connectedTvPort > 0 ? connectedTvPort : 6466);
                    if (reconnected && isRemoteSocketAlive()) {
                        boolean sent = sendRemoteKeyInject(keyCode);
                        if (sent) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("action", action);
                            res.put("keyCode", keyCode);
                            call.resolve(res);
                            return;
                        }
                    }
                }

                // 3. Fallback to ADB Socket on 5555 if configured
                if (targetIp != null && !targetIp.isEmpty()) {
                    boolean adbSent = sendAdbKey(targetIp, 5555, keyCode);
                    if (adbSent) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("action", action);
                        res.put("keyCode", keyCode);
                        call.resolve(res);
                        return;
                    }
                }

                call.reject("Cannot send key: TV is not connected. Please pair or connect to your Smart TV.");

            } catch (Exception e) {
                Log.e(TAG, "Error sending key command", e);
                call.reject("Failed to send key to TV: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeRemoteControlSession();
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
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

            // Step 1: Send RemoteConfigure
            // RemoteMessage { remote_configure { code1: 622, device_info { model: "Nexus Phone", vendor: "Nexus", unknown: 1, app_version: "1.0.0" } } }
            byte[] configMsg = buildRemoteConfigureMessage(622, "Nexus Remote", "Nexus", "1.0.0");
            writeDelimitedMessage(remoteControlOut, configMsg);

            // Step 2: Read TV's RemoteConfigure response to get the TV's model name!
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

            // Step 3: Send RemoteSetActive
            byte[] activeMsg = buildRemoteSetActiveMessage(622);
            writeDelimitedMessage(remoteControlOut, activeMsg);

            // Set normal timeout for ongoing keys
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
            // Direction 1 = SHORT_PRESS (Press and release)
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
            try {
                remoteControlSocket.close();
            } catch (Exception ignored) {
            }
            remoteControlSocket = null;
        }
        remoteControlOut = null;
        remoteControlIn = null;
    }

    private synchronized void closePairingSession() {
        if (pairingSocket != null) {
            try {
                pairingSocket.close();
            } catch (Exception ignored) {
            }
            pairingSocket = null;
        }
        pairingOut = null;
        pairingIn = null;
    }

    // =========================================================================
    // ADB FALLBACK (PORT 5555)
    // =========================================================================
    private boolean testAdbSocket(String ip, int port) {
        try {
            Socket s = new Socket();
            s.connect(new InetSocketAddress(ip, port), 2000);
            s.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean sendAdbKey(String ip, int port, int keyCode) {
        Socket s = null;
        try {
            s = new Socket();
            s.connect(new InetSocketAddress(ip, port), 2500);
            OutputStream out = s.getOutputStream();
            // Send standard shell input keyevent
            String cmd = "input keyevent " + keyCode + "\n";
            out.write(cmd.getBytes("UTF-8"));
            out.flush();
            Thread.sleep(50);
            s.close();
            return true;
        } catch (Exception e) {
            if (s != null) {
                try {
                    s.close();
                } catch (Exception ignored) {}
            }
            return false;
        }
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

        Log.d(TAG, "Client certificate generated and persisted successfully.");
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

    /**
     * Pure Java DER-encoded X.509 v3 Certificate Generator (No external dependencies)
     */
    private X509Certificate generateSelfSignedCertificate(KeyPair keyPair) throws Exception {
        long now = System.currentTimeMillis();
        Date notBefore = new Date(now - 86400000L); // 1 day ago
        Date notAfter = new Date(now + 10L * 365 * 24 * 3600 * 1000L); // 10 years

        SimpleDateFormat sdf = new SimpleDateFormat("yyMMddHHmmss'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        byte[] notBeforeBytes = sdf.format(notBefore).getBytes("US-ASCII");
        byte[] notAfterBytes = sdf.format(notAfter).getBytes("US-ASCII");

        // 1. Validity
        ByteArrayOutputStream validityBaos = new ByteArrayOutputStream();
        validityBaos.write(derEncode(0x17, notBeforeBytes)); // UTCTime
        validityBaos.write(derEncode(0x17, notAfterBytes)); // UTCTime
        byte[] validity = derEncode(0x30, validityBaos.toByteArray());

        // 2. Subject / Issuer: CN=NexusRemote
        byte[] cnValue = derEncode(0x0C, "NexusRemote".getBytes("UTF-8")); // UTF8String
        byte[] cnOid = new byte[]{ 0x06, 0x03, 0x55, 0x04, 0x03 }; // OID: 2.5.4.3 (commonName)
        ByteArrayOutputStream atvBaos = new ByteArrayOutputStream();
        atvBaos.write(cnOid);
        atvBaos.write(cnValue);
        byte[] rdn = derEncode(0x31, derEncode(0x30, atvBaos.toByteArray())); // SET of SEQUENCE
        byte[] name = derEncode(0x30, rdn); // SEQUENCE of SET

        // 3. Signature Algorithm: sha256WithRSAEncryption (1.2.840.113549.1.1.11)
        byte[] sigAlg = new byte[]{
            0x30, 0x0D,
            0x06, 0x09, 0x2A, (byte)0x86, 0x48, (byte)0x86, (byte)0xF7, 0x0D, 0x01, 0x01, 0x0B,
            0x05, 0x00
        };

        // 4. SubjectPublicKeyInfo (from RSA public key)
        byte[] pubKeyInfo = keyPair.getPublic().getEncoded();

        // 5. Build TBSCertificate
        ByteArrayOutputStream tbsBaos = new ByteArrayOutputStream();
        // Version: [0] EXPLICIT INTEGER (version 2 = v3)
        tbsBaos.write(new byte[]{ (byte)0xA0, 0x03, 0x02, 0x01, 0x02 });
        // Serial Number: INTEGER 1
        tbsBaos.write(new byte[]{ 0x02, 0x01, 0x01 });
        // Signature Algorithm
        tbsBaos.write(sigAlg);
        // Issuer
        tbsBaos.write(name);
        // Validity
        tbsBaos.write(validity);
        // Subject
        tbsBaos.write(name);
        // SubjectPublicKeyInfo
        tbsBaos.write(pubKeyInfo);

        byte[] tbsBytes = derEncode(0x30, tbsBaos.toByteArray());

        // 6. Sign TBSCertificate with RSA Private Key
        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initSign(keyPair.getPrivate());
        sig.update(tbsBytes);
        byte[] signatureBytes = sig.sign();

        // 7. Assemble Full X.509 Certificate
        ByteArrayOutputStream certBaos = new ByteArrayOutputStream();
        certBaos.write(tbsBytes);
        certBaos.write(sigAlg);
        // Signature BIT STRING (0 unused bits prefix)
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
        writeInt32(msgBaos, 1, 2); // protocol_version = 2
        writeInt32(msgBaos, 2, 200); // status = 200 (STATUS_OK)
        writeMessage(msgBaos, 3, reqBaos.toByteArray()); // pairing_request

        return msgBaos.toByteArray();
    }

    private byte[] buildPairingOptionMessage() throws IOException {
        ByteArrayOutputStream encBaos = new ByteArrayOutputStream();
        writeInt32(encBaos, 1, 1); // type = ENCODING_HEXADECIMAL (1)
        writeInt32(encBaos, 2, 6); // symbol_length = 6

        ByteArrayOutputStream optBaos = new ByteArrayOutputStream();
        writeInt32(optBaos, 1, 1); // preferred_role = ROLE_INPUT (1)
        writeMessage(optBaos, 2, encBaos.toByteArray()); // input_encodings

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2); // protocol_version = 2
        writeInt32(msgBaos, 2, 200); // status = 200
        writeMessage(msgBaos, 5, optBaos.toByteArray()); // pairing_option

        return msgBaos.toByteArray();
    }

    private byte[] buildPairingConfigurationMessage() throws IOException {
        ByteArrayOutputStream encBaos = new ByteArrayOutputStream();
        writeInt32(encBaos, 1, 1); // type = ENCODING_HEXADECIMAL (1)
        writeInt32(encBaos, 2, 6); // symbol_length = 6

        ByteArrayOutputStream cfgBaos = new ByteArrayOutputStream();
        writeInt32(cfgBaos, 1, 1); // client_role = ROLE_INPUT (1)
        writeMessage(cfgBaos, 2, encBaos.toByteArray()); // encoding

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2); // protocol_version = 2
        writeInt32(msgBaos, 2, 200); // status = 200
        writeMessage(msgBaos, 7, cfgBaos.toByteArray()); // pairing_configuration

        return msgBaos.toByteArray();
    }

    private byte[] buildPairingSecretMessage(byte[] secretHash) throws IOException {
        ByteArrayOutputStream secBaos = new ByteArrayOutputStream();
        writeBytes(secBaos, 1, secretHash);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeInt32(msgBaos, 1, 2); // protocol_version = 2
        writeInt32(msgBaos, 2, 200); // status = 200
        writeMessage(msgBaos, 9, secBaos.toByteArray()); // pairing_secret

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
        writeMessage(msgBaos, 1, cfgBaos.toByteArray()); // remote_configure

        return msgBaos.toByteArray();
    }

    private byte[] buildRemoteSetActiveMessage(int activeCode) throws IOException {
        ByteArrayOutputStream actBaos = new ByteArrayOutputStream();
        writeInt32(actBaos, 1, activeCode);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeMessage(msgBaos, 2, actBaos.toByteArray()); // remote_set_active

        return msgBaos.toByteArray();
    }

    private byte[] buildRemoteKeyInjectMessage(int keyCode, int direction) throws IOException {
        ByteArrayOutputStream keyBaos = new ByteArrayOutputStream();
        writeInt32(keyBaos, 1, keyCode);
        writeInt32(keyBaos, 2, direction);

        ByteArrayOutputStream msgBaos = new ByteArrayOutputStream();
        writeMessage(msgBaos, 3, keyBaos.toByteArray()); // remote_key_inject

        return msgBaos.toByteArray();
    }

    private String parseTvModelFromRemoteConfigure(byte[] data) {
        if (data == null || data.length == 0) return null;
        try {
            // Scan for readable string in payload
            String raw = new String(data, "UTF-8");
            if (raw.contains("BRAVIA")) return "Sony BRAVIA TV";
            if (raw.contains("Chromecast")) return "Chromecast with Google TV";
            if (raw.contains("TCL")) return "TCL Google TV";
            if (raw.contains("Google TV")) return "Google TV";
            if (raw.contains("Android TV")) return "Android TV";
            if (raw.contains("Mi TV") || raw.contains("Xiaomi")) return "Xiaomi Smart TV";
            if (raw.contains("Hisense")) return "Hisense Google TV";
            if (raw.contains("Philips")) return "Philips Android TV";
        } catch (Exception ignored) {
        }
        return "Google TV";
    }

    private void writeTag(OutputStream os, int fieldNumber, int wireType) throws IOException {
        writeVarint(os, (fieldNumber << 3) | wireType);
    }

    private void writeInt32(OutputStream os, int fieldNumber, int value) throws IOException {
        writeTag(os, fieldNumber, 0); // varint
        writeVarint(os, value);
    }

    private void writeString(OutputStream os, int fieldNumber, String str) throws IOException {
        byte[] bytes = str.getBytes("UTF-8");
        writeTag(os, fieldNumber, 2); // length-delimited
        writeVarint(os, bytes.length);
        os.write(bytes);
    }

    private void writeBytes(OutputStream os, int fieldNumber, byte[] bytes) throws IOException {
        writeTag(os, fieldNumber, 2); // length-delimited
        writeVarint(os, bytes.length);
        os.write(bytes);
    }

    private void writeMessage(OutputStream os, int fieldNumber, byte[] msgBytes) throws IOException {
        writeTag(os, fieldNumber, 2); // length-delimited
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
