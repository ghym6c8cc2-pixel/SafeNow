import { bootstrapAdmin } from "./server-db.mjs";
try {
  console.log(await bootstrapAdmin(process.env.BOOTSTRAP_ADMIN_EMAIL));
} catch {
  console.error(
    "Bootstrap recusado. Verifique a conexão privilegiada, o e-mail confirmado e se já existe administrador. Consulte o procedimento no README.",
  );
  process.exitCode = 1;
}
