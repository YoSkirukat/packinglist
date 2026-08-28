import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { validateTransferLines, type TransferLineInput } from "@/lib/stock";
import { getWarehouseCartonSlots } from "@/lib/stock-query";

const transferInclude = {
  fromWarehouse: true,
  toWarehouse: true,
  createdBy: { select: { login: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      allocations: {
        orderBy: [{ cartonNo: "asc" as const }],
      },
    },
  },
};

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const transfers = await prisma.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      createdBy: { select: { login: true } },
      lines: { select: { qty: true } },
    },
  });

  return NextResponse.json({
    transfers: transfers.map((t) => ({
      ...t,
      lineCount: t.lines.length,
      totalQty: t.lines.reduce((sum, l) => sum + l.qty, 0),
    })),
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const fromWarehouseId = String(body.fromWarehouseId ?? "");
    const toWarehouseId = String(body.toWarehouseId ?? "");
    const note = String(body.note ?? "").trim();
    const lines = (Array.isArray(body.lines) ? body.lines : []) as TransferLineInput[];

    const slots = await getWarehouseCartonSlots({ warehouseId: fromWarehouseId });
    const validated = validateTransferLines({
      fromWarehouseId,
      toWarehouseId,
      lines,
      slots,
    });

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          fromWarehouseId,
          toWarehouseId,
          note,
          createdById: user.id,
        },
      });

      for (const line of validated) {
        await tx.stockTransferLine.create({
          data: {
            transferId: created.id,
            productId: line.productId,
            productName: line.productName,
            productCode: line.productCode,
            productArticle: line.productArticle,
            qty: line.qty,
            sortOrder: line.sortOrder,
            allocations: {
              create: line.allocations.map((a) => ({
                packingItemId: a.packingItemId,
                shipmentId: a.shipmentId,
                cartonNo: a.cartonNo,
                qty: a.qty,
              })),
            },
          },
        });
      }

      return tx.stockTransfer.findUniqueOrThrow({
        where: { id: created.id },
        include: transferInclude,
      });
    });

    await logActivity({
      userId: user.id,
      action: "transfer.create",
      message: `${user.login} создал перемещение ${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`,
    });

    return NextResponse.json({ transfer });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
