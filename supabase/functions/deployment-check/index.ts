// One-shot deployment verification. Requires both a Vault credential AND a
// short-lived run inserted by a trusted database operator. No caller data accepted.
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.117.3";
import jpeg from "npm:jpeg-js@0.4.4";
import { backend, json } from "../_shared/http.ts";
import { scheduledRequest } from "../_shared/scheduled.ts";
Deno.serve(async (req) => {
  const admin = backend();
  if (req.method !== "POST" || !(await scheduledRequest(req, admin)))
    return json({ error: "Acesso negado." }, 401);
  const run = await admin.rpc("claim_verification_run");
  if (run.error || !run.data)
    return json({ error: "Sem execução autorizada." }, 409);
  const report: Record<string, boolean | string> = {};
  const ids: string[] = [],
    alerts: string[] = [],
    paths: string[] = [];
  let stage = "setup";
  function check(name: string, value: unknown) {
    report[name] = !!value;
    if (!value) throw new Error(name);
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const clients: SupabaseClient[] = [];
  try {
    const accounts = [];
    for (const [index, role] of ["admin", "user", "user"].entries()) {
      const email = `safenow-check-${crypto.randomUUID()}@example.invalid`;
      const password = crypto.randomUUID() + crypto.randomUUID().slice(0, 16);
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: "Verificação temporária",
          signup_role: role,
          terms_accepted: true,
        },
      });
      if (created.error || !created.data.user) throw new Error("fixture");
      const id = created.data.user.id;
      ids.push(id);
      const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clients.push(client);
      const login = await client.auth.signInWithPassword({ email, password });
      check(
        `login_account_${index}`,
        !login.error && login.data.user?.id === id,
      );
      accounts.push({
        id,
        email,
        password,
        client,
        token: login.data.session!.access_token,
      });
    }
    const [author, voter, moderator] = accounts;
    stage = "auth";
    const own = await author.client
      .from("profiles")
      .select("role,status")
      .eq("id", author.id)
      .single();
    check(
      "forged_admin_signup_denied",
      !own.error && own.data?.role === "user",
    );
    const wrong = await voter.client.auth.signInWithPassword({
      email: author.email,
      password: "wrong" + author.password,
    });
    check("incorrect_password_denied", !!wrong.error);
    check(
      "self_role_change_denied",
      !!(
        await author.client
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", author.id)
      ).error,
    );
    check(
      "common_admin_rpc_denied",
      !!(
        await author.client.rpc("manage_user", {
          u: voter.id,
          s: "suspended",
          r: "Verificação temporária",
        })
      ).error,
    );
    const promoted = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", moderator.id);
    check("server_fixture_admin", !promoted.error);
    const relogin = await moderator.client.auth.signInWithPassword({
      email: moderator.email,
      password: moderator.password,
    });
    const adminProfile = await moderator.client
      .from("profiles")
      .select("role")
      .eq("id", moderator.id)
      .single();
    check(
      "admin_same_login",
      !relogin.error && adminProfile.data?.role === "admin",
    );
    const generated = await admin.auth.admin.generateLink({
      type: "recovery",
      email: author.email,
      options: {
        redirectTo: "http://localhost:3000/auth/callback?flow=recovery",
      },
    });
    if (!generated.error && generated.data.properties?.action_link) {
      const redirect = new URL(
        generated.data.properties.action_link,
      ).searchParams.get("redirect_to");
      if (redirect)
        report.auth_redirect =
          new URL(redirect).origin + new URL(redirect).pathname;
      check("recovery_link_generated", true);
    } else check("recovery_link_generated", false);
    stage = "alerts";
    const created = await author.client.rpc("create_alert", {
      p: {
        title: "Teste automatizado de implantação",
        description:
          "Ocorrência fictícia temporária. Será removida após a verificação.",
        category_id: "blocked",
        risk: 2,
        anonymous: true,
        region: "Região simulada",
        occurred_at: new Date().toISOString(),
        location: {
          latitude: -23.550123,
          longitude: -46.633456,
          accuracy: 15,
          captured_at: new Date().toISOString(),
        },
      },
    });
    check("create_alert", !created.error && typeof created.data === "string");
    const alert = created.data as string;
    alerts.push(alert);
    const feed = await voter.client
      .from("alerts")
      .select("*")
      .eq("id", alert)
      .single();
    check(
      "anonymous_public_feed",
      !feed.error &&
        feed.data?.anonymous &&
        feed.data?.public_author_name === null &&
        !Object.hasOwn(feed.data, "user_id") &&
        !Object.hasOwn(feed.data, "author_id"),
    );
    check(
      "public_location_rounded",
      feed.data?.latitude === -23.55 && feed.data?.longitude === -46.633,
    );
    check(
      "one_vote",
      !(await voter.client.rpc("vote_alert", { a: alert, k: "confirm" })).error,
    );
    check(
      "opinion_change_allowed",
      !(await voter.client.rpc("vote_alert", { a: alert, k: "contest" })).error,
    );
    check(
      "self_vote_denied",
      !!(await author.client.rpc("vote_alert", { a: alert, k: "confirm" }))
        .error,
    );
    check(
      "comment",
      !(
        await voter.client.rpc("comment_alert", {
          a: alert,
          b: "Comentário fictício de verificação.",
        })
      ).error,
    );
    check(
      "ordinary_moderation_denied",
      !!(
        await author.client.rpc("moderate_alert", {
          a: alert,
          s: "confirmed",
          r: "Verificação temporária",
        })
      ).error,
    );
    stage = "evidence";
    const bytes = jpeg.encode(
      { width: 1, height: 1, data: new Uint8Array([20, 160, 90, 255]) },
      80,
    ).data;
    const upload = await fetch(url + "/functions/v1/evidence-upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${author.token}`,
        "Content-Type": "image/jpeg",
        "x-alert-id": alert,
        "x-file-name": "ficticio.jpg",
      },
      body: new Uint8Array(bytes),
    });
    check("evidence_upload", upload.ok);
    const evidence = await voter.client
      .from("evidence")
      .select("path")
      .eq("alert_id", alert)
      .single();
    check("evidence_visible", !evidence.error && !!evidence.data?.path);
    paths.push(evidence.data!.path);
    check(
      "authorized_signed_url",
      !(
        await voter.client.storage
          .from("evidence")
          .createSignedUrl(paths[0], 60)
      ).error,
    );
    const anonymous = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });
    check(
      "anonymous_storage_denied",
      !!(await anonymous.storage.from("evidence").createSignedUrl(paths[0], 60))
        .error,
    );
    check(
      "foreign_upload_denied",
      (
        await fetch(url + "/functions/v1/evidence-upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${voter.token}`,
            "Content-Type": "image/jpeg",
            "x-alert-id": alert,
            "x-file-name": "ficticio.jpg",
          },
          body: new Uint8Array(bytes),
        })
      ).status === 403,
    );
    stage = "moderation";
    check(
      "admin_moderation",
      !(
        await moderator.client.rpc("moderate_alert", {
          a: alert,
          s: "spam",
          r: "Verificação temporária de implantação.",
        })
      ).error,
    );
    const hidden = await voter.client
      .from("alerts")
      .select("id")
      .eq("id", alert);
    check("spam_hidden", !hidden.error && hidden.data?.length === 0);
    check(
      "revoked_storage_denied",
      !!(
        await voter.client.storage
          .from("evidence")
          .createSignedUrl(paths[0], 60)
      ).error,
    );
    check(
      "admin_suspension",
      !(
        await moderator.client.rpc("manage_user", {
          u: author.id,
          s: "suspended",
          r: "Verificação temporária de implantação.",
        })
      ).error,
    );
    const suspendedLogin = await author.client.auth.signInWithPassword({
      email: author.email,
      password: author.password,
    });
    check(
      "suspended_session_denied_app_data",
      !!suspendedLogin.error ||
        (await author.client.from("alerts").select("id")).data?.length === 0,
    );
    check(
      "suspended_rpc_denied",
      !!(await author.client.rpc("create_alert", { p: {} })).error,
    );
    check(
      "ordinary_worker_denied",
      (
        await fetch(url + "/functions/v1/push-dispatch", {
          method: "POST",
          headers: { Authorization: `Bearer ${voter.token}` },
        })
      ).status === 401,
    );
    report.ok = true;
  } catch {
    report.ok = false;
    report.failed_stage = stage;
  } finally {
    for (const c of clients) await c.removeAllChannels();
    if (alerts.length) {
      const media = await admin
        .from("evidence")
        .select("path")
        .in("alert_id", alerts);
      const allPaths = [
        ...new Set([
          ...paths,
          ...(media.data ?? []).map((x) => x.path as string),
        ]),
      ];
      if (allPaths.length)
        await admin.storage.from("evidence").remove(allPaths);
      await admin.from("alerts").delete().in("id", alerts);
    }
    if (ids.length) await admin.from("audit_log").delete().in("actor_id", ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
    report.fixtures_removed =
      (await admin.from("profiles").select("id").in("id", ids)).data?.length ===
      0;
    await admin.rpc("finish_verification_run", { run_id: run.data, report });
  }
  return json({ ok: report.ok === true });
});
