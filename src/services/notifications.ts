import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { db } from "./supabase";
export async function registerPush() {
  if (Platform.OS === "web")
    throw new Error(
      "Push móvel exige um dispositivo Android ou iOS com development build.",
    );
  const Device = await import("expo-device");
  if (!Device.isDevice)
    throw new Error(
      "Use um dispositivo físico para registrar notificações push.",
    );
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error(
      "Configure o projeto EAS e as credenciais FCM/APNs conforme o README.",
    );
  const N = await import("expo-notifications");
  if (Platform.OS === "android") {
    await N.setNotificationChannelAsync("safenow-sound", {
      name: "Alertas SafeNow",
      importance: N.AndroidImportance.DEFAULT,
      sound: "default",
    });
    await N.setNotificationChannelAsync("safenow-silent", {
      name: "Alertas SafeNow sem som",
      importance: N.AndroidImportance.DEFAULT,
      sound: null,
    });
  }
  let permission = await N.getPermissionsAsync();
  if (!permission.granted) permission = await N.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Notificações não autorizadas. Você pode alterar a permissão nas configurações do dispositivo.",
    );
  const token = (await N.getExpoPushTokenAsync({ projectId })).data;
  const {
    data: { user },
  } = await db().auth.getUser();
  if (!user) throw new Error("Entre novamente para registrar o dispositivo.");
  const { error } = await db()
    .from("push_tokens")
    .upsert({ token, user_id: user.id, updated_at: new Date().toISOString() });
  if (error) throw error;
  return "Dispositivo registrado. Salve também sua zona e as preferências abaixo.";
}
export function alertIdFromNotification(data: Record<string, unknown>) {
  return typeof data.alert_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.alert_id)
    ? data.alert_id
    : null;
}
export function useNotificationNavigation(signedIn: boolean) {
  useEffect(() => {
    if (Platform.OS === "web" || !signedIn) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import("expo-notifications").then(async (N) => {
      if (cancelled) return;
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      const open = (data: Record<string, unknown>) => {
        const id = alertIdFromNotification(data);
        if (id) router.push(`/alert/${id}`);
      };
      const subscription = N.addNotificationResponseReceivedListener((r) =>
        open(r.notification.request.content.data ?? {}),
      );
      cleanup = () => subscription.remove();
      const last = await N.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        open(last.notification.request.content.data ?? {});
        await N.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [signedIn]);
}
