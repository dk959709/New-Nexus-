# Android build

NEXUS uses Capacitor 7 and the existing Android project.

## Sync the web bundle

```bash
npm install
npm run android:sync
```

## Build a debug APK

```bash
cd android
./gradlew assembleDebug
```

The APK is written under `android/app/build/outputs/apk/debug/`.

## Build a release APK

Configure your Android signing credentials in the Android build environment, then run:

```bash
cd android
./gradlew assembleRelease
```

## Supported architectures

`android/app/build.gradle` explicitly includes:

- `arm64-v8a` for modern ARM64 phones and tablets.
- `armeabi-v7a` for older ARM devices.
- `x86_64` for emulator and compatible devices.

The Docker and Node build use standard Linux/Node dependencies and are compatible with both `linux/amd64` and `linux/arm64` hosts.
