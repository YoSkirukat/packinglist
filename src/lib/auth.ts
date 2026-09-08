import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth-session";

export type SessionUser = {
  id: string;
  login: string;
  name: string;
  role: "admin" | "user";
  blocked: boolean;
};

export { createSessionToken, verifySessionToken, SESSION_COOKIE };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || user.blocked) return null;
    return {
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role === "admin" ? "admin" : "user",
      blocked: user.blocked,
    };
  } catch {
    return null;
  }
}

export async function requireApiUser(
  role?: "admin",
): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Нужна авторизация" }, { status: 401 }),
    };
  }
  if (role === "admin" && user.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

export async function ensureAdminUser() {
  try {
    const count = await prisma.user.count();
    if (count > 0) return;
    const password = process.env.ADMIN_PASSWORD?.trim() || "admin";
    await prisma.user.create({
      data: {
        login: "admin",
        passwordHash: await hashPassword(password),
        role: "admin",
        blocked: false,
      },
    });
  } catch {
    // таблица User ещё не создана — prisma db push на старте
  }
}

export function validateLogin(login: string) {
  const value = login.trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(value)) {
    return "Логин: 3–32 символа, латиница, цифры, точка, _ или -";
  }
  return null;
}

export function validateName(name: string) {
  if (name.trim().length > 64) {
    return "Имя не длиннее 64 символов";
  }
  return null;
}

export function validatePassword(password: string) {
  if (password.length < 6) return "Пароль не короче 6 символов";
  return null;
}
