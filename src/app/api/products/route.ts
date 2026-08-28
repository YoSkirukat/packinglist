import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") || 40) || 40, 80);

  const products = await prisma.catalogProduct.findMany({
    where: q
      ? {
          searchText: { contains: q },
        }
      : undefined,
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      code: true,
      article: true,
      name: true,
    },
  });

  const total = await prisma.catalogProduct.count();
  return NextResponse.json({ products, total });
}
