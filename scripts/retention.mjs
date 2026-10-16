import { createClient } from "@supabase/supabase-js";
import { serverDatabase } from "./server-db.mjs";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Configure os segredos somente no servidor.");
const service = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
// Run daily from a trusted server after backups/retention are approved institutionally.
await serverDatabase(async (c) => {
  const expired = await c.query(
    "select e.path from public.evidence e join public.alerts a on a.id=e.alert_id where a.status in ('deleted','spam') and a.updated_at<now()-interval '30 days'",
  );
  for (let i = 0; i < expired.rows.length; i += 100) {
    const { error } = await service.storage
      .from("evidence")
      .remove(expired.rows.slice(i, i + 100).map((x) => x.path));
    if (error) throw new Error("Não foi possível limpar as mídias.");
  }
  await c.query(
    "delete from public.alerts where status in ('deleted','spam') and updated_at<now()-interval '30 days'",
  );
  // Strip retained exact GPS after 30 days. Public approximation remains with incident history.
  await c.query(
    "update private.alert_owners set latitude=round(latitude::numeric,3),longitude=round(longitude::numeric,3),accuracy=null where captured_at<now()-interval '30 days'",
  );
  const accounts = await c.query(
    "select id from public.profiles where status='deletion_requested' and updated_at<now()-interval '1 day'",
  );
  for (const p of accounts.rows) {
    await c.query("delete from private.rate_limits where user_id=$1", [p.id]);
    const { error } = await service.auth.admin.deleteUser(p.id);
    if (error) throw new Error("Falha ao processar uma exclusão de conta.");
  }
  await c.query(
    "delete from public.audit_log where created_at<now()-interval '90 days'",
  );
});
console.log(
  "Retenção processada. Nenhum conteúdo ou segredo foi registrado no log.",
);
