"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="accent-fill mb-4 grid size-12 place-items-center rounded-2xl text-lg font-bold text-[var(--on-accent)] shadow-xl">L</span>
          <p className="text-xs font-semibold tracking-[0.3em] text-muted">LIFE OS</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="glass card-pad" style={{ padding: "1.5rem" }}>{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        <p className="mt-8 text-center text-xs text-faint">Your Life. Your Goals. Your Progress.</p>
      </motion.div>
    </div>
  );
}
