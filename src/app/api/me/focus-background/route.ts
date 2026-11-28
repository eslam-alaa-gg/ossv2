import { eq } from "drizzle-orm";
import { db } from "@/db";
import { focusBackgrounds } from "@/db/schema";
import { ApiError, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const MAX = 450 * 1024;

function sniff(buffer: Buffer): string | null {
  if (buffer.length > 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length > 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

// The application session is the only source of identity; clients cannot request another user's file.
export const GET = handle(async () => {
  const auth = await requireUser();
  const [background] = await db.select().from(focusBackgrounds).where(eq(focusBackgrounds.userId, auth.id)).limit(1);
  if (!background) throw new ApiError(404, "No Focus background has been uploaded.");
  return new Response(new Uint8Array(background.data), {
    headers: {
      "Content-Type": background.mime,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX + 64 * 1024) {
    throw new ApiError(413, "Image upload is too large. Please choose an image under 450 KB.");
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose a non-empty image to upload.");
  if (file.size > MAX) throw new ApiError(413, "Image is too large. Please choose an image under 450 KB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buffer);
  if (!mime) throw new ApiError(400, "Only valid JPG, PNG or WebP images are supported.");
  await db.insert(focusBackgrounds).values({ userId: auth.id, mime, data: buffer }).onConflictDoUpdate({
    target: focusBackgrounds.userId,
    set: { mime, data: buffer, updatedAt: new Date() },
  });
  return { saved: true, updatedAt: new Date().toISOString() };
});

export const DELETE = handle(async () => {
  const auth = await requireUser();
  await db.delete(focusBackgrounds).where(eq(focusBackgrounds.userId, auth.id));
  return { deleted: true };
});
