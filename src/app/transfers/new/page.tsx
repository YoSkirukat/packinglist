import Link from "next/link";
import { AppHeader, PageShell, Panel } from "@/components/ui";
import { TransferForm } from "@/components/TransferForm";

export const dynamic = "force-dynamic";

export default function NewTransferPage() {
  return (
    <div>
      <AppHeader active="/transfers" />
      <PageShell
        title="Новое перемещение"
        description="Выберите склады и заполните список товаров с коробками"
        actions={
          <Link
            href="/transfers"
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
          >
            К списку
          </Link>
        }
      >
        <Panel className="fade-in px-5 py-5">
          <TransferForm mode="create" />
        </Panel>
      </PageShell>
    </div>
  );
}
