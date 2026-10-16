import { useState } from "react";
import { Image, Linking } from "react-native";
import { Body, Button, Card, Notice } from "./ui";
import type { Evidence } from "../domain/types";
import { evidenceUrl } from "../services/media";
export function EvidenceView({ evidence: e }: { evidence: Evidence }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function show() {
    setBusy(true);
    setError("");
    try {
      const signed = await evidenceUrl(e.path);
      if (e.kind === "video") await Linking.openURL(signed);
      else setUrl(signed);
    } catch {
      setError("Mídia indisponível ou acesso expirado. Tente abrir novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Body>
        Conteúdo potencialmente sensível ·{" "}
        {e.kind === "video" ? "Vídeo" : "Imagem"}
      </Body>
      <Body muted>
        Abra somente se se sentir confortável. Não compartilhe informações que
        identifiquem outras pessoas.
      </Body>
      {url && (
        <Image
          accessibilityLabel="Evidência enviada pela comunidade, pode conter conteúdo sensível"
          source={{ uri: url }}
          resizeMode="contain"
          style={{ height: 240, width: "100%" }}
          onError={() => {
            setUrl("");
            setError(
              "O link expirou ou a imagem não pôde ser carregada. Abra novamente.",
            );
          }}
        />
      )}
      {error && <Notice error text={error} />}
      <Button
        secondary
        disabled={busy}
        title={
          url
            ? "Renovar acesso à evidência"
            : "Entendo e desejo abrir a evidência"
        }
        onPress={() => void show()}
      />
      {url && (
        <Button
          secondary
          title="Ocultar evidência"
          onPress={() => setUrl("")}
        />
      )}
    </Card>
  );
}
