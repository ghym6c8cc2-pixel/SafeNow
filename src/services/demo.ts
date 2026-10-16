import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Category,
  History,
  Vote,
  Incident,
  Preferences,
  Profile,
  Report,
} from "../domain/types";
import type { Repository } from "./repository";
import {
  score,
  validateReport,
  communityStatus,
  acceptsContributions,
} from "../domain/rules";
export const demoProfile: Profile = {
  id: "demo-local",
  name: "Visitante de demonstração",
  role: "user",
  status: "active",
  anonymous_default: true,
  created_at: new Date().toISOString(),
};
export const defaultPreferences: Preferences = {
  enabled: false,
  radius_m: 3000,
  categories: [],
  sound: true,
  latitude: null,
  longitude: null,
  zone_name: "",
  quiet_start: null,
  quiet_end: null,
  timezone: "America/Sao_Paulo",
};
export const demoCategories: Category[] = [
  ["robbery", "Roubo", 4, "◆"],
  ["theft", "Furto", 2, "◇"],
  ["accident", "Acidente", 3, "▲"],
  ["fire", "Incêndio", 4, "!"],
  ["violence", "Violência", 4, "!"],
  ["blocked", "Via bloqueada", 2, "▬"],
  ["missing", "Pessoa desaparecida", 3, "?"],
  ["animal", "Animal perdido", 1, "●"],
  ["other", "Outra ocorrência", 2, "+"],
].map(([id, name, risk, icon]) => ({
  id: String(id),
  name: String(name),
  default_risk: Number(risk) as Category["default_risk"],
  icon: String(icon),
  active: true,
}));
function fixture(
  id: string,
  title: string,
  category_id: string,
  risk: Incident["risk"],
  status: Incident["status"],
  lat: number,
  lon: number,
): Incident {
  const time = new Date().toISOString();
  return {
    id,
    title,
    description:
      "Cenário inteiramente fictício para avaliação acadêmica. Não representa uma ocorrência real.",
    category_id,
    risk,
    status,
    latitude: lat,
    longitude: lon,
    region: "Região fictícia · São Paulo",
    score: status === "confirmed" ? 76 : 40,
    anonymous: true,
    public_author_name: null,
    occurred_at: time,
    created_at: time,
    updated_at: time,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    evidence_count: 0,
    confirmations: status === "confirmed" ? 6 : 0,
    contests: 0,
    spam_votes: 0,
    resolved_votes: 0,
    moderated: status === "resolved",
  };
}
interface DemoState {
  alerts: Incident[];
  mine: string[];
  opinions: Record<string, Vote>;
  resolutions: string[];
  history: Record<string, History[]>;
  prefs: Preferences;
  comments: Record<
    string,
    { id: string; alert_id: string; body: string; created_at: string }[]
  >;
}
const initial = (): DemoState => ({
  alerts: [
    fixture(
      "demo-1",
      "Exemplo · via com acesso interrompido",
      "blocked",
      2,
      "active",
      -23.55,
      -46.634,
    ),
    fixture(
      "demo-2",
      "Exemplo · colisão relatada",
      "accident",
      3,
      "confirmed",
      -23.553,
      -46.638,
    ),
    fixture(
      "demo-3",
      "Exemplo · animal reencontrado",
      "animal",
      1,
      "resolved",
      -23.548,
      -46.63,
    ),
    fixture(
      "demo-4",
      "Exemplo · informação em análise",
      "theft",
      2,
      "under_review",
      -23.545,
      -46.636,
    ),
  ],
  mine: [],
  opinions: {},
  resolutions: [],
  history: {},
  prefs: { ...defaultPreferences },
  comments: {},
});
let state: DemoState | undefined;
async function get() {
  if (!state) {
    const saved = await AsyncStorage.getItem("safenow-demo-v2");
    try {
      state = saved ? (JSON.parse(saved) as DemoState) : initial();
    } catch {
      state = initial();
    }
  }
  return state;
}
async function save() {
  await AsyncStorage.setItem("safenow-demo-v2", JSON.stringify(state));
}
export const demo: Repository = {
  alerts: async () => [...(await get()).alerts],
  alert: async (id) => (await get()).alerts.find((a) => a.id === id) ?? null,
  categories: async () => demoCategories,
  mine: async () => (await get()).mine,
  create: async (p: Report) => {
    const invalid = validateReport(p);
    if (invalid) throw new Error(invalid);
    const s = await get(),
      id = "local-" + Date.now();
    s.alerts.unshift({
      ...fixture(
        id,
        p.title,
        p.category_id,
        p.risk,
        "active",
        Math.round(p.location.latitude * 1000) / 1000,
        Math.round(p.location.longitude * 1000) / 1000,
      ),
      ...p,
      latitude: Math.round(p.location.latitude * 1000) / 1000,
      longitude: Math.round(p.location.longitude * 1000) / 1000,
      public_author_name: p.anonymous ? null : demoProfile.name,
    });
    s.mine.push(id);
    await save();
    return id;
  },
  edit: async (id, title, description) => {
    const s = await get(),
      a = s.alerts.find((x) => x.id === id);
    if (
      !a ||
      !s.mine.includes(id) ||
      a.status !== "active" ||
      Date.now() - Date.parse(a.created_at) > 900000
    )
      throw new Error("Correção não permitida.");
    a.title = title;
    a.description = description;
    await save();
  },
  remove: async (id) => {
    const s = await get(),
      a = s.alerts.find((x) => x.id === id);
    if (!a || !s.mine.includes(id)) throw new Error("Acesso negado.");
    a.status = "deleted";
    await save();
  },
  contribution: async (id) => {
    const s = await get();
    return {
      opinion: s.opinions[id] ?? null,
      resolution_reported: s.resolutions.includes(id),
    };
  },
  vote: async (id, k) => {
    const s = await get(),
      a = s.alerts.find((x) => x.id === id);
    if (
      !a ||
      s.mine.includes(id) ||
      (k !== null && !acceptsContributions(a.status))
    )
      throw new Error("Contribuição não permitida.");
    const previous = s.opinions[id] ?? null;
    if (previous === k) return;
    const counters = {
      confirm: "confirmations",
      contest: "contests",
      spam: "spam_votes",
    } as const;
    if (previous) a[counters[previous]]--;
    if (k) {
      a[counters[k]]++;
      s.opinions[id] = k;
    } else delete s.opinions[id];
    const old = a.status;
    a.status = communityStatus(a);
    a.score = score({ ...a, ageHours: 0 });
    a.updated_at = new Date().toISOString();
    if (old !== a.status)
      (s.history[id] ??= []).unshift({
        id: "opinion-" + Date.now(),
        alert_id: id,
        from_status: old,
        to_status: a.status,
        reason:
          "Status recalculado após atualização das opiniões comunitárias.",
        created_at: a.updated_at,
      });
    await save();
  },
  reportResolution: async (id, reported) => {
    const s = await get(),
      a = s.alerts.find((x) => x.id === id);
    if (!a || (reported && !acceptsContributions(a.status)))
      throw new Error("Aviso de resolução não permitido.");
    const previous = s.resolutions.includes(id);
    if (previous === reported) return;
    if (reported) s.resolutions.push(id);
    else s.resolutions = s.resolutions.filter((x) => x !== id);
    a.resolved_votes += reported ? 1 : -1;
    a.updated_at = new Date().toISOString();
    (s.history[id] ??= []).unshift({
      id: "resolution-" + Date.now(),
      alert_id: id,
      from_status: a.status,
      to_status: a.status,
      reason: reported
        ? "Resolução informada pela comunidade. Aguarda análise da moderação."
        : "Um aviso de resolução foi retirado. O status administrativo foi preservado.",
      created_at: a.updated_at,
    });
    await save();
  },
  comment: async (id, b) => {
    if (b.trim().length < 2 || b.length > 500)
      throw new Error("Comentário inválido.");
    const s = await get();
    (s.comments[id] ??= []).unshift({
      id: String(Date.now()),
      alert_id: id,
      body: b.trim(),
      created_at: new Date().toISOString(),
    });
    await save();
  },
  details: async (id) => ({
    evidence: [],
    comments: (await get()).comments[id] ?? [],
    history: (await get()).history[id] ?? [],
  }),
  preferences: async () => (await get()).prefs,
  savePreferences: async (p) => {
    (await get()).prefs = p;
    await save();
  },
  safePlaces: async () => [],
  users: async () => {
    throw new Error("Use uma conta administrativa real no Supabase.");
  },
  moderate: async () => {
    throw new Error(
      "Moderação exige um administrador autenticado no servidor.",
    );
  },
  manage: async () => {
    throw new Error(
      "Gerenciamento exige um administrador autenticado no servidor.",
    );
  },
  updateProfile: async (n, a) => {
    demoProfile.name = n;
    demoProfile.anonymous_default = a;
  },
  deleteAccount: async () => {
    await AsyncStorage.removeItem("safenow-demo-v2");
    state = undefined;
  },
  audit: async () => [],
};
