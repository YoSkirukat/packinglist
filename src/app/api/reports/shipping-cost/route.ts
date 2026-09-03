import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findProductPhoto,
  listProductPhotos,
  productPhotoUrl,
} from "@/lib/product-photos";

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

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const fromWarehouseId = String(body.fromWarehouseId ?? "");
  const toWarehouseId = String(body.toWarehouseId ?? "");
  const dateFrom = String(body.dateFrom ?? "");
  const dateTo = String(body.dateTo ?? "");
  const unitCost = Number(body.unitCost);

  if (!fromWarehouseId || !toWarehouseId) {
    return NextResponse.json(
      { error: "Укажите склад-отправитель и склад-получатель" },
      { status: 400 },
    );
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json(
      { error: "Склады отправителя и получателя должны отличаться" },
      { status: 400 },
    );
  }
  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "Укажите период дат" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return NextResponse.json(
      { error: "Укажите корректную стоимость обработки единицы" },
      { status: 400 },
    );
  }

  const from = parseDayStart(dateFrom);
  const to = parseDayEnd(dateTo);
  if (!from || !to) {
    return NextResponse.json({ error: "Некорректный период дат" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json(
      { error: "Дата начала не может быть позже даты окончания" },
      { status: 400 },
    );
  }

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      fromWarehouseId,
      toWarehouseId,
      createdAt: { gte: from, lte: to },
    },
    include: {
      lines: true,
    },
  });

  type Agg = {
    key: string;
    productId: string | null;
    productName: string;
    productCode: string;
    productArticle: string;
    qty: number;
  };

  const map = new Map<string, Agg>();
  for (const transfer of transfers) {
    for (const line of transfer.lines) {
      const key = productKey(line);
      const existing = map.get(key);
      if (existing) {
        existing.qty += line.qty;
      } else {
        map.set(key, {
          key,
          productId: line.productId,
          productName: line.productName,
          productCode: line.productCode,
          productArticle: line.productArticle,
          qty: line.qty,
        });
      }
    }
  }

  const photoFiles = await listProductPhotos();
  const items = [...map.values()]
    .map((item) => {
      const file = findProductPhoto(
        photoFiles,
        item.productCode,
        item.productArticle,
      );
      const cost = item.qty * unitCost;
      return {
        key: item.key,
        productName: item.productName,
        productCode: item.productCode,
        productArticle: item.productArticle,
        qty: item.qty,
        cost,
        photoUrl: file ? productPhotoUrl(file) : null,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  return NextResponse.json({
    transferCount: transfers.length,
    unitCost,
    items,
    totalQty,
    totalCost,
  });
}
