import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { draftStorage } from "../../src/services/drafts";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Field,
  Notice,
  s,
} from "../../src/components/ui";
import { useSession } from "../../src/state/session";
import { useCategories } from "../../src/state/queries";
import type { Media, Position, Report, Risk } from "../../src/domain/types";
import { RISK, validateReport } from "../../src/domain/rules";
import { accuracyLabel } from "../../src/services/location-core";
import { locate } from "../../src/services/location";
import { pickMedia, uploadEvidence } from "../../src/services/media";
import { friendlyError } from "../../src/services/supabase";
import { CategoryChoices, RiskChoices } from "../../src/components/choices";
import IncidentMap from "../../src/components/IncidentMap";
import {
  needsSpecificTitle,
  nextReportTitle,
} from "../../src/domain/categories";
export default function ReportScreen() {
  const { repository, profile, demoMode } = useSession(),
    categories = useCategories(),
    cache = useQueryClient();
  const [category, setCategory] = useState(""),
    [risk, setRisk] = useState<Risk>(2),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [region, setRegion] = useState(""),
    [anonymous, setAnonymous] = useState(profile?.anonymous_default ?? true),
    [position, setPosition] = useState<Position | null>(null),
    [locationConfirmed, setLocationConfirmed] = useState(false),
    [locationAdjusted, setLocationAdjusted] = useState(false),
    [media, setMedia] = useState<Media[]>([]),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const draftKey = `draft-${demoMode ? "demo" : profile?.id}`;
  useEffect(() => {
    void draftStorage.getItem(draftKey).then((text) => {
      if (!text) return;
      try {
        const p = JSON.parse(text) as Partial<Report>;
        setCategory(p.category_id ?? "");
        setRisk(p.risk ?? 2);
        setTitle(p.title ?? "");
        setDescription(p.description ?? "");
        setRegion(p.region ?? "");
        setAnonymous(p.anonymous ?? true);
        setMessage("Rascunho recuperado. Confirme novamente o GPS.");
      } catch {
        void draftStorage.removeItem(draftKey);
      }
    });
  }, [draftKey]);
  function report(): Report {
    return {
      title,
      description,
      category_id: category,
      risk,
      anonymous,
      location: position!,
      region,
      occurred_at: new Date().toISOString(),
    };
  }
  async function gps() {
    setBusy(true);
    setMessage("");
    try {
      setPosition(await locate());
      setLocationConfirmed(false);
      setLocationAdjusted(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function attach() {
    setBusy(true);
    try {
      const m = await pickMedia();
      if (m) setMedia((old) => [...old, m]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (busy) return;
    if (!position || !locationConfirmed) {
      setMessage("Confira o ponto no mapa e confirme o local da ocorrência.");
      return;
    }
    setBusy(true);
    setMessage("");
    let id: string | undefined;
    try {
      id = await repository.create(report());
      if (!demoMode) for (const m of media) await uploadEvidence(id, m);
      await draftStorage.removeItem(draftKey);
      setTitle("");
      setDescription("");
      setCategory("");
      setPosition(null);
      setLocationConfirmed(false);
      setMedia([]);
      setReview(false);
      setMessage(
        "Alerta publicado. Os usuários elegíveis serão notificados pelo servidor.",
      );
      await cache.invalidateQueries();
      router.push(`/alert/${id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
      if (id) {
        await cache.invalidateQueries();
        setReview(false);
        setMedia([]);
        setTitle("");
        setDescription("");
        setCategory("");
        await draftStorage.removeItem(draftKey);
        router.push(`/alert/${id}`);
      }
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    await draftStorage.removeItem(draftKey);
    setTitle("");
    setDescription("");
    setCategory("");
    setMedia([]);
    setPosition(null);
    setLocationConfirmed(false);
    setReview(false);
    setMessage("Rascunho descartado.");
  }
  return (
    <Page>
      <Heading sub="Relate somente o que sabe, de um local seguro.">
        {review ? "Revise antes de publicar" : "Relatar ocorrência"}
      </Heading>
      <Notice text="O SafeNow não aciona equipes de emergência. Não se aproxime do perigo para registrar informações." />
      {!!message && <Notice text={message} />}
      {review ? (
        <>
          <Card>
            <Heading>{title}</Heading>
            <Body>
              {categories.data?.find((c) => c.id === category)?.name} · Risco{" "}
              {RISK[risk].label}
            </Body>
            <Body>{description}</Body>
            <Body>{region || "Região aproximada obtida pelo GPS"}</Body>
            <IncidentMap
              alerts={[]}
              position={position}
              height={240}
              title="Local revisado da ocorrência"
              positionTitle="Local confirmado"
            />
            <Body muted>
              {accuracyLabel(position)}. A comunidade verá coordenadas
              aproximadas, em cerca de 100 m.
            </Body>
            <Body>
              {anonymous
                ? "Seu nome não será exibido."
                : "Seu nome de perfil será exibido."}
            </Body>
            <Body>{media.length} evidência(s) selecionada(s).</Body>
          </Card>
          <Button
            disabled={busy}
            title={busy ? "Publicando…" : "Confirmar e publicar"}
            onPress={() => void publish()}
          />
          <Button
            secondary
            disabled={busy}
            title="Voltar e corrigir"
            onPress={() => setReview(false)}
          />
        </>
      ) : (
        <>
          <Card>
            <Body>1 · O que aconteceu?</Body>
            <Body muted>
              Categorias do maior para o menor risco sugerido. Você pode ajustar
              o risco do seu relato.
            </Body>
            {categories.isError && (
              <>
                <Notice error text="Não foi possível carregar as categorias." />
                <Button
                  secondary
                  title="Tentar novamente"
                  onPress={() => void categories.refetch()}
                />
              </>
            )}
            <CategoryChoices
              value={category}
              categories={categories.data ?? []}
              onChange={(v) => {
                setCategory(v);
                const c = categories.data?.find((x) => x.id === v);
                if (c) {
                  setRisk(c.default_risk);
                  setTitle(
                    nextReportTitle(
                      title,
                      categories.data?.find((x) => x.id === category),
                      c,
                    ),
                  );
                }
              }}
            />
            <Body>Nível de risco percebido</Body>
            <Body muted>
              O valor inicial é uma sugestão da categoria. Ajuste de 1 a 4
              conforme a situação que você observou.
            </Body>
            <RiskChoices value={risk} onChange={setRisk} />
            <Field
              label={
                needsSpecificTitle(category)
                  ? "Qual foi o problema? (4 a 100 caracteres)"
                  : "Título (4 a 100 caracteres)"
              }
              placeholder={
                category === "blocked"
                  ? "Ex.: semáforo apagado, congestionamento ou via interditada"
                  : category === "other"
                    ? "Escreva qual foi a ocorrência"
                    : "Resuma o que aconteceu"
              }
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Field
              label="Descrição breve (8 a 2.000 caracteres)"
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              placeholder="Descreva os fatos, sem nomes ou dados pessoais."
            />
          </Card>
          <Card>
            <Body>2 · Onde aconteceu?</Body>
            <Body muted>
              Ao tocar abaixo, você autoriza o uso pontual do GPS. Coordenadas
              exatas serão restritas ao servidor. Confira no mapa se o ponto
              corresponde à ocorrência; você pode ajustá-lo antes de confirmar.
            </Body>
            <Button
              title={
                position
                  ? "Atualizar minha localização"
                  : "Encontrar minha localização"
              }
              disabled={busy}
              onPress={() => void gps()}
            />
            <Body>
              {locationAdjusted
                ? "Local ajustado manualmente no mapa"
                : accuracyLabel(position)}
            </Body>
            {position && (
              <>
                <IncidentMap
                  alerts={[]}
                  position={position}
                  height={300}
                  title="Confirmar local da ocorrência no mapa"
                  positionTitle="Local da ocorrência"
                  editable
                  onPositionChange={(p) => {
                    setPosition(p);
                    setLocationAdjusted(true);
                    setLocationConfirmed(false);
                  }}
                />
                <Body>
                  Local selecionado: {position.latitude.toFixed(6)},{" "}
                  {position.longitude.toFixed(6)}
                </Body>
                <Body muted>
                  {locationAdjusted
                    ? "Ponto ajustado por você."
                    : "Ponto obtido pelo dispositivo."}{" "}
                  Arraste o pino ou toque no mapa para corrigir o local.
                </Body>
                <Button
                  secondary={locationConfirmed}
                  title={
                    locationConfirmed
                      ? "Local confirmado ✓"
                      : "Confirmar este local"
                  }
                  onPress={() => setLocationConfirmed(true)}
                />
                <Body muted>
                  Local obtido em{" "}
                  {new Date(position.captured_at).toLocaleTimeString("pt-BR")}.
                  Atualize se tiver se deslocado.
                </Body>
              </>
            )}
            <Field
              label="Região ou referência aproximada (opcional)"
              value={region}
              onChangeText={setRegion}
              maxLength={120}
            />
          </Card>
          <Card>
            <Body>3 · Privacidade e evidências</Body>
            <View style={s.row}>
              <Switch
                accessibilityLabel="Publicar anonimamente"
                value={anonymous}
                onValueChange={setAnonymous}
              />
              <Body>Publicar anonimamente</Body>
            </View>
            <Body muted>
              Evite rostos, documentos, placas e endereços residenciais. A
              anonimização remove metadados, mas não oculta informações visíveis
              na cena.
            </Body>
            {!demoMode ? (
              <>
                <Button
                  secondary
                  disabled={busy || media.length >= 3}
                  title={`Anexar foto ou MP4 (${media.length}/3)`}
                  onPress={() => void attach()}
                />
                {media.map((m, i) => (
                  <View key={m.uri} style={{ gap: 6 }}>
                    <Body muted>
                      {m.name} · {(m.size / 1048576).toFixed(1)} MB
                    </Body>
                    <Button
                      secondary
                      title={`Remover anexo ${i + 1}`}
                      onPress={() =>
                        setMedia((old) => old.filter((_, n) => n !== i))
                      }
                    />
                  </View>
                ))}
              </>
            ) : (
              <Body muted>
                Envio de mídias disponível ao conectar o Supabase. A
                demonstração não faz uploads.
              </Body>
            )}
          </Card>
          <Button
            disabled={busy}
            title="Revisar relato"
            onPress={() => {
              if (!position || !locationConfirmed) {
                setMessage(
                  "Confira o ponto no mapa e toque em Confirmar este local para continuar.",
                );
                return;
              }
              const invalid = validateReport(report());
              if (invalid) setMessage(invalid);
              else {
                setMessage("");
                setReview(true);
              }
            }}
          />
          <Button
            secondary
            title="Salvar rascunho sem GPS ou mídia"
            onPress={() =>
              void draftStorage
                .setItem(
                  draftKey,
                  JSON.stringify({
                    title,
                    description,
                    category_id: category,
                    risk,
                    anonymous,
                    region,
                  }),
                )
                .then(() =>
                  setMessage(
                    "Rascunho salvo neste dispositivo, sem localização ou mídia.",
                  ),
                )
            }
          />
          <Button
            secondary
            title="Descartar rascunho"
            onPress={() => void discard()}
          />
        </>
      )}
    </Page>
  );
}
