import Link from "next/link";
import { AppHeader, EmptyState, PageShell, Panel } from "@/components/ui";
import { DeleteTransferButton } from "@/components/DeleteTransferButton";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const transfers = await prisma.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      createdBy: { select: { login: true } },
      lines: { select: { qty: true } },
    },
  });

  return (
    <div>
      <AppHeader active="/transfers" />
      <PageShell
        title="Перемещение товаров"
        description="Учёт перемещений со склада хранения на склады-получатели"
        actions={
          <Link
            href="/transfers/new"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95"
          >
            Создать перемещение
          </Link>
        }
      >
        <Panel className="fade-in">
          {transfers.length === 0 ? (
            <EmptyState
              title="Перемещений ещё нет"
              description="Создайте перемещение: укажите склады и добавьте товары с выбором коробок."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Откуда</th>
                    <th>Куда</th>
                    <th>Позиций</th>
                    <th>Шт</th>
                    <th>Кто создал</th>
                    <th>Комментарий</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => {
                    const totalQty = transfer.lines.reduce((sum, l) => sum + l.qty, 0);
                    const label = `${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`;
                    return (
                      <tr key={transfer.id}>
                        <td>{formatDateTime(transfer.createdAt)}</td>
                        <td>{transfer.fromWarehouse.name}</td>
                        <td>{transfer.toWarehouse.name}</td>
                        <td>{formatNumber(transfer.lines.length)}</td>
                        <td>{formatNumber(totalQty)}</td>
                        <td>{transfer.createdBy.login}</td>
                        <td className="text-[var(--muted)]">
                          {transfer.note || "—"}
                        </td>
                        <td>
                          <div className="flex flex-wrap justify-end gap-2">
                            <DeleteTransferButton
                              transferId={transfer.id}
                              label={label}
                            />
                          </div>
                        </td>
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
