import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  ensureAdminUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    await ensureAdminUser();
    const body = await request.json().catch(() => ({}));
    const login = String(body.login ?? "").trim();
    const password = String(body.password ?? "");

    if (!login || !password) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    if (user.blocked) {
      return NextResponse.json({ error: "Пользователь заблокирован" }, { status: 403 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const token = await createSessionToken(user);
    await setSessionCookie(token);
    await logActivity({
      userId: user.id,
      action: "login",
      message: `Вход пользователя ${user.login}`,
    });
    return NextResponse.json({
      ok: true,
      user: { id: user.id, login: user.login, role: user.role },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
