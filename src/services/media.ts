import * as Picker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import type { Media } from "../domain/types";
import { db } from "./supabase";
export const MAX_IMAGE = 5 * 1024 * 1024,
  MAX_VIDEO = 20 * 1024 * 1024;
export function validateMedia(m: Pick<Media, "mime" | "size" | "name">) {
  if (!["image/jpeg", "image/png", "video/mp4"].includes(m.mime))
    return "Escolha uma imagem JPG/PNG ou um vídeo MP4.";
  if (!/\.(jpe?g|png|mp4)$/i.test(m.name))
    return "Extensão de arquivo não permitida.";
  if (
    !Number.isFinite(m.size) ||
    m.size <= 0 ||
    m.size > (m.mime === "video/mp4" ? MAX_VIDEO : MAX_IMAGE)
  )
    return "Limite: 5 MB por imagem e 20 MB por vídeo.";
  return null;
}
export async function pickMedia(): Promise<Media | null> {
  const permission = await Picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Permita acesso às fotos selecionadas para anexar uma evidência.",
    );
  const result = await Picker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.75,
    exif: false,
    videoMaxDuration: 30,
  });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  let media: Media = {
    uri: a.uri,
    name: a.fileName ?? (a.type === "video" ? "evidence.mp4" : "evidence.jpg"),
    mime: a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
    size: a.fileSize ?? 0,
  };
  if (a.type !== "video") {
    const ctx = ImageManipulator.manipulate(a.uri);
    ctx.resize({ width: Math.min(a.width, 1600) });
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.8,
    });
    const bytes = await readBytes(saved.uri);
    media = {
      uri: saved.uri,
      name: "evidence.jpg",
      mime: "image/jpeg",
      size: bytes.byteLength,
    };
  }
  const invalid = validateMedia(media);
  if (invalid) throw new Error(invalid);
  return media;
}
async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web")
    return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  const { File } = await import("expo-file-system");
  return new File(uri).bytes();
}
export async function uploadEvidence(id: string, media: Media) {
  const invalid = validateMedia(media);
  if (invalid) throw new Error(invalid);
  const {
    data: { session },
  } = await db().auth.getSession();
  if (!session) throw new Error("Entre novamente para enviar a evidência.");
  const bytes = await readBytes(media.uri);
  const { error } = await db().functions.invoke("evidence-upload", {
    body: bytes.buffer as ArrayBuffer,
    headers: {
      "Content-Type": media.mime,
      "x-alert-id": id,
      "x-file-name": encodeURIComponent(media.name),
    },
  });
  if (error)
    throw new Error(
      "O relato foi salvo, mas a evidência não foi enviada. Abra o alerta e tente anexar novamente em até 15 minutos.",
    );
}
export async function evidenceUrl(path: string) {
  const { data, error } = await db()
    .storage.from("evidence")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
