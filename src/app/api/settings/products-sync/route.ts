import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  getSettings,
  parseCatalogExcel,
  productSearchText,
} from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

async function fetchCatalogFile(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept: "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      "User-Agent": "PackingList/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Не удалось скачать файл: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("Файл по ссылке пустой");
  if (buffer.length > 40 * 1024 * 1024) {
    throw new Error("Файл с товарами больше 40 МБ");
  }
  return buffer;
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const productsFileUrl = String(body.productsFileUrl ?? "").trim();
    if (!productsFileUrl || !/^https?:\/\//i.test(productsFileUrl)) {
      return NextResponse.json(
        { error: "Сначала укажите ссылку на Excel-файл с товарами" },
        { status: 400 },
      );
    }

    const buffer = await fetchCatalogFile(productsFileUrl);
    const parsed = parseCatalogExcel(buffer);

    await getSettings();

    let created = 0;
    let updated = 0;
    const chunkSize = 50;
    for (let i = 0; i < parsed.length; i += chunkSize) {
      const chunk = parsed.slice(i, i + chunkSize);
      const existing = await prisma.catalogProduct.findMany({
        where: { code: { in: chunk.map((p) => p.code) } },
        select: { code: true },
      });
      const existingCodes = new Set(existing.map((row) => row.code));
      await prisma.$transaction(
        chunk.map((product) => {
          const searchText = productSearchText(product.code, product.article, product.name);
          const isNew = !existingCodes.has(product.code);
          if (isNew) created += 1;
          else updated += 1;
          return prisma.catalogProduct.upsert({
            where: { code: product.code },
            create: {
              code: product.code,
              article: product.article,
              name: product.name,
              searchText,
            },
            update: {
              article: product.article,
              name: product.name,
              searchText,
            },
          });
        }),
      );
    }

    const productsCount = await prisma.catalogProduct.count();
    const settings = await prisma.settings.update({
      where: { id: 1 },
      data: {
        productsFileUrl,
        lastProductsSync: new Date(),
        productsCount,
      },
    });

    await logActivity({
      userId: user.id,
      action: "catalog.sync",
      message: `${user.login} загрузил справочник товаров: ${parsed.length} позиций (${created} новых, ${updated} обновлённых)`,
    });

    return NextResponse.json({
      ok: true,
      count: parsed.length,
      created,
      updated,
      settings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
