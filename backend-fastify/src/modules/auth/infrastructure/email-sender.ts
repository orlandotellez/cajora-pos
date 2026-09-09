import { Resend } from "resend";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

interface SendEmailResult {
  ok: boolean
  error?: string
}

export async function sendVerificationCodeEmail(
  email: string,
  code: string,
): Promise<SendEmailResult> {
  const resend = getClient();

  // Sin key configurada: fallback a logger (nunca romper el flujo de registro).
  if (!resend) {
    logger.info({ email, code }, "[email] RESEND_API_KEY no configurada. Código de verificación");
    return { ok: true };
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
      logger.error({ email, error: error.message }, "[email] Error enviando código");
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ email, err }, "[email] Error enviando código");
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
  }
}