import { createClient } from "npm:@supabase/supabase-js@2.117.3";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-alert-id, x-file-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
export const backend = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export async function authenticated(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("unauthorized");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: header } },
      auth: { persistSession: false },
    },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");
  const { data: p, error: pe } = await userClient
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .single();
  if (pe || p?.status !== "active") throw new Error("unauthorized");
  return { userClient, user: data.user };
}
