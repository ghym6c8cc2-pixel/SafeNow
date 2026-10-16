import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = !!url && !!key;
// SecureStore chunks avoid per-item limits for JWTs. Web uses Supabase's browser storage
// so the PKCE verifier survives the e-mail link opening a new tab on the same origin.
export const secureStorage = {
  async getItem(k: string) {
    const count = Number((await SecureStore.getItemAsync(k + ".n")) ?? 0);
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(k + "." + i),
      ),
    );
    return parts.every((x) => x !== null) ? parts.join("") : null;
  },
  async setItem(k: string, v: string) {
    await secureStorage.removeItem(k);
    const parts = v.match(/[\s\S]{1,400}/gu) ?? [];
    for (let i = 0; i < parts.length; i++)
      await SecureStore.setItemAsync(k + "." + i, parts[i]!);
    await SecureStore.setItemAsync(k + ".n", String(parts.length));
  },
  async removeItem(k: string) {
    const n = Number((await SecureStore.getItemAsync(k + ".n")) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(k + "." + i);
    await SecureStore.deleteItemAsync(k + ".n");
  },
};
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storage: Platform.OS === "web" ? undefined : secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        lock: processLock,
      },
    })
  : null;
if (Platform.OS !== "web")
  AppState.addEventListener("change", (s) => {
    if (s === "active") supabase?.auth.startAutoRefresh();
    else supabase?.auth.stopAutoRefresh();
  });
export function db() {
  if (!supabase) throw new Error("Configure o Supabase no arquivo .env.");
  return supabase;
}
export function friendlyError(e: unknown) {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String(e.code) : "";
  if (code === "23505") return "Você já contribuiu neste alerta.";
  if (code === "42501")
    return "Acesso negado. Confira sua sessão e as permissões da conta.";
  if (code === "PGRST301" || code === "refresh_token_not_found")
    return "Sua sessão expirou. Entre novamente.";
  if (e instanceof Error && /fetch|network|internet/i.test(e.message))
    return "Sem conexão. Tente novamente quando tiver internet.";
  // Never expose SQL, stack traces or raw backend error messages.
  return "Não foi possível concluir. Verifique os dados, sua permissão e tente novamente.";
}
