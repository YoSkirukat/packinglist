import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ warehouses });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (name.length < 1) {
      return NextResponse.json({ error: "Укажите название склада" }, { status: 400 });
    }

    const existing = await prisma.warehouse.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ warehouse: existing });
    }

    const warehouse = await prisma.warehouse.create({ data: { name } });
    await logActivity({
      userId: user.id,
      action: "warehouse.create",
      message: `${user.login} создал склад «${warehouse.name}»`,
    });
    return NextResponse.json({ warehouse });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
