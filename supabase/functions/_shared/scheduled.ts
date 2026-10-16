import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
export async function scheduledRequest(req: Request, admin: SupabaseClient) {
  const credential = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!credential) return false;
  const envSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (envSecret) return credential === envSecret;
  const { data, error } = await admin.rpc("authorize_dispatch", {
    provided: credential,
  });
  return !error && data === true;
}
