import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
  TEST_USER_EMAIL: email,
  TEST_USER_PASSWORD: password,
  TEST_SUSPENDED_EMAIL: suspendedEmail,
  TEST_SUSPENDED_PASSWORD: suspendedPassword,
} = process.env;
if (
  !url ||
  !key ||
  !email ||
  !password ||
  !suspendedEmail ||
  !suspendedPassword
) {
  console.error(
    "Integração NÃO executada: configure Supabase e contas de teste ativa comum e suspensa conforme docs/TESTING.md.",
  );
  process.exit(2);
}
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const wrong = client();
assert.ok(
  (
    await wrong.auth.signInWithPassword({
      email,
      password: "incorreta" + password,
    })
  ).error,
  "Senha incorreta deve falhar",
);
const common = client(),
  login = await common.auth.signInWithPassword({ email, password });
assert.ifError(login.error);
const p = await common
  .from("profiles")
  .select("*")
  .eq("id", login.data.user.id)
  .single();
assert.ifError(p.error);
assert.equal(p.data.status, "active");
assert.notEqual(p.data.role, "admin");
const denied = await common.rpc("manage_user", {
  u: login.data.user.id,
  s: "active",
  r: "Tentativa não autorizada em teste",
});
assert.ok(denied.error, "Usuário comum não pode administrar");
const suspended = client(),
  s = await suspended.auth.signInWithPassword({
    email: suspendedEmail,
    password: suspendedPassword,
  });
// Auth may issue a JWT; live DB account status MUST deny all application data.
if (!s.error) {
  const result = await suspended.from("alerts").select("*");
  assert.ifError(result.error);
  assert.equal(result.data.length, 0);
  assert.ok((await suspended.rpc("create_alert", { p: {} })).error);
  await suspended.auth.signOut();
}
await common.auth.signOut();
console.log(
  "Integração Auth concluída: credenciais válidas, senha incorreta, suspensão e administração negada.",
);
