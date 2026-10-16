import * as Location from "expo-location";
import { locateWith } from "./location-core";
export const locate = () =>
  locateWith({
    enabled: Location.hasServicesEnabledAsync,
    permission: async () =>
      (await Location.requestForegroundPermissionsAsync()).granted,
    current: async () => {
      const p = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "O GPS demorou para responder. Vá para um local seguro e tente novamente.",
                ),
              ),
            18000,
          ),
        ),
      ]);
      return { ...p.coords, captured_at: new Date(p.timestamp).toISOString() };
    },
  });
