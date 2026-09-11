import { env } from '$env/dynamic/private';
import { BRAND_SUBTITLE } from '$lib/brand';
import { sendCloudflareEmail } from './cloudflareEmail';

export async function sendEmail(to: string, subject: string, html: string, text: string) {
	await sendCloudflareEmail(
		{
			accountId: env.CLOUDFLARE_ACCOUNT_ID ?? '',
			apiToken: env.CLOUDFLARE_API_TOKEN ?? '',
			fromAddress: env.EMAIL_FROM_ADDRESS ?? 'no-reply@widube.com',
			fromName: env.EMAIL_FROM_NAME ?? BRAND_SUBTITLE
		},
		{ to, subject, html, text }
	);
}

export async function sendMagicLinkEmail(to: string, magicUrl: string) {
	const html = `
		<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
			<h1 style="font-size: 20px; margin: 0 0 16px;">Inicia sesión en el Periódico Escolar Salesiano</h1>
			<p style="font-size: 14px; color: #334155;">Hacé click en el botón de abajo para iniciar sesión. El enlace expira en 15 minutos y solo se puede usar una vez.</p>
			<p style="margin: 24px 0; text-align: center;">
				<a href="${magicUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Iniciar sesión</a>
			</p>
			<p style="font-size: 12px; color: #64748b;">¿No funciona el botón? Copia y pega este enlace en tu navegador:</p>
			<p style="font-size: 12px; color: #334155; word-break: break-all;">${magicUrl}</p>
			<p style="font-size: 12px; color: #64748b; margin-top: 24px;">Si no solicitaste este correo, puedes ignorarlo.</p>
		</div>
	`;
	const text = `Inicia sesión en el Periódico Escolar Salesiano

Abre este enlace para iniciar sesión:
${magicUrl}

El enlace expira en 15 minutos y solo se puede usar una vez.

Si no solicitaste este correo, puedes ignorarlo.`;
	await sendEmail(to, 'Tu enlace de acceso al Periódico Escolar Salesiano', html, text);
}
