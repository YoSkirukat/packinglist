import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  requireApiUser,
  validatePassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user: actor, error } = await requireApiUser("admin");
  if (error) return error;

  try {
    const { id } = await context.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const data: {
      blocked?: boolean;
      passwordHash?: string;
      role?: string;
    } = {};
    const notes: string[] = [];

    if (typeof body.blocked === "boolean") {
      if (target.id === actor.id && body.blocked) {
        return NextResponse.json(
          { error: "Нельзя заблокировать свою учётную запись" },
          { status: 400 },
        );
      }
      data.blocked = body.blocked;
      notes.push(body.blocked ? "заблокировал" : "разблокировал");
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      const passwordError = validatePassword(body.password);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.password);
      notes.push("сменил пароль");
    }

    if (body.role === "admin" || body.role === "user") {
      if (target.role === "admin" && body.role !== "admin") {
        const admins = await prisma.user.count({
          where: { role: "admin", blocked: false },
        });
        if (admins <= 1) {
          return NextResponse.json(
            { error: "Нельзя снять роль с последнего админа" },
            { status: 400 },
          );
        }
      }
      data.role = body.role;
      notes.push(`изменил роль на ${body.role}`);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        login: true,
        role: true,
        blocked: true,
        createdAt: true,
      },
    });

    if (notes.length > 0) {
      await logActivity({
        userId: actor.id,
        action: "user.update",
        message: `${actor.login} ${notes.join(", ")} пользователя ${user.login}`,
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user: actor, error } = await requireApiUser("admin");
  if (error) return error;

  try {
    const { id } = await context.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    if (target.id === actor.id) {
      return NextResponse.json(
        { error: "Нельзя удалить свою учётную запись" },
        { status: 400 },
      );
    }
    if (target.role === "admin") {
      const admins = await prisma.user.count({
        where: { role: "admin", blocked: false },
      });
      if (admins <= 1) {
        return NextResponse.json(
          { error: "Нельзя удалить последнего админа" },
          { status: 400 },
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    await logActivity({
      userId: actor.id,
      action: "user.delete",
      message: `${actor.login} удалил пользователя ${target.login}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
