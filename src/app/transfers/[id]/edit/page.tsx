import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader, PageShell, Panel } from "@/components/ui";
import { TransferForm } from "@/components/TransferForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          allocations: { orderBy: { cartonNo: "asc" } },
        },
      },
    },
  });
  if (!transfer) notFound();

  return (
    <div>
      <AppHeader active="/transfers" />
      <PageShell
        title="Редактирование перемещения"
        description={`${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`}
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
          <TransferForm
            mode="edit"
            transferId={transfer.id}
            initial={{
              id: transfer.id,
              fromWarehouseId: transfer.fromWarehouseId,
              toWarehouseId: transfer.toWarehouseId,
              note: transfer.note,
              lines: transfer.lines.map((line) => ({
                productId: line.productId,
                productName: line.productName,
                productCode: line.productCode,
                productArticle: line.productArticle,
                qty: line.qty,
                allocations: line.allocations.map((a) => ({
                  packingItemId: a.packingItemId,
                  shipmentId: a.shipmentId,
                  cartonNo: a.cartonNo,
                  qty: a.qty,
                })),
              })),
            }}
          />
        </Panel>
      </PageShell>
    </div>
  );
}
