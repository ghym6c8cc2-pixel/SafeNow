import { useState } from "react";
import { Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Field,
  Notice,
  Chips,
  Loading,
  s,
} from "../src/components/ui";
import {
  AccountManagement,
  AlertModeration,
} from "../src/components/AdminActions";
import { useSession } from "../src/state/session";
import { useAlerts, useCategories } from "../src/state/queries";
import { mayAdmin } from "../src/services/auth-core";
import { STATUS } from "../src/domain/rules";
import { auditLabel, needsReview } from "../src/domain/moderation";
import { friendlyError } from "../src/services/supabase";

type Section = "alerts" | "users" | "history";
export default function Admin() {
  const { repository, profile } = useSession(),
    allowed = mayAdmin(profile),
    cache = useQueryClient(),
    alerts = useAlerts(),
    categories = useCategories();
  const users = useQuery({
      queryKey: ["admin-users"],
      queryFn: () => repository.users(),
      enabled: allowed,
    }),
    audit = useQuery({
      queryKey: ["audit"],
      queryFn: () => repository.audit(),
      enabled: allowed,
    });
  const [section, setSection] = useState<Section>("alerts"),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [filter, setFilter] = useState("queue"),
    [alertSearch, setAlertSearch] = useState(""),
    [userFilter, setUserFilter] = useState("all"),
    [userSearch, setUserSearch] = useState("");
  if (!allowed)
    return (
      <Page>
        <Heading>Acesso administrativo negado</Heading>
        <Notice
          error
          text="Somente uma conta ativa com papel de administrador definido no servidor pode acessar este painel."
        />
      </Page>
    );
  async function action(fn: () => Promise<void>, success: string) {
    if (busy) return false;
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      await cache.invalidateQueries();
      setFeedback({ text: success, error: false });
      return true;
    } catch (e) {
      setFeedback({ text: friendlyError(e), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const all = alerts.data ?? [],
    accounts = users.data ?? [],
    queue = all.filter(needsReview);
  const list = (filter === "queue" ? queue : all).filter((a) =>
    `${a.title} ${a.region}`
      .toLocaleLowerCase("pt-BR")
      .includes(alertSearch.trim().toLocaleLowerCase("pt-BR")),
  );
  const people = accounts.filter(
    (u) =>
      (userFilter === "all" || u.status === userFilter) &&
      `${u.name} ${u.id}`
        .toLocaleLowerCase("pt-BR")
        .includes(userSearch.trim().toLocaleLowerCase("pt-BR")),
  );
  const counts = Object.entries(STATUS).map(([key, label]) => ({
    status: label,
    total: all.filter((a) => a.status === key).length,
  }));
  return (
    <Page maxWidth={1200}>
      <Heading sub="Escolha o que deseja revisar. Cada decisão é registrada no histórico privado.">
        Painel administrativo
      </Heading>
      <View style={s.row}>
        <Button
          secondary
          title="Voltar ao perfil"
          onPress={() => router.replace("/(tabs)/settings")}
        />
      </View>
      <Chips
        value={section}
        onChange={(value) => {
          if (!busy) setSection(value);
        }}
        items={[
          { value: "alerts", label: "Ocorrências" },
          { value: "users", label: "Usuários" },
          { value: "history", label: "Histórico" },
        ]}
      />
      {feedback && <Notice text={feedback.text} error={feedback.error} />}
      {(alerts.isError || users.isError || audit.isError) && (
        <>
          <Notice
            error
            text={friendlyError(alerts.error ?? users.error ?? audit.error)}
          />
          <Button
            secondary
            title="Atualizar painel"
            disabled={busy}
            onPress={() => {
              void alerts.refetch();
              void users.refetch();
              void audit.refetch();
            }}
          />
        </>
      )}
      {section === "alerts" && (
        <>
          <Heading sub="Abra uma ocorrência para escolher a ação e registrar a decisão.">
            Revisar ocorrências
          </Heading>
          <Card>
            <Chips
              value={filter}
              onChange={setFilter}
              items={[
                { value: "queue", label: `Para revisar (${queue.length})` },
                { value: "all", label: `Todas (${all.length})` },
              ]}
            />
            <Field
              label="Buscar ocorrência ou região"
              value={alertSearch}
              onChangeText={setAlertSearch}
            />
          </Card>
          {alerts.isPending && <Loading />}
          {!alerts.isPending && !alerts.isError && !list.length && (
            <Notice
              text={
                alertSearch.trim()
                  ? "Nenhuma ocorrência corresponde à busca."
                  : filter === "queue"
                    ? "Fila em dia. Não há ocorrências aguardando revisão."
                    : "Nenhuma ocorrência disponível."
              }
            />
          )}
          {list.map((a) => (
            <AlertModeration
              key={a.id + ":" + a.status}
              alert={a}
              busy={busy}
              error={feedback?.error ? feedback.text : undefined}
              category={
                categories.data?.find((c) => c.id === a.category_id)?.name
              }
              run={(id, status, reason) =>
                action(
                  () => repository.moderate(id, status, reason),
                  "Ocorrência atualizada. A decisão foi registrada no histórico.",
                )
              }
            />
          ))}
        </>
      )}
      {section === "users" && (
        <>
          <Heading sub="Revise uma conta por vez. A justificativa pertence somente à pessoa selecionada.">
            Gerenciar usuários
          </Heading>
          <Card>
            <Field
              label="Buscar pessoa"
              value={userSearch}
              onChangeText={setUserSearch}
            />
            <Chips
              value={userFilter}
              onChange={setUserFilter}
              items={[
                { value: "all", label: "Todas as contas" },
                { value: "active", label: "Ativas" },
                { value: "suspended", label: "Suspensas" },
              ]}
            />
          </Card>
          {users.isPending && <Loading />}
          {!users.isPending && !users.isError && !people.length && (
            <Notice text="Nenhuma conta corresponde à busca." />
          )}
          {people.map((u) => (
            <AccountManagement
              key={u.id + ":" + u.status}
              user={u}
              busy={busy}
              error={feedback?.error ? feedback.text : undefined}
              run={(id, status, reason) =>
                action(
                  () => repository.manage(id, status, reason),
                  "Acesso atualizado. A revisão foi registrada no histórico.",
                )
              }
            />
          ))}
        </>
      )}
      {section === "history" && (
        <>
          <Heading sub="Registro privado de quem decidiu, quando e por qual motivo.">
            Histórico de decisões
          </Heading>
          <Card>
            <Text style={s.label}>Resumo das ocorrências</Text>
            <Body muted>Totais dos registros carregados no painel.</Body>
            {counts.map((item) => (
              <View
                key={item.status}
                style={[s.row, { justifyContent: "space-between" }]}
              >
                <Body>{item.status}</Body>
                <Text style={s.label}>{item.total}</Text>
              </View>
            ))}
          </Card>
          <Button
            secondary
            title="Compartilhar resumo"
            onPress={() =>
              void Share.share({
                title: "Relatório acadêmico SafeNow",
                message:
                  "SafeNow · " +
                  new Date().toLocaleString("pt-BR") +
                  "\n" +
                  counts.map((c) => `${c.status}: ${c.total}`).join("\n") +
                  "\nDados comunitários sujeitos a erro. Totais limitados aos registros carregados.",
              })
            }
          />

          {audit.isPending && <Loading />}
          {!audit.isPending && !audit.isError && !audit.data?.length && (
            <Notice text="Nenhuma decisão registrada." />
          )}
          {audit.data?.map((entry) => (
            <Card key={entry.id}>
              <Text style={s.label}>{auditLabel(entry.action)}</Text>
              <Body muted>
                {new Date(entry.created_at).toLocaleString("pt-BR")}
              </Body>
              {entry.target_id &&
                (all.find((a) => a.id === entry.target_id)?.title ||
                  accounts.find((u) => u.id === entry.target_id)?.name) && (
                  <Body>
                    {all.find((a) => a.id === entry.target_id)?.title ??
                      accounts.find((u) => u.id === entry.target_id)?.name}
                  </Body>
                )}
              <Body>{entry.reason}</Body>
              <Body muted>
                Responsável:{" "}
                {accounts.find((u) => u.id === entry.actor_id)?.name ??
                  (entry.actor_id
                    ? "Administrador (conta indisponível)"
                    : "Procedimento de servidor")}
              </Body>
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
