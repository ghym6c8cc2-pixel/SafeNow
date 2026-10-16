import { db } from "./supabase";
export async function verifyConnection() {
  const {
    data: { user },
    error,
  } = await db().auth.getUser();
  if (error || !user)
    throw new Error("Entre com uma conta real para verificar a conexão.");
  const profile = await db()
    .from("profiles")
    .select("id,status")
    .eq("id", user.id)
    .single();
  if (profile.error || profile.data?.status !== "active")
    throw new Error("A conta não tem acesso ativo ao banco.");
  const categories = await db()
    .from("categories")
    .select("id", { count: "exact", head: true });
  const alerts = await db()
    .from("alerts")
    .select("id", { count: "exact", head: true });
  if (categories.error || alerts.error)
    throw new Error(
      "O login funciona, mas as tabelas ou permissões do banco ainda não estão prontas.",
    );
  const project = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname;
  return `Conexão real confirmada com ${project}. Perfil autenticado, ${categories.count ?? 0} categorias e ${alerts.count ?? 0} alertas visíveis. Os dados vêm do servidor.`;
}
