import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "farmer_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

function getPassword(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(): string {
  const secret = getPassword();
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_PASSWORD must be at least 16 characters long.");
  }

  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");

  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminSessionToken(token?: string | null): boolean {
  const secret = getPassword();
  if (!secret || secret.length < 16 || !token) return false;

  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;

  const expected = signature(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number; nonce?: string };
    return typeof decoded.exp === "number"
      && decoded.exp > Math.floor(Date.now() / 1000)
      && typeof decoded.nonce === "string"
      && decoded.nonce.length >= 16;
  } catch {
    return false;
  }
}

export async function isAdminPageRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value);
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
