path = "src/pages/DevicesPage.tsx"

with open(path, "r") as f:
    content = f.read()

old = """        // Report scan results to NEXUS server so they are visible across the system
        try {
          await api.reportScanResults({
            devices: scanRes.devices,
            scannedSubnet: scanRes.scannedSubnet,
          });
        } catch {
          // Ignore background sync errors
        }"""

new = """        // Report scan results to NEXUS server so they are visible across the system
        // (fire-and-forget - don't block the UI if Render is cold-starting/slow)
        api.reportScanResults({
          devices: scanRes.devices,
          scannedSubnet: scanRes.scannedSubnet,
        }).catch(() => {
          // Ignore background sync errors
        });"""

if old not in content:
    print("PATTERN NOT FOUND - aborting")
    exit(1)

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("Patched successfully")
