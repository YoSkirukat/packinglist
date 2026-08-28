import { AppHeader, PageShell, Panel } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";
import { getSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <AppHeader active="/settings" />
      <PageShell
        title="Настройки"
        description="Справочники и параметры учёта поставок"
      >
        <Panel className="fade-in px-5 py-5">
          <SettingsForm
            initialUrl={settings.productsFileUrl}
            lastSync={settings.lastProductsSync}
            productsCount={settings.productsCount}
          />
        </Panel>
      </PageShell>
    </div>
  );
}
