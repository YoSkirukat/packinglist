import { AppHeader, PageShell, Panel } from "@/components/ui";
import { CreateShipmentForm } from "@/components/CreateShipmentForm";

export const dynamic = "force-dynamic";

export default function NewShipmentPage() {
  return (
    <div>
      <AppHeader active="/shipments" />
      <PageShell
        title="Новая поставка"
        description="После создания откроется карточка, куда можно загрузить packing list"
      >
        <Panel className="fade-in px-5 py-5">
          <CreateShipmentForm />
        </Panel>
      </PageShell>
    </div>
  );
}
