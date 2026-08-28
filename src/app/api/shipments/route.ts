import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { login: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ shipments });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const supplier = String(body.supplier ?? "Китай").trim() || "Китай";
    const note = String(body.note ?? "").trim();
    const warehouseId =
      body.warehouseId === null || body.warehouseId === "" || body.warehouseId == null
        ? null
        : String(body.warehouseId);

    if (title.length < 2) {
      return NextResponse.json(
        { error: "Укажите название поставки" },
        { status: 400 },
      );
    }

    if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse) {
        return NextResponse.json({ error: "Склад не найден" }, { status: 400 });
      }
    }

    const shipment = await prisma.shipment.create({
      data: {
        title,
        supplier,
        note,
        warehouseId,
        createdById: user.id,
      },
    });

    await logActivity({
      userId: user.id,
      shipmentId: shipment.id,
      action: "shipment.create",
      message: `${user.login} создал поставку «${shipment.title}»`,
    });

    return NextResponse.json({ shipment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
