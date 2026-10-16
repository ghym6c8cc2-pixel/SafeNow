import { chromium, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
if (existsSync(".env")) loadEnvFile(".env");
if (!process.env.EXPO_PUBLIC_SUPABASE_URL)
  throw new Error("Configure EXPO_PUBLIC_SUPABASE_URL no ambiente ou .env.");
const expectedHost = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname;
const base = process.env.SAFENOW_TEST_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    locale: "pt-BR",
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Explorar demonstração local",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Supabase ainda não configurado.", { exact: false }),
  ).toHaveCount(0);
  const request = page.waitForResponse(
    (r) =>
      r.url().includes("/auth/v1/token") && r.request().method() === "POST",
  );
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("safenow-ui-no-account@example.invalid");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Senha-ficticia-invalida-123");
  await page
    .getByRole("button", { name: "Entrar", exact: true })
    .last()
    .click();
  const response = await request;
  expect(new URL(response.url()).hostname).toBe(expectedHost);
  expect(response.status()).toBe(400);
  await expect(
    page.getByText("E-mail ou senha incorretos, ou serviço indisponível.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cadastrar", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sua conta será de Usuário comum.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Colaborador", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Administrador", exact: true }),
  ).toHaveCount(0);
  await page.goto(new URL("/?code=invalid-test-code", base).href);
  await expect(
    page.getByText(
      "Link inválido ou expirado. Solicite outro na tela de acesso.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto(base);
  await mkdir("work", { recursive: true });
  await page.screenshot({ path: "work/connected-login.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "Interface conectada passou: acesso habilitado, requisição ao Auth real, senha inválida recusada, cadastro sem papel administrativo e callback inválido tratado. Sem erros de runtime.",
  );
} finally {
  await browser.close();
}
