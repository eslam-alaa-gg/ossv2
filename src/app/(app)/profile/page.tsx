"use client";
import { Calendar, Camera, Globe, Mail, Palette, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Field, Modal, PageHeader, Progress, useUI } from "@/components/ui";
import { fmtLong } from "@/lib/dates";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Center-crop + downscale to 512px WebP (JPEG fallback) in the browser before upload. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const size = Math.min(512, Math.min(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const s = Math.min(bmp.width, bmp.height);
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.86));
  if (blob && blob.type === "image/webp") return blob;
  const j = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
  if (!j) throw new Error("Couldn't process the image.");
  return j;
}

export default function ProfilePage() {
  const { user, patchUser, setAvatarVersion, lang, refresh, t } = useApp();
  const { run, toast, confirm } = useUI();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pic, setPic] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setName(user?.displayName ?? ""); }, [user, editing]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  if (!user) return null;

  const trimmed = name.replace(/\s+/g, " ").trim();
  const validate = (v: string) => (v.length < 2 ? t("Name must be at least 2 characters.") : v.length > 40 ? t("Name must be 40 characters or fewer.") : null);

  async function saveName() {
    const e = validate(trimmed);
    setNameErr(e);
    if (e) return;
    setSaving(true);
    const ok = await run(() => patchUser({ displayName: trimmed }), t("Name updated"));
    setSaving(false);
    if (ok !== undefined || trimmed === user!.displayName) { setEditing(false); router.refresh(); }
  }

  async function pick(f?: File) {
    setFileErr(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setFileErr(t("Please choose a JPG, PNG or WebP image."));
    if (f.size > 10 * 1024 * 1024) return setFileErr(t("That image is over 10 MB. Choose a smaller one."));
    try {
      const b = await compress(f);
      if (b.size > 600 * 1024) return setFileErr("الصورة بعد الضغط لازم تكون أقل من 600 كيلوبايت. جرّب صورة تانية.");
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch {
      setFileErr(t("We couldn't read that image. It may be corrupted."));
    }
  }

  function upload() {
    if (!blob) return;
    setProg(0);
    const fd = new FormData();
    fd.append("file", blob, "avatar." + (blob.type === "image/webp" ? "webp" : "jpg"));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/avatar");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProg(Math.round((e.loaded / e.total) * 90));
    xhr.onerror = () => { setProg(null); toast("error", t("Upload failed — check your connection.")); };
    xhr.onload = () => {
      setProg(null);
      let d: { avatarVersion?: number; error?: string } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.avatarVersion) {
        setAvatarVersion(d.avatarVersion); // only after the server confirmed the save
        toast("success", t("Profile picture updated"));
        closePic(); router.refresh();
      } else toast("error", d.error ?? t("Upload failed."));
    };
    xhr.send(fd);
  }
  function closePic() { setPic(false); setBlob(null); setPreview(null); setFileErr(null); }
  async function remove() {
    if (!(await confirm(t("Remove your profile picture?"), t("Remove")))) return;
    const r = await run(() => fetch("/api/me/avatar", { method: "DELETE" }).then((x) => { if (!x.ok) throw new Error(t("Couldn't remove the picture.")); return x.json(); }), t("Picture removed"));
    if (r) { setAvatarVersion(null); closePic(); router.refresh(); }
  }

  const first = trimmed || user.displayName;
  return (
    <>
      <PageHeader title={t("Profile")} subtitle={t("How you appear across LIFE OS.")} />
      <div className="grid gap-[var(--gap)] lg:grid-cols-[360px_1fr]">
        <Card className="flex flex-col items-center py-8 text-center">
          <button onClick={() => setPic(true)} className="group relative rounded-full" aria-label={t("Change profile picture")}>
            <Avatar size={132} ring />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera className="size-7 text-white" /></span>
          </button>
          {editing ? (
            <div className="mt-5 w-full space-y-3 text-start">
              <Field label={t("Display name")} error={nameErr} hint={`${trimmed.length}/40`}><input className="input" value={name} onChange={(e) => { setName(e.target.value); setNameErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }} maxLength={60} autoFocus aria-label={t("Display name")} /></Field>
              <p className="text-xs text-muted">{t("Preview:")} <b className="text-fg">{first}</b>{t(" — only your display name changes; your email and sign-in stay the same.")}</p>
              <div className="flex gap-2"><Button className="flex-1" onClick={() => { setEditing(false); setNameErr(null); }}>{t("Cancel")}</Button><Button variant="primary" className="flex-1" loading={saving} onClick={saveName}>{t("Save")}</Button></div>
            </div>
          ) : (
            <>
              <h2 className="mt-5 text-2xl font-semibold">{user.displayName}</h2>
              <p className="text-sm text-muted">{user.isDemo ? t("Demo account") : user.email}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => setEditing(true)}><Pencil className="size-4" /> {t("Edit Profile")}</Button><Button onClick={() => setPic(true)}><Camera className="size-4" /> {t("Change Picture")}</Button></div>
            </>
          )}
        </Card>
        <div className="space-y-[var(--gap)]">
          <Card>
            <h2 className="mb-4 text-sm font-medium text-muted">{t("Account")}</h2>
            <dl className="divide-y divide-[var(--border)] text-sm">
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted"><Pencil className="size-4" /> {t("Display name")}</dt><dd className="flex items-center gap-2">{user.displayName}<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t("Change Name")}</Button></dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted"><Mail className="size-4" /> {t("Email")}</dt><dd className="flex items-center gap-2 truncate">{user.isDemo ? "—" : user.email}{!user.isDemo && <Badge tone={user.emailVerified ? "green" : "amber"}>{t(user.emailVerified ? "Verified" : "Unverified")}</Badge>}<Badge>{t("read-only")}</Badge></dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted"><Calendar className="size-4" /> {t("Member since")}</dt><dd>{fmtLong(user.createdAt.slice(0, 10), lang)}</dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted"><Globe className="size-4" /> {t("Timezone")}</dt><dd>{user.timezone}</dd></div>
            </dl>
          </Card>
          <PrefsCard />
        </div>
      </div>

      <Modal open={pic} onClose={closePic} title={t("Profile picture")} footer={<><Button onClick={closePic} disabled={prog !== null}>{t("Cancel")}</Button><Button variant="primary" disabled={!blob || prog !== null} loading={prog !== null} onClick={upload}><Upload className="size-4" /> {t("Save picture")}</Button></>}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative"><Avatar size={160} ring previewUrl={preview} />{prog !== null && <div className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-sm font-medium text-white">{prog}%</div>}</div>
          {prog !== null && <Progress value={prog} className="w-full" />}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} aria-label={t("Choose image")} />
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => input.current?.click()} disabled={prog !== null}><Camera className="size-4" /> {preview ? t("Choose another") : user.avatarVersion ? t("Replace picture") : t("Choose picture")}</Button>{user.avatarVersion && !preview && <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> {t("Remove")}</Button>}</div>
          {fileErr && <p role="alert" className="text-sm text-red-400">{fileErr}</p>}
          <p className="text-center text-xs text-faint">{t("JPG, PNG or WebP. Maximum size after optimisation: 600 KB. Images are cropped to a square and optimised in your browser before upload.")}</p>
        </div>
      </Modal>
      <span className="hidden">{String(!!refresh)}</span>
    </>
  );
}

function PrefsCard() {
  const { user, patchUser, theme, t } = useApp();
  const { run } = useUI();
  const router = useRouter();
  if (!user) return null;
  const tzs = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium text-muted">{t("Account preferences")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Language")}><select className="input" value={user.language} onChange={async (e) => { await run(() => patchUser({ language: e.target.value as "en" | "ar" }), t("Language updated")); router.refresh(); }} aria-label={t("Language")}><option value="en">{t("English")} ({t("left to right")})</option><option value="ar">{t("Arabic")} ({t("right to left")})</option></select></Field>
        <Field label={t("Timezone")}><select className="input" value={user.timezone} onChange={(e) => run(() => patchUser({ timezone: e.target.value }), t("Timezone updated"))} aria-label={t("Timezone")}>{(tzs.includes(user.timezone) ? tzs : [user.timezone, ...tzs]).map((z) => <option key={z}>{z}</option>)}</select></Field>
        <Field label={t("Daily productivity goal (points)")}><input className="input" type="number" min={1} max={30} defaultValue={user.dailyGoal} onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 30 && v !== user.dailyGoal) run(() => patchUser({ dailyGoal: v }), t("Daily goal updated")); }} aria-label={t("Daily goal")} /></Field>
        <Field label={t("Appearance")}><Link href="/themes" className="glass-btn w-full justify-between"><span className="flex items-center gap-2"><Palette className="size-4 text-accent" /> {t("Theme Studio")}</span><span className="text-xs capitalize text-muted">{t(theme.mode)}</span></Link></Field>
      </div>
      <p className="mt-4 text-xs text-faint">{t("Notification channels, quiet hours and data export live in")} <Link href="/settings" className="text-accent">{t("Settings")}</Link>.</p>
    </Card>
  );
}
