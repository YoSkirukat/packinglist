import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getSettings } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const productsFileUrl = String(body.productsFileUrl ?? "").trim();
    if (productsFileUrl && !/^https?:\/\//i.test(productsFileUrl)) {
      return NextResponse.json(
        { error: "Укажите ссылку вида https://..." },
        { status: 400 },
      );
    }

    await getSettings();
    const settings = await prisma.settings.update({
      where: { id: 1 },
      data: { productsFileUrl },
    });

    await logActivity({
      userId: user.id,
      action: "settings.update",
      message: `${user.login} обновил ссылку на файл товаров`,
    });

    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
