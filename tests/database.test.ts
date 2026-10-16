import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { score } from "../src/domain/rules";
let db: PGlite;
let legacyResolution: {
  status: string;
  resolved_votes: number;
  reports: number;
  old_votes: number;
  history: number;
};
const user = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  admin = "00000000-0000-4000-8000-000000000003",
  suspended = "00000000-0000-4000-8000-000000000004",
  legacy = "00000000-0000-4000-8000-000000000005";
async function as(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function root() {
  await db.exec("reset role");
}
async function deny(sql: string) {
  await db.exec("savepoint denied");
  await expect(db.exec(sql)).rejects.toThrow();
  await db.exec("rollback to savepoint denied");
}
async function create(anon = true) {
  const result = await db.query<{ id: string }>(
    `select public.create_alert(jsonb_build_object('title','Via bloqueada','description','Relato fictício de teste.','category_id','blocked','risk',2,'anonymous',$1::boolean,'region','Região simulada','occurred_at',now(),'location',jsonb_build_object('latitude',-23.550123,'longitude',-46.633456,'accuracy',15,'captured_at',now()))) id`,
    [anon],
  );
  return result.rows[0]!.id;
}
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  // Minimal Supabase platform contracts; application migration and policies run unmodified.
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public,storage to authenticated,service_role,anon;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 create publication supabase_realtime;`);
  for (const file of [
    "20261014223042_safenow_core.sql",
    "20261014223050_safenow_storage_realtime.sql",
    "20261014223054_safenow_abuse_controls.sql",
    "20261014223348_safenow_admin_nomination.sql",
    "20261014223556_safenow_server_jobs.sql",
    "20261014223905_safenow_cloud_jobs.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  // Simula uma conta de colaborador anterior à migração, com suspensão preservada.
  await db.query(
    `insert into auth.users(id,email,raw_user_meta_data) values($1,'legado@teste.example','{"name":"Conta anterior","signup_role":"collaborator","terms_accepted":true}')`,
    [legacy],
  );
  await db.query("update public.profiles set status='suspended' where id=$1", [
    legacy,
  ]);
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261015001712_safenow_two_roles.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
  );
  for (const [id, name] of [
    [user, "Pessoa comum"],
    [other, "Outra pessoa"],
    [admin, "Admin"],
    [suspended, "Suspenso"],
  ])
    await db.query(
      `insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)`,
      [
        id,
        `${id}@teste.example`,
        JSON.stringify({ name, signup_role: "user", terms_accepted: true }),
      ],
    );
  await db.query("update public.profiles set role='admin' where id=$1", [
    admin,
  ]);
  await db.query("update public.profiles set status='suspended' where id=$1", [
    suspended,
  ]);
  // Um encerramento comunitário anterior deve virar aviso pendente, sem perder o histórico.
  const oldAlert = "00000000-0000-4000-8000-000000000090";
  await db.query(
    `insert into public.alerts(id,title,description,category_id,latitude,longitude,risk,status,resolved_votes,occurred_at)
    values($1,'Alerta legado','Resolução comunitária anterior','blocked',-23.55,-46.63,2,'resolved',1,now())`,
    [oldAlert],
  );
  await db.query(
    "insert into private.votes(user_id,alert_id,kind) values($1,$2,'resolved')",
    [other, oldAlert],
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261015003614_safenow_editable_contributions.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  legacyResolution = (
    await db.query<typeof legacyResolution>(
      `select status,resolved_votes,
    (select count(*)::int from private.resolution_reports where alert_id=$1) reports,
    (select count(*)::int from private.votes where alert_id=$1) old_votes,
    (select count(*)::int from private.contribution_history where alert_id=$1 and scope='resolution') history
    from public.alerts where id=$1`,
      [oldAlert],
    )
  ).rows[0]!;
  await db.query("delete from public.alerts where id=$1", [oldAlert]);
});
beforeEach(async () => {
  await root();
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback;reset role");
});
afterAll(async () => {
  await db.close();
});
describe("Grants, RLS e papel administrativo no PostgreSQL", () => {
  it("migra colaborador sem perder conta, status ou preferências e registra auditoria", async () => {
    const result = await db.query<{
      role: string;
      status: string;
      name: string;
    }>("select role,status,name from public.profiles where id=$1", [legacy]);
    expect(result.rows[0]).toEqual({
      role: "user",
      status: "suspended",
      name: "Conta anterior",
    });
    expect(
      (
        await db.query(
          "select 1 from public.notification_preferences where user_id=$1",
          [legacy],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select 1 from public.audit_log where target_id=$1 and action='migrate_collaborator_to_user'",
          [legacy],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("cadastro ignora o antigo papel de colaborador e o banco aceita apenas user ou admin", async () => {
    const id = "00000000-0000-4000-8000-000000000098";
    await db.query(
      `insert into auth.users(id,raw_user_meta_data) values($1,'{"name":"Cadastro antigo","signup_role":"collaborator","terms_accepted":true}')`,
      [id],
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.profiles where id=$1",
          [id],
        )
      ).rows[0]?.role,
    ).toBe("user");
    await deny(
      `update public.profiles set role='collaborator' where id='${id}'`,
    );
  });
  it("a nomeação exige e-mail confirmado e é inacessível ao cliente", async () => {
    await db.exec("update public.profiles set role='user' where role='admin'");
    await db.exec(
      "insert into private.admin_nomination(email) values('nomeado@teste.example')",
    );
    const nominated = "00000000-0000-4000-8000-000000000099";
    await db.query(
      'insert into auth.users(id,email,raw_user_meta_data) values($1,\'nomeado@teste.example\',\'{"name":"Nomeado","signup_role":"admin","terms_accepted":true}\')',
      [nominated],
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.profiles where id=$1",
          [nominated],
        )
      ).rows[0]!.role,
    ).toBe("user");
    await as(user);
    await deny("select * from private.admin_nomination");
    await deny(
      "insert into private.admin_nomination(email) values('intruso@teste.example')",
    );
    await root();
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [nominated],
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.profiles where id=$1",
          [nominated],
        )
      ).rows[0]!.role,
    ).toBe("admin");
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.audit_log where action='bootstrap_admin_verified'",
        )
      ).rows[0]!.n,
    ).toBe(1);
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [other],
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.profiles where id=$1",
          [other],
        )
      ).rows[0]!.role,
    ).toBe("user");
  });
  it("jobs, retenção e verificações privilegiadas não aceitam clientes comuns", async () => {
    await as(user);
    for (const sql of [
      "select public.authorize_dispatch('x')",
      "select public.claim_verification_run()",
      "select public.retention_work()",
      "select public.retention_complete('{}'::uuid[])",
      "select public.finish_verification_run(gen_random_uuid(),'{}'::jsonb)",
      "select * from private.runtime_config",
      "select * from private.verification_runs",
    ])
      await deny(sql);
  });
  it("RLS habilitado em todas as tabelas de aplicação", async () => {
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });
  it("não permite promover o próprio perfil nem alterar status diretamente", async () => {
    await as(user);
    await deny(`update profiles set role='admin' where id='${user}'`);
    await deny(`update profiles set status='active' where id='${user}'`);
  });
  it("cadastro com metadados admin resulta em usuário comum", async () => {
    await root();
    await db.exec(
      `insert into auth.users(id,raw_user_meta_data) values('00000000-0000-4000-8000-000000000099','{"name":"Tentativa","signup_role":"admin","role":"admin","terms_accepted":true}');`,
    );
    const r = await db.query<{ role: string }>(
      "select role from profiles where id='00000000-0000-4000-8000-000000000099'",
    );
    expect(r.rows[0]?.role).toBe("user");
  });
  it("conta suspensa não lê alertas nem publica mesmo com JWT válido", async () => {
    await as(user);
    await create();
    await as(suspended);
    expect((await db.query("select * from alerts")).rows).toHaveLength(0);
    await deny(`select create_alert('{}')`);
    await deny(`select moderate_alert('${user}','confirmed','Teste válido')`);
  });
  it("comum não acessa painel por RPC, auditoria ou dados privados", async () => {
    await as(user);
    const a = await create();
    await deny(`select moderate_alert('${a}','confirmed','Teste válido')`);
    await deny(`select manage_user('${other}','suspended','Motivo de teste')`);
    expect((await db.query("select * from audit_log")).rows).toHaveLength(0);
    await deny("select * from private.alert_owners");
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
  });
  it("anônimo sem sessão não consegue ler ou escrever", async () => {
    await db.exec("set role anon");
    await deny("select * from alerts");
    await deny(`select create_alert('{}')`);
  });
  it("cria alerta com GPS privado e payload público sem autoria", async () => {
    await as(user);
    const a = await create();
    const r = await db.query<Record<string, unknown>>(
      "select * from alerts where id=$1",
      [a],
    );
    expect(r.rows[0]?.latitude).toBe(-23.55);
    expect(r.rows[0]?.longitude).toBe(-46.633);
    expect(r.rows[0]?.public_author_name).toBeNull();
    expect(r.rows[0]).not.toHaveProperty("user_id");
    expect(r.rows[0]).not.toHaveProperty("accuracy");
    await as(other);
    expect((await db.query("select * from alerts")).rows).toHaveLength(1);
    expect((await db.query("select * from my_alert_ids()")).rows).toHaveLength(
      0,
    );
  });
  it("autor nomeado só expõe nome após escolha explícita", async () => {
    await as(user);
    const a = await create(false);
    expect(
      (
        await db.query<{ public_author_name: string }>(
          "select public_author_name from alerts where id=$1",
          [a],
        )
      ).rows[0]?.public_author_name,
    ).toBe("Pessoa comum");
  });
  it("rejeita relato sem GPS ou categoria válida e excesso de publicação", async () => {
    await as(user);
    await deny(
      `select create_alert('{"title":"Teste alerta","description":"Relato inválido","category_id":"blocked","risk":2}')`,
    );
    for (let i = 0; i < 5; i++) await create();
    await db.exec("savepoint limit_test");
    await expect(create()).rejects.toThrow();
    await db.exec("rollback to savepoint limit_test");
  });
  it("migra resoluções antigas para aviso independente e reabre encerramento não moderado", () => {
    expect(legacyResolution).toEqual({
      status: "active",
      resolved_votes: 1,
      reports: 1,
      old_votes: 0,
      history: 1,
    });
  });
  it("autor não se valida; troca ou retira opinião mantendo uma só contagem e histórico", async () => {
    await as(user);
    const a = await create();
    await deny(`select vote_alert('${a}','confirm')`);
    await as(other);
    await db.exec(
      `select vote_alert('${a}','confirm');select vote_alert('${a}','confirm');`,
    );
    expect(
      (
        await db.query<{ confirmations: number }>(
          "select confirmations from alerts where id=$1",
          [a],
        )
      ).rows[0]?.confirmations,
    ).toBe(1);
    await db.exec(`select vote_alert('${a}','contest')`);
    expect(
      (
        await db.query<{ confirmations: number; contests: number }>(
          "select confirmations,contests from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({ confirmations: 0, contests: 1 });
    await db.exec(
      `select vote_alert('${a}',null);select vote_alert('${a}',null);`,
    );
    expect(
      (
        await db.query<{ confirmations: number; contests: number }>(
          "select confirmations,contests from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({ confirmations: 0, contests: 0 });
    await root();
    expect(
      (await db.query("select * from private.votes where alert_id=$1", [a]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from private.contribution_history where alert_id=$1 and scope='opinion'",
          [a],
        )
      ).rows,
    ).toHaveLength(3);
  });
  it("três avisos não resolvem: confirmação é preservada e apenas admin encerra com motivo", async () => {
    await as(user);
    const a = await create();
    await root();
    for (let i = 10; i < 13; i++)
      await db.exec(
        `insert into auth.users(id,raw_user_meta_data) values('00000000-0000-4000-8000-0000000000${i}','{"name":"Validador","terms_accepted":true}')`,
      );
    for (let i = 10; i < 13; i++) {
      await as(`00000000-0000-4000-8000-0000000000${i}`);
      await db.exec(
        `select vote_alert('${a}','confirm'); select report_resolution('${a}',true); select report_resolution('${a}',true);`,
      );
    }
    expect(
      (
        await db.query<{
          status: string;
          resolved_votes: number;
          confirmations: number;
        }>(
          "select status,resolved_votes,confirmations from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({ status: "confirmed", resolved_votes: 3, confirmations: 3 });
    await deny(
      `select moderate_alert('${a}','resolved','Solicitação de encerramento')`,
    );
    await as(admin);
    await deny(`select moderate_alert('${a}','resolved','x')`);
    await db.exec(
      `select moderate_alert('${a}','resolved','Resolução analisada pelo administrador')`,
    );
    await as("00000000-0000-4000-8000-000000000010");
    await db.exec(
      `select vote_alert('${a}',null);select report_resolution('${a}',false);`,
    );
    expect(
      (
        await db.query<{
          status: string;
          moderated: boolean;
          confirmations: number;
          resolved_votes: number;
        }>(
          "select status,moderated,confirmations,resolved_votes from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({
      status: "resolved",
      moderated: true,
      confirmations: 2,
      resolved_votes: 2,
    });
    await deny(`select vote_alert('${a}','contest')`);
    await deny(`select report_resolution('${a}',true)`);
  });
  it("retirada de opinião desfaz consenso automático, mas nunca decisão administrativa", async () => {
    await as(user);
    const a = await create();
    for (const id of [other, admin]) {
      await as(id);
      await db.exec(`select vote_alert('${a}','confirm')`);
    }
    await root();
    await db.exec(
      `insert into private.votes(user_id,alert_id,kind) values(null,'${a}','confirm'); select private.recalculate('${a}');`,
    );
    await as(other);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from alerts where id=$1",
          [a],
        )
      ).rows[0]?.status,
    ).toBe("confirmed");
    await db.exec(`select vote_alert('${a}','contest')`);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from alerts where id=$1",
          [a],
        )
      ).rows[0]?.status,
    ).toBe("active");
    await as(admin);
    await db.exec(
      `select moderate_alert('${a}','confirmed','Informação revisada pela moderação')`,
    );
    await as(other);
    await db.exec(`select vote_alert('${a}',null)`);
    expect(
      (
        await db.query<{ status: string; score: number }>(
          "select status,score from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({ status: "confirmed", score: 95 });
  });
  it("opinião e resolução são independentes, idempotentes e a consulta expõe apenas o titular", async () => {
    await as(user);
    const a = await create();
    await as(other);
    await db.exec(
      `select vote_alert('${a}','confirm');select report_resolution('${a}',true);`,
    );
    expect(
      (
        await db.query<{ state: unknown }>(
          `select my_contribution('${a}') state`,
        )
      ).rows[0]?.state,
    ).toEqual({ opinion: "confirm", resolution_reported: true });
    await db.exec(`select report_resolution('${a}',false)`);
    expect(
      (
        await db.query<{ confirmations: number; resolved_votes: number }>(
          "select confirmations,resolved_votes from alerts where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({ confirmations: 1, resolved_votes: 0 });
    await as(user);
    expect(
      (
        await db.query<{ state: unknown }>(
          `select my_contribution('${a}') state`,
        )
      ).rows[0]?.state,
    ).toEqual({ opinion: null, resolution_reported: false });
    // O autor pode avisar que terminou, mas não validar o próprio relato.
    await db.exec(`select report_resolution('${a}',true)`);
    await deny("select * from private.resolution_reports");
    await deny("select * from private.contribution_history");
    await deny(
      `insert into private.resolution_reports(user_id,alert_id) values('${other}','${a}')`,
    );
    await deny(`select vote_alert('${a}','valor-inválido')`);
  });
  it("clientes antigos enviam resolução sem apagar opinião ou encerrar; acesso oculto/suspenso é negado", async () => {
    await as(user);
    const a = await create();
    await as(other);
    await db.exec(
      `select vote_alert('${a}','confirm');select vote_alert('${a}','resolved');`,
    );
    expect(
      (
        await db.query<{ state: unknown }>(
          `select my_contribution('${a}') state`,
        )
      ).rows[0]?.state,
    ).toEqual({ opinion: "confirm", resolution_reported: true });
    await as(suspended);
    await deny(`select vote_alert('${a}','contest')`);
    await deny(`select report_resolution('${a}',true)`);
    await deny(`select my_contribution('${a}')`);
    await root();
    await db.exec("set role anon");
    await deny(`select my_contribution('${a}')`);
    await deny(`select report_resolution('${a}',true)`);
    await as(user);
    await db.exec(`select delete_alert('${a}')`);
    await as(other);
    await deny(`select vote_alert('${a}',null)`);
    await deny(`select report_resolution('${a}',false)`);
    await deny(`select my_contribution('${a}')`);
  });
  it("limita alterações de opinião e de resolução contra abuso", async () => {
    await as(user);
    const a = await create();
    await as(other);
    for (let i = 0; i < 30; i++)
      await db.exec(
        `select vote_alert('${a}','${i % 2 ? "contest" : "confirm"}')`,
      );
    await deny(`select vote_alert('${a}',null)`);
    for (let i = 0; i < 20; i++)
      await db.exec(`select report_resolution('${a}',${i % 2 === 0})`);
    await deny(`select report_resolution('${a}',true)`);
  });
  it("impede escrita direta em score, alerta e histórico", async () => {
    await as(user);
    const a = await create();
    await deny(`update alerts set score=100 where id='${a}'`);
    await deny(
      `insert into status_history(alert_id,to_status,reason) values('${a}','confirmed','forjado')`,
    );
  });
  it("somente autor corrige no prazo e exclui seu alerta", async () => {
    await as(user);
    const a = await create();
    await as(other);
    await deny(`select edit_alert('${a}','Novo título','Descrição corrigida')`);
    await deny(`select delete_alert('${a}')`);
    await as(user);
    await db.exec(
      `select edit_alert('${a}','Novo título','Descrição corrigida')`,
    );
    await root();
    await db.exec(
      `update alerts set created_at=now()-interval '16 minutes' where id='${a}'`,
    );
    await as(user);
    await deny(`select edit_alert('${a}','Outro título','Outra descrição')`);
    await db.exec(`select delete_alert('${a}')`);
    await as(other);
    expect((await db.query("select * from alerts")).rows).toHaveLength(0);
  });
  it("moderação requer motivo, aplica score, audita e rejeita transição ilegal", async () => {
    await as(user);
    const a = await create();
    await as(admin);
    await deny(`select moderate_alert('${a}','confirmed','x')`);
    await db.exec(
      `select moderate_alert('${a}','confirmed','Evidência revisada')`,
    );
    expect(
      (
        await db.query<{ score: number }>(
          "select score from alerts where id=$1",
          [a],
        )
      ).rows[0]?.score,
    ).toBe(95);
    expect(
      (
        await db.query(
          "select 1 from audit_log where target_id=$1 and action='moderate_alert:confirmed'",
          [a],
        )
      ).rows,
    ).toHaveLength(1);
    await db.exec(
      `select moderate_alert('${a}','deleted','Solicitação válida')`,
    );
    await deny(`select moderate_alert('${a}','active','Tentativa de reabrir')`);
  });
  it("admin suspende com motivo e revoga imediatamente a autorização", async () => {
    await as(admin);
    await db.exec(
      `select manage_user('${other}','suspended','Relatos abusivos em teste')`,
    );
    await as(other);
    expect((await db.query("select * from categories")).rows).toHaveLength(0);
    await deny(`select update_profile('Teste',false)`);
  });
  it("tokens e preferências só são legíveis pelo próprio usuário", async () => {
    await as(user);
    await db.exec(
      `insert into push_tokens(token,user_id) values('ExpoPushToken[test_token]','${user}')`,
    );
    await as(other);
    expect((await db.query("select * from push_tokens")).rows).toHaveLength(0);
    await deny(
      `insert into push_tokens(token,user_id) values('ExpoPushToken[other]','${user}')`,
    );
    expect(
      (await db.query("select * from notification_preferences")).rows,
    ).toHaveLength(1);
  });
  it("evidências e Storage respeitam visibilidade e bucket privado", async () => {
    await as(user);
    const a = await create();
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select evidence_upload_allowed($1) allowed",
          [a],
        )
      ).rows[0]?.allowed,
    ).toBe(true);
    await as(other);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select evidence_upload_allowed($1) allowed",
          [a],
        )
      ).rows[0]?.allowed,
    ).toBe(false);
    await deny(
      `select register_evidence('${a}','forjado','image',100,'image/jpeg')`,
    );
    await root();
    await db.exec(
      `insert into evidence(alert_id,path,kind,bytes,mime) values('${a}','${a}/fixture.jpg','image',100,'image/jpeg');insert into storage.objects(bucket_id,name) values('evidence','${a}/fixture.jpg')`,
    );
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='evidence'",
        )
      ).rows[0]?.public,
    ).toBe(false);
    await as(other);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await as(admin);
    await db.exec(
      `select moderate_alert('${a}','spam','Conteúdo de teste inválido')`,
    );
    await as(other);
    expect((await db.query("select * from evidence")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("comentários são limitados, sem autoria pública e não podem ser forjados diretamente", async () => {
    await as(user);
    const a = await create();
    await as(other);
    await deny(`select comment_alert('${a}','x')`);
    await db.exec(`select comment_alert('${a}','Informação de teste')`);
    const r = await db.query("select * from comments");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).not.toHaveProperty("user_id");
    await deny(`insert into comments(alert_id,body) values('${a}','forjado')`);
  });
  it("servidor aplica limite de evidências e deduplica entregas atomicamente", async () => {
    await as(user);
    const a = await create();
    await root();
    await db.exec("set role service_role");
    for (let i = 0; i < 3; i++)
      await db.exec(
        `select register_evidence('${a}','${a}/${i}.jpg','image',100,'image/jpeg')`,
      );
    await deny(
      `select register_evidence('${a}','${a}/4.jpg','image',100,'image/jpeg')`,
    );
    const job = (
      await db.query<{ id: number }>(
        "select id from private.notification_jobs limit 1",
      )
    ).rows[0]!.id;
    expect(
      (
        await db.query<{ ok: boolean }>(
          `select claim_delivery($1,'ExpoPushToken[test]') ok`,
          [job],
        )
      ).rows[0]?.ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          `select claim_delivery($1,'ExpoPushToken[test]') ok`,
          [job],
        )
      ).rows[0]?.ok,
    ).toBe(false);
  });
  it("score SQL coincide com domínio TypeScript", async () => {
    for (const hours of [0, 6, 24, 144]) {
      const r = await db.query<{ score: number }>(
        `select private.score(3,1,0,1,$1,false,'active') score`,
        [hours],
      );
      expect(r.rows[0]?.score).toBe(
        score({
          confirmations: 3,
          contests: 1,
          spam_votes: 0,
          evidence_count: 1,
          ageHours: hours,
          moderated: false,
          status: "active",
        }),
      );
    }
  });
  it("pedido de exclusão bloqueia conta, remove token e anonimiza nome", async () => {
    await as(user);
    const a = await create(false);
    await db.exec(
      `insert into push_tokens(token,user_id) values('ExpoPushToken[test]','${user}')`,
    );
    await db.exec("select request_account_deletion()");
    await root();
    expect(
      (
        await db.query<{ anonymous: boolean }>(
          "select anonymous from alerts where id=$1",
          [a],
        )
      ).rows[0]?.anonymous,
    ).toBe(true);
    expect((await db.query("select * from push_tokens")).rows).toHaveLength(0);
    await as(user);
    await deny(`select create_alert('{}')`);
  });
});
