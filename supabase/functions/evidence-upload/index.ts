import jpeg from "npm:jpeg-js@0.4.4";
import { Buffer } from "node:buffer";
// @ts-types="npm:@types/pngjs@6"
import { PNG } from "npm:pngjs@7.0.0";
import { authenticated, backend, cors, json } from "../_shared/http.ts";
import { identify, MAX_VIDEO, sanitizeMp4 } from "../_shared/media.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  let path: string | undefined;
  const admin = backend();
  try {
    const { userClient } = await authenticated(req);
    const alert = req.headers.get("x-alert-id");
    if (!alert || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(alert))
      return json({ error: "Alerta inválido." }, 400);
    const { data: allowed, error } = await userClient.rpc(
      "evidence_upload_allowed",
      { a: alert },
    );
    if (error || !allowed)
      return json(
        { error: "Envio não autorizado ou prazo de 15 minutos expirado." },
        403,
      );
    if (!req.body) return json({ error: "Arquivo ausente." }, 400);
    const reader = req.body.getReader(),
      chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_VIDEO) {
        await reader.cancel();
        return json({ error: "Arquivo excede o limite." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    const mime = req.headers.get("content-type")?.split(";")[0] ?? "",
      name = decodeURIComponent(req.headers.get("x-file-name") ?? "");
    const kind = identify(bytes, mime, name);
    let clean: Uint8Array;
    if (kind === "jpeg") {
      const decoded = jpeg.decode(bytes, {
        useTArray: true,
        maxResolutionInMP: 4,
        maxMemoryUsageInMB: 64,
        formatAsRGBA: true,
      });
      clean = new Uint8Array(
        jpeg.encode(
          { data: decoded.data, width: decoded.width, height: decoded.height },
          80,
        ).data,
      );
    } else if (kind === "png")
      clean = new Uint8Array(
        PNG.sync.write(PNG.sync.read(Buffer.from(bytes), { checkCRC: true })),
      );
    else clean = sanitizeMp4(bytes);
    path = `${alert}/${crypto.randomUUID()}.${kind === "jpeg" ? "jpg" : kind}`;
    const { error: upload } = await admin.storage
      .from("evidence")
      .upload(path, clean, { contentType: mime, upsert: false });
    if (upload) throw upload;
    const { error: registered } = await admin.rpc("register_evidence", {
      a: alert,
      p: path,
      k: kind === "mp4" ? "video" : "image",
      b: clean.length,
      m: mime,
    });
    if (registered) throw registered;
    return json({ ok: true });
  } catch (e) {
    if (path) await admin.storage.from("evidence").remove([path]);
    const unauthorized = e instanceof Error && e.message === "unauthorized";
    return json(
      {
        error: unauthorized
          ? "Acesso negado."
          : "Mídia recusada. Verifique formato, integridade, resolução e tamanho.",
      },
      unauthorized ? 401 : 400,
    );
  }
});
