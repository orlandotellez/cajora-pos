import { Resend } from "resend";
import { env } from "@/config/env";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export async function sendVerificationCodeEmail(email: string, code: string): Promise<void> {
  const resend = getClient();

  // Sin key configurada: fallback a console (nunca romper el flujo de registro).
  if (!resend) {
    console.log(`[email] RESEND_API_KEY no configurada. Código de verificación para ${email}: ${code}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Tu código de verificación · POS Cloud",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111827; margin: 0 0 12px;">Confirmá tu correo</h2>
          <p style="color: #374151; font-size: 15px; line-height: 1.5;">
            Usá este código para confirmar tu email y continuar con la activación de tu tienda:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #111827;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            El código expira en 15 minutos. Si no pediste este correo, podés ignorarlo.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[email] Error enviando código a ${email}:`, error.message);
      throw new Error("No se pudo enviar el correo de verificación");
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "No se pudo enviar el correo de verificación") {
      console.error(`[email] Error enviando código a ${email}:`, err);
      throw new Error("No se pudo enviar el correo de verificación");
    }
    throw err;
  }
}