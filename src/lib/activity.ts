import { prisma } from "@/lib/prisma";

export async function logActivity(input: {
  userId?: string | null;
  shipmentId?: string | null;
  action: string;
  message: string;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      shipmentId: input.shipmentId ?? null,
      action: input.action,
      message: input.message,
    },
  });
}
