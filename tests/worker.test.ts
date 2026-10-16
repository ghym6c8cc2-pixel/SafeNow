import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetch: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/http.ts", () => ({
  cors: {},
  json: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status }),
  backend: () => ({
    rpc: mocks.rpc,
    from: () => ({ delete: () => ({ eq: mocks.remove }) }),
  }),
}));
let handler: (req: Request) => Promise<Response>;
const alert = {
  id: "00000000-0000-4000-8000-000000000001",
  category_id: "blocked",
  latitude: -23.55,
  longitude: -46.63,
  status: "active",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};
const p = {
  user_id: "near",
  enabled: true,
  radius_m: 3000,
  categories: [],
  sound: false,
  latitude: -23.55,
  longitude: -46.63,
  zone_name: "",
  quiet_start: null,
  quiet_end: null,
  timezone: "America/Sao_Paulo",
};
beforeAll(async () => {
  vi.stubGlobal("Deno", {
    serve: (fn: typeof handler) => {
      handler = fn;
    },
    env: {
      get: (key: string) =>
        key === "PUSH_DISPATCH_SECRET" ? "simulated-secret" : undefined,
    },
  });
  const entry = "../supabase/functions/push-dispatch/index.ts";
  await import(entry);
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ data: { status: "ok", id: "ticket" } }), {
      status: 200,
    }),
  );
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "notification_work")
      return {
        data: {
          jobs: [{ id: 1, alert_id: alert.id, kind: "new" }],
          alerts: [alert],
          tokens: [
            { token: "ExpoPushToken[near]", user_id: "near" },
            { token: "ExpoPushToken[far]", user_id: "far" },
          ],
          preferences: [p, { ...p, user_id: "far", latitude: 0 }],
        },
        error: null,
      };
    return { data: true, error: null };
  });
});
const request = (key = "simulated-secret") =>
  new Request("http://localhost/push-dispatch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
describe("Despachante: handler real com rede e Supabase substituídos", () => {
  it("nega JWT comum ou segredo incorreto", async () => {
    expect((await handler(request("jwt-de-usuario"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("envia somente a token elegível com payload mínimo e sem som", async () => {
    expect((await handler(request())).status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(mocks.fetch.mock.calls[0]![1].body);
    expect(payload.to).toBe("ExpoPushToken[near]");
    expect(payload.data).toEqual({ alert_id: alert.id });
    expect(payload.sound).toBeUndefined();
    expect(payload.channelId).toBe("safenow-silent");
    expect(payload).not.toHaveProperty("latitude");
  });
  it("não duplica reserva já processada", async () => {
    const current = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (name: string, ...args: unknown[]) =>
      name === "claim_delivery" ? { data: false } : current(name, ...args),
    );
    await handler(request());
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("falha de rede fica como incerta sem retentativa automática", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("timeout"));
    await handler(request());
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finish_delivery",
      expect.objectContaining({ s: "unknown" }),
    );
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});
