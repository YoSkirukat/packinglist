import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { normalizeSupplierName } from "@/lib/packing-list";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id, itemId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const productId = String(body.productId ?? "").trim();
    if (!productId) {
      return NextResponse.json({ error: "Выберите товар" }, { status: 400 });
    }

    const item = await prisma.packingItem.findFirst({
      where: { id: itemId, shipmentId: id },
    });
    if (!item) {
      return NextResponse.json({ error: "Строка поставки не найдена" }, { status: 404 });
    }

    const product = await prisma.catalogProduct.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json({ error: "Товар не найден в справочнике" }, { status: 404 });
    }

    const supplierKey = item.supplierKey || normalizeSupplierName(item.supplierName);

    await prisma.$transaction([
      prisma.productMapping.upsert({
        where: { supplierKey },
        create: {
          supplierKey,
          supplierName: item.supplierName,
          productId: product.id,
        },
        update: {
          supplierName: item.supplierName,
          productId: product.id,
        },
      }),
      prisma.packingItem.updateMany({
        where: {
          OR: [{ supplierKey }, { supplierName: item.supplierName }],
        },
        data: {
          supplierKey,
          productId: product.id,
          mappedName: product.name,
          mappedCode: product.code,
          mappedArticle: product.article,
        },
      }),
    ]);

    await logActivity({
      userId: user.id,
      shipmentId: id,
      action: "product.map",
      message: `${user.login} сопоставил «${item.supplierName}» → ${product.name} (${product.code})`,
    });

    return NextResponse.json({
      ok: true,
      product: {
        id: product.id,
        code: product.code,
        article: product.article,
        name: product.name,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
