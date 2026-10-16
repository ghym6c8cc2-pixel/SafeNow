import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Body,
  Button,
  Card,
  Chips,
  Field,
  Page,
  Heading,
  Notice,
  colors,
  s,
} from "./ui";

import {
  accountDecisionReason,
  availableDecisions,
  decisionDescriptions,
  decisionLabels,
  decisionReason,
  decisionReasonLimit,
  needsDecisionReason,
  adminStatus,
  type Decision,
  reactivationReason,
} from "../domain/moderation";
import type { Incident, Profile, Status } from "../domain/types";

function ReviewSheet({
  visible,
  busy,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  busy: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === "web" ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.light }}>
        <Page maxWidth={760}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.label}>SafeNow · Administração</Text>
            <Button
              secondary
              title="Fechar revisão"
              disabled={busy}
              onPress={onClose}
            />
          </View>
          <Heading>{title}</Heading>
          {children}
          <Body muted>
            Protótipo acadêmico. Não é atendimento de emergência.
          </Body>
        </Page>
      </SafeAreaView>
    </Modal>
  );
}

export function AlertModeration({
  alert: a,
  busy,
  run,
  category,
  error,
}: {
  alert: Incident;
  busy: boolean;
  category?: string;
  error?: string;
  run: (id: string, status: Status, reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<Decision | null>(null),
    [details, setDetails] = useState(""),
    [failed, setFailed] = useState(false);
  const actions = availableDecisions(a.status),
    reason = status ? decisionReason(status, details) : null;
  function choose(value: Decision) {
    if (busy) return;
    setStatus(value);
    setDetails("");
    setFailed(false);
  }
  async function apply() {
    if (!status || !reason || busy || !actions.includes(status)) return;
    setFailed(false);
    if (await run(a.id, status, reason)) setOpen(false);
    else setFailed(true);
  }
  function seeDetails() {
    setOpen(false);
    router.push(`/alert/${a.id}`);
  }
  return (
    <View testID={`moderation-${a.id}`}>
      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Body muted>
            {category ?? a.category_id} · Risco {a.risk}/4
          </Body>
          <Text style={s.tag}>{adminStatus(a.status)}</Text>
        </View>
        <Text style={s.cardTitle}>{a.title}</Text>
        <Body muted>{a.region || "Região aproximada"}</Body>
        {a.resolved_votes > 0 && a.status !== "resolved" && (
          <Body>{a.resolved_votes} aviso(s) de resolução para revisar</Body>
        )}
        {actions.length > 0 ? (
          <Button
            title={
              actions[0] === "under_review"
                ? "Rever decisão"
                : "Analisar ocorrência"
            }
            disabled={busy}
            onPress={() => {
              setStatus(null);
              setDetails("");
              setFailed(false);
              setOpen(true);
            }}
          />
        ) : (
          <Body muted>
            Ocorrência excluída. Consulte o histórico nos detalhes.
          </Body>
        )}
        <Button
          secondary
          title="Ver relato e evidências"
          disabled={busy}
          onPress={seeDetails}
        />
      </Card>
      <ReviewSheet
        visible={open}
        busy={busy}
        title={status ? "Confirmar decisão" : "Revisar ocorrência"}
        onClose={() => setOpen(false)}
      >
        <View testID={`review-${a.id}`} style={{ gap: 14 }}>
          <Card>
            <Text style={s.cardTitle}>{a.title}</Text>
            <Body>Status atual: {adminStatus(a.status)}</Body>
            {!status && (
              <>
                <Body>{a.description}</Body>
                <Body muted>
                  {a.region || "Região aproximada"} · Risco {a.risk}/4 ·{" "}
                  {a.evidence_count} evidência(s)
                </Body>
                <Button
                  secondary
                  title="Ver relato e evidências"
                  disabled={busy}
                  onPress={seeDetails}
                />
                {a.resolved_votes > 0 && a.status !== "resolved" && (
                  <Notice text="A comunidade informou que a situação terminou. Confira as informações antes de resolver." />
                )}
              </>
            )}
          </Card>
          {!status ? (
            <>
              <Body>Escolha o resultado da sua análise.</Body>
              {actions.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={decisionLabels[value]}
                  disabled={busy}
                  onPress={() => choose(value)}
                  style={({ pressed }) => [
                    s.card,
                    { gap: 5, opacity: pressed || busy ? 0.6 : 1 },
                  ]}
                >
                  <Text style={s.label}>{decisionLabels[value]}</Text>
                  <Body muted>{decisionDescriptions[value]}</Body>
                </Pressable>
              ))}
              <Body muted>
                Se faltar informação, feche a revisão e analise depois. Nada
                será alterado.
              </Body>
            </>
          ) : (
            <Card>
              <Text style={s.cardTitle}>{decisionLabels[status]}</Text>
              <Body muted>{decisionDescriptions[status]}</Body>
              <Body>
                {adminStatus(a.status)} → {adminStatus(status)}
              </Body>
              <Field
                label={
                  status === "spam"
                    ? "Por que ocultar? (8 a 500 caracteres)"
                    : status === "under_review"
                      ? "Por que reabrir? (8 a 500 caracteres)"
                      : "Observação (opcional)"
                }
                placeholder={
                  needsDecisionReason(status)
                    ? "Explique o problema encontrado, sem dados pessoais desnecessários."
                    : "Acrescente uma informação, se necessário."
                }
                value={details}
                editable={!busy}
                maxLength={decisionReasonLimit(status)}
                multiline
                onChangeText={(value) => {
                  setDetails(value);
                  setFailed(false);
                }}
              />
              <Body muted>
                {needsDecisionReason(status)
                  ? "O motivo será registrado no histórico privado."
                  : "A decisão será registrada no histórico, mesmo sem observação."}
              </Body>
              {failed && (
                <Notice
                  error
                  text={
                    error ??
                    "Não foi possível salvar. Confira sua sessão e tente novamente."
                  }
                />
              )}
              <Button
                danger={status === "spam"}
                disabled={busy || !reason}
                title={busy ? "Salvando…" : decisionLabels[status]}
                onPress={() => void apply()}
              />
              {!reason && (
                <Body muted>
                  Escreva um motivo com pelo menos 8 caracteres para continuar.
                </Body>
              )}
              <Button
                secondary
                disabled={busy}
                title="Voltar sem salvar"
                onPress={() => {
                  setStatus(null);
                  setDetails("");
                  setFailed(false);
                }}
              />
            </Card>
          )}
        </View>
      </ReviewSheet>
    </View>
  );
}

export function AccountManagement({
  user: u,
  busy,
  run,
  error,
}: {
  user: Profile;
  busy: boolean;
  error?: string;
  run: (
    id: string,
    status: "active" | "suspended",
    reason: string,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [choice, setChoice] = useState(""),
    [details, setDetails] = useState(""),
    [confirm, setConfirm] = useState(false),
    [failed, setFailed] = useState(false);
  const suspend = u.status === "active",
    allowed = u.role !== "admin" && u.status !== "deletion_requested",
    reason = accountDecisionReason(suspend, choice, details);
  async function apply() {
    if (!reason || busy || !allowed) return;
    setFailed(false);
    if (await run(u.id, suspend ? "suspended" : "active", reason)) {
      setOpen(false);
      setConfirm(false);
    } else setFailed(true);
  }
  return (
    <View testID={`account-${u.id}`}>
      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={[s.cardTitle, { flex: 1 }]}>{u.name}</Text>
          <Text style={s.tag}>
            {u.status === "active"
              ? "Ativa"
              : u.status === "suspended"
                ? "Suspensa"
                : "Exclusão solicitada"}
          </Text>
        </View>
        <Body muted>
          {u.role === "admin" ? "Administrador" : "Usuário comum"}
        </Body>
        {allowed && (
          <Button
            secondary
            disabled={busy}
            title="Revisar acesso"
            onPress={() => {
              setChoice("");
              setDetails("");
              setFailed(false);
              setOpen(true);
              setConfirm(false);
            }}
          />
        )}
        {u.role === "admin" && (
          <Body muted>
            Contas administrativas são gerenciadas por procedimento de servidor.
          </Body>
        )}
      </Card>
      {allowed && (
        <ReviewSheet
          visible={open}
          busy={busy}
          title={suspend ? "Suspender uma conta" : "Reativar uma conta"}
          onClose={() => setOpen(false)}
        >
          <View testID={`account-review-${u.id}`} style={{ gap: 14 }}>
            <Card>
              <Text style={s.cardTitle}>{u.name}</Text>
              <Body>{suspend ? "Suspender acesso" : "Reativar acesso"}</Body>
              <Body muted>
                {suspend
                  ? "A pessoa perderá o acesso aos dados e às ações do aplicativo. Explique o motivo da suspensão."
                  : "Após sua revisão, a pessoa poderá voltar a usar o aplicativo."}
              </Body>
              {!suspend && (
                <Chips
                  value={choice}
                  onChange={(value) => {
                    if (!busy) {
                      setChoice(value);
                      setDetails("");
                      setConfirm(false);
                    }
                  }}
                  items={[
                    { value: "review", label: "Revisão concluída" },
                    { value: "other", label: "Escrever outro motivo" },
                  ]}
                />
              )}
              {(suspend || !!choice) && (
                <Field
                  label={
                    suspend || choice === "other"
                      ? "Motivo da revisão (8 a 500 caracteres)"
                      : "Complemento da revisão (opcional)"
                  }
                  value={details}
                  editable={!busy}
                  onChangeText={(value) => {
                    setDetails(value);
                    setConfirm(false);
                  }}
                  maxLength={
                    choice === "review" ? 499 - reactivationReason.length : 500
                  }
                  multiline
                />
              )}
              {failed && (
                <Notice
                  error
                  text={
                    error ??
                    "Não foi possível atualizar o acesso. Tente novamente."
                  }
                />
              )}
              {!confirm && (
                <Button
                  danger={suspend}
                  disabled={busy || !reason}
                  title={suspend ? "Suspender conta" : "Reativar conta"}
                  onPress={() => {
                    if (suspend) setConfirm(true);
                    else void apply();
                  }}
                />
              )}
              {confirm && (
                <>
                  <Notice
                    error
                    text={`Confirma a suspensão de ${u.name}? A justificativa será registrada no histórico privado.`}
                  />
                  <Button
                    danger
                    disabled={busy || !reason}
                    title="Confirmar suspensão"
                    onPress={() => void apply()}
                  />
                  <Button
                    secondary
                    disabled={busy}
                    title="Cancelar suspensão"
                    onPress={() => setConfirm(false)}
                  />
                </>
              )}
            </Card>
          </View>
        </ReviewSheet>
      )}
    </View>
  );
}
