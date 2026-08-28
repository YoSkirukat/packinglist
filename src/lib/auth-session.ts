export const SESSION_COOKIE = "pl_session";
export const SESSION_DAYS = 7;

export type SessionPayload = {
  id: string;
  login: string;
  role: "admin" | "user";
};

function getAuthSecretBytes() {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    "packing-list-china-supply-auth";
  return new TextEncoder().encode(raw);
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    getAuthSecretBytes(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(user: {
  id: string;
  login: string;
  role: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        login: user.login,
        role: user.role,
        sub: user.id,
        iat: now,
        exp: now + SESSION_DAYS * 24 * 60 * 60,
      }),
    ),
  );
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(data),
  );
  return `${data}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature!),
      new TextEncoder().encode(data),
    );
    if (!ok) return null;

    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(payload!))) as {
      sub?: string;
      login?: string;
      role?: string;
      exp?: number;
    };
    if (!json.sub) return null;
    if (typeof json.exp === "number" && json.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: json.sub,
      login: json.login ?? "",
      role: json.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}
