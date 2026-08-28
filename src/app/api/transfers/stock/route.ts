import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getWarehouseCartonSlots, groupSlotsToProducts } from "@/lib/stock-query";
import {
  findProductPhoto,
  listProductPhotos,
  productPhotoUrl,
} from "@/lib/product-photos";

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const warehouseId = String(searchParams.get("warehouseId") ?? "");
  const q = String(searchParams.get("q") ?? "");
  const excludeTransferId = searchParams.get("excludeTransferId");
  const limit = Math.min(Number(searchParams.get("limit") || 40), 80);

  if (!warehouseId) {
    return NextResponse.json({ error: "Укажите склад" }, { status: 400 });
  }

  const slots = await getWarehouseCartonSlots({
    warehouseId,
    excludeTransferId,
  });
  const products = groupSlotsToProducts(slots, q, Number.isFinite(limit) ? limit : 40);
  const photoFiles = await listProductPhotos();

  return NextResponse.json({
    products: products.map((p) => {
      const file = findProductPhoto(photoFiles, p.productCode, p.productArticle);
      return {
        ...p,
        photoUrl: file ? productPhotoUrl(file) : null,
      };
    }),
  });
}
