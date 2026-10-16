import pg from "pg";
export async function serverDatabase(fn) {
  if (!process.env.SUPABASE_DB_URL)
    throw new Error("Defina SUPABASE_DB_URL somente no terminal do servidor.");
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
export async function bootstrapAdmin(email) {
  if (!email)
    throw new Error(
      "Defina BOOTSTRAP_ADMIN_EMAIL após criar e confirmar a conta pelo Supabase Auth.",
    );
  return serverDatabase(async (c) => {
    await c.query("begin");
    try {
      await c.query(
        "select pg_advisory_xact_lock(hashtext('safenow:first-admin'))",
      );
      const { rows } = await c.query(
        "select id,email_confirmed_at from auth.users where lower(email)=lower($1)",
        [email],
      );
      if (rows.length !== 1 || !rows[0].email_confirmed_at)
        throw new Error("Conta inexistente ou e-mail ainda não confirmado.");
      const id = rows[0].id;
      const existing = await c.query(
        "select id from public.profiles where role='admin' for update",
      );
      if (existing.rows.length) {
        if (existing.rows.some((p) => p.id === id)) {
          await c.query("rollback");
          return "Esta conta já é administradora.";
        }
        throw new Error(
          "Já existe um administrador. Use um procedimento institucional auditado para futuras nomeações.",
        );
      }
      const changed = await c.query(
        "update public.profiles set role='admin',updated_at=now() where id=$1 and status='active' returning id",
        [id],
      );
      if (changed.rowCount !== 1) throw new Error("O perfil deve estar ativo.");
      await c.query(
        "insert into public.audit_log(action,target_id,reason) values('bootstrap_admin',$1,'Primeiro administrador definido por operador do banco via conexão privilegiada.')",
        [id],
      );
      await c.query("commit");
      return "Primeiro administrador definido e auditado. Entre pelo login comum do aplicativo.";
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  });
}
