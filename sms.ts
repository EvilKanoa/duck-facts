import nodemailer from 'nodemailer';
import { logger } from './logger.ts';

// big shout out to textbelt here: https://github.com/typpo/textbelt
// only uncommenting highly used ones since each provider uses an email quota
const PROVIDERS = [
	// '%s@blueskyfrog.com',
	// '%s@bplmobile.com',
	// '%s@cellularonewest.com',
	// '%s@clearlydigital.com',
	// '%s@comcastpcs.textmsg.com',
	// '%s@corrwireless.net',
	// '%s@csouth1.com',
	// '%s@cwemail.com',
	// '%s@cwwsms.com',
	// '%s@email.swbw.com',
	// '%s@email.uscc.net',
	'%s@fido.ca',
	// '%s@ideacellular.net',
	// '%s@inlandlink.com',
	// '%s@ivctext.com',
	// '%s@message.alltel.com',
	// '%s@messaging.centurytel.net',
	// '%s@messaging.sprintpcs.com',
	// '%s@mobile.celloneusa.com',
	// '%s@mobile.dobson.net',
	// '%s@mobile.surewest.com',
	// '%s@mobilecomm.net',
	// '%s@msg.clearnet.com',
	'%s@msg.koodomobile.com',
	'%s@msg.telus.com',
	// '%s@my2way.com',
	'%s@myboostmobile.com',
	// '%s@onlinebeep.net',
	// '%s@page.metrocall.com',
	// '%s@pagemci.com',
	// '%s@paging.acswireless.com',
	'%s@pcs.rogers.com',
	// '%s@pcsone.net',
	// '%s@qwestmp.com',
	// '%s@satellink.net',
	// '%s@sms.3rivers.net',
	// '%s@sms.bluecell.com',
	// '%s@sms.edgewireless.com',
	// '%s@sms.goldentele.com',
	// '%s@sms.pscel.com',
	// '%s@sms.wcc.net',
	// '%s@text.houstoncellular.net',
	// '%s@text.mtsmobility.com',
	// '%s@tmomail.net',
	// '%s@tms.suncom.com',
	// '%s@txt.att.net',
	'%s@txt.bell.ca',
	// '%s@txt.northerntelmobility.com',
	'%s@txt.windmobile.ca',
	// '%s@uswestdatamail.com',
	// '%s@utext.com',
	'%s@vmobile.ca',
	// '%s@vmobl.com',
	// '%s@vtext.com',
] as const;

const MAILER_FROM = process.env.MAILER_FROM ?? 'unknown';
const MAILER_HOST = process.env.MAILER_HOST ?? '';
const MAILER_PORT = parseInt(process.env.MAILER_PORT ?? '0');
const MAILER_SECURE =
	(process.env.MAILER_SECURE ?? '').toLowerCase() === 'true';
const MAILER_USER = process.env.MAILER_USER ?? '';
const MAILER_PASS = process.env.MAILER_PASS ?? '';
const MAILER_TLS_REJECT_UNAUTHORIZED =
	(process.env.MAILER_TLS_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() ===
	'true';

const transporter = nodemailer.createTransport({
	host: MAILER_HOST,
	port: MAILER_PORT,
	secure: MAILER_SECURE,
	auth: {
		user: MAILER_USER,
		pass: MAILER_PASS,
	},
	tls: { rejectUnauthorized: MAILER_TLS_REJECT_UNAUTHORIZED },
});

export const send = async (to: string, message: string): Promise<boolean> => {
	const results = await Promise.allSettled(
		PROVIDERS.map(
			(provider) =>
				new Promise((resolve, reject) =>
					transporter.sendMail(
						{
							from: `"Duck Fact" <${MAILER_FROM}>`,
							to: provider.replace('%s', to),
							subject: undefined,
							text: message,
							html: message,
						},
						(err, info) => (err != null ? reject(err) : resolve(info)),
					),
				),
		),
	);

	const success = results.some(({ status }) => status === 'fulfilled');

	if (!success) {
		results
			.filter(
				(p): p is { reason: string; status: 'rejected' } =>
					p.status === 'rejected',
			)
			.forEach(({ reason }) => logger.warn(reason));
	}

	return success;
};
