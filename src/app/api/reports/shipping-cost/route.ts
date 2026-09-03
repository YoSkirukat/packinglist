import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function productKey(line: {
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
}) {
  if (line.productId) return `id:${line.productId}`;
  const code = line.productCode.trim().toLowerCase();
  if (code) return `code:${code}`;
  const article = line.productArticle.trim().toLowerCase();
  if (article) return `article:${article}`;
  return `name:${line.productName.trim().toLowerCase()}`;
}

function parseDayStart(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseDayEnd(value: string) {
  const d = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseReportInput(body: Record<string, unknown>) {
  const fromWarehouseId = String(body.fromWarehouseId ?? "");
  const toWarehouseId = String(body.toWarehouseId ?? "");
  const dateFrom = String(body.dateFrom ?? "");
  const dateTo = String(body.dateTo ?? "");
  const unitCost = Number(body.unitCost);

  if (!fromWarehouseId || !toWarehouseId) {
    return { error: "Укажите склад-отправитель и склад-получатель" as const };
  }
  if (fromWarehouseId === toWarehouseId) {
    return {
      error: "Склады отправителя и получателя должны отличаться" as const,
    };
  }
  if (!dateFrom || !dateTo) {
    return { error: "Укажите период дат" as const };
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return {
      error: "Укажите корректную стоимость обработки единицы" as const,
    };
  }

  const from = parseDayStart(dateFrom);
  const to = parseDayEnd(dateTo);
  if (!from || !to) {
    return { error: "Некорректный период дат" as const };
  }
  if (from > to) {
    return {
      error: "Дата начала не может быть позже даты окончания" as const,
    };
  }

  return {
    fromWarehouseId,
    toWarehouseId,
    dateFrom,
    dateTo,
    unitCost,
    from,
    to,
  };
}

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = parseReportInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { fromWarehouseId, toWarehouseId, unitCost, from, to } = parsed;

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      fromWarehouseId,
      toWarehouseId,
      createdAt: { gte: from, lte: to },
    },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const productKeys = new Set<string>();
  let totalQty = 0;

  const exportRows: {
    date: string;
    note: string;
    fromWarehouse: string;
    toWarehouse: string;
    productName: string;
    qty: number;
  }[] = [];

  for (const transfer of transfers) {
    for (const line of transfer.lines) {
      productKeys.add(productKey(line));
      totalQty += line.qty;
      exportRows.push({
        date: formatDateTime(transfer.createdAt),
        note: transfer.note || "",
        fromWarehouse: transfer.fromWarehouse.name,
        toWarehouse: transfer.toWarehouse.name,
        productName: line.productName,
        qty: line.qty,
      });
    }
  }

  const totalCost = totalQty * unitCost;

  return NextResponse.json({
    transferCount: transfers.length,
    unitCost,
    productCount: productKeys.size,
    totalQty,
    totalCost,
    exportRows,
  });
}
