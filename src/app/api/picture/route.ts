import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { resolvePhotoPath } from "@/lib/product-photos";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const name = new URL(request.url).searchParams.get("name") || "";
  const abs = resolvePhotoPath(name);
  if (!abs) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  try {
    const info = await stat(abs);
    if (!info.isFile()) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }
    const ext = path.extname(abs).toLowerCase();
    const data = await readFile(abs);
    return new NextResponse(data, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(info.size),
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
}
