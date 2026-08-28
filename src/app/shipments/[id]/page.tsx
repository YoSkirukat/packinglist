import { notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader, PageShell, Panel, StatusBadge } from "@/components/ui";
import { PackingListUpload } from "@/components/PackingListUpload";
import { PackingItemsTable } from "@/components/PackingItemsTable";
import { ActivityLogButton } from "@/components/ActivityLogButton";
import { ShipmentWarehouseField } from "@/components/ShipmentWarehouseField";
import { prisma } from "@/lib/prisma";
import { summarizeItems } from "@/lib/packing-list";
import { ensureSplitPackingItems } from "@/lib/catalog";
import {
  formatDateTime,
  formatNumber,
  shipmentStatusLabel,
  shipmentStatusTone,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureSplitPackingItems(id);
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      createdBy: { select: { login: true } },
      items: { orderBy: { lineNo: "asc" } },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { login: true } } },
      },
    },
  });

  if (!shipment) notFound();

  const sum = summarizeItems(shipment.items);

  return (
    <div>
      <AppHeader active="/shipments" wide />
      <PageShell
        wide
        title={shipment.title}
        description={`${shipment.supplier}${shipment.note ? ` · ${shipment.note}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActivityLogButton logs={shipment.logs} />
            <Link
              href="/shipments"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
            >
              К списку
            </Link>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <StatusBadge tone={shipmentStatusTone(shipment.status)}>
            {shipmentStatusLabel(shipment.status)}
          </StatusBadge>
          <span>Создал {shipment.createdBy.login}</span>
          <span>{formatDateTime(shipment.createdAt)}</span>
          {shipment.packingFileName ? (
            <span>Файл: {shipment.packingFileName}</span>
          ) : null}
        </div>

        <div className="mb-5">
          <ShipmentWarehouseField
            key={shipment.warehouseId ?? "none"}
            shipmentId={shipment.id}
            warehouseId={shipment.warehouseId}
          />
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 fade-in">
          {[
            { label: "Позиций", value: formatNumber(sum.positions) },
            { label: "Коробок", value: formatNumber(sum.cartons) },
            { label: "Штук", value: formatNumber(sum.pcs) },
            { label: "Вес / объём", value: `${formatNumber(sum.kg, 1)} кг · ${formatNumber(sum.cbm, 3)} м³` },
          ].map((card) => (
            <Panel key={card.label} className="px-4 py-4">
              <div className="text-xs text-[var(--muted)]">{card.label}</div>
              <div className="mt-1 text-xl font-semibold">{card.value}</div>
            </Panel>
          ))}
        </div>

        <div className="space-y-4">
          {shipment.items.length === 0 ? (
            <Panel className="fade-in px-4 py-4">
              <PackingListUpload shipmentId={shipment.id} hasItems={false} />
            </Panel>
          ) : (
            <>
              <Panel className="fade-in">
                <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
                  Товары из packing list
                </div>
                <PackingItemsTable items={shipment.items} shipmentId={shipment.id} />
              </Panel>
              <Panel className="fade-in px-4 py-4">
                <PackingListUpload shipmentId={shipment.id} hasItems />
              </Panel>
            </>
          )}
        </div>
      </PageShell>
    </div>
  );
}
