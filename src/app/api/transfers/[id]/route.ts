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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { id } = await context.params;
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: transferInclude,
  });
  if (!transfer) {
    return NextResponse.json({ error: "Перемещение не найдено" }, { status: 404 });
  }
  return NextResponse.json({ transfer });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id } = await context.params;
    const existing = await prisma.stockTransfer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Перемещение не найдено" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const fromWarehouseId = String(body.fromWarehouseId ?? existing.fromWarehouseId);
    const toWarehouseId = String(body.toWarehouseId ?? existing.toWarehouseId);
    const note = String(body.note ?? existing.note).trim();
    const lines = (Array.isArray(body.lines) ? body.lines : []) as TransferLineInput[];

    const slots = await getWarehouseCartonSlots({
      warehouseId: fromWarehouseId,
      excludeTransferId: id,
    });
    const validated = validateTransferLines({
      fromWarehouseId,
      toWarehouseId,
      lines,
      slots,
    });

    const transfer = await prisma.$transaction(async (tx) => {
      await tx.stockTransferAllocation.deleteMany({
        where: { line: { transferId: id } },
      });
      await tx.stockTransferLine.deleteMany({ where: { transferId: id } });

      await tx.stockTransfer.update({
        where: { id },
        data: {
          fromWarehouseId,
          toWarehouseId,
          note,
        },
      });

      for (const line of validated) {
        await tx.stockTransferLine.create({
          data: {
            transferId: id,
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
        where: { id },
        include: transferInclude,
      });
    });

    await logActivity({
      userId: user.id,
      action: "transfer.update",
      message: `${user.login} изменил перемещение ${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`,
    });

    return NextResponse.json({ transfer });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id } = await context.params;
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { fromWarehouse: true, toWarehouse: true },
    });
    if (!transfer) {
      return NextResponse.json({ error: "Перемещение не найдено" }, { status: 404 });
    }

    await prisma.stockTransfer.delete({ where: { id } });

    await logActivity({
      userId: user.id,
      action: "transfer.delete",
      message: `${user.login} удалил перемещение ${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
