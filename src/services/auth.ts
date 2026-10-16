import { db } from "./supabase";
import { Platform } from "react-native";
import { authRedirect, type AuthPurpose } from "./auth-links";
import { authenticate } from "./auth-core";
import { authErrorMessage } from "./auth-errors";
import type { Profile } from "../domain/types";
function redirect(purpose: AuthPurpose) {
  return authRedirect(
    Platform.OS,
    Platform.OS === "web" ? globalThis.location?.origin : undefined,
    purpose,
  );
}
export async function loadProfile(id: string): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Profile;
}
export async function signIn(email: string, password: string) {
  return authenticate(
    {
      async signIn(e, p) {
        const { data, error } = await db().auth.signInWithPassword({
          email: e,
          password: p,
        });
        if (error) throw new Error(authErrorMessage(error, "login"));
        return data.user;
      },
      profile: loadProfile,
      async signOut() {
        await db().auth.signOut();
      },
    },
    email,
    password,
  );
}
export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await db().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: name.trim(), terms_accepted: true },
      emailRedirectTo: redirect("signup"),
    },
  });
  if (error) throw new Error(authErrorMessage(error, "signup"));
  return { signedIn: !!data.session };
}
export async function resetPassword(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirect("recovery"),
  });
  if (error) throw new Error(authErrorMessage(error, "recovery"));
}
export async function changePassword(password: string) {
  const { error } = await db().auth.updateUser({ password });
  if (error)
    throw new Error("Não foi possível atualizar a senha. Solicite outro link.");
}
