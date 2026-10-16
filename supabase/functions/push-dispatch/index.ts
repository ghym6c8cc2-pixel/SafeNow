import { backend, cors, json } from "../_shared/http.ts";
import { scheduledRequest } from "../_shared/scheduled.ts";
import { notificationEligible } from "../../../src/domain/rules.ts";
import type { Incident, Preferences } from "../../../src/domain/types.ts";
// Scheduled server call only. This secret never belongs in EXPO_PUBLIC variables.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  const admin = backend();
  if (!(await scheduledRequest(req, admin)))
    return json({ error: "Acesso negado." }, 401);
  try {
    await admin.rpc("maintenance");
    const { data, error } = await admin.rpc("notification_work");
    if (error) throw error;
    const work = data as {
      jobs: { id: number; alert_id: string; kind: string }[];
      alerts: Incident[];
      tokens: { token: string; user_id: string }[];
      preferences: (Preferences & { user_id: string })[];
    };
    let sent = 0;
    for (const job of work.jobs) {
      const alert = work.alerts.find((a) => a.id === job.alert_id);
      if (!alert) continue;
      for (const token of work.tokens) {
        const p = work.preferences.find((p) => p.user_id === token.user_id);
        if (!p) continue;
        let eligible = false;
        try {
          eligible = notificationEligible(alert, p);
        } catch {
          continue;
        }
        if (!eligible) continue;
        const { data: claimed, error: ce } = await admin.rpc("claim_delivery", {
          j: job.id,
          t: token.token,
        });
        if (ce || !claimed) continue;
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(Deno.env.get("EXPO_ACCESS_TOKEN")
                ? {
                    Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              to: token.token,
              title: "SafeNow · atualização próxima",
              body: "Há uma informação comunitária na sua zona de interesse. Abra para consultar os detalhes.",
              data: { alert_id: alert.id },
              sound: p.sound ? "default" : undefined,
              channelId: p.sound ? "safenow-sound" : "safenow-silent",
              ttl: 1800,
            }),
          });
          const result = await response.json();
          const ticket = result.data;
          if (!response.ok || ticket?.status !== "ok") {
            await admin.rpc("finish_delivery", {
              j: job.id,
              t: token.token,
              s: "failed",
            });
            if (ticket?.details?.error === "DeviceNotRegistered")
              await admin.from("push_tokens").delete().eq("token", token.token);
          } else {
            await admin.rpc("finish_delivery", {
              j: job.id,
              t: token.token,
              s: "sent",
              ticket_id: ticket.id,
            });
            sent++;
          }
        } catch {
          await admin.rpc("finish_delivery", {
            j: job.id,
            t: token.token,
            s: "unknown",
          });
        }
      }
    }
    // Privacy: do not log device tokens, messages, locations or credentials.
    return json({ ok: true, sent });
  } catch {
    return json({ error: "Não foi possível processar a fila." }, 500);
  }
});
