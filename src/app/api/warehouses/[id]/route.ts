import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id } = await context.params;
    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      return NextResponse.json({ error: "Склад не найден" }, { status: 404 });
    }

    const [shipments, transfersFrom, transfersTo] = await Promise.all([
      prisma.shipment.count({ where: { warehouseId: id } }),
      prisma.stockTransfer.count({ where: { fromWarehouseId: id } }),
      prisma.stockTransfer.count({ where: { toWarehouseId: id } }),
    ]);

    if (shipments > 0 || transfersFrom > 0 || transfersTo > 0) {
      return NextResponse.json(
        {
          error:
            "Нельзя удалить склад: он используется в поставках или перемещениях",
        },
        { status: 400 },
      );
    }

    await prisma.warehouse.delete({ where: { id } });
    await logActivity({
      userId: user.id,
      action: "warehouse.delete",
      message: `${user.login} удалил склад «${warehouse.name}»`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
