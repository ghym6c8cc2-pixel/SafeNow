import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useAlerts, useCategories } from "../../src/state/queries";
import { useSession } from "../../src/state/session";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Chips,
  Notice,
  Loading,
  IncidentCard,
  s,
} from "../../src/components/ui";
import IncidentMap from "../../src/components/IncidentMap";
import { filterAlerts } from "../../src/domain/rules";
import type { Position } from "../../src/domain/types";
import { locate } from "../../src/services/location";
import { accuracyLabel } from "../../src/services/location-core";
import { friendlyError } from "../../src/services/supabase";
import { categoryIcon } from "../../src/components/icons";
export default function MapScreen() {
  const { width } = useWindowDimensions();
  const alerts = useAlerts(),
    categories = useCategories(),
    { demoMode } = useSession();
  const [position, setPosition] = useState<Position | null>(null),
    [radius, setRadius] = useState<number | null>(null),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [risk, setRisk] = useState(0),
    [error, setError] = useState(""),
    [locating, setLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters =
    Number(!!category) +
    Number(!!status) +
    Number(!!risk) +
    Number(radius !== null);
  const items = filterAlerts(
    alerts.data ?? [],
    position,
    radius,
    category,
    status,
    risk,
  );
  async function gps() {
    setLocating(true);
    setError("");
    try {
      setPosition(await locate());
    } catch (e) {
      setError(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setLocating(false);
    }
  }
  return (
    <Page maxWidth={1200}>
      <Heading sub="Informação comunitária para orientar suas escolhas.">
        Ao seu redor
      </Heading>
      {demoMode && (
        <Notice text="Todos os alertas desta demonstração são fictícios. O mapa usa São Paulo como região de exemplo." />
      )}
      <View style={[s.row, { alignItems: "stretch" }]}>
        <View style={{ flex: 1, minWidth: 155 }}>
          <Button
            secondary
            title={locating ? "Obtendo localização…" : "Minha localização"}
            disabled={locating}
            onPress={() => void gps()}
          />
        </View>
        <View style={{ flex: 1, minWidth: 155 }}>
          <Button
            title="＋ Relatar uma ocorrência"
            onPress={() => router.push("/(tabs)/report")}
          />
        </View>
      </View>
      <IncidentMap
        alerts={items}
        position={position}
        height={width >= 800 ? 460 : 360}
      />
      <Body muted>
        {position
          ? `Ponto azul: você · ${accuracyLabel(position)}`
          : "Ative Minha localização para ver sua posição e filtrar por distância."}{" "}
        · Pinos numerados: risco das ocorrências.
      </Body>
      <Body muted>
        No computador, use a roda do mouse para aproximar ou afastar. No
        celular, use dois dedos.
      </Body>
      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
            <Body>
              {items.length === 1
                ? "1 ocorrência no mapa"
                : `${items.length} ocorrências no mapa`}
            </Body>
            <Body muted>
              {radius === null
                ? "Sem limite de distância"
                : position
                  ? `Até ${radius / 1000} km em linha reta`
                  : `Raio de ${radius / 1000} km pendente · ative o GPS`}{" "}
              ·{" "}
              {categories.data?.find((c) => c.id === category)?.name ??
                "Todas as categorias"}
            </Body>
          </View>
          <Button
            secondary
            title={
              filtersOpen
                ? "Recolher filtros"
                : `Filtrar alertas${activeFilters ? ` (${activeFilters})` : ""}`
            }
            onPress={() => setFiltersOpen(!filtersOpen)}
          />
        </View>
        {filtersOpen && (
          <>
            <Body>Distância</Body>
            <Chips
              value={radius ?? "all"}
              onChange={(value) =>
                setRadius(value === "all" ? null : Number(value))
              }
              items={[
                { value: "all", label: "Sem limite de distância" },
                { value: 1000, label: "1 km" },
                { value: 3000, label: "3 km" },
                { value: 10000, label: "10 km" },
              ]}
            />
            <Body muted>
              {radius === null
                ? "Visão geral: veja os alertas disponíveis de toda a região. Os outros filtros continuam valendo."
                : position
                  ? "O raio usa a distância em linha reta a partir da última localização obtida, não o trajeto pelas ruas."
                  : `O raio de ${radius / 1000} km ainda não está aplicado. Ative sua localização para filtrar os alertas próximos.`}
            </Body>
            {radius !== null && !position && (
              <Button
                secondary
                title={
                  locating
                    ? "Obtendo localização…"
                    : "Ativar localização para filtrar"
                }
                disabled={locating}
                onPress={() => void gps()}
              />
            )}
            <Body>Categoria</Body>
            <Chips
              value={category}
              onChange={setCategory}
              items={[
                { value: "", label: "Todas as categorias" },
                ...(categories.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                  icon: categoryIcon(c.id),
                })),
              ]}
            />
            <Body>Status da ocorrência</Body>
            <Chips
              value={status}
              onChange={setStatus}
              items={[
                { value: "", label: "Em andamento" },
                { value: "under_review", label: "Em análise" },
                { value: "confirmed", label: "Confirmados" },
                { value: "resolved", label: "Resolvidos" },
              ]}
            />
            <Body muted>
              {status === "under_review"
                ? "Relatos aguardando análise ou com informações divergentes."
                : status === "confirmed"
                  ? "Relatos confirmados pela comunidade ou pela moderação."
                  : status === "resolved"
                    ? "Ocorrências encerradas como resolvidas pela moderação."
                    : "Reúne as ocorrências que ainda estão em acompanhamento."}
            </Body>
            <Body>Nível de risco</Body>
            <Chips
              value={risk}
              onChange={setRisk}
              items={[
                { value: 0, label: "Todos os riscos" },
                { value: 1, label: "1/4 · Baixo" },
                { value: 2, label: "2/4 · Atenção" },
                { value: 3, label: "3/4 · Alto" },
                { value: 4, label: "4/4 · Crítico" },
              ]}
            />
            <Button
              secondary
              title="Limpar filtros"
              onPress={() => {
                setRadius(null);
                setCategory("");
                setStatus("");
                setRisk(0);
              }}
            />
          </>
        )}
      </Card>
      {!!error && <Notice text={error} error />}
      {(alerts.isPending || categories.isPending) && <Loading />}
      {(alerts.isError || categories.isError) && (
        <>
          <Notice
            text={friendlyError(alerts.error ?? categories.error)}
            error
          />
          <Button
            secondary
            title="Tentar carregar novamente"
            onPress={() => {
              void alerts.refetch();
              void categories.refetch();
            }}
          />
        </>
      )}
      <Heading sub="Risco e confiabilidade são informações diferentes.">
        {items.length} alertas encontrados
      </Heading>
      {!alerts.isPending && !alerts.isError && !items.length && (
        <Notice text="Nenhum alerta corresponde aos filtros. Isso não garante que a região esteja segura." />
      )}
      {items.map((a) => (
        <IncidentCard
          key={a.id}
          alert={a}
          category={categories.data?.find((c) => c.id === a.category_id)?.name}
        />
      ))}
      <Button
        secondary
        title="Consultar locais de apoio"
        onPress={() => router.push("/safe-places")}
      />
    </Page>
  );
}
