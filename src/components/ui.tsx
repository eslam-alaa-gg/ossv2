"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, CheckCircle2, Info, Loader2, X } from "lucide-react";
import Link from "next/link";
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ApiErr } from "@/lib/client";
import { translate, type Lang } from "@/lib/i18n";

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ------------------------------ buttons ------------------------------ */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "glass" | "ghost" | "danger"; size?: "sm" | "md" | "icon"; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "glass", size = "md", loading, className, children, disabled, type = "button", ...p }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn("glass-btn", variant === "primary" && "btn-primary", variant === "ghost" && "btn-ghost", variant === "danger" && "btn-danger", size === "sm" && "btn-sm", size === "icon" && "btn-icon", className)}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ href, children, variant = "glass", className, ...p }: { href: string; children: ReactNode; variant?: BtnProps["variant"]; className?: string; target?: string; rel?: string }) {
  return (
    <Link href={href} className={cn("glass-btn", variant === "primary" && "btn-primary", variant === "ghost" && "btn-ghost", className)} {...p}>
      {children}
    </Link>
  );
}

/* ------------------------------- surfaces ----------------------------- */
export function Card({ children, className, hover, pad = true, ...p }: { children: ReactNode; className?: string; hover?: boolean; pad?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass", pad && "card-pad", hover && "card-hover", className)} {...p}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone, className }: { children: ReactNode; tone?: "red" | "amber" | "green" | "blue" | "accent"; className?: string }) {
  const t = { red: "text-red-400", amber: "text-amber-400", green: "text-emerald-400", blue: "text-sky-400", accent: "text-accent" }[tone ?? "blue"];
  return <span className={cn("chip", tone && t, className)}>{children}</span>;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("progress-track", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="progress-fill" initial={false} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 8, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--input)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value / 100))) }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const lang = useContext(LocaleContext);
  return (
    <div className="space-y-3" aria-busy aria-label={translate(lang, "Loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-card text-accent">{icon}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const lang = useContext(LocaleContext);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-red-400/30 bg-red-500/5 px-6 py-8 text-center">
      <AlertTriangle className="size-6 text-red-400" />
      <p className="text-sm">{translate(lang, message)}</p>
      {retry && (
        <Button size="sm" onClick={retry}>
          {translate(lang, "Try again")}
        </Button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[calc(var(--radius)*.7)] border border-line bg-[var(--input)] p-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={cn("whitespace-nowrap rounded-[calc(var(--radius)*.55)] px-3 py-1.5 text-sm font-medium transition-colors", value === o.value ? "bg-card text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("grid size-6 shrink-0 place-items-center rounded-full border transition-all active:scale-90", checked ? "check-on border-transparent bg-accent text-[var(--on-accent)]" : "border-[var(--border-strong)] hover:border-accent")}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="check-path" d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full border border-line transition-colors", checked ? "bg-accent" : "bg-[var(--input)]")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")} />
    </button>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint && !error && <p className="text-xs text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------- modal -------------------------------- */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const lang = useContext(LocaleContext);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select")?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "var(--overlay)" }} onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn("popover relative flex max-h-[92dvh] w-full flex-col rounded-b-none sm:rounded-b-[var(--radius-sm)]", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
            style={{ borderRadius: "var(--radius)" }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={translate(lang, "Close")}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="pb-safe flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ toasts + confirm ----------------------- */
type Toast = { id: number; kind: "success" | "error" | "info"; text: string; action?: { label: string; href: string } };
const LocaleContext = createContext<Lang>("en");

type UICtx = {
  toast: (kind: Toast["kind"], text: string, action?: Toast["action"]) => void;
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
  confirm: (text: string, label?: string) => Promise<boolean>;
};
const UI = createContext<UICtx | null>(null);
export const useUI = () => {
  const c = useContext(UI);
  if (!c) throw new Error("useUI outside provider");
  return c;
};

export function UIProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const t = (s: string) => translate(lang, s);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<{ text: string; label: string; resolve: (v: boolean) => void } | null>(null);
  const toast = useCallback<UICtx["toast"]>((kind, text, action) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text: translate(lang, text), action: action ? { ...action, label: translate(lang, action.label) } : undefined }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 4200);
  }, [lang]);
  const run = useCallback<UICtx["run"]>(
    async (fn, success) => {
      try {
        const r = await fn();
        if (success) toast("success", success);
        return r;
      } catch (e) {
        if (e instanceof ApiErr && e.code === "demo") toast("info", t("Demo accounts have limited access."), { label: t("Create account"), href: "/signup" });
        else toast("error", e instanceof Error ? t(e.message) : t("Something went wrong."));
        return undefined;
      }
    },
    [toast, lang],
  );
  const confirm = useCallback<UICtx["confirm"]>((text, label = t("Confirm")) => new Promise((resolve) => setConf({ text: t(text), label: t(label), resolve })), [lang]);
  const icon = { success: <CheckCircle2 className="size-4 text-emerald-400" />, error: <AlertTriangle className="size-4 text-red-400" />, info: <Info className="size-4 text-sky-400" /> };
  return (
    <LocaleContext.Provider value={lang}>
    <UI.Provider value={{ toast, run, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pe-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="popover pointer-events-auto flex max-w-sm items-start gap-3 px-4 py-3 text-sm">
              <span className="mt-0.5">{icon[t.kind]}</span>
              <span className="flex-1">{t.text}</span>
              {t.action && (
                <Link href={t.action.href} className="font-medium text-accent underline">
                  {t.action.label}
                </Link>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Modal
        open={!!conf}
        onClose={() => {
          conf?.resolve(false);
          setConf(null);
        }}
        title={t("Are you sure?")}
        footer={
          <>
            <Button onClick={() => { conf?.resolve(false); setConf(null); }}>{t("Cancel")}</Button>
            <Button variant="primary" onClick={() => { conf?.resolve(true); setConf(null); }}>
              {conf?.label}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{conf?.text}</p>
      </Modal>
    </UI.Provider>
    </LocaleContext.Provider>
  );
}

export function SavedTick({ show }: { show: boolean }) {
  return show ? <Check className="size-4 text-emerald-400" /> : null;
}
