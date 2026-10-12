import { Resend } from "resend";

export async function sendBriefEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  if (opts.to.length === 0) throw new Error("No recipients configured in config/settings.json");
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Podcast Radar <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error || !data) throw new Error(`Resend error: ${error?.message ?? "no response"}`);
  return { id: data.id };
}
