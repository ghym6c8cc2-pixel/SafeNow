// Keep Expo's official PKCE login flow. Only replace Windows browser opening:
// passing the URL directly as an argument avoids cmd.exe interpreting '&'.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const roots = [
  process.env.ProgramFiles,
  process.env["ProgramFiles(x86)"],
  process.env.LOCALAPPDATA,
].filter(Boolean);
const browsers = [
  "BraveSoftware/Brave-Browser/Application/brave.exe",
  "Microsoft/Edge/Application/msedge.exe",
  "Google/Chrome/Application/chrome.exe",
];
const browser = browsers
  .flatMap((name) => roots.map((root) => join(root, name)))
  .find((path) => existsSync(path));
const cli = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/expo/bin/cli",
);
const login = spawn(process.execPath, [cli, "login", "--browser"], {
  env: { ...process.env, BROWSER: "none" },
  stdio: ["inherit", "pipe", "inherit"],
  shell: false,
});
login.stdout.on("data", (chunk) => process.stdout.write(chunk));
let opened = false;
const lines = createInterface({ input: login.stdout });
lines.on("line", (line) => {
  const target = line.match(/https:\/\/expo\.dev\/login\?[^\s]+/)?.[0];
  if (!target || opened) return;
  const url = new URL(target);
  if (
    url.origin !== "https://expo.dev" ||
    url.pathname !== "/login" ||
    url.searchParams.get("client_id") !== "expo-cli"
  )
    return;
  opened = true;
  if (!browser) {
    console.log("Abra o link acima no navegador para concluir o login.");
    return;
  }
  const window = spawn(browser, [target], {
    shell: false,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  window.on("error", () => {
    console.error("Nao foi possivel abrir o navegador. Use o link acima.");
  });
  window.unref();
  console.log("Login aberto no navegador. Conclua a autorizacao por la.");
});
login.on("error", (error) => {
  console.error("Nao foi possivel iniciar o login do Expo:", error.message);
  process.exitCode = 1;
});
login.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
