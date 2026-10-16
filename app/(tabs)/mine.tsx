import {
  Page,
  Heading,
  Notice,
  Loading,
  IncidentCard,
} from "../../src/components/ui";
import { useAlerts, useCategories, useMine } from "../../src/state/queries";
import { friendlyError } from "../../src/services/supabase";
export default function Mine() {
  const alerts = useAlerts(),
    mine = useMine(),
    categories = useCategories();
  const list = alerts.data?.filter((a) => mine.data?.includes(a.id)) ?? [];
  return (
    <Page>
      <Heading sub="Consulte contribuições, histórico e correções nos detalhes.">
        Meus alertas
      </Heading>
      {(alerts.isPending || mine.isPending) && <Loading />}
      {(alerts.isError || mine.isError) && (
        <Notice error text={friendlyError(alerts.error ?? mine.error)} />
      )}
      {!alerts.isPending &&
        !mine.isPending &&
        !alerts.isError &&
        !mine.isError &&
        !list.length && (
          <Notice text="Você ainda não publicou alertas. Use Relatar para registrar uma ocorrência de um local seguro." />
        )}
      {list.map((a) => (
        <IncidentCard
          key={a.id}
          alert={a}
          category={categories.data?.find((c) => c.id === a.category_id)?.name}
        />
      ))}
    </Page>
  );
}
