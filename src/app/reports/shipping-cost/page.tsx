import { AppHeader, PageShell, Panel } from "@/components/ui";
import { ShippingCostReport } from "@/components/ShippingCostReport";

export const dynamic = "force-dynamic";

export default function ShippingCostReportPage() {
  return (
    <div>
      <AppHeader active="/reports/shipping-cost" />
      <PageShell
        title="Стоимость отправок"
        description="Сводка по перемещениям за период: количество единиц и стоимость обработки"
      >
        <Panel className="fade-in px-5 py-5">
          <ShippingCostReport />
        </Panel>
      </PageShell>
    </div>
  );
}
