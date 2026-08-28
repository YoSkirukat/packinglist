import Link from "next/link";
import { DeleteShipmentButton } from "@/components/DeleteShipmentButton";
import { AppHeader, EmptyState, PageShell, Panel, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeItems } from "@/lib/packing-list";
import {
  formatDateTime,
  formatNumber,
  shipmentStatusLabel,
  shipmentStatusTone,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const [user, shipments] = await Promise.all([
    getCurrentUser(),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { login: true } },
        items: {
          select: {
            totalPcs: true,
            totalCartons: true,
            totalGrossWeight: true,
            totalCbm: true,
          },
        },
      },
    }),
  ]);
  const isAdmin = user?.role === "admin";

  return (
    <div>
      <AppHeader active="/shipments" />
      <PageShell
        title="Поставки"
        description="Каждая поставка — отдельный packing list от китайского поставщика"
        actions={
          <Link
            href="/shipments/new"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95"
          >
            Создать поставку
          </Link>
        }
      >
        <Panel className="fade-in">
          {shipments.length === 0 ? (
            <EmptyState
              title="Поставок ещё нет"
              description="Создайте поставку и загрузите Excel packing list — появится таблица товаров и коробок."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Поставка</th>
                    <th>Статус</th>
                    <th>Позиций</th>
                    <th>Коробок</th>
                    <th>Вес, кг</th>
                    <th>м³</th>
                    <th>Кто создал</th>
                    <th>Дата</th>
                    {isAdmin ? <th className="w-12" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => {
                    const sum = summarizeItems(shipment.items);
                    return (
                      <tr key={shipment.id}>
                        <td>
                          <Link
                            href={`/shipments/${shipment.id}`}
                            className="font-medium text-[var(--link)] hover:underline"
                          >
                            {shipment.title}
                          </Link>
                          <div className="mt-0.5 text-xs text-[var(--muted)]">
                            {shipment.supplier}
                            {shipment.packingFileName ? ` · ${shipment.packingFileName}` : ""}
                          </div>
                        </td>
                        <td>
                          <StatusBadge tone={shipmentStatusTone(shipment.status)}>
                            {shipmentStatusLabel(shipment.status)}
                          </StatusBadge>
                        </td>
                        <td>{formatNumber(sum.positions)}</td>
                        <td className="col-cartons">{formatNumber(sum.cartons)}</td>
                        <td>{formatNumber(sum.kg, 1)}</td>
                        <td>{formatNumber(sum.cbm, 3)}</td>
                        <td>{shipment.createdBy.login}</td>
                        <td>{formatDateTime(shipment.createdAt)}</td>
                        {isAdmin ? (
                          <td className="text-right">
                            <DeleteShipmentButton
                              shipmentId={shipment.id}
                              shipmentTitle={shipment.title}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </PageShell>
    </div>
  );
}
