import { eq } from "drizzle-orm";
import { db } from "@/db";
import { avatars, users } from "@/db/schema";
import { ApiError, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const MAX = 600 * 1024;

function sniff(b: Buffer): string | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

// Only ever returns the *signed-in user's own* avatar; no id is accepted from the client.
export const GET = handle(async () => {
  const a = await requireUser();
  const [r] = await db.select().from(avatars).where(eq(avatars.userId, a.id)).limit(1);
  if (!r) throw new ApiError(404, "No avatar.");
  return new Response(new Uint8Array(r.data), {
    headers: { "Content-Type": r.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose an image to upload.");
  if (file.size > MAX) throw new ApiError(413, "Image is too large (max 600 KB after optimisation).");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new ApiError(400, "Only JPG, PNG or WebP images are supported.");
  await db.insert(avatars).values({ userId: a.id, mime, data: buf }).onConflictDoUpdate({ target: avatars.userId, set: { mime, data: buf, updatedAt: new Date() } });
  const version = (a.user.avatarVersion ?? 0) + 1;
  await db.update(users).set({ avatarVersion: version, updatedAt: new Date() }).where(eq(users.id, a.id));
  return { avatarVersion: version };
});

export const DELETE = handle(async () => {
  const a = await requireUser();
  await db.delete(avatars).where(eq(avatars.userId, a.id));
  await db.update(users).set({ avatarVersion: null, updatedAt: new Date() }).where(eq(users.id, a.id));
  return { avatarVersion: null };
});
