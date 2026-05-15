import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export function getTransport() {
	const host = env.SMTP_HOST;
	const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
	const user = env.SMTP_USER;
	const pass = env.SMTP_PASS;

	if (!host || !user || !pass) {
		throw new Error('SMTP no está configurado correctamente');
	}

	return nodemailer.createTransport({
		host,
		port,
		secure: port === 465,
		auth: { user, pass }
	});
}

export async function sendEmail(to: string, subject: string, html: string) {
	const from = env.SMTP_FROM ?? 'No-Reply <no-reply@example.com>';
	const transporter = getTransport();
	await transporter.sendMail({ from, to, subject, html });
}

export async function sendMagicLinkEmail(to: string, magicUrl: string) {
	const html = `
		<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
			<h1 style="font-size: 20px; margin: 0 0 16px;">Inicia sesión en el Periódico escolar</h1>
			<p style="font-size: 14px; color: #334155;">Hacé click en el botón de abajo para iniciar sesión. El enlace expira en 15 minutos y solo se puede usar una vez.</p>
			<p style="margin: 24px 0; text-align: center;">
				<a href="${magicUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Iniciar sesión</a>
			</p>
			<p style="font-size: 12px; color: #64748b;">¿No funciona el botón? Copia y pega este enlace en tu navegador:</p>
			<p style="font-size: 12px; color: #334155; word-break: break-all;">${magicUrl}</p>
			<p style="font-size: 12px; color: #64748b; margin-top: 24px;">Si no solicitaste este correo, puedes ignorarlo.</p>
		</div>
	`;
	await sendEmail(to, 'Tu enlace de acceso al Periódico escolar', html);
}
