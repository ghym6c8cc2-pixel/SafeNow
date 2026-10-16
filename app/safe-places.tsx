import { useQuery } from "@tanstack/react-query";
import { Linking } from "react-native";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Notice,
  Loading,
} from "../src/components/ui";
import { useSession } from "../src/state/session";
export default function SafePlaces() {
  const { repository, profile } = useSession(),
    q = useQuery({
      queryKey: ["safe-places"],
      queryFn: () => repository.safePlaces(),
      enabled: !!profile,
    });
  return (
    <Page>
      <Heading sub="Informações de apoio, sujeitas a horário, disponibilidade e revisão.">
        Locais de apoio
      </Heading>
      <Notice text="Nenhum trajeto ou local é garantia de segurança. Afaste-se do perigo e procure serviços oficiais. O mapa externo não avalia os relatos do SafeNow." />
      {q.isPending && <Loading />}
      {q.isError && (
        <Notice
          error
          text="Não foi possível consultar os locais. Tente novamente."
        />
      )}
      {!q.isPending && !q.isError && !q.data?.length && (
        <Notice text="Não há locais verificados cadastrados para este protótipo. A instituição responsável deve verificar e cadastrar pontos reais antes do uso em campo." />
      )}
      {q.data?.map((p) => (
        <Card key={p.id}>
          <Heading>{p.name}</Heading>
          <Body>{p.description}</Body>
          <Body muted>
            Última verificação:{" "}
            {p.verified_at
              ? new Date(p.verified_at).toLocaleDateString("pt-BR")
              : "Pendente"}
          </Body>
          <Button
            secondary
            title="Abrir deslocamento em mapa externo"
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=walking`,
              )
            }
          />
        </Card>
      ))}
      <Button
        secondary
        title="Pesquisar serviços de apoio em mapa externo"
        onPress={() =>
          void Linking.openURL(
            "https://www.google.com/maps/search/?api=1&query=servicos+publicos+de+emergencia+proximos",
          )
        }
      />
    </Page>
  );
}
