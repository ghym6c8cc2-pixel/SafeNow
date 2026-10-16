import React, { useEffect } from "react";
import { Stack, router, useSegments, type Href } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SessionProvider, useSession } from "../src/state/session";
import { useRealtime } from "../src/state/queries";
import { colors, Loading } from "../src/components/ui";
import { useNotificationNavigation } from "../src/services/notifications";
import * as Linking from "expo-linking";
import { rootAuthReturn } from "../src/services/auth-links";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
function Root() {
  const incomingUrl = Linking.useURL();
  const authReturn = rootAuthReturn(
    Platform.OS === "web" ? globalThis.location.href : incomingUrl,
  );
  const { profile, ready, demoMode } = useSession(),
    segments: readonly string[] = useSegments();
  useRealtime();
  useNotificationNavigation(!!profile);
  useEffect(() => {
    if (!ready) return;
    if (authReturn) {
      router.replace(authReturn as Href);
      return;
    }
    const first = segments[0];
    if (!profile && first !== "auth" && first !== "legal")
      router.replace("/auth");
    else if (profile && first === "auth" && segments[1] !== "callback")
      router.replace("/(tabs)/map");
  }, [profile, ready, segments, authReturn]);
  if (!ready) return <Loading />;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: "white",
          headerTitle: "SafeNow",
          contentStyle: { backgroundColor: colors.light },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth/callback"
          options={{ title: "Recuperar acesso" }}
        />
        <Stack.Screen
          name="alert/[id]"
          options={{ title: "Detalhes do alerta" }}
        />
        <Stack.Screen name="admin" options={{ title: "Administração" }} />
        <Stack.Screen
          name="legal"
          options={{ title: "Termos e privacidade" }}
        />
        <Stack.Screen
          name="notifications"
          options={{ title: "Preferências de notificações" }}
        />
        <Stack.Screen
          name="safe-places"
          options={{ title: "Locais de apoio" }}
        />
      </Stack>
      <View
        style={{
          backgroundColor: demoMode ? "#fff3cf" : "#e9f1f6",
          paddingHorizontal: 16,
          paddingVertical: 7,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.navy, textAlign: "center" }}>
          {demoMode
            ? "DEMONSTRAÇÃO LOCAL · Dados fictícios. "
            : "Protótipo acadêmico · "}
          Não é atendimento de emergência. Contate os serviços oficiais.
        </Text>
      </View>
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
