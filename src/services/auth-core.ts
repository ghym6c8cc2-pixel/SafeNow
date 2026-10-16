import type { Profile } from "../domain/types";
// Small dependency boundary makes real login control flow testable without native modules.
export interface AuthGateway {
  signIn(email: string, password: string): Promise<{ id: string }>;
  profile(id: string): Promise<Profile>;
  signOut(): Promise<void>;
}
export async function authenticate(
  gateway: AuthGateway,
  email: string,
  password: string,
) {
  const identity = await gateway.signIn(email.trim().toLowerCase(), password);
  try {
    const profile = await gateway.profile(identity.id);
    if (profile.status !== "active")
      throw new Error(
        "Acesso negado. Conta suspensa ou com exclusão solicitada.",
      );
    return profile;
  } catch (e) {
    await gateway.signOut();
    throw e;
  }
}
export function mayAdmin(p: Profile | null) {
  return p?.status === "active" && p.role === "admin";
}
