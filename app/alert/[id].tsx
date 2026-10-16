import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Notice,
  Loading,
  Field,
} from "../../src/components/ui";
import { useCategories, useMine } from "../../src/state/queries";
import { useSession } from "../../src/state/session";
import { confidence, RISK, STATUS } from "../../src/domain/rules";
import { friendlyError } from "../../src/services/supabase";
import { EvidenceView } from "../../src/components/EvidenceView";
import { mayAdmin } from "../../src/services/auth-core";
import { pickMedia, uploadEvidence } from "../../src/services/media";
import IncidentMap from "../../src/components/IncidentMap";
import { ContributionActions } from "../../src/components/ContributionActions";
export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { repository, profile, demoMode } = useSession(),
    categories = useCategories(),
    mine = useMine(),
    cache = useQueryClient();
  const alerts = useQuery({
    queryKey: ["alert", id],
    queryFn: () => repository.alert(id),
    enabled: !!profile && !!id,
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ["detail", id],
    queryFn: () => repository.details(id),
    enabled: !!profile && !!id,
    refetchInterval: 30000,
  });
  const [comment, setComment] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const a = alerts.data,
    own = mine.data?.includes(id);
  async function action(run: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await run();
      setMessage(success);
      setComment("");
      await cache.invalidateQueries();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  if (alerts.isPending)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (alerts.isError)
    return (
      <Page>
        <Notice error text={friendlyError(alerts.error)} />
        <Button
          secondary
          title="Tentar novamente"
          onPress={() => void alerts.refetch()}
        />
      </Page>
    );
  if (!a)
    return (
      <Page>
        <Notice text="Alerta indisponível, removido ou sem permissão de acesso." />
      </Page>
    );
  return (
    <Page>
      <Heading sub={categories.data?.find((c) => c.id === a.category_id)?.name}>
        {a.title}
      </Heading>
      <IncidentMap
        alerts={[a]}
        position={null}
        focusAlertId={a.id}
        height={310}
        title="Local da ocorrência no mapa"
      />
      <Body muted>
        O pino marca a região da ocorrência. A área pública é aproximada para
        preservar a privacidade.
      </Body>
      <Card>
        <Body>{a.description}</Body>
        <Body>
          {a.region || "Região aproximada"} · {a.latitude.toFixed(3)},{" "}
          {a.longitude.toFixed(3)}
        </Body>
        <Body muted>
          A posição pública é aproximada. Não representa necessariamente a
          posição de quem relatou.
        </Body>
        <Body>
          Risco {a.risk}/4: {RISK[a.risk].label}
        </Body>
        <Body>
          Status: {STATUS[a.status]}
          {a.moderated
            ? " · decisão da moderação"
            : " · informação comunitária"}
        </Body>
        <Body>
          Confiabilidade: {confidence(a)} · {a.score}/100
        </Body>
        <Body muted>
          Indicador sujeito a erro; não é certeza nem previsão criminal.
        </Body>
        <Body>
          Ocorrência: {new Date(a.occurred_at).toLocaleString("pt-BR")}
        </Body>
        <Body muted>
          Atualização: {new Date(a.updated_at).toLocaleString("pt-BR")} ·
          revisão até {new Date(a.expires_at).toLocaleString("pt-BR")}
        </Body>
        <Body>
          {a.anonymous
            ? "Autor anônimo"
            : `Relatado por ${a.public_author_name ?? "participante"}`}
        </Body>
        <Body>
          {a.confirmations} confirmações · {a.contests} contestações ·{" "}
          {a.spam_votes} sinalizações de spam · {a.resolved_votes} avisos de
          resolução
        </Body>
        <Body>{a.evidence_count} evidência(s)</Body>
      </Card>
      {!!message && <Notice text={message} />}
      {!["spam", "deleted"].includes(a.status) && (
        <Card>
          <ContributionActions alert={a} own={own} />
        </Card>
      )}
      {own && a.status !== "deleted" && (
        <Card>
          <Body>Gerenciar meu relato</Body>
          {a.status === "active" && now - Date.parse(a.created_at) < 900000 && (
            <>
              <Button
                secondary
                title="Corrigir texto (até 15 minutos)"
                onPress={() => {
                  setTitle(a.title);
                  setDescription(a.description);
                  setEditing(!editing);
                }}
              />
              {editing && (
                <>
                  <Field
                    label="Título"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                  />
                  <Field
                    label="Descrição"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    maxLength={2000}
                  />
                  <Button
                    disabled={
                      busy ||
                      title.trim().length < 4 ||
                      description.trim().length < 8
                    }
                    title="Salvar correção"
                    onPress={() =>
                      void action(async () => {
                        await repository.edit(id, title, description);
                        setEditing(false);
                      }, "Texto corrigido.")
                    }
                  />
                </>
              )}
              {!demoMode && (
                <Button
                  secondary
                  disabled={busy || a.evidence_count >= 3}
                  title="Anexar evidência / tentar envio novamente"
                  onPress={() =>
                    void action(async () => {
                      const m = await pickMedia();
                      if (m) await uploadEvidence(id, m);
                    }, "Seleção de mídia concluída.")
                  }
                />
              )}
            </>
          )}
          <Button
            secondary
            title={confirmDelete ? "Cancelar exclusão" : "Excluir meu alerta"}
            onPress={() => setConfirmDelete(!confirmDelete)}
          />
          {confirmDelete && (
            <>
              <Notice text="O relato sairá da visualização comunitária. O histórico interno será preservado pelo período de retenção." />
              <Button
                danger
                disabled={busy}
                title="Confirmar exclusão do alerta"
                onPress={() =>
                  void action(() => repository.remove(id), "Alerta excluído.")
                }
              />
            </>
          )}
        </Card>
      )}
      <Heading>Evidências</Heading>
      {detail.isPending && <Loading />}
      {detail.isError && <Notice error text={friendlyError(detail.error)} />}
      {!detail.isPending &&
        !detail.isError &&
        !detail.data?.evidence.length && (
          <Body muted>Nenhuma evidência anexada.</Body>
        )}
      {detail.data?.evidence.map((e) => (
        <EvidenceView key={e.id} evidence={e} />
      ))}
      <Heading>Atualizações</Heading>
      {detail.data?.history.map((h) => (
        <Card key={h.id}>
          <Body>
            {STATUS[h.to_status]} ·{" "}
            {new Date(h.created_at).toLocaleString("pt-BR")}
          </Body>
          <Body muted>{h.reason}</Body>
        </Card>
      ))}
      <Heading>Comentários</Heading>
      <Body muted>
        Não publique nomes, acusações pessoais ou dados identificáveis.
        Comentários não exibem autoria pública.
      </Body>
      {!["spam", "deleted"].includes(a.status) && (
        <>
          <Field
            label="Seu comentário (2 a 500 caracteres)"
            value={comment}
            onChangeText={setComment}
            maxLength={500}
            multiline
          />
          <Button
            disabled={busy || comment.trim().length < 2}
            title="Enviar comentário"
            onPress={() =>
              void action(
                () => repository.comment(id, comment),
                "Comentário enviado.",
              )
            }
          />
        </>
      )}
      {detail.data?.comments.map((c) => (
        <Card key={c.id}>
          <Body>{c.body}</Body>
          <Body muted>
            {new Date(c.created_at).toLocaleString("pt-BR")} · Participante
          </Body>
        </Card>
      ))}
      {(a.status === "confirmed" || a.risk >= 3) && (
        <Button
          secondary
          title="Consultar locais de apoio"
          onPress={() => router.push("/safe-places")}
        />
      )}
      {mayAdmin(profile) && (
        <Button title="Abrir moderação" onPress={() => router.push("/admin")} />
      )}
      <Notice text="Este aplicativo não substitui os serviços oficiais de emergência. Não procure ou confronte pessoas com base em relatos." />
    </Page>
  );
}
