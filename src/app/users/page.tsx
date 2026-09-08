import { notFound } from "next/navigation";
import { AppHeader, PageShell, Panel } from "@/components/ui";
import { UsersManager } from "@/components/UsersManager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      login: true,
      name: true,
      role: true,
      blocked: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <AppHeader active="/users" />
      <PageShell
        title="Пользователи"
        description="Учётные записи доступа к сервису. Только администратор может добавлять, блокировать и удалять пользователей."
      >
        <Panel className="fade-in px-4 py-4">
          <UsersManager users={users} currentUserId={me.id} />
        </Panel>
      </PageShell>
    </div>
  );
}
