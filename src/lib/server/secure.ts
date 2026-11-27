import "server-only";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
}

export async function sendEmail(to: string, subject: string, html: string, fallbackLink?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM_EMAIL || "LIFE OS <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html: `${html}${fallbackLink ? `<p>If the button does not work, copy this link: <a href="${escapeHtml(fallbackLink)}">${escapeHtml(fallbackLink)}</a></p>` : ""}` }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("[email] provider rejected message", response.status);
    return false;
  }
  return true;
}
