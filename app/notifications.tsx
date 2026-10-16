import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Chips,
  Field,
  Notice,
  Loading,
  s,
} from "../src/components/ui";
import { useSession } from "../src/state/session";
import { useCategories } from "../src/state/queries";
import type { Preferences } from "../src/domain/types";
import { defaultPreferences } from "../src/services/demo";
import { locate } from "../src/services/location";
import { registerPush } from "../src/services/notifications";
import { friendlyError } from "../src/services/supabase";
import { AppIcon, categoryIcon } from "../src/components/icons";
export default function Notifications() {
  const { repository, demoMode, profile } = useSession(),
    categories = useCategories(),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ["preferences"],
    queryFn: () => repository.preferences(),
    enabled: !!profile,
  });
  const [draft, setP] = useState<Preferences | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const p = draft ?? query.data ?? defaultPreferences;
  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading sub="Receba somente o que for relevante para a zona que você escolher.">
        Notificações
      </Heading>
      {query.isPending && <Loading />}
      {query.isError && <Notice error text={friendlyError(query.error)} />}
      {!!message && <Notice text={message} />}
      <Card>
        <View style={s.row}>
          <Switch
            accessibilityLabel="Ativar alertas push"
            value={p.enabled}
            onValueChange={(v) => setP({ ...p, enabled: v })}
          />
          <Body>Ativar alertas push</Body>
        </View>
        <Body muted>
          Ao registrar o dispositivo, você autoriza o envio de avisos genéricos
          de alertas próximos. O conteúdo completo exige abrir o aplicativo.
        </Body>
        <Button
          secondary
          disabled={busy || demoMode}
          title="Solicitar permissão e registrar dispositivo"
          onPress={() => void run(registerPush)}
        />
        {demoMode && (
          <Body muted>
            A demonstração salva preferências locais. Push exige Supabase, EAS,
            FCM/APNs e dispositivo físico.
          </Body>
        )}
        <View style={s.row}>
          <Switch
            accessibilityLabel="Usar som nos alertas"
            value={p.sound}
            onValueChange={(v) => setP({ ...p, sound: v })}
          />
          <Body>Usar som</Body>
        </View>
        <Body muted>
          O modo silencioso do sistema e suas configurações de canais têm
          prioridade. Em primeiro plano, os avisos são exibidos sem som.
        </Body>
      </Card>
      <Card>
        <Body>Zona de interesse</Body>
        <Field
          label="Nome da zona (opcional)"
          value={p.zone_name}
          onChangeText={(v) => setP({ ...p, zone_name: v })}
          maxLength={80}
        />
        <Body muted>
          Ao usar GPS abaixo, você autoriza salvar uma posição aproximada no
          servidor para selecionar avisos por raio. A zona não acompanha seus
          deslocamentos.
        </Body>
        <Button
          disabled={busy}
          secondary
          title="Usar GPS para definir esta zona"
          onPress={() =>
            void run(async () => {
              const x = await locate();
              setP({
                ...p,
                latitude: Math.round(x.latitude * 1000) / 1000,
                longitude: Math.round(x.longitude * 1000) / 1000,
              });
              return "Zona aproximada definida. Salve as preferências.";
            })
          }
        />
        <Body>
          {p.latitude === null
            ? "Zona não definida"
            : `${p.latitude.toFixed(3)}, ${p.longitude?.toFixed(3)} · aproximada`}
        </Body>
        <Button
          secondary
          title="Remover zona e desativar alertas"
          onPress={() =>
            setP({ ...p, latitude: null, longitude: null, enabled: false })
          }
        />
        <Body>Raio da zona</Body>
        <Chips
          value={p.radius_m}
          onChange={(v) => setP({ ...p, radius_m: v })}
          items={[
            { value: 1000, label: "1 km" },
            { value: 3000, label: "3 km" },
            { value: 5000, label: "5 km" },
            { value: 10000, label: "10 km" },
            { value: 20000, label: "20 km" },
          ]}
        />
      </Card>
      <Card>
        <Body>Categorias de interesse</Body>
        <Body muted>Sem seleção, todas as categorias serão consideradas.</Body>
        {categories.data?.map((c) => (
          <View key={c.id} style={s.row}>
            <Switch
              accessibilityLabel={`Receber ${c.name}`}
              value={p.categories.includes(c.id)}
              onValueChange={(v) =>
                setP({
                  ...p,
                  categories: v
                    ? [...p.categories, c.id]
                    : p.categories.filter((x) => x !== c.id),
                })
              }
            />
            <AppIcon name={categoryIcon(c.id)} size={22} />
            <Body>{c.name}</Body>
          </View>
        ))}
      </Card>
      <Card>
        <Body>Horário silencioso</Body>
        <Chips
          value={p.quiet_start === null ? "off" : "night"}
          items={[
            { value: "off", label: "Sem horário silencioso" },
            { value: "night", label: "Das 22h às 7h" },
          ]}
          onChange={(v) =>
            setP({
              ...p,
              quiet_start: v === "off" ? null : 22,
              quiet_end: v === "off" ? null : 7,
            })
          }
        />
        <Body muted>
          Fuso: {p.timezone}. Avisos elegíveis nesse período são descartados.
        </Body>
        <Body muted>
          Localização em segundo plano: não utilizada neste protótipo. Push pode
          chegar com o app fechado, usando a zona salva. Atualize a zona
          manualmente ao se deslocar.
        </Body>
      </Card>
      <Button
        title={busy ? "Salvando…" : "Salvar preferências"}
        disabled={busy || query.isPending || query.isError}
        onPress={() =>
          void run(async () => {
            if (p.enabled && p.latitude === null)
              throw new Error("Defina uma zona antes de ativar os avisos.");
            await repository.savePreferences(p);
            await cache.invalidateQueries({ queryKey: ["preferences"] });
            return "Preferências salvas.";
          })
        }
      />
    </Page>
  );
}
