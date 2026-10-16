import { describe, expect, it } from "vitest";
import {
  accountDecisionReason,
  adminStatus,
  auditLabel,
  availableDecisions,
  decisionDefaults,
  decisionReason,
  decisionReasonLimit,
  needsDecisionReason,
  needsReview,
} from "../src/domain/moderation";
import { transitions } from "../src/domain/rules";
import type { Status } from "../src/domain/types";

describe("Moderação simplificada", () => {
  it("confirmar e resolver registram a decisão sem exigir digitação ou escolha de motivo", () => {
    expect(decisionReason("resolved", "")).toBe(decisionDefaults.resolved);
    expect(decisionReason("confirmed", "  ")).toBe(decisionDefaults.confirmed);
    expect(decisionReason("resolved", " Via restabelecida. ")).toBe(
      `${decisionDefaults.resolved} Via restabelecida.`,
    );
  });
  it.each(["spam", "under_review"] as const)(
    "%s exige motivo escrito de 8 a 500 caracteres",
    (status) => {
      expect(needsDecisionReason(status)).toBe(true);
      expect(decisionReason(status, "")).toBeNull();
      expect(decisionReason(status, "curto")).toBeNull();
      expect(decisionReason(status, "Motivo da revisão.")).toBe(
        "Motivo da revisão.",
      );
      expect(decisionReason(status, "a".repeat(500))).toHaveLength(500);
      expect(decisionReason(status, "a".repeat(501))).toBeNull();
    },
  );
  it("observações respeitam o limite total do servidor, incluindo a descrição da decisão", () => {
    for (const status of ["confirmed", "resolved"] as const) {
      expect(needsDecisionReason(status)).toBe(false);
      const max = decisionReasonLimit(status);
      expect(decisionReason(status, "a".repeat(max))).toHaveLength(500);
      expect(decisionReason(status, "a".repeat(max + 1))).toBeNull();
    }
  });
  it("mostra somente decisões essenciais permitidas e reabertura contextual", () => {
    expect(availableDecisions("active")).toEqual([
      "confirmed",
      "resolved",
      "spam",
    ]);
    expect(availableDecisions("under_review")).toEqual([
      "confirmed",
      "resolved",
      "spam",
    ]);
    expect(availableDecisions("confirmed")).toEqual(["resolved", "spam"]);
    for (const status of ["resolved", "inactive", "spam"] as const)
      expect(availableDecisions(status)).toEqual(["under_review"]);
    expect(availableDecisions("deleted")).toEqual([]);
    for (const status of Object.keys(transitions) as Status[]) {
      expect(availableDecisions(status).length).toBeLessThanOrEqual(3);
      for (const decision of availableDecisions(status))
        expect(transitions[status]).toContain(decision);
    }
  });
  it("fila inclui relatos novos e confirmações comunitárias, mas não decisões administrativas encerradas", () => {
    expect(
      needsReview({ status: "active", moderated: false, resolved_votes: 0 }),
    ).toBe(true);
    expect(
      needsReview({ status: "confirmed", moderated: false, resolved_votes: 0 }),
    ).toBe(true);
    expect(
      needsReview({ status: "confirmed", moderated: true, resolved_votes: 0 }),
    ).toBe(false);
    expect(
      needsReview({ status: "confirmed", moderated: true, resolved_votes: 1 }),
    ).toBe(true);
    expect(
      needsReview({
        status: "under_review",
        moderated: true,
        resolved_votes: 0,
      }),
    ).toBe(true);
    expect(
      needsReview({ status: "resolved", moderated: true, resolved_votes: 3 }),
    ).toBe(false);
    expect(
      needsReview({ status: "spam", moderated: true, resolved_votes: 3 }),
    ).toBe(false);
  });
  it("suspensão exige texto e reativação aceita justificativa pronta", () => {
    expect(accountDecisionReason(true, "review", "")).toBeNull();
    expect(
      accountDecisionReason(true, "review", "Relatos abusivos recorrentes."),
    ).toBe("Relatos abusivos recorrentes.");
    expect(accountDecisionReason(false, "", "")).toBeNull();
    expect(accountDecisionReason(false, "review", "")).toBe(
      "Conta reativada após revisão da suspensão.",
    );
    expect(accountDecisionReason(false, "other", "curto")).toBeNull();
    expect(accountDecisionReason(false, "review", "a".repeat(500))).toBeNull();
  });
  it("usa nomes compreensíveis sem alterar os estados internos", () => {
    expect(adminStatus("active")).toBe("Em acompanhamento");
    expect(adminStatus("spam")).toBe("Oculto");
    expect(adminStatus("contested")).toBe("Aguardando análise");
    expect(auditLabel("moderate_alert:resolved")).toBe("Alerta: Resolvido");
    expect(auditLabel("account:suspended")).toBe("Conta suspensa");
  });
});
