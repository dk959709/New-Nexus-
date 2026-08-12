export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function getLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. You can still search for a city manually.',
          2: 'Unable to determine your location. Please search for a city.',
          3: 'Location request timed out. Please search for a city.',
        };
        reject(new Error(messages[error.code] ?? 'Unable to determine your location.'));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
