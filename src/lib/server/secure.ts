import "server-only";

/** Sends transactional email through Resend. Returns false when delivery is not configured. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.EMAIL_FROM || "LIFE OS <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[email] Resend rejected message:", response.status, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Delivery failed:", error);
    return false;
  }
}
