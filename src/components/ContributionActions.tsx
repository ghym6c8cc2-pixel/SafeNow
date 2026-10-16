import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Body, Button, Notice } from "./ui";
import { acceptsContributions, resolutionNotice } from "../domain/rules";
import type { Incident, Vote } from "../domain/types";
import { useSession } from "../state/session";
import { friendlyError } from "../services/supabase";

const opinions: { value: Vote; label: string; button: string; hint: string }[] =
  [
    {
      value: "confirm",
      label: "Confirmação",
      button: "Confirmar informação",
      hint: "Indica que você sabe que a ocorrência aconteceu.",
    },
    {
      value: "contest",
      label: "Contestação",
      button: "Contestar informação",
      hint: "Aponta um erro no relato, sem afirmar que foi inventado.",
    },
    {
      value: "spam",
      label: "Sinalização de spam / falso",
      button: "Sinalizar spam ou falso",
      hint: "Sinaliza suspeita de relato falso, propaganda ou abuso para análise.",
    },
  ];
export function ContributionActions({
  alert: a,
  own,
}: {
  alert: Incident;
  own: boolean | undefined;
}) {
  const { repository, profile } = useSession(),
    cache = useQueryClient();
  const contribution = useQuery({
    queryKey: ["contribution", a.id, profile?.id],
    queryFn: () => repository.contribution(a.id),
    enabled: !!profile,
    refetchInterval: 60000,
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const current = contribution.data,
    open = acceptsContributions(a.status);
  const disabled =
    busy || !current || contribution.isError || own === undefined;
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      await action();
      await cache.invalidateQueries();
      setMessage(success);
    } catch (e) {
      setError(true);
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const notice = resolutionNotice(a);
  return (
    <View testID={`contribution-${a.id}`} style={{ gap: 10 }}>
      {!!notice && <Notice text={notice} />}
      <Body>Sua contribuição</Body>
      <Body muted>
        Contribua somente com o que você já sabe. Não se aproxime para
        verificar.
      </Body>
      {contribution.isPending && (
        <Body muted>Consultando sua contribuição…</Body>
      )}
      {contribution.isError && (
        <>
          <Notice
            error
            text="Não foi possível consultar sua contribuição. Tente novamente antes de alterar."
          />
          <Button
            secondary
            title="Consultar minha contribuição novamente"
            onPress={() => void contribution.refetch()}
          />
        </>
      )}
      {current && (
        <Body>
          Sua opinião:{" "}
          {opinions.find((x) => x.value === current.opinion)?.label ??
            "Nenhuma"}
        </Body>
      )}
      {own && (
        <Body muted>
          Você não pode validar o próprio relato. Pode informar que a situação
          terminou para análise.
        </Body>
      )}
      {!own && open && (
        <>
          <Body muted>
            Uma opinião ativa por pessoa. Você pode trocar ou retirar; a
            anterior deixa de contar.
          </Body>
          {opinions.map((x) => (
            <Button
              key={x.value}
              secondary={current?.opinion !== x.value}
              title={x.button}
              hint={x.hint}
              disabled={disabled || current?.opinion === x.value}
              onPress={() =>
                void run(
                  () => repository.vote(a.id, x.value),
                  "Opinião salva. A anterior foi substituída, sem duplicar votos.",
                )
              }
            />
          ))}
        </>
      )}
      {current?.opinion && (
        <Button
          secondary
          title="Retirar minha opinião"
          hint="Remove sua opinião atual e desconta o voto da contagem."
          disabled={disabled}
          onPress={() =>
            void run(
              () => repository.vote(a.id, null),
              "Opinião retirada. As contagens foram atualizadas.",
            )
          }
        />
      )}
      {(open || current?.resolution_reported) && (
        <>
          <Body>Informar resolução</Body>
          <Body muted>
            Este aviso é separado da sua opinião. Apenas a moderação pode
            encerrar a ocorrência como resolvida.
          </Body>
          {current?.resolution_reported ? (
            <>
              <Body>Você informou que a situação terminou.</Body>
              <Button
                secondary
                title="Retirar meu aviso de resolução"
                disabled={disabled}
                onPress={() =>
                  void run(
                    () => repository.reportResolution(a.id, false),
                    "Aviso retirado. A decisão da moderação não foi alterada.",
                  )
                }
              />
            </>
          ) : (
            <Button
              secondary
              title="Informar que foi resolvido"
              disabled={disabled}
              onPress={() =>
                void run(
                  () => repository.reportResolution(a.id, true),
                  "Aviso de resolução enviado para análise. Sua opinião foi preservada.",
                )
              }
            />
          )}
        </>
      )}
      {!!message && <Notice error={error} text={message} />}
    </View>
  );
}
