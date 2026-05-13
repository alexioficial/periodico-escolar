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

function codeEmailTemplate(title: string, intro: string, code: string) {
	return `
		<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
			<h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
			<p style="font-size: 14px; color: #334155;">${intro}</p>
			<div style="font-size: 28px; letter-spacing: 8px; font-weight: 700; background: #0ea5e9; color: #0f172a; padding: 12px 16px; text-align: center; border-radius: 12px; margin: 16px 0;">
				${code}
			</div>
			<p style="font-size: 12px; color: #64748b;">Si no solicitaste este correo, puedes ignorarlo.</p>
		</div>
	`;
}

export async function sendVerificationEmail(to: string, code: string) {
	await sendEmail(
		to,
		'Tu código de verificación',
		codeEmailTemplate(
			'Verifica tu correo',
			'Usa el siguiente código para verificar tu cuenta. Expira en 15 minutos.',
			code
		)
	);
}

export async function sendPasswordResetEmail(to: string, code: string) {
	await sendEmail(
		to,
		'Restablece tu contraseña',
		codeEmailTemplate(
			'Restablece tu contraseña',
			'Usa el siguiente código para restablecer tu contraseña. Expira en 15 minutos.',
			code
		)
	);
}
