import re

path = "node_modules/capacitor-tcp-socket/android/src/main/java/com/svend/plugins/tcp/socket/TcpSocketPlugin.java"

with open(path, "r") as f:
    content = f.read()

old = '''    @PluginMethod
    public void connect(PluginCall call) {
        String ipAddress = call.getString("ipAddress");

        if (ipAddress == null || ipAddress.isEmpty()) {
            call.reject("IP address is required");
            return;
        }
        Integer port = call.getInt("port", 9100);

        try {
            Socket socket = new Socket(ipAddress, port);
            clients.add(socket);
            
            JSObject ret = new JSObject();
            ret.put("client", clients.size() - 1);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Connection failed: " + e.getMessage());
            call.reject("Connection failed: " + e.getMessage());
        }
    }'''

new = '''    @PluginMethod
    public void connect(final PluginCall call) {
        final String ipAddress = call.getString("ipAddress");

        if (ipAddress == null || ipAddress.isEmpty()) {
            call.reject("IP address is required");
            return;
        }
        final Integer port = call.getInt("port", 9100);
        final int timeoutMs = call.getInt("timeout", 3000);

        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Socket socket = new Socket();
                    socket.connect(new java.net.InetSocketAddress(ipAddress, port), timeoutMs);
                    clients.add(socket);

                    JSObject ret = new JSObject();
                    ret.put("client", clients.size() - 1);
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Connection failed: " + e.getMessage());
                    call.reject("Connection failed: " + e.getMessage());
                }
            }
        });
        thread.start();
    }'''

if old not in content:
    print("PATTERN NOT FOUND - aborting")
    exit(1)

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("Patched successfully")
