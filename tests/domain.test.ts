import { describe, it, expect, vi } from "vitest";
import {
  canTransition,
  communityStatus,
  resolutionNotice,
  confidence,
  distance,
  filterAlerts,
  notificationEligible,
  score,
  validateAuth,
  validateReport,
} from "../src/domain/rules";
import {
  authenticate,
  mayAdmin,
  type AuthGateway,
} from "../src/services/auth-core";
import { accuracyLabel, locateWith } from "../src/services/location-core";
import { identify, sanitizeMp4 } from "../supabase/functions/_shared/media";
import type {
  Incident,
  Preferences,
  Profile,
  Report,
} from "../src/domain/types";
const profile: Profile = {
  id: "u",
  name: "Teste",
  role: "user",
  status: "active",
  anonymous_default: true,
  created_at: "",
};
const report: Report = {
  title: "Via bloqueada",
  description: "Obstáculo relatado na via.",
  category_id: "blocked",
  risk: 2,
  anonymous: true,
  location: {
    latitude: -23.55,
    longitude: -46.63,
    accuracy: 15,
    captured_at: new Date().toISOString(),
  },
  region: "Região simulada",
  occurred_at: new Date().toISOString(),
};
const incident: Incident = {
  ...report,
  ...report.location,
  id: "a",
  latitude: -23.55,
  longitude: -46.63,
  status: "active",
  score: 40,
  public_author_name: null,
  created_at: report.occurred_at,
  updated_at: report.occurred_at,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  evidence_count: 0,
  confirmations: 0,
  contests: 0,
  spam_votes: 0,
  resolved_votes: 0,
  moderated: false,
};
describe("Acesso com o mesmo Supabase Auth", () => {
  function gateway(p = profile): AuthGateway {
    return {
      signIn: vi.fn().mockResolvedValue({ id: "u" }),
      profile: vi.fn().mockResolvedValue(p),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
  }
  it("login válido consulta papel no servidor", async () => {
    const g = gateway({ ...profile, role: "admin" });
    expect(
      mayAdmin(await authenticate(g, " ADMIN@TESTE.EXAMPLE ", "senha")),
    ).toBe(true);
    expect(g.signIn).toHaveBeenCalledWith("admin@teste.example", "senha");
    expect(g.profile).toHaveBeenCalledWith("u");
  });
  it("senha incorreta não carrega perfil", async () => {
    const g = gateway();
    vi.mocked(g.signIn).mockRejectedValue(new Error("Credenciais inválidas"));
    await expect(authenticate(g, "a@b.c", "errada")).rejects.toThrow();
    expect(g.profile).not.toHaveBeenCalled();
  });
  it("conta suspensa encerra a sessão", async () => {
    const g = gateway({ ...profile, status: "suspended" });
    await expect(authenticate(g, "a@b.c", "senha")).rejects.toThrow("suspensa");
    expect(g.signOut).toHaveBeenCalledOnce();
  });
  it("falha ao consultar perfil encerra a sessão", async () => {
    const g = gateway();
    vi.mocked(g.profile).mockRejectedValue(new Error("offline"));
    await expect(authenticate(g, "a@b.c", "senha")).rejects.toThrow();
    expect(g.signOut).toHaveBeenCalledOnce();
  });
  it("usuário comum não recebe autorização administrativa", () => {
    expect(mayAdmin(profile)).toBe(false);
    expect(mayAdmin({ ...profile, role: "admin", status: "suspended" })).toBe(
      false,
    );
  });
});
describe("Validação e localização", () => {
  it("exige aceite, e-mail e senha forte no cadastro", () => {
    expect(validateAuth("a", "password123", true, "Ana", true)).toBeTruthy();
    expect(
      validateAuth("a@b.com", "password123", true, "Ana", false),
    ).toBeTruthy();
    expect(validateAuth("a@b.com", "123", true, "Ana", true)).toBeTruthy();
    expect(
      validateAuth("a@b.com", "password123", true, "Ana", true),
    ).toBeNull();
  });
  it("valida relato e limites de entrada", () => {
    expect(validateReport(report)).toBeNull();
    expect(validateReport({ ...report, title: "x" })).toBeTruthy();
    expect(validateReport({ ...report, description: "x" })).toBeTruthy();
    expect(
      validateReport({ ...report, description: "x".repeat(2001) }),
    ).toBeTruthy();
    expect(
      validateReport({
        ...report,
        location: { ...report.location, latitude: 91 },
      }),
    ).toBeTruthy();
    expect(
      validateReport({
        ...report,
        location: { ...report.location, accuracy: -1 },
      }),
    ).toBeTruthy();
  });
  it("preserva anonimato como escolha explícita", () => {
    expect(report.anonymous).toBe(true);
    expect(incident.public_author_name).toBeNull();
  });
  it("não chama GPS se permissão for negada", async () => {
    const current = vi.fn();
    await expect(
      locateWith({
        enabled: async () => true,
        permission: async () => false,
        current,
      }),
    ).rejects.toThrow("não autorizada");
    expect(current).not.toHaveBeenCalled();
  });
  it("informa serviço desativado, imprecisão e erro do GPS", async () => {
    await expect(
      locateWith({
        enabled: async () => false,
        permission: async () => true,
        current: async () => report.location,
      }),
    ).rejects.toThrow("Ative");
    expect(accuracyLabel({ ...report.location, accuracy: 70 })).toContain(
      "impreciso",
    );
    await expect(
      locateWith({
        enabled: async () => true,
        permission: async () => true,
        current: async () => {
          throw new Error("timeout");
        },
      }),
    ).rejects.toThrow("timeout");
  });
  it("obtém posição quando autorizada", async () => {
    await expect(
      locateWith({
        enabled: async () => true,
        permission: async () => true,
        current: async () => report.location,
      }),
    ).resolves.toEqual(report.location);
  });
});
describe("Confiabilidade e estados", () => {
  it("score determinístico separado do risco", () => {
    const a = {
      confirmations: 3,
      contests: 1,
      spam_votes: 0,
      evidence_count: 1,
      ageHours: 6,
      moderated: false,
      status: "active" as const,
    };
    expect(score(a)).toBe(55);
    expect(score({ ...a, spam_votes: 10 })).toBe(0);
    expect(score({ ...a, confirmations: 100 })).toBeLessThanOrEqual(90);
    expect(score({ ...a, status: "confirmed", moderated: true })).toBe(95);
    expect(score({ ...a, status: "spam" })).toBe(0);
  });
  it("decai com idade e não apresenta certeza", () => {
    expect(score({ ...incident, ageHours: 144 })).toBe(0);
    expect(confidence(incident)).toBe("Baixa confiabilidade");
    expect(confidence({ ...incident, status: "under_review", score: 90 })).toBe(
      "Em análise",
    );
  });
  it("impede reabertura de excluídos e exige revisão de resolvidos", () => {
    expect(canTransition("deleted", "active")).toBe(false);
    expect(canTransition("resolved", "confirmed")).toBe(false);
    expect(canTransition("resolved", "under_review")).toBe(true);
  });
  it("filtros e estado vazio", () => {
    expect(filterAlerts([], null, 3000, "", "", 0)).toEqual([]);
    expect(
      filterAlerts([incident], report.location, 3000, "fire", "", 0),
    ).toEqual([]);
    expect(
      filterAlerts(
        [{ ...incident, status: "resolved" }],
        null,
        3000,
        "",
        "",
        0,
      ),
    ).toEqual([]);
    expect(distance(report.location, report.location)).toBe(0);
  });
});
describe("Notificações por zona, categoria, validade e silêncio", () => {
  const prefs: Preferences = {
    enabled: true,
    radius_m: 3000,
    categories: [],
    sound: true,
    latitude: -23.55,
    longitude: -46.63,
    zone_name: "Zona",
    quiet_start: null,
    quiet_end: null,
    timezone: "America/Sao_Paulo",
  };
  it("filtra sem localização, desativadas, categorias e distância", () => {
    expect(notificationEligible(incident, prefs)).toBe(true);
    expect(notificationEligible(incident, { ...prefs, enabled: false })).toBe(
      false,
    );
    expect(
      notificationEligible(incident, { ...prefs, categories: ["fire"] }),
    ).toBe(false);
    expect(notificationEligible(incident, { ...prefs, latitude: 0 })).toBe(
      false,
    );
    expect(notificationEligible(incident, { ...prefs, latitude: null })).toBe(
      false,
    );
  });
  it("descarta expirados, resolvidos e horário silencioso no fuso da zona", () => {
    expect(
      notificationEligible({ ...incident, expires_at: "2000-01-01" }, prefs),
    ).toBe(false);
    expect(
      notificationEligible({ ...incident, status: "resolved" }, prefs),
    ).toBe(false);
    expect(
      notificationEligible(
        incident,
        { ...prefs, quiet_start: 22, quiet_end: 7 },
        new Date("2026-10-14T02:00:00Z"),
      ),
    ).toBe(false);
  });
});
describe("Conteúdo de evidências", () => {
  function box(type: string, payload = new Uint8Array(0)) {
    const a = new Uint8Array(8 + payload.length);
    new DataView(a.buffer).setUint32(0, a.length);
    a.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    a.set(payload, 8);
    return a;
  }
  function concat(...a: Uint8Array[]) {
    const result = new Uint8Array(a.reduce((n, b) => n + b.length, 0));
    let offset = 0;
    for (const b of a) {
      result.set(b, offset);
      offset += b.length;
    }
    return result;
  }
  it("rejeita falsificação de MIME/extensão e tamanho", () => {
    expect(() =>
      identify(new Uint8Array([1, 2, 3]), "image/jpeg", "a.jpg"),
    ).toThrow();
    expect(() =>
      identify(new Uint8Array([255, 216, 255]), "image/jpeg", "a.exe"),
    ).toThrow();
    expect(() =>
      identify(new Uint8Array(21 * 1024 * 1024), "video/mp4", "a.mp4"),
    ).toThrow();
  });
  it("remove metadados MP4 sem deslocar offsets de trilhas", () => {
    const bytes = concat(
      box("ftyp", new Uint8Array([105, 115, 111, 109])),
      box("moov", box("udta", new TextEncoder().encode("GPS secret"))),
      box("mdat", new Uint8Array([1, 2, 3, 4])),
    );
    expect(identify(bytes, "video/mp4", "a.mp4")).toBe("mp4");
    const clean = sanitizeMp4(bytes);
    expect(clean.length).toBe(bytes.length);
    expect(new TextDecoder().decode(clean)).not.toContain("GPS secret");
    expect(clean.slice(-4)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
  it("rejeita MP4 corrompido ou fragmentado", () => {
    expect(() => sanitizeMp4(box("ftyp"))).toThrow();
    expect(() =>
      sanitizeMp4(concat(box("ftyp"), box("moof"), box("mdat"))),
    ).toThrow();
  });
});

describe("Opinião e resolução independentes", () => {
  it("recalcula consenso comunitário e preserva decisões administrativas", () => {
    const a = {
      ...incident,
      status: "active" as const,
      moderated: false,
      confirmations: 3,
      contests: 0,
      spam_votes: 0,
    };
    expect(communityStatus(a)).toBe("confirmed");
    expect(
      communityStatus({ ...a, status: "confirmed", confirmations: 2 }),
    ).toBe("active");
    expect(communityStatus({ ...a, contests: 3 })).toBe("contested");
    expect(communityStatus({ ...a, spam_votes: 3 })).toBe("under_review");
    expect(communityStatus({ ...a, status: "resolved", moderated: true })).toBe(
      "resolved",
    );
    expect(
      communityStatus({
        ...a,
        status: "confirmed",
        moderated: true,
        confirmations: 0,
      }),
    ).toBe("confirmed");
  });
  it("diferencia aviso pendente de decisão da moderação", () => {
    expect(
      resolutionNotice({ ...incident, status: "active", resolved_votes: 3 }),
    ).toBe(
      "Resolução informada pela comunidade · aguarda análise da moderação",
    );
    expect(
      resolutionNotice({ ...incident, status: "resolved", moderated: true }),
    ).toBe("Resolvido pela moderação");
    expect(
      resolutionNotice({ ...incident, status: "deleted", resolved_votes: 1 }),
    ).toBeNull();
    expect(
      resolutionNotice({ ...incident, status: "active", resolved_votes: 0 }),
    ).toBeNull();
  });
});

describe("Raio de consulta no mapa", () => {
  const origin = {
    latitude: 0,
    longitude: 0,
    accuracy: 10,
    captured_at: new Date().toISOString(),
  };
  const near = {
    ...incident,
    id: "perto",
    status: "active" as const,
    latitude: 0,
    longitude: 0.005,
  };
  const far = { ...near, id: "longe", longitude: 0.02 };
  it("calcula distância geográfica em metros e inclui apenas alertas dentro do raio", () => {
    expect(distance(origin, { latitude: 1, longitude: 0 })).toBeCloseTo(
      111194.93,
      1,
    );
    expect(
      filterAlerts([far, near], origin, 1000, "", "", 0).map((a) => a.id),
    ).toEqual(["perto"]);
    expect(
      filterAlerts([far, near], origin, 3000, "", "", 0).map((a) => a.id),
    ).toEqual(["perto", "longe"]);
    const boundary = distance(origin, far);
    expect(filterAlerts([far], origin, boundary, "", "", 0)).toHaveLength(1);
    expect(filterAlerts([far], origin, boundary - 1, "", "", 0)).toHaveLength(
      0,
    );
  });
  it("sem GPS não inventa um centro; sem limite mantém os demais filtros", () => {
    expect(filterAlerts([near, far], null, 1000, "", "", 0)).toHaveLength(2);
    expect(filterAlerts([near, far], origin, null, "", "", 0)).toHaveLength(2);
    expect(filterAlerts([near, far], origin, null, "fire", "", 0)).toHaveLength(
      0,
    );
    expect(
      filterAlerts(
        [near, { ...far, status: "resolved" }],
        origin,
        null,
        "",
        "",
        0,
      ),
    ).toHaveLength(1);
    expect(filterAlerts([near, far], origin, null, "", "", 4)).toHaveLength(0);
  });
});

describe("Status simplificados do mapa", () => {
  it("Em análise reúne relatos em revisão e contestados, sem incluir encerrados", () => {
    const values = [
      "active",
      "under_review",
      "confirmed",
      "contested",
      "resolved",
      "inactive",
    ].map((status) => ({
      ...incident,
      id: status,
      status: status as Incident["status"],
    }));
    expect(
      filterAlerts(values, null, null, "", "under_review", 0).map((a) => a.id),
    ).toEqual(["under_review", "contested"]);
    expect(
      filterAlerts(values, null, null, "", "resolved", 0).map((a) => a.id),
    ).toEqual(["resolved"]);
    expect(
      filterAlerts(values, null, null, "", "", 0).map((a) => a.id),
    ).toEqual(["active", "under_review", "confirmed", "contested"]);
  });
});
