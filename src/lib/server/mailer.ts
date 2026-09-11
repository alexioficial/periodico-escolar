import { env } from '$env/dynamic/private';
import emailLogoDataUrl from '$lib/assets/brand/isotipo-periodico-sds-email.png?inline';
import { BRAND_SUBTITLE } from '$lib/brand';
import { sendCloudflareEmail, type EmailAttachment } from './cloudflareEmail';
import { buildMagicLinkEmail } from './magicLinkEmail';

const EMAIL_LOGO_CONTENT = emailLogoDataUrl.replace(/^data:image\/png;base64,/, '');

export async function sendEmail(
	to: string,
	subject: string,
	html: string,
	text: string,
	attachments: EmailAttachment[] = []
) {
	await sendCloudflareEmail(
		{
			accountId: env.CLOUDFLARE_ACCOUNT_ID ?? '',
			apiToken: env.CLOUDFLARE_API_TOKEN ?? '',
			fromAddress: env.EMAIL_FROM_ADDRESS ?? 'no-reply@widube.com',
			fromName: env.EMAIL_FROM_NAME ?? BRAND_SUBTITLE
		},
		{ to, subject, html, text, attachments }
	);
}

export async function sendMagicLinkEmail(to: string, magicUrl: string) {
	const email = buildMagicLinkEmail(magicUrl, EMAIL_LOGO_CONTENT);
	await sendEmail(to, email.subject, email.html, email.text, email.attachments);
}
