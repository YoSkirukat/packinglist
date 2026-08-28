import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { parsePackingList } from "@/lib/packing-list";
import { applyMappingsToItems } from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 120;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "packing-list.xlsx";
}

export async function POST(
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

    const originalName = decodeURIComponent(
      request.headers.get("x-file-name") || "packing-list.xlsx",
    );
    const lower = originalName.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Нужен файл Excel: .xlsx или .xls" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    const items = await applyMappingsToItems(await parsePackingList(buffer));

    const dir = path.join(process.cwd(), "uploads", "shipments", id);
    await mkdir(dir, { recursive: true });
    const storedName = `${Date.now()}-${safeFileName(originalName)}`;
    const storedPath = path.join(dir, storedName);
    await writeFile(storedPath, buffer);

    if (shipment.packingFilePath) {
      try {
        await unlink(path.join(process.cwd(), shipment.packingFilePath));
      } catch {
        // старый файл мог быть уже удалён
      }
    }

    const relativePath = path.posix.join("uploads", "shipments", id, storedName);

    await prisma.$transaction([
      prisma.packingItem.deleteMany({ where: { shipmentId: id } }),
      prisma.packingItem.createMany({
        data: items.map((item) => ({
          shipmentId: id,
          ...item,
        })),
      }),
      prisma.shipment.update({
        where: { id },
        data: {
          status: "uploaded",
          packingFileName: originalName,
          packingFilePath: relativePath,
          packingUploadedAt: new Date(),
        },
      }),
    ]);

    await logActivity({
      userId: user.id,
      shipmentId: id,
      action: "shipment.packing_upload",
      message: `${user.login} загрузил packing list «${originalName}» (${items.length} позиций)`,
    });

    return NextResponse.json({
      ok: true,
      count: items.length,
      fileName: originalName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
