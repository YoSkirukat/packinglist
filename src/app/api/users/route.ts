import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  requireApiUser,
  validateLogin,
  validatePassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireApiUser("admin");
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      login: true,
      role: true,
      blocked: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { user: actor, error } = await requireApiUser("admin");
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const login = String(body.login ?? "").trim();
    const password = String(body.password ?? "");
    const role = body.role === "admin" ? "admin" : "user";

    const loginError = validateLogin(login);
    if (loginError) {
      return NextResponse.json({ error: loginError }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { login } });
    if (exists) {
      return NextResponse.json({ error: "Такой логин уже есть" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        login,
        passwordHash: await hashPassword(password),
        role,
        blocked: false,
      },
      select: {
        id: true,
        login: true,
        role: true,
        blocked: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: actor.id,
      action: "user.create",
      message: `${actor.login} создал пользователя ${user.login} (${user.role})`,
    });

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
