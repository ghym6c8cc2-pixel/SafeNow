import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import jpeg from "jpeg-js";
const mocks = vi.hoisted(() => ({
  authenticated: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  allowed: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/http.ts", () => ({
  cors: { "Access-Control-Allow-Origin": "*" },
  json: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  authenticated: mocks.authenticated,
  backend: () => ({
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    rpc: mocks.rpc,
  }),
}));
let handler: (req: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal("Deno", {
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  });
  const entry = "../supabase/functions/evidence-upload/index.ts";
  await import(entry);
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated.mockResolvedValue({ userClient: { rpc: mocks.allowed } });
  mocks.allowed.mockResolvedValue({ data: true, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
const request = (body: Uint8Array, mime = "image/jpeg", name = "test.jpg") =>
  new Request("http://localhost/evidence-upload", {
    method: "POST",
    headers: {
      "content-type": mime,
      "x-alert-id": "00000000-0000-4000-8000-000000000001",
      "x-file-name": name,
      Authorization: "Bearer simulated",
    },
    body: body as unknown as BodyInit,
  });
describe("Edge Function de upload: handler real com fronteiras de rede substituídas", () => {
  it("nega autenticação inválida e autoria ausente antes de ler/upload", async () => {
    mocks.authenticated.mockRejectedValueOnce(new Error("unauthorized"));
    expect((await handler(request(new Uint8Array([1])))).status).toBe(401);
    mocks.allowed.mockResolvedValueOnce({ data: false });
    expect((await handler(request(new Uint8Array([1])))).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejeita conteúdo forjado sem upload", async () => {
    expect((await handler(request(new Uint8Array([1, 2, 3])))).status).toBe(
      400,
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("recodifica JPEG, remove metadados EXIF e registra somente mídia tratada", async () => {
    const source = jpeg.encode(
      { width: 1, height: 1, data: Buffer.from([100, 150, 200, 255]) },
      80,
    ).data;
    const marker = Buffer.from("Exif\0\0GPS-SECRET"),
      app1 = Buffer.alloc(marker.length + 4);
    app1[0] = 255;
    app1[1] = 225;
    app1.writeUInt16BE(marker.length + 2, 2);
    marker.copy(app1, 4);
    const bytes = Buffer.concat([
      source.subarray(0, 2),
      app1,
      source.subarray(2),
    ]);
    const response = await handler(request(bytes));
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledOnce();
    const uploaded = mocks.upload.mock.calls[0]![1] as Uint8Array;
    expect(Buffer.from(uploaded).toString()).not.toContain("GPS-SECRET");
    expect(jpeg.decode(uploaded).width).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_evidence",
      expect.objectContaining({ k: "image", m: "image/jpeg" }),
    );
  });
  it("remove o objeto caso o registro transacional falhe", async () => {
    const bytes = jpeg.encode(
      { width: 1, height: 1, data: Buffer.from([0, 0, 0, 255]) },
      80,
    ).data;
    mocks.rpc.mockResolvedValueOnce({ error: new Error("limite concorrente") });
    expect((await handler(request(bytes))).status).toBe(400);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("recusa métodos não suportados", async () => {
    expect(
      (await handler(new Request("http://localhost", { method: "GET" })))
        .status,
    ).toBe(405);
  });
});
