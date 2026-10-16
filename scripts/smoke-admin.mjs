// QA isolado: API interceptada, sem usar contas, senhas ou decisões reais.
import { chromium, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { loadEnvFile } from "node:process";
if (existsSync(".env")) loadEnvFile(".env");
const origin = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!origin)
  throw new Error(
    "O teste administrativo usa um bundle configurado para Supabase; a API será interceptada.",
  );
const root = resolve("dist"),
  port = 8098;
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".html": "text/html",
};
const server = createServer(async (req, res) => {
  const file = resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader("Content-Type", mime[extname(file)] ?? "text/html");
    res.end(await readFile(extname(file) ? file : resolve(root, "index.html")));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
let browser;
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  one: "00000000-0000-4000-8000-000000000002",
  two: "00000000-0000-4000-8000-000000000003",
  deleted: "00000000-0000-4000-8000-000000000004",
};
const now = new Date().toISOString();
const profiles = [
  { id: ids.admin, name: "Admin de teste", role: "admin", status: "active" },
  { id: ids.one, name: "Pessoa de teste", role: "user", status: "active" },
  { id: ids.two, name: "Outra pessoa", role: "user", status: "active" },
  {
    id: ids.deleted,
    name: "Conta com exclusão",
    role: "user",
    status: "deletion_requested",
  },
].map((p) => ({ ...p, anonymous_default: true, created_at: now }));
const alertBase = {
  description: "Cenário fictício de QA, sem ocorrência real.",
  category_id: "blocked",
  latitude: -23.55,
  longitude: -46.63,
  region: "Região simulada",
  risk: 2,
  score: 40,
  anonymous: true,
  public_author_name: null,
  occurred_at: now,
  created_at: now,
  updated_at: now,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  evidence_count: 0,
  confirmations: 0,
  contests: 0,
  spam_votes: 0,
  moderated: false,
};
const alerts = [
  {
    ...alertBase,
    id: "00000000-0000-4000-8000-000000000010",
    title: "[FICTÍCIO] Via liberada",
    status: "active",
    resolved_votes: 2,
  },
  {
    ...alertBase,
    id: "00000000-0000-4000-8000-000000000011",
    title: "[FICTÍCIO] Conteúdo em análise",
    status: "under_review",
    resolved_votes: 0,
  },
];
const audit = [],
  calls = { moderate: [], manage: [] },
  unexpected = [],
  errors = [];
let failNextModeration = false;
async function prepare(role = "admin") {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 1100 },
    locale: "pt-BR",
  });
  const profile = profiles.find(
    (p) => p.id === (role === "admin" ? ids.admin : ids.one),
  );
  const user = {
    id: profile.id,
    aud: "authenticated",
    role: "authenticated",
    email: "qa@example.invalid",
    email_confirmed_at: now,
    created_at: now,
    user_metadata: {},
    app_metadata: { provider: "email", providers: ["email"] },
  };
  const jwt = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      role: "authenticated",
      aud: "authenticated",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    "qa-signature",
  ]
    .map((part, i) =>
      i < 2 ? Buffer.from(JSON.stringify(part)).toString("base64url") : part,
    )
    .join(".");
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: `sb-${new URL(origin).hostname.split(".")[0]}-auth-token`,
      session: {
        access_token: jwt,
        refresh_token: "qa-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      },
    },
  );
  await context.routeWebSocket(/.*/, (socket) => socket.close());
  await context.route(`${origin}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info,prefer",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info,prefer",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    if (path === "/auth/v1/user") return reply(user);
    if (path === "/rest/v1/profiles")
      return reply(url.searchParams.has("id") ? profile : profiles);
    if (path === "/rest/v1/alerts")
      return reply(
        url.searchParams.has("id")
          ? (alerts.find((a) => `eq.${a.id}` === url.searchParams.get("id")) ??
              null)
          : alerts,
      );
    if (path === "/rest/v1/categories")
      return reply([
        {
          id: "blocked",
          name: "Via bloqueada",
          active: true,
          default_risk: 2,
          icon: "blocked",
        },
      ]);
    if (path === "/rest/v1/audit_log") return reply(audit);
    if (path === "/rest/v1/rpc/my_alert_ids") return reply([]);
    if (path === "/rest/v1/rpc/moderate_alert") {
      const p = req.postDataJSON();
      if (role !== "admin" || failNextModeration) {
        failNextModeration = false;
        return reply({ code: "42501", message: "Denied" }, 403);
      }
      expect(p.r.trim().length).toBeGreaterThanOrEqual(8);
      expect(p.r.length).toBeLessThanOrEqual(500);
      const a = alerts.find((a) => a.id === p.a);
      a.status = p.s;
      a.moderated = true;
      calls.moderate.push(p);
      audit.unshift({
        id: audit.length + 1,
        action: `moderate_alert:${p.s}`,
        target_id: a.id,
        actor_id: ids.admin,
        reason: p.r,
        created_at: now,
      });
      return reply(null);
    }
    if (path === "/rest/v1/rpc/manage_user") {
      const p = req.postDataJSON();
      if (role !== "admin")
        return reply({ code: "42501", message: "Denied" }, 403);
      expect(p.r.trim().length).toBeGreaterThanOrEqual(8);
      profiles.find((u) => u.id === p.u).status = p.s;
      calls.manage.push(p);
      audit.unshift({
        id: audit.length + 1,
        action: `account:${p.s}`,
        target_id: p.u,
        actor_id: ids.admin,
        reason: p.r,
        created_at: now,
      });
      return reply(null);
    }
    unexpected.push(`${req.method()} ${path}`);
    return reply({ code: "QA_UNEXPECTED" }, 500);
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  const { context, page } = await prepare();
  await page.goto(`http://127.0.0.1:${port}/admin`);
  await expect(
    page.getByRole("heading", { name: "Painel administrativo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Para revisar (2)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Buscar pessoa", { exact: true })).toHaveCount(
    0,
  );
  await mkdir("work", { recursive: true });
  await page.screenshot({
    path: "work/smoke-admin-desktop.png",
    fullPage: true,
  });
  const first = page.getByTestId(`moderation-${alerts[0].id}`),
    firstReview = page.getByTestId(`review-${alerts[0].id}`);
  await first
    .getByRole("button", { name: /^(Analisar ocorrência|Rever decisão)$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revisar ocorrência", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Confirmar relato",
    "Marcar como resolvido",
    "Ocultar relato",
  ])
    await expect(
      firstReview.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  for (const name of [
    "Outras ações",
    "Enviar para análise",
    "Retomar acompanhamento",
    "Registrar contestação",
    "Excluir alerta",
  ])
    await expect(
      firstReview.getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  await page.screenshot({ path: "work/smoke-admin-actions.png" });
  await firstReview
    .getByRole("button", { name: "Marcar como resolvido", exact: true })
    .click();
  await expect(
    firstReview.getByLabel("Observação (opcional)", { exact: true }),
  ).toHaveValue("");
  await expect(
    firstReview.getByRole("button", {
      name: "Marcar como resolvido",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    firstReview.getByRole("button", {
      name: "Situação encerrada",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.screenshot({ path: "work/smoke-admin-resolve.png" });
  await firstReview
    .getByRole("button", { name: "Voltar sem salvar", exact: true })
    .click();
  expect(calls.moderate).toHaveLength(0);
  await page
    .getByRole("button", { name: "Fechar revisão", exact: true })
    .click();
  expect(calls.moderate).toHaveLength(0);
  await first
    .getByRole("button", { name: /^(Analisar ocorrência|Rever decisão)$/ })
    .click();
  await firstReview
    .getByRole("button", { name: "Marcar como resolvido", exact: true })
    .click();
  await firstReview
    .getByRole("button", { name: "Marcar como resolvido", exact: true })
    .click();
  await expect(first).toHaveCount(0);
  expect(calls.moderate[0].r).toBe(
    "Ocorrência marcada como resolvida pela moderação.",
  );
  const second = page.getByTestId(`moderation-${alerts[1].id}`),
    secondReview = page.getByTestId(`review-${alerts[1].id}`);
  await second
    .getByRole("button", { name: "Analisar ocorrência", exact: true })
    .click();
  await secondReview
    .getByRole("button", { name: "Ocultar relato", exact: true })
    .click();
  const explanation = secondReview.getByLabel(
    "Por que ocultar? (8 a 500 caracteres)",
    { exact: true },
  );
  await expect(
    secondReview.getByRole("button", { name: "Ocultar relato", exact: true }),
  ).toBeDisabled();
  await explanation.fill("Curto");
  await expect(
    secondReview.getByRole("button", { name: "Ocultar relato", exact: true }),
  ).toBeDisabled();
  await explanation.fill("Propaganda comercial sem relação com a ocorrência.");
  failNextModeration = true;
  await secondReview
    .getByRole("button", { name: "Ocultar relato", exact: true })
    .click();
  await expect(
    secondReview.getByText(
      "Acesso negado. Confira sua sessão e as permissões da conta.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(explanation).toHaveValue(
    "Propaganda comercial sem relação com a ocorrência.",
  );
  expect(calls.moderate).toHaveLength(1);
  await secondReview
    .getByRole("button", { name: "Ocultar relato", exact: true })
    .click();
  expect(calls.moderate).toHaveLength(2);
  await expect(
    page.getByText("Fila em dia. Não há ocorrências aguardando revisão.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Usuários", exact: true }).click();
  const person = page.getByTestId(`account-${ids.one}`),
    another = page.getByTestId(`account-${ids.two}`);
  const personReview = page.getByTestId(`account-review-${ids.one}`),
    anotherReview = page.getByTestId(`account-review-${ids.two}`);
  await person
    .getByRole("button", { name: "Revisar acesso", exact: true })
    .click();
  await personReview
    .getByLabel("Motivo da revisão (8 a 500 caracteres)", { exact: true })
    .fill("Publicações abusivas recorrentes após revisão.");
  await page
    .getByRole("button", { name: "Fechar revisão", exact: true })
    .click();
  await another
    .getByRole("button", { name: "Revisar acesso", exact: true })
    .click();
  await expect(
    anotherReview.getByLabel("Motivo da revisão (8 a 500 caracteres)", {
      exact: true,
    }),
  ).toHaveValue("");
  await expect(
    anotherReview.getByRole("button", { name: "Suspender conta", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Fechar revisão", exact: true })
    .click();
  await person
    .getByRole("button", { name: "Revisar acesso", exact: true })
    .click();
  await personReview
    .getByLabel("Motivo da revisão (8 a 500 caracteres)", { exact: true })
    .fill("Publicações abusivas recorrentes após revisão.");
  await personReview
    .getByRole("button", { name: "Suspender conta", exact: true })
    .click();
  expect(calls.manage).toHaveLength(0);
  await personReview
    .getByRole("button", { name: "Cancelar suspensão", exact: true })
    .click();
  expect(calls.manage).toHaveLength(0);
  await personReview
    .getByRole("button", { name: "Suspender conta", exact: true })
    .click();
  await personReview
    .getByRole("button", { name: "Confirmar suspensão", exact: true })
    .click();
  await expect(person.getByText("Suspensa", { exact: true })).toBeVisible();
  await person
    .getByRole("button", { name: "Revisar acesso", exact: true })
    .click();
  await personReview
    .getByRole("button", { name: "Revisão concluída", exact: true })
    .click();
  await personReview
    .getByRole("button", { name: "Reativar conta", exact: true })
    .click();
  await expect(person.getByText("Ativa", { exact: true })).toBeVisible();
  expect(calls.manage[1].r).toBe("Conta reativada após revisão da suspensão.");
  for (const id of [ids.admin, ids.deleted])
    await expect(
      page
        .getByTestId(`account-${id}`)
        .getByRole("button", { name: "Revisar acesso", exact: true }),
    ).toHaveCount(0);
  await page.getByRole("button", { name: "Ocorrências", exact: true }).click();
  await page.getByRole("button", { name: "Todas (2)", exact: true }).click();
  await first
    .getByRole("button", { name: /^(Analisar ocorrência|Rever decisão)$/ })
    .click();
  await expect(
    firstReview.getByRole("button", { name: "Confirmar relato", exact: true }),
  ).toHaveCount(0);
  await firstReview
    .getByRole("button", { name: "Reabrir análise", exact: true })
    .click();
  await expect(
    firstReview.getByRole("button", { name: "Reabrir análise", exact: true }),
  ).toBeDisabled();
  await firstReview
    .getByLabel("Por que reabrir? (8 a 500 caracteres)", { exact: true })
    .fill("Novas informações precisam de revisão.");
  await firstReview
    .getByRole("button", { name: "Reabrir análise", exact: true })
    .click();
  await first
    .getByRole("button", { name: /^(Analisar ocorrência|Rever decisão)$/ })
    .click();
  await firstReview
    .getByRole("button", { name: "Confirmar relato", exact: true })
    .click();
  await firstReview
    .getByRole("button", { name: "Confirmar relato", exact: true })
    .click();
  expect(calls.moderate.at(-1).r).toBe("Relato confirmado pela moderação.");
  await first
    .getByRole("button", { name: /^(Analisar ocorrência|Rever decisão)$/ })
    .click();
  await expect(
    firstReview.getByRole("button", { name: "Confirmar relato", exact: true }),
  ).toHaveCount(0);
  await firstReview
    .getByRole("button", { name: "Marcar como resolvido", exact: true })
    .click();
  await firstReview
    .getByLabel("Observação (opcional)", { exact: true })
    .fill("Via liberada conforme novas informações.");
  await firstReview
    .getByRole("button", { name: "Marcar como resolvido", exact: true })
    .click();
  expect(calls.moderate.at(-1).r).toContain(
    "Via liberada conforme novas informações.",
  );
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Alerta: Resolvido", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Conta suspensa", { exact: true })).toBeVisible();
  await expect(
    page.getByText("moderate_alert:resolved", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "work/smoke-admin-history.png",
    fullPage: true,
  });
  await context.close();
  const ordinary = await prepare("user");
  await ordinary.page.goto(`http://127.0.0.1:${port}/admin`);
  await expect(
    ordinary.page.getByRole("heading", {
      name: "Acesso administrativo negado",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    ordinary.page.getByRole("button", {
      name: "Salvar alteração",
      exact: true,
    }),
  ).toHaveCount(0);
  await ordinary.context.close();
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    "Admin UI passou com API simulada: somente ações essenciais, resolução e confirmação sem digitação, ocultação/reabertura com motivo, cancelamento sem mutação, erro preservando texto, motivos isolados por conta, suspensão/reativação, histórico e acesso comum negado. Sem dados reais alterados.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
