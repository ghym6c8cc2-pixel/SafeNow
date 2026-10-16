import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { bootstrapAdmin } from "./server-db.mjs";
const url = process.env.SUPABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) ||
  process.env.ALLOW_LOCAL_SEED !== "true"
)
  throw new Error(
    "Seed de usuários permitido somente em Supabase local com ALLOW_LOCAL_SEED=true.",
  );
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Defina a chave de serviço somente neste processo do servidor.",
  );
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const accounts = [];
for (const [name, role, email] of [
  ["Usuário de teste", "user", "usuario@safenow.example"],
  ["Outro usuário de teste", "user", "outro@safenow.example"],
  ["Admin de teste", "user", "admin@safenow.example"],
]) {
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, signup_role: role, terms_accepted: true },
  });
  if (error)
    throw new Error(
      "Seed requer base local limpa. Execute supabase db reset e tente novamente.",
    );
  accounts.push({ id: data.user.id, email, password });
}
await bootstrapAdmin("admin@safenow.example");
const common = createClient(
  url,
  process.env.SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const signed = await common.auth.signInWithPassword(accounts[0]);
if (signed.error)
  throw new Error("Não foi possível autenticar a conta de desenvolvimento.");
const moderator = createClient(
  url,
  process.env.SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
await moderator.auth.signInWithPassword(accounts[2]);
for (const [category, risk, status, i] of [
  ["blocked", 2, "active", 0],
  ["accident", 3, "confirmed", 1],
  ["animal", 1, "resolved", 2],
  ["fire", 4, "under_review", 3],
  ["theft", 2, "contested", 4],
]) {
  const { data: id, error } = await common.rpc("create_alert", {
    p: {
      title: "[FICTÍCIO] Exemplo acadêmico " + category,
      description:
        "Cenário inteiramente fictício para testes. Não representa uma ocorrência real.",
      category_id: category,
      risk,
      anonymous: true,
      region: "Região simulada",
      occurred_at: new Date().toISOString(),
      location: {
        latitude: -23.55 + i * 0.001,
        longitude: -46.633 + i * 0.001,
        accuracy: 15,
        captured_at: new Date().toISOString(),
      },
    },
  });
  if (error) throw new Error("Falha ao criar os alertas de exemplo.");
  if (status !== "active")
    await moderator.rpc("moderate_alert", {
      a: id,
      s: status,
      r: "Cenário fictício definido no seed de desenvolvimento.",
    });
  // Evidence fixture is generated and contains no real person, EXIF or remote URL.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWMQ0HH+DwACTgF/b3vKZgAAAABJRU5ErkJggg==",
    "base64",
  );
  const path = `${id}/fixture.png`;
  const upload = await admin.storage
    .from("evidence")
    .upload(path, png, { contentType: "image/png" });
  if (upload.error) throw new Error("Falha ao armazenar evidência fictícia.");
  const evidence = await admin.rpc("register_evidence", {
    a: id,
    p: path,
    k: "image",
    b: png.length,
    m: "image/png",
  });
  if (evidence.error) throw new Error("Falha ao registrar evidência fictícia.");
}
await mkdir(".local", { recursive: true });
await writeFile(".local/dev-accounts.json", JSON.stringify(accounts, null, 2), {
  mode: 0o600,
});
console.log(
  "Contas e alertas fictícios criados. Credenciais aleatórias em .local/dev-accounts.json (ignorado pelo Git). Não compartilhe esse arquivo.",
);
