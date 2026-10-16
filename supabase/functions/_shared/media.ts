export const MAX_IMAGE = 5 * 1024 * 1024,
  MAX_VIDEO = 20 * 1024 * 1024;
export function identify(
  bytes: Uint8Array,
  mime: string,
  name: string,
): "jpeg" | "png" | "mp4" {
  if (
    !bytes.length ||
    bytes.length > (mime === "video/mp4" ? MAX_VIDEO : MAX_IMAGE)
  )
    throw new Error("Tamanho não permitido.");
  const ascii = (at: number, n: number) =>
    String.fromCharCode(...bytes.slice(at, at + n));
  if (
    mime === "image/jpeg" &&
    /\.jpe?g$/i.test(name) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "jpeg";
  if (
    mime === "image/png" &&
    /\.png$/i.test(name) &&
    bytes
      .slice(0, 8)
      .every((x, i) => x === [137, 80, 78, 71, 13, 10, 26, 10][i])
  ) {
    if (bytes.length < 24) throw new Error("PNG inválido.");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint32(16) * v.getUint32(20) > 4000000)
      throw new Error("Imagem excede 4 megapixels.");
    return "png";
  }
  if (mime === "video/mp4" && /\.mp4$/i.test(name) && ascii(4, 4) === "ftyp")
    return "mp4";
  throw new Error("Conteúdo, tipo e extensão não correspondem.");
}
// MP4 metadata boxes are replaced by equal-size free boxes. Track offsets stay valid.
// ISO BMFF only; malformed, fragmented and unknown top-level containers fail closed.
export function sanitizeMp4(input: Uint8Array) {
  const data = input.slice(),
    v = new DataView(data.buffer);
  let moov = false,
    mdat = false;
  const containers = new Set([
    "moov",
    "trak",
    "mdia",
    "minf",
    "stbl",
    "edts",
    "dinf",
  ]);
  function scan(start: number, end: number, depth: number) {
    if (depth > 12) throw new Error("MP4 inválido.");
    let pos = start;
    while (pos < end) {
      if (end - pos < 8) throw new Error("MP4 truncado.");
      let size = v.getUint32(pos);
      const type = String.fromCharCode(...data.slice(pos + 4, pos + 8));
      let header = 8;
      if (size === 1) {
        if (end - pos < 16) throw new Error("MP4 truncado.");
        const big = v.getBigUint64(pos + 8);
        if (big > BigInt(data.length)) throw new Error("MP4 inválido.");
        size = Number(big);
        header = 16;
      }
      if (size === 0) size = end - pos;
      if (size < header || pos + size > end) throw new Error("MP4 inválido.");
      if (
        depth === 0 &&
        ![
          "ftyp",
          "moov",
          "mdat",
          "free",
          "skip",
          "wide",
          "uuid",
          "meta",
          "udta",
        ].includes(type)
      )
        throw new Error("Use um MP4 convencional, não fragmentado.");
      if (type === "moov") moov = true;
      if (type === "mdat") mdat = true;
      if (["udta", "meta", "uuid", "free", "skip"].includes(type)) {
        data.set([102, 114, 101, 101], pos + 4);
        data.fill(0, pos + header, pos + size);
      } else if (containers.has(type))
        scan(pos + header, pos + size, depth + 1);
      pos += size;
    }
  }
  scan(0, data.length, 0);
  if (!moov || !mdat) throw new Error("MP4 sem áudio/vídeo válido.");
  return data;
}
