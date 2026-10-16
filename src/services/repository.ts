import type {
  Category,
  Comment,
  Contribution,
  Evidence,
  History,
  Incident,
  Preferences,
  Profile,
  Report,
  SafePlace,
  Status,
  Vote,
} from "../domain/types";
import { db } from "./supabase";
export interface Repository {
  alerts(): Promise<Incident[]>;
  alert(id: string): Promise<Incident | null>;
  categories(): Promise<Category[]>;
  mine(): Promise<string[]>;
  create(p: Report): Promise<string>;
  edit(a: string, title: string, description: string): Promise<void>;
  remove(a: string): Promise<void>;
  contribution(a: string): Promise<Contribution>;
  vote(a: string, k: Vote | null): Promise<void>;
  reportResolution(a: string, reported: boolean): Promise<void>;
  comment(a: string, b: string): Promise<void>;
  details(
    a: string,
  ): Promise<{ evidence: Evidence[]; comments: Comment[]; history: History[] }>;
  preferences(): Promise<Preferences>;
  savePreferences(p: Preferences): Promise<void>;
  safePlaces(): Promise<SafePlace[]>;
  users(): Promise<Profile[]>;
  moderate(a: string, s: Status, r: string): Promise<void>;
  manage(u: string, s: string, r: string): Promise<void>;
  updateProfile(n: string, a: boolean): Promise<void>;
  deleteAccount(): Promise<void>;
  audit(): Promise<
    {
      id: number;
      action: string;
      reason: string;
      created_at: string;
      actor_id?: string | null;
      target_id?: string | null;
    }[]
  >;
}
async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await db().rpc(name, args);
  if (error) throw error;
  return data;
}
async function rows<T>(table: string, order = "created_at"): Promise<T[]> {
  const { data, error } = await db()
    .from(table)
    .select("*")
    .order(order, { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as T[];
}
async function userId() {
  const { data, error } = await db().auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada.");
  return data.user.id;
}
export const remote: Repository = {
  alerts: () => rows<Incident>("alerts"),
  alert: async (id) => {
    const { data, error } = await db()
      .from("alerts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as Incident | null;
  },
  categories: () => rows<Category>("categories", "name"),
  mine: async () => (await rpc("my_alert_ids")) as string[],
  create: async (p) => (await rpc("create_alert", { p })) as string,
  edit: async (a, title, description) => {
    await rpc("edit_alert", { a, p_title: title, p_description: description });
  },
  remove: async (a) => {
    await rpc("delete_alert", { a });
  },
  vote: async (a, k) => {
    await rpc("vote_alert", { a, k });
  },
  contribution: async (a) =>
    (await rpc("my_contribution", { a })) as Contribution,
  reportResolution: async (a, reported) => {
    await rpc("report_resolution", { a, reported });
  },
  comment: async (a, b) => {
    await rpc("comment_alert", { a, b });
  },
  details: async (a) => {
    const tables = ["evidence", "comments", "status_history"] as const;
    const results = await Promise.all(
      tables.map((t) =>
        db()
          .from(t)
          .select("*")
          .eq("alert_id", a)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    );
    for (const r of results) if (r.error) throw r.error;
    return {
      evidence: results[0]!.data as Evidence[],
      comments: results[1]!.data as Comment[],
      history: results[2]!.data as History[],
    };
  },
  preferences: async () => {
    const { data, error } = await db()
      .from("notification_preferences")
      .select("*")
      .eq("user_id", await userId())
      .single();
    if (error) throw error;
    return data as Preferences;
  },
  savePreferences: async (p) => {
    const { error } = await db()
      .from("notification_preferences")
      .upsert({
        ...p,
        user_id: await userId(),
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  },
  safePlaces: () => rows<SafePlace>("safe_places", "name"),
  users: () => rows<Profile>("profiles"),
  moderate: async (a, s, r) => {
    await rpc("moderate_alert", { a, s, r });
  },
  manage: async (u, s, r) => {
    await rpc("manage_user", { u, s, r });
  },
  updateProfile: async (n, a) => {
    await rpc("update_profile", { n, a });
  },
  deleteAccount: async () => {
    await rpc("request_account_deletion");
  },
  audit: () => rows("audit_log"),
};
