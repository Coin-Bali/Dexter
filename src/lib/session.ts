import crypto from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  getCookieValue,
  hashToken,
} from "@/lib/auth";

export async function createUserSession(options: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.userSession.create({
    data: {
      userId: options.userId,
      sessionTokenHash,
      userAgent: options.userAgent ?? null,
      ipAddress: options.ipAddress ?? null,
      expiresAt,
    },
  });

  return { sessionToken, expiresAt };
}

export function setSessionCookie(response: NextResponse, sessionToken: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

export async function getSessionFromRequest(request: Request | NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return null;
  }

  const sessionTokenHash = hashToken(sessionToken);
  const session = await prisma.userSession.findUnique({
    where: { sessionTokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { sessionTokenHash } }).catch(() => {});
    return null;
  }

  await prisma.userSession
    .update({
      where: { sessionTokenHash },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return session;
}

export async function requireAuthenticatedUser(request: Request | NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  return {
    session,
    user: session.user,
  };
}

export async function deleteSessionFromRequest(request: Request | NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return;
  }

  const sessionTokenHash = hashToken(sessionToken);
  await prisma.userSession.delete({ where: { sessionTokenHash } }).catch(() => {});
}
