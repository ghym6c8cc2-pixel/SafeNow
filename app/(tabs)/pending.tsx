import {
  Page,
  Heading,
  Notice,
  Loading,
  IncidentCard,
} from "../../src/components/ui";
import { useAlerts, useCategories, useMine } from "../../src/state/queries";
import { useSession } from "../../src/state/session";
import { friendlyError } from "../../src/services/supabase";
import { ContributionActions } from "../../src/components/ContributionActions";
export default function Pending() {
  const alerts = useAlerts(),
    categories = useCategories(),
    mine = useMine(),
    { profile } = useSession();
  const items =
    alerts.data?.filter(
      (a) =>
        ["active", "under_review", "contested"].includes(a.status) &&
        !mine.data?.includes(a.id),
    ) ?? [];
  return (
    <Page>
      <Heading sub="Contribua apenas com informações que você já conhece.">
        Validação comunitária
      </Heading>
      <Notice text="Não se aproxime da ocorrência para validar. Você não precisa confirmar um relato para usar o aplicativo." />
      {(alerts.isPending || mine.isPending) && <Loading />}
      {(alerts.isError || mine.isError) && (
        <Notice error text={friendlyError(alerts.error ?? mine.error)} />
      )}{" "}
      {!alerts.isPending && !alerts.isError && !items.length && (
        <Notice text="Não há alertas pendentes disponíveis para sua contribuição." />
      )}
      {items.map((a) => (
        <IncidentCard
          key={a.id}
          alert={a}
          category={categories.data?.find((c) => c.id === a.category_id)?.name}
          extra={
            <ContributionActions
              alert={a}
              own={profile && mine.data ? mine.data.includes(a.id) : undefined}
            />
          }
        />
      ))}
    </Page>
  );
}
