import { STATUS, transitions } from "./rules";
import type { Incident, Status } from "./types";

export type Decision = "confirmed" | "resolved" | "spam" | "under_review";
export const decisionLabels: Record<Decision, string> = {
  confirmed: "Confirmar relato",
  resolved: "Marcar como resolvido",
  spam: "Ocultar relato",
  under_review: "Reabrir análise",
};
export const decisionDescriptions: Record<Decision, string> = {
  confirmed: "O relato foi considerado válido e continua em acompanhamento.",
  resolved:
    "A situação terminou. A ocorrência sai da lista de relatos em andamento.",
  spam: "Use para conteúdo falso, propaganda, abuso ou exposição de dados pessoais. O relato deixa de aparecer para a comunidade.",
  under_review:
    "A ocorrência volta a ficar visível para a comunidade e aguarda uma nova avaliação.",
};
export const decisionDefaults = {
  confirmed: "Relato confirmado pela moderação.",
  resolved: "Ocorrência marcada como resolvida pela moderação.",
} as const;
export function needsDecisionReason(status: Decision) {
  return status === "spam" || status === "under_review";
}
export function decisionReasonLimit(status: Decision) {
  return needsDecisionReason(status)
    ? 500
    : 499 - decisionDefaults[status as keyof typeof decisionDefaults].length;
}
export function decisionReason(
  status: Decision,
  details: string,
): string | null {
  const note = details.trim();
  if (needsDecisionReason(status))
    return note.length >= 8 && note.length <= 500 ? note : null;
  const base = decisionDefaults[status as keyof typeof decisionDefaults];
  const result = note ? `${base} ${note}` : base;
  return result.length <= 500 ? result : null;
}
export function adminStatus(status: Status) {
  if (status === "active") return "Em acompanhamento";
  if (status === "contested" || status === "under_review")
    return "Aguardando análise";
  if (status === "inactive") return "Encerrado por prazo";
  if (status === "spam") return "Oculto";
  return STATUS[status];
}
export function availableDecisions(status: Status): Decision[] {
  const options: Decision[] = ["resolved", "inactive", "spam"].includes(status)
    ? ["under_review"]
    : ["confirmed", "resolved", "spam"];
  return options.filter((option) => transitions[status].includes(option));
}
export function needsReview(
  a: Pick<Incident, "status" | "resolved_votes"> &
    Partial<Pick<Incident, "moderated">>,
) {
  return (
    ["under_review", "contested"].includes(a.status) ||
    (a.moderated === false && ["active", "confirmed"].includes(a.status)) ||
    (a.resolved_votes > 0 &&
      !["resolved", "spam", "deleted"].includes(a.status))
  );
}
export const reactivationReason = "Conta reativada após revisão da suspensão.";
export function accountDecisionReason(
  suspend: boolean,
  choice: string,
  details: string,
): string | null {
  const note = details.trim();
  if (suspend || choice === "other")
    return note.length >= 8 && note.length <= 500 ? note : null;
  if (choice !== "review") return null;
  const result = `${reactivationReason}${note ? ` ${note}` : ""}`;
  return result.length <= 500 ? result : null;
}
export function auditLabel(action: string) {
  if (action.startsWith("moderate_alert:")) {
    const status = action.slice("moderate_alert:".length) as Status;
    return STATUS[status] ? `Alerta: ${STATUS[status]}` : "Moderação de alerta";
  }
  if (action === "account:suspended") return "Conta suspensa";
  if (action === "account:active") return "Conta reativada";
  if (action === "deletion_requested") return "Exclusão de conta solicitada";
  if (action.startsWith("bootstrap_admin"))
    return "Administrador definido no servidor";
  if (action === "migrate_collaborator_to_user")
    return "Perfil atualizado para usuário comum";
  return "Ação administrativa registrada";
}
