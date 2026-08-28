import { AppHeader, PageShell, Panel } from "@/components/ui";
import { StockBalancesView } from "@/components/StockBalancesView";

export const dynamic = "force-dynamic";

export default function StockPage() {
  return (
    <div>
      <AppHeader active="/stock" />
      <PageShell
        title="Остатки"
        description="Сколько товара сейчас на выбранном складе: по поставкам и приходам перемещений"
      >
        <Panel className="fade-in px-5 py-5">
          <StockBalancesView />
        </Panel>
      </PageShell>
    </div>
  );
}
