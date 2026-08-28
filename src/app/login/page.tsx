import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { ensureAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureAdminUser();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[#1a1a1a]">
            PL
          </span>
          <div>
            <div className="text-base font-semibold">Packing List</div>
            <div className="text-xs text-[var(--muted)]">Вход в сервис поставок</div>
          </div>
        </div>
        <Suspense fallback={<p className="text-sm text-[var(--muted)]">Загрузка…</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Первый вход: логин <span className="font-medium text-[var(--text)]">admin</span>,
          пароль <span className="font-medium text-[var(--text)]">admin</span>
        </p>
      </div>
    </div>
  );
}
