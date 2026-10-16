import { Redirect, type Href } from "expo-router";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { rootAuthReturn } from "../src/services/auth-links";
export default function Index() {
  const incomingUrl = Linking.useURL();
  const target = rootAuthReturn(
    Platform.OS === "web" ? globalThis.location.href : incomingUrl,
  );
  return <Redirect href={(target ?? "/(tabs)/map") as Href} />;
}
