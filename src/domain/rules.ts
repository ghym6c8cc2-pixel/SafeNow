import type {
  Incident,
  Position,
  Preferences,
  Report,
  Risk,
  Status,
} from "./types.ts";
export const RISK: Record<
  Risk,
  { label: string; color: string; symbol: string }
> = {
  1: { label: "Baixo", color: "#176748", symbol: "●" },
  2: { label: "Atenção", color: "#806100", symbol: "▲" },
  3: { label: "Alto", color: "#ad4b00", symbol: "◆" },
  4: { label: "Crítico", color: "#b52c3e", symbol: "!" },
};
export const STATUS: Record<Status, string> = {
  active: "Ativo",
  under_review: "Em análise",
  confirmed: "Confirmado",
  contested: "Contestado",
  resolved: "Resolvido",
  inactive: "Inativo",
  spam: "Spam / falso",
  deleted: "Excluído",
};
export const transitions: Record<Status, readonly Status[]> = {
  active: [
    "under_review",
    "confirmed",
    "contested",
    "resolved",
    "inactive",
    "spam",
    "deleted",
  ],
  under_review: [
    "active",
    "confirmed",
    "contested",
    "resolved",
    "spam",
    "deleted",
  ],
  confirmed: [
    "under_review",
    "contested",
    "resolved",
    "inactive",
    "spam",
    "deleted",
  ],
  contested: [
    "under_review",
    "confirmed",
    "resolved",
    "inactive",
    "spam",
    "deleted",
  ],
  resolved: ["under_review", "deleted"],
  inactive: ["under_review", "deleted"],
  spam: ["under_review", "deleted"],
  deleted: [],
};
export function canTransition(from: Status, to: Status) {
  return transitions[from].includes(to);
}
export function acceptsContributions(status: Status) {
  return ["active", "under_review", "confirmed", "contested"].includes(status);
}
export function communityStatus(
  a: Pick<
    Incident,
    "status" | "moderated" | "confirmations" | "contests" | "spam_votes"
  >,
): Status {
  if (a.moderated || !acceptsContributions(a.status)) return a.status;
  if (a.spam_votes >= 3) return "under_review";
  if (a.contests >= 3) return "contested";
  if (a.confirmations >= 3 && a.confirmations > a.contests) return "confirmed";
  return "active";
}
export function resolutionNotice(
  a: Pick<Incident, "status" | "moderated" | "resolved_votes">,
) {
  if (a.status === "resolved")
    return a.moderated
      ? "Resolvido pela moderação"
      : "Resolução registrada no histórico";
  if (a.resolved_votes > 0 && !["spam", "deleted"].includes(a.status))
    return "Resolução informada pela comunidade · aguarda análise da moderação";
  return null;
}
export function score(input: {
  confirmations: number;
  contests: number;
  spam_votes: number;
  evidence_count: number;
  ageHours: number;
  moderated: boolean;
  status: Status;
}) {
  if (input.status === "spam" || input.status === "deleted") return 0;
  if (input.moderated && input.status === "confirmed") return 95;
  return Math.max(
    0,
    Math.min(
      90,
      Math.round(
        40 +
          Math.min(input.confirmations, 10) * 7 -
          Math.min(input.contests, 10) * 9 -
          Math.min(input.spam_votes, 10) * 12 +
          Math.min(input.evidence_count, 2) * 5 -
          Math.min(24, Math.floor(Math.max(0, input.ageHours) / 6)) * 2,
      ),
    ),
  );
}
export function confidence(
  a: Pick<Incident, "score" | "moderated" | "status" | "confirmations">,
) {
  if (a.moderated && a.status === "confirmed")
    return "Confirmado pela moderação";
  if (a.status === "under_review" || a.status === "contested")
    return "Em análise";
  if (a.score >= 70 && a.confirmations >= 3)
    return "Confirmado pela comunidade";
  return a.score >= 45 ? "Confiança moderada" : "Baixa confiabilidade";
}
export function distance(
  a: Pick<Position, "latitude" | "longitude">,
  b: Pick<Position, "latitude" | "longitude">,
) {
  const r = Math.PI / 180,
    dlat = (b.latitude - a.latitude) * r,
    dlon = (b.longitude - a.longitude) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function validatePosition(p: Position) {
  return (
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180 &&
    (p.accuracy === null || (Number.isFinite(p.accuracy) && p.accuracy >= 0)) &&
    Number.isFinite(Date.parse(p.captured_at))
  );
}
export function validateReport(r: Report): string | null {
  if (r.title.trim().length < 4 || r.title.trim().length > 100)
    return "O título deve ter entre 4 e 100 caracteres.";
  if (r.description.trim().length < 8 || r.description.trim().length > 2000)
    return "Descreva o que sabe em 8 a 2.000 caracteres.";
  if (!r.category_id || ![1, 2, 3, 4].includes(r.risk))
    return "Escolha categoria e nível de risco.";
  if (!validatePosition(r.location)) return "Confirme uma localização válida.";
  if (
    !Number.isFinite(Date.parse(r.occurred_at)) ||
    Date.parse(r.occurred_at) > Date.now() + 300000
  )
    return "Informe uma data válida para a ocorrência.";
  if (r.region.length > 120) return "A região pode ter até 120 caracteres.";
  return null;
}
export function validateAuth(
  email: string,
  password: string,
  signup = false,
  name = "",
  terms = false,
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Informe um e-mail válido.";
  if (password.length < (signup ? 10 : 1))
    return signup
      ? "Use uma senha com pelo menos 10 caracteres."
      : "Informe a senha.";
  if (signup && (name.trim().length < 2 || name.length > 80))
    return "Informe seu nome (2 a 80 caracteres).";
  if (signup && !terms)
    return "Leia e aceite os termos e a política de privacidade.";
  return null;
}
export function notificationEligible(
  a: Incident,
  p: Preferences,
  now = new Date(),
) {
  if (
    !p.enabled ||
    p.latitude === null ||
    p.longitude === null ||
    !["active", "confirmed"].includes(a.status) ||
    Date.parse(a.expires_at) <= now.getTime()
  )
    return false;
  if (p.categories.length && !p.categories.includes(a.category_id))
    return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: p.timezone,
    }).format(now),
  );
  if (
    p.quiet_start !== null &&
    p.quiet_end !== null &&
    (p.quiet_start < p.quiet_end
      ? hour >= p.quiet_start && hour < p.quiet_end
      : hour >= p.quiet_start || hour < p.quiet_end)
  )
    return false;
  return (
    distance(a, { latitude: p.latitude, longitude: p.longitude }) <= p.radius_m
  );
}
export function filterAlerts(
  items: Incident[],
  position: Position | null,
  radius: number | null,
  category: string,
  status: string,
  risk: number,
) {
  return items
    .filter(
      (a) =>
        !["spam", "deleted", "inactive", "resolved"].includes(a.status) ||
        status === a.status,
    )
    .filter(
      (a) =>
        (!category || a.category_id === category) &&
        (!status ||
          a.status === status ||
          (status === "under_review" && a.status === "contested")) &&
        (!risk || a.risk === risk) &&
        (radius === null || !position || distance(a, position) <= radius),
    )
    .sort((a, b) =>
      position
        ? distance(a, position) - distance(b, position)
        : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
}
