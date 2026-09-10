import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getWarehouseStock } from "@/lib/stock-query";
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
  if (!warehouseId) {
    return NextResponse.json({ error: "Укажите склад" }, { status: 400 });
  }

  const products = await getWarehouseStock(warehouseId);
  const photoFiles = await listProductPhotos();

  return NextResponse.json({
    products: products.map((p) => {
      const file = findProductPhoto(photoFiles, p.productCode, p.productArticle);
      return {
        key: p.key,
        productId: p.productId,
        productName: p.productName,
        productCode: p.productCode,
        productArticle: p.productArticle,
        supplierName: p.supplierName,
        availableTotal: p.availableTotal,
        cartonCount: p.cartonCount,
        photoUrl: file ? productPhotoUrl(file) : null,
        cartons: p.cartons.map((c) => ({
          packingItemId: c.packingItemId,
          shipmentId: c.shipmentId,
          cartonNo: c.cartonNo,
          available: c.available,
          shipmentTitle: c.shipmentTitle,
        })),
      };
    }),
  });
}
