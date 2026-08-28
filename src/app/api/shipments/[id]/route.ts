import { rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { id } = await context.params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      items: { orderBy: { lineNo: "asc" } },
      createdBy: { select: { login: true } },
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Поставка не найдена" }, { status: 404 });
  }

  return NextResponse.json({ shipment });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id } = await context.params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json({ error: "Поставка не найдена" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const data: { warehouseId?: string | null } = {};

    if ("warehouseId" in body) {
      const warehouseId =
        body.warehouseId === null || body.warehouseId === ""
          ? null
          : String(body.warehouseId);
      if (warehouseId) {
        const warehouse = await prisma.warehouse.findUnique({
          where: { id: warehouseId },
        });
        if (!warehouse) {
          return NextResponse.json({ error: "Склад не найден" }, { status: 400 });
        }
      }
      data.warehouseId = warehouseId;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
    }

    const updated = await prisma.shipment.update({
      where: { id },
      data,
      include: { warehouse: true },
    });

    if ("warehouseId" in data) {
      await logActivity({
        userId: user.id,
        shipmentId: id,
        action: "shipment.warehouse",
        message: updated.warehouse
          ? `${user.login} назначил склад «${updated.warehouse.name}» для поставки «${updated.title}»`
          : `${user.login} снял склад с поставки «${updated.title}»`,
      });
    }

    return NextResponse.json({ shipment: updated });
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
  const { user, error } = await requireApiUser("admin");
  if (error) return error;

  try {
    const { id } = await context.params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json({ error: "Поставка не найдена" }, { status: 404 });
    }

    await prisma.shipment.delete({ where: { id } });

    const uploadDir = path.join(process.cwd(), "uploads", "shipments", id);
    try {
      await rm(uploadDir, { recursive: true, force: true });
    } catch {
      // каталог мог отсутствовать
    }

    await logActivity({
      userId: user.id,
      action: "shipment.delete",
      message: `${user.login} удалил поставку «${shipment.title}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
