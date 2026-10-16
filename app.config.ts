import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "SafeNow",
  slug: "safenow",
  version: "1.0.0",
  scheme: "safenow",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: { supportsTablet: true, bundleIdentifier: "br.edu.safenow.app" },
  android: {
    package: "br.edu.safenow.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#102c43",
    },
  },
  web: { bundler: "metro", output: "single", name: "SafeNow" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Sua localização permite ver alertas próximos e situar um relato. Ela só será obtida ao tocar em Usar GPS.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Escolha somente as evidências que deseja compartilhar.",
        cameraPermission: "Fotografe uma evidência sem se aproximar do perigo.",
        microphonePermission: false,
      },
    ],
    ["expo-notifications", { color: "#176748" }],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "",
      },
    ],
  ],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "" } },
  experiments: { typedRoutes: true },
};
export default config;
