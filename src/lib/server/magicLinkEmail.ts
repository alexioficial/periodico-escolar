import { BRAND_SUBTITLE } from '../brand';
import type { EmailMessage } from './cloudflareEmail';

const LOGO_CONTENT_ID = 'periodico-sds-logo';

export function buildMagicLinkEmail(
	magicUrl: string,
	logoContent: string
): Omit<EmailMessage, 'to'> & { attachments: NonNullable<EmailMessage['attachments']> } {
	const subject = `Tu enlace de acceso al ${BRAND_SUBTITLE}`;
	const html = `
		<div style="background: #f1f5f9; margin: 0; padding: 32px 16px;">
			<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; overflow: hidden;">
				<div style="background: #ffffff; padding: 24px 24px 8px; text-align: center;">
					<img src="cid:${LOGO_CONTENT_ID}" alt="Isotipo de Santo Domingo Savio" width="88" height="88" style="display: block; margin: 0 auto; width: 88px; height: 88px;" />
				</div>
				<div style="background: #ffffff; padding: 8px 24px 24px;">
					<h1 style="color: #0f172a; font-size: 20px; margin: 0 0 16px; text-align: center;">Inicia sesión en el ${BRAND_SUBTITLE}</h1>
					<p style="font-size: 14px; color: #334155;">Hacé click en el botón de abajo para iniciar sesión. El enlace expira en 15 minutos y solo se puede usar una vez.</p>
					<p style="margin: 24px 0; text-align: center;">
						<a href="${magicUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Iniciar sesión</a>
					</p>
					<p style="font-size: 12px; color: #64748b;">¿No funciona el botón? Copia y pega este enlace en tu navegador:</p>
					<p style="font-size: 12px; color: #334155; word-break: break-all;">${magicUrl}</p>
					<p style="font-size: 12px; color: #64748b; margin-top: 24px;">Si no solicitaste este correo, puedes ignorarlo.</p>
				</div>
			</div>
		</div>
	`;
	const text = `Inicia sesión en el ${BRAND_SUBTITLE}

Abre este enlace para iniciar sesión:
${magicUrl}

El enlace expira en 15 minutos y solo se puede usar una vez.

Si no solicitaste este correo, puedes ignorarlo.`;

	return {
		subject,
		html,
		text,
		attachments: [
			{
				filename: 'isotipo-periodico-sds.png',
				content: logoContent,
				type: 'image/png',
				disposition: 'inline',
				content_id: LOGO_CONTENT_ID
			}
		]
	};
}
