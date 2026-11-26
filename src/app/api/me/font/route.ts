import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customFonts } from "@/db/schema";
import { ApiError, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const MAX = 2 * 1024 * 1024;

function sniff(buffer: Buffer): string | null {
  if (buffer.length > 4 && buffer.subarray(0, 4).toString() === "wOF2") return "font/woff2";
  if (buffer.length > 4 && buffer.subarray(0, 4).toString() === "wOFF") return "font/woff";
  if (buffer.length > 4 && buffer.subarray(0, 4).toString() === "OTTO") return "font/otf";
  if (buffer.length > 4 && buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) return "font/ttf";
  if (buffer.length > 4 && buffer.subarray(0, 4).toString() === "true") return "font/ttf";
  return null;
}

export const GET = handle(async (request) => {
  const auth = await requireUser();
  const [font] = await db.select().from(customFonts).where(eq(customFonts.userId, auth.id)).limit(1);
  if (!font) throw new ApiError(404, "No custom font uploaded.");
  if (new URL(request.url).searchParams.get("meta") === "1") {
    return { name: font.name, mime: font.mime, updatedAt: font.updatedAt.toISOString() };
  }
  return new Response(new Uint8Array(font.data), {
    headers: {
      "Content-Type": font.mime,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a font file to upload.");
  if (file.size > MAX) throw new ApiError(413, "Font files must be 2 MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buffer);
  if (!mime) throw new ApiError(400, "Only valid WOFF2, WOFF, TTF or OTF fonts are supported.");
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) || "Custom font";
  await db.insert(customFonts).values({ userId: auth.id, name, mime, data: buffer }).onConflictDoUpdate({
    target: customFonts.userId,
    set: { name, mime, data: buffer, updatedAt: new Date() },
  });
  return { name, mime };
});

export const DELETE = handle(async () => {
  const auth = await requireUser();
  await db.delete(customFonts).where(eq(customFonts.userId, auth.id));
  return { deleted: true };
});
