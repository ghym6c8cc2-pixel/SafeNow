export type AuthPurpose = "signup" | "recovery";

// GoTrue may use Site URL when a requested development redirect is not allowed.
// Preserve the Auth return at the root instead of discarding it in navigation.
export function rootAuthReturn(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/")
      return null;
    const hash = new URLSearchParams(url.hash.slice(1));
    if (
      !url.searchParams.has("code") &&
      !url.searchParams.has("error") &&
      !hash.has("access_token") &&
      !hash.has("error")
    )
      return null;
    return "/auth/callback" + url.search + url.hash;
  } catch {
    return null;
  }
}

export function authRedirect(
  platform: string,
  origin: string | undefined,
  purpose: AuthPurpose,
) {
  let target: URL;
  if (platform === "web") {
    if (!origin)
      throw new Error("Abra o aplicativo em um endereço web válido.");
    const base = new URL(origin);
    if (!["http:", "https:"].includes(base.protocol))
      throw new Error("Endereço web inválido.");
    target = new URL("/auth/callback", base.origin);
  } else target = new URL("safenow://auth/callback");
  target.searchParams.set("flow", purpose);
  return target.toString();
}

export function parseAuthCallback(value: string) {
  const url = new URL(value);
  if (!["http:", "https:", "safenow:"].includes(url.protocol))
    throw new Error("Link inválido.");
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("error") || hash.has("error"))
    throw new Error("Link inválido ou expirado.");
  const code = url.searchParams.get("code");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!code && !(accessToken && refreshToken))
    throw new Error("Link sem confirmação de acesso.");
  return {
    code,
    tokens:
      accessToken && refreshToken
        ? { access_token: accessToken, refresh_token: refreshToken }
        : null,
    recovery:
      url.searchParams.get("flow") === "recovery" ||
      hash.get("type") === "recovery",
  };
}
