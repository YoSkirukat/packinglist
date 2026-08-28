import Link from "next/link";
import { AppHeader, PageShell, Panel, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { summarizeItems } from "@/lib/packing-list";
import {
  formatDateTime,
  formatNumber,
  shipmentStatusLabel,
  shipmentStatusTone,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [shipments, users, logs, itemAgg] = await Promise.all([
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
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
    prisma.user.count(),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { login: true } } },
    }),
    prisma.packingItem.aggregate({
      _sum: {
        totalCartons: true,
        totalPcs: true,
        totalGrossWeight: true,
        totalCbm: true,
      },
      _count: true,
    }),
  ]);

  const totals = {
    shipments: await prisma.shipment.count(),
    cartons: itemAgg._sum.totalCartons ?? 0,
    kg: itemAgg._sum.totalGrossWeight ?? 0,
    cbm: itemAgg._sum.totalCbm ?? 0,
  };

  return (
    <div>
      <AppHeader active="/" />
      <PageShell
        title="Обзор"
        description="Учёт поставок из Китая: packing list, коробки и движения товара на складе партнёра"
        actions={
          <Link
            href="/shipments/new"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95"
          >
            Создать поставку
          </Link>
        }
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 fade-in">
          {[
            { label: "Поставки", value: formatNumber(totals.shipments), href: "/shipments" },
            { label: "Коробок", value: formatNumber(totals.cartons), href: "/shipments" },
            { label: "Вес, кг", value: formatNumber(totals.kg, 1), href: "/shipments" },
            { label: "Объём, м³", value: formatNumber(totals.cbm, 3), href: "/shipments" },
          ].map((card) => (
            <Link key={card.label} href={card.href}>
              <Panel className="px-4 py-4 transition hover:border-[#d5d9e0]">
                <div className="text-xs text-[var(--muted)]">{card.label}</div>
                <div className="mt-1 text-2xl font-semibold">{card.value}</div>
              </Panel>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel className="fade-in">
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
              Последние поставки
            </div>
            {shipments.length === 0 ? (
              <div className="px-4 py-10 text-sm text-[var(--muted)]">
                Поставок пока нет. Создайте первую и загрузите packing list.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Поставка</th>
                      <th>Статус</th>
                      <th>Коробок</th>
                      <th>Дата</th>
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
                              {shipment.supplier} · {shipment.createdBy.login}
                            </div>
                          </td>
                          <td>
                            <StatusBadge tone={shipmentStatusTone(shipment.status)}>
                              {shipmentStatusLabel(shipment.status)}
                            </StatusBadge>
                          </td>
                          <td>{formatNumber(sum.cartons)}</td>
                          <td>{formatDateTime(shipment.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel className="fade-in px-4 py-4">
            <div className="text-sm font-medium">Быстрый старт</div>
            <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>1. Создайте поставку</li>
              <li>2. Загрузите packing list из Excel</li>
              <li>3. Проверьте таблицу коробок и товаров</li>
              <li>4. В настройках загрузите файл товаров</li>
              <li>5. Сопоставьте китайские названия со своими</li>
            </ol>
            <div className="mt-5 text-sm font-medium">Последние действия</div>
            {logs.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Действий пока нет</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {logs.map((log) => (
                  <li key={log.id} className="text-sm">
                    <div className="text-[var(--text)]">{log.message}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatDateTime(log.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-xs text-[var(--muted)]">
              Пользователей в сервисе: {users}
            </div>
          </Panel>
        </div>
      </PageShell>
    </div>
  );
}
