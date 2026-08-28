import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { applyMappingsToItems } from "@/lib/catalog";
import { normalizeSupplierName, splitSupplierProducts } from "@/lib/packing-list";

async function getItem(shipmentId: string, itemId: string) {
  return prisma.packingItem.findFirst({
    where: { id: itemId, shipmentId },
  });
}

async function renumberItems(shipmentId: string) {
  const items = await prisma.packingItem.findMany({
    where: { shipmentId },
    orderBy: { lineNo: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    items.map((item, index) =>
      prisma.packingItem.update({
        where: { id: item.id },
        data: { lineNo: index + 1 },
      }),
    ),
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id, itemId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const rawName = String(body.supplierName ?? "").replace(/\s+/g, " ").trim();
    if (!rawName) {
      return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
    }

    const item = await getItem(id, itemId);
    if (!item) {
      return NextResponse.json({ error: "Строка поставки не найдена" }, { status: 404 });
    }

    const parts = splitSupplierProducts(rawName);
    const part = parts.length === 1 ? parts[0]! : null;
    const supplierName = part?.name ?? rawName;
    const supplierKey = normalizeSupplierName(supplierName);
    const pcsPerCarton =
      part?.qty != null ? part.qty : item.pcsPerCarton;
    const totalPcs =
      pcsPerCarton != null && item.totalCartons != null
        ? pcsPerCarton * item.totalCartons
        : pcsPerCarton ?? item.totalPcs;

    const base = {
      supplierName,
      supplierKey,
      nameLocked: true,
      pcsPerCarton,
      totalPcs,
      mappedName: "",
      mappedCode: "",
      mappedArticle: "",
      productId: null as string | null,
    };

    await prisma.packingItem.update({
      where: { id: itemId },
      data: base,
    });

    const [mapped] = await applyMappingsToItems([
      {
        supplierName,
        supplierKey,
        pcsPerCarton,
      },
    ]);

    if (mapped?.mappedName) {
      await prisma.packingItem.update({
        where: { id: itemId },
        data: {
          mappedName: mapped.mappedName,
          mappedCode: mapped.mappedCode,
          mappedArticle: mapped.mappedArticle,
          productId: mapped.productId,
        },
      });
    }

    await logActivity({
      userId: user.id,
      shipmentId: id,
      action: "packing_item.rename",
      message: `${user.login} изменил китайское название: «${item.supplierName}» → «${supplierName}»`,
    });

    return NextResponse.json({ ok: true, supplierName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id, itemId } = await context.params;
    const item = await getItem(id, itemId);
    if (!item) {
      return NextResponse.json({ error: "Строка поставки не найдена" }, { status: 404 });
    }

    await prisma.packingItem.delete({ where: { id: itemId } });
    await renumberItems(id);

    await logActivity({
      userId: user.id,
      shipmentId: id,
      action: "packing_item.delete",
      message: `${user.login} удалил строку «${item.supplierName}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
