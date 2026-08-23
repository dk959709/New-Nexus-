path = "android/app/src/main/java/com/nexus/intelligence/AndroidTvRemotePlugin.java"

with open(path, "r") as f:
    content = f.read()

old = """        int keyCode = (keyCodeVal != null && keyCodeVal > 0) ? keyCodeVal : mapActionToKeyCode(action);

        new Thread(() -> {"""

new = """        int keyCode = (keyCodeVal != null && keyCodeVal > 0) ? keyCodeVal : mapActionToKeyCode(action);
        final String finalTargetIp = targetIp;

        new Thread(() -> {"""

if old not in content:
    print("PATTERN NOT FOUND - aborting")
    exit(1)

content = content.replace(old, new)

# Replace only the two usages inside the lambda body (lines that reference targetIp for reconnect/adb fallback)
content = content.replace(
    'if (targetIp != null && !targetIp.isEmpty()) {\n                    boolean reconnected = connectControlSocketInternal(targetIp,',
    'if (finalTargetIp != null && !finalTargetIp.isEmpty()) {\n                    boolean reconnected = connectControlSocketInternal(finalTargetIp,'
)

content = content.replace(
    'if (targetIp != null && !targetIp.isEmpty()) {\n                    boolean adbSent = sendAdbKey(targetIp,',
    'if (finalTargetIp != null && !finalTargetIp.isEmpty()) {\n                    boolean adbSent = sendAdbKey(finalTargetIp,'
)

with open(path, "w") as f:
    f.write(content)

print("Patched successfully")
