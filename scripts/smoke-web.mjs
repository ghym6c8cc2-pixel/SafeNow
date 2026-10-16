import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.env.SAFENOW_E2E_DIST ?? "dist"),
  port = 8097;
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".png": "image/png",
  ".json": "application/json",
  ".css": "text/css",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    file = resolve(root, "." + rel);
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(
      extname(file) ? file : resolve(root, "index.html"),
    );
    res.setHeader("Content-Type", mime[extname(file)] ?? "text/html");
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : process.env.PLAYWRIGHT_CHANNEL
        ? { channel: process.env.PLAYWRIGHT_CHANNEL }
        : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    geolocation: { latitude: -23.5505, longitude: -46.6333, accuracy: 15 },
    permissions: ["geolocation"],
    locale: "pt-BR",
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) =>
    errors.push(page.url() + " " + (e.stack ?? e.message)),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Unexpected text node|text strings must be rendered/i.test(message.text())
    )
      errors.push(page.url() + " " + message.text());
  });
  await page.goto(`http://127.0.0.1:${port}`);
  for (const mode of ["Cadastrar", "Recuperar", "Entrar"])
    await page.getByRole("button", { name: mode, exact: true }).first().click();
  await page.goto(`http://127.0.0.1:${port}`);
  await page
    .getByRole("button", { name: "Explorar demonstração local", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ao seu redor" }),
  ).toBeVisible();
  await expect(
    page.locator(".leaflet-marker-icon[data-alert-id]").first(),
  ).toBeVisible();
  await page.locator(".leaflet-marker-icon[data-alert-id]").first().click();
  await page
    .getByRole("button", { name: "Abrir ocorrência", exact: true })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Local da ocorrência no mapa",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Local da ocorrência no mapa", exact: true })
      .locator(".leaflet-marker-icon[data-alert-id]"),
  ).toHaveCount(1);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Todas as categorias", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filtrar alertas", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Todas as categorias", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sem limite de distância · Todas as categorias", {
      exact: true,
    }),
  ).toBeVisible();
  for (const name of ["Ativos", "Contestados", "Inativos"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  for (const name of [
    "Em andamento",
    "Em análise",
    "Confirmados",
    "Resolvidos",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1 km", exact: true }).click();
  await expect(
    page.getByText("Raio de 1 km pendente · ative o GPS", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("3 ocorrências no mapa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await page.getByRole("button", { name: "1 km", exact: true }).click();
  await context.setGeolocation({
    latitude: -23.5705,
    longitude: -46.6333,
    accuracy: 15,
  });
  await page
    .getByRole("button", {
      name: "Ativar localização para filtrar",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("0 ocorrências no mapa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sem limite de distância", exact: true })
    .click();
  await expect(
    page.getByText("3 ocorrências no mapa", { exact: true }),
  ).toBeVisible();
  await context.setGeolocation({
    latitude: -23.5505,
    longitude: -46.6333,
    accuracy: 15,
  });
  await page
    .getByRole("button", { name: "Recolher filtros", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Minha localização",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Precisão aproximada: 15 m", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ponto azul: você", { exact: false }),
  ).toContainText("Precisão aproximada: 15 m");
  await expect(page.locator(".safenow-user-dot")).toHaveCount(1);
  const mainMap = page.getByRole("region", {
    name: "Mapa de ocorrências",
    exact: true,
  });
  await mainMap.scrollIntoViewIfNeeded();
  const mapScale = mainMap.locator(".leaflet-control-scale-line");
  const beforeWheel = await mapScale.innerText();
  await mainMap.hover();
  await page.mouse.wheel(0, -240);
  await expect.poll(() => mapScale.innerText()).not.toBe(beforeWheel);
  const afterWheelIn = await mapScale.innerText();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => mapScale.innerText()).not.toBe(afterWheelIn);
  // Dois dedos afastando-se devem aproximar o mapa, sem ampliar a página.
  const pinchBounds = await mainMap.boundingBox();
  const cx = pinchBounds.x + pinchBounds.width / 2,
    cy = pinchBounds.y + pinchBounds.height / 2;
  const pinch = await context.newCDPSession(page);
  async function pinchMap(initial, steps) {
    const before = await mapScale.innerText();
    await pinch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 1, x: cx - initial, y: cy },
        { id: 2, x: cx + initial, y: cy },
      ],
    });
    for (const separation of steps) {
      await pinch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: cx - separation, y: cy },
          { id: 2, x: cx + separation, y: cy },
        ],
      });
      await page.evaluate(
        () =>
          new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
      );
    }
    await pinch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => mapScale.innerText()).not.toBe(before);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(
      1,
    );
  }
  await pinchMap(30, [50, 80, 120]);
  await pinchMap(120, [80, 50, 30]);
  await pinch.detach();
  await mkdir("work", { recursive: true });
  await page.screenshot({ path: "work/smoke-map.png", fullPage: true });
  await page.setViewportSize({ width: 1366, height: 1100 });
  await page
    .getByRole("heading", { name: "Ao seu redor", exact: true })
    .scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "work/smoke-map-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 412, height: 915 });
  await page
    .getByRole("button", { name: "＋ Relatar uma ocorrência", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trânsito / via bloqueada", exact: true })
    .click();
  await expect(
    page.getByLabel("Qual foi o problema? (4 a 100 caracteres)", {
      exact: true,
    }),
  ).toHaveValue("");
  const categoryNames = await page
    .getByTestId("category-choices")
    .getByRole("button")
    .evaluateAll((elements) =>
      elements.map((e) => e.getAttribute("aria-label")),
    );
  expect(categoryNames).toEqual([
    "Violência",
    "Incêndio",
    "Roubo",
    "Pessoa desaparecida",
    "Acidente",
    "Trânsito / via bloqueada",
    "Furto",
    "Outra ocorrência",
    "Animal perdido",
  ]);
  await page
    .getByRole("button", { name: "Outra ocorrência", exact: true })
    .click();
  await page
    .getByLabel("Qual foi o problema? (4 a 100 caracteres)", { exact: true })
    .fill("Falta de iluminação na praça");
  await page
    .getByRole("button", { name: "Trânsito / via bloqueada", exact: true })
    .click();
  await expect(
    page.getByLabel("Qual foi o problema? (4 a 100 caracteres)", {
      exact: true,
    }),
  ).toHaveValue("Falta de iluminação na praça");
  await page
    .getByLabel("Qual foi o problema? (4 a 100 caracteres)", { exact: true })
    .fill("");
  await page.screenshot({
    path: "work/smoke-report-icons.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 980, height: 1050 });
  await page.getByRole("button", { name: "Violência", exact: true }).click();
  await page
    .getByText("1 · O que aconteceu?", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "work/smoke-report-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Trânsito / via bloqueada", exact: true })
    .click();
  await page.setViewportSize({ width: 412, height: 915 });
  await page
    .getByRole("button", { name: "Risco 4 de 4: Crítico", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "work/smoke-report-risk.png", fullPage: true });
  await page
    .getByLabel("Qual foi o problema? (4 a 100 caracteres)", { exact: true })
    .fill("Semáforo apagado no cruzamento");
  await page
    .getByLabel("Descrição breve (8 a 2.000 caracteres)", { exact: true })
    .fill("Relato fictício criado por teste automatizado de navegação.");
  await page
    .getByRole("button", { name: "Encontrar minha localização", exact: true })
    .click();
  await expect(
    page.getByText("Precisão aproximada: 15 m", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Confirmar local da ocorrência no mapa",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar relato", exact: true })
    .click();
  await expect(
    page.getByText(
      "Confira o ponto no mapa e toque em Confirmar este local para continuar.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar este local", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Local confirmado ✓", exact: true }),
  ).toBeVisible();
  const locationMap = page.getByRole("region", {
    name: "Confirmar local da ocorrência no mapa",
    exact: true,
  });
  await locationMap.scrollIntoViewIfNeeded();
  const bounds = await locationMap.boundingBox();
  await locationMap.click({
    position: { x: bounds.width * 0.68, y: bounds.height * 0.62 },
  });
  await expect(
    page.getByRole("button", { name: "Local confirmado ✓", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirmar este local", exact: true })
    .click();
  await page.screenshot({
    path: "work/smoke-location-confirm.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Revisar relato", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar e publicar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Semáforo apagado no cruzamento",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Autor anônimo", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Local da ocorrência no mapa",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Local da ocorrência no mapa", exact: true })
      .locator(".leaflet-marker-icon[data-alert-id]"),
  ).toHaveCount(1);
  await page
    .getByLabel("Seu comentário (2 a 500 caracteres)", { exact: true })
    .fill("Comentário fictício de teste");
  await page
    .getByRole("button", { name: "Enviar comentário", exact: true })
    .click();
  await expect(
    page.getByText("Comentário fictício de teste", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Corrigir texto (até 15 minutos)",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Teste funcional · via bloqueada");
  await page
    .getByRole("button", { name: "Salvar correção", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Teste funcional · via bloqueada" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir meu alerta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão do alerta", exact: true })
    .click();
  await expect(
    page.getByText("Status: Excluído · informação comunitária", {
      exact: true,
    }),
  ).toBeVisible();
  // SPA transitions preserve in-memory auth; direct reload intentionally returns to login in web.
  await page.goBack();
  await page.getByRole("tab", { name: /Contribuir/ }).click();
  const contribution = page.getByTestId("contribution-demo-1");
  const confirmButton = contribution.getByRole("button", {
    name: "Confirmar informação",
    exact: true,
  });
  const confirmHint = contribution.getByText(
    "Indica que você sabe que a ocorrência aconteceu.",
    { exact: true },
  );
  const confirmHelp = contribution.getByRole("button", {
    name: "Sobre Confirmar informação",
    exact: true,
  });
  await confirmButton.hover();
  await expect(confirmHint).toHaveCount(0);
  await confirmHelp.hover();
  await expect(confirmHint).toBeVisible();
  // Sair do símbolo fecha a dica, mesmo permanecendo em cima do botão principal.
  await confirmButton.hover();
  await expect(confirmHint).toHaveCount(0);
  await confirmHelp.click();
  await confirmButton.hover();
  await expect(confirmHint).toHaveCount(0);
  await confirmButton.focus();
  await page.keyboard.press("Tab");
  await expect(confirmHint).toBeVisible();
  await page.keyboard.press("Escape");
  // Uma pressão longa no ícone consulta a ajuda sem registrar uma opinião.
  await confirmHelp.scrollIntoViewIfNeeded();
  const helpBounds = await confirmHelp.boundingBox();
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: helpBounds.x + helpBounds.width / 2,
        y: helpBounds.y + helpBounds.height / 2,
      },
    ],
  });
  await page.waitForTimeout(600);
  await expect(confirmHint).toBeVisible();
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  await page.waitForTimeout(350);
  await expect(
    contribution.getByText("Sua opinião: Nenhuma", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await contribution
    .getByRole("button", { name: "Confirmar informação", exact: true })
    .click();
  await expect(
    contribution.getByText("Sua opinião: Confirmação", { exact: true }),
  ).toBeVisible();
  await expect(
    contribution.getByRole("button", {
      name: "Confirmar informação",
      exact: true,
    }),
  ).toBeDisabled();
  const helpHints = [
    [
      "Confirmar informação",
      "Indica que você sabe que a ocorrência aconteceu.",
    ],
    [
      "Contestar informação",
      "Aponta um erro no relato, sem afirmar que foi inventado.",
    ],
    [
      "Sinalizar spam ou falso",
      "Sinaliza suspeita de relato falso, propaganda ou abuso para análise.",
    ],
    [
      "Retirar minha opinião",
      "Remove sua opinião atual e desconta o voto da contagem.",
    ],
  ];
  for (const [title, description] of helpHints) {
    await contribution
      .getByRole("button", { name: `Sobre ${title}`, exact: true })
      .tap();
    await expect(
      contribution.getByText(description, { exact: true }),
    ).toBeVisible();
    await expect(
      contribution.getByText("Sua opinião: Confirmação", { exact: true }),
    ).toBeVisible();
    if (title === "Contestar informação")
      await contribution.screenshot({
        path: "work/smoke-contribution-help.png",
      });
    await page.keyboard.press("Escape");
  }
  await contribution
    .getByRole("button", { name: "Informar que foi resolvido", exact: true })
    .click();
  await expect(
    contribution.getByText("Você informou que a situação terminou.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    contribution.getByText("Sua opinião: Confirmação", { exact: true }),
  ).toBeVisible();
  await expect(
    contribution.getByText(
      "Resolução informada pela comunidade · aguarda análise da moderação",
      { exact: true },
    ),
  ).toBeVisible();
  await contribution
    .getByRole("button", { name: "Contestar informação", exact: true })
    .click();
  await expect(
    contribution.getByText("Sua opinião: Contestação", { exact: true }),
  ).toBeVisible();
  await contribution
    .getByRole("button", { name: "Retirar minha opinião", exact: true })
    .click();
  await expect(
    contribution.getByText("Sua opinião: Nenhuma", { exact: true }),
  ).toBeVisible();
  await expect(
    contribution.getByText("Você informou que a situação terminou.", {
      exact: true,
    }),
  ).toBeVisible();
  await contribution
    .getByRole("button", {
      name: "Retirar meu aviso de resolução",
      exact: true,
    })
    .click();
  await expect(
    contribution.getByText(
      "Resolução informada pela comunidade · aguarda análise da moderação",
      { exact: true },
    ),
  ).toHaveCount(0);
  await contribution
    .getByRole("button", { name: "Confirmar informação", exact: true })
    .click();
  await expect(
    contribution.getByText("Sua opinião: Confirmação", { exact: true }),
  ).toBeVisible();
  await contribution.screenshot({ path: "work/smoke-contributions.png" });
  await page.getByRole("tab", { name: /Perfil/ }).click();
  await expect(
    page.getByRole("button", { name: "Painel administrativo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Notificações e zona de interesse",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Usar GPS para definir esta zona",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Salvar preferências", exact: true })
    .click();
  await expect(
    page.getByText("Preferências salvas.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "work/smoke-preferences.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "Smoke web passou: pinos e detalhes no mapa, filtros recolhidos, GPS, ajuste e confirmação do local, criação, anonimato, comentários, exclusão, troca e retirada de opinião, resolução independente e preferências. Sem erros de runtime.",
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
