import fs from "node:fs/promises";
import path from "node:path";

const PHOTO_DIR = path.join(process.cwd(), "picture");
const PHOTO_EXTS = new Set([".png", ".jpg", ".jpeg"]);

export function productPhotosDir() {
  return PHOTO_DIR;
}

export async function listProductPhotos() {
  try {
    const files = await fs.readdir(PHOTO_DIR);
    return files.filter((file) => {
      if (file.includes(":")) return false;
      return PHOTO_EXTS.has(path.extname(file).toLowerCase());
    });
  } catch {
    return [];
  }
}

export function findProductPhoto(
  files: string[],
  code?: string | null,
  article?: string | null,
) {
  const keys = [code, article]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  if (keys.length === 0) return null;

  const stems = files.map((file) => ({
    file,
    stem: path.parse(file).name.toLowerCase(),
  }));

  for (const key of keys) {
    const needle = key.toLowerCase();
    const exact = stems.find((item) => item.stem === needle);
    if (exact) return exact.file;
  }

  for (const key of [...keys].sort((a, b) => b.length - a.length)) {
    if (key.length < 3) continue;
    const needle = key.toLowerCase();
    const found = stems.find((item) => item.stem.includes(needle));
    if (found) return found.file;
  }

  return null;
}

export function productPhotoUrl(file: string) {
  return `/api/picture?name=${encodeURIComponent(file)}`;
}

export function resolvePhotoPath(name: string) {
  const file = path.basename(name);
  if (!PHOTO_EXTS.has(path.extname(file).toLowerCase())) return null;
  if (file.includes(":") || file.includes("..")) return null;
  const abs = path.resolve(PHOTO_DIR, file);
  if (!abs.startsWith(PHOTO_DIR + path.sep)) return null;
  return abs;
}
