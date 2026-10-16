import { backend, cors, json } from "../_shared/http.ts";
import { scheduledRequest } from "../_shared/scheduled.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  const admin = backend();
  if (!(await scheduledRequest(req, admin)))
    return json({ error: "Acesso negado." }, 401);
  try {
    const { data, error } = await admin.rpc("retention_work");
    if (error) throw error;
    const work = data as {
      alerts: string[];
      paths: string[];
      accounts: string[];
    };
    for (let i = 0; i < work.paths.length; i += 100) {
      const r = await admin.storage
        .from("evidence")
        .remove(work.paths.slice(i, i + 100));
      if (r.error) throw r.error;
    }
    const completed = await admin.rpc("retention_complete", {
      alert_ids: work.alerts,
    });
    if (completed.error) throw completed.error;
    for (const id of work.accounts) {
      const removed = await admin.auth.admin.deleteUser(id);
      if (removed.error) throw removed.error;
    }
    return json({
      ok: true,
      alerts: work.alerts.length,
      accounts: work.accounts.length,
    });
  } catch {
    return json({ error: "Não foi possível concluir a retenção." }, 500);
  }
});
