import 'dotenv/config';

import Fastify from 'fastify';
import fastifySensible from '@fastify/sensible';
import fetch from 'node-fetch';

import {
	getFacts,
	insertFact,
	findFact,
	insertSubscriber,
	getSubscribers,
	removeSubscriber,
} from './database.ts';
import { logger } from './logger.ts';
import { send } from './sms.ts';

const FACT_EXPIRATION_SECONDS = 60 * 60 * 24;
const PROMPTS = {
	GENERATE_FACT: () =>
		'Please list 10 interesting facts about ducks. Please start each fact with the word FACT.',
	TRANSLATE_TO_FRENCH: (message: string) =>
		`Translate the following English duck fact to French: ${message}`,
} as const;

let key: string | undefined;

const toStr = (fact: { en: string; fr?: string }): string =>
	`${fact.en}\n${fact.fr ?? ''}`;

const chat = async (message: string): Promise<string> => {
	const endpoint = 'https://api.openai.com/v1/chat/completions';

	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'gpt-3.5-turbo',
			messages: [{ role: 'user', content: message }],
		}),
	}).then(async (res) => {
		if (!res.ok) {
			logger.error({ status: res.status, statusText: res.statusText });
			try {
				logger.error(await res.json());
			} catch {}
			throw 'bad response from chatgpt :(';
		}

		return res.json();
	});

	const reply = (res as any)?.choices?.[0]?.message?.content;

	if (reply == null || reply.length <= 0) {
		logger.warn(res);
		throw 'cannot parse reply from chatgpt response';
	}

	return reply;
};

const generateFact = async (): Promise<{ en: string; fr: string }> => {
	const newFact = async () => {
		const reply = await chat(PROMPTS.GENERATE_FACT());
		const facts = reply
			.split(/FACT(?:\s?[0-9]*)?:/gi)
			.map((fact) => fact.trim())
			.filter((fact) => fact != null && fact.length);
		return facts[Math.floor(Math.random() * facts.length)];
	};

	let en;
	do {
		en = await newFact();
	} while ((await findFact(en)) != null);

	const fr = await chat(PROMPTS.TRANSLATE_TO_FRENCH(en));

	const fact = { en, fr };
	logger.info('generated fact', fact);
	await insertFact(fact);
	return fact;
};

const getFact = async (): Promise<{ en: string; fr: string }> => {
	const cached = await getFacts(Date.now() / 1000 - FACT_EXPIRATION_SECONDS);
	if (cached.length > 0) {
		logger.info('cache hit');
		return cached[Math.floor(Math.random() * cached.length)];
	}
	logger.info('cache miss');

	return await generateFact();
};

const run = async () => {
	const port = parseInt(process.env.PORT ?? '8080');
	key = process.env.API_KEY;

	if (key == null || key.length <= 0) {
		throw 'cannot start server without an API_KEY specified!';
	}

	const fastify = Fastify({ logger });
	fastify.register(fastifySensible);

	fastify.get('/', async (request, reply) => {
		reply.code(200);
		return {
			routes: [
				{ path: '/health', description: 'Health check route' },
				{
					path: '/fact',
					description:
						'Returns a singular duck fact, returns fact in both English and French',
				},
			],
			description: 'Duck fact generation server, now powered by AI!',
		};
	});

	fastify.get('/health', async (request, reply) => {
		reply.code(200);
		return { status: 'healthy' };
	});

	fastify.get('/fact', async (request, reply) => {
		try {
			const fact = await getFact();
			reply.code(200);
			reply.type('text/plain; charset=utf-8');
			return toStr(fact);
		} catch (err) {
			fastify.log.error(err);
			throw fastify.httpErrors.internalServerError();
		}
	});

	fastify.post('/send', async (request, reply) => {
		const key = process.env.SEND_SECRET ?? undefined;
		if (
			key == null ||
			key.length === 0 ||
			request.headers.authorization !== key
		) {
			throw fastify.httpErrors.unauthorized(
				'missing or incorrect authorization',
			);
		}

		const fact = await getFact();
		const factStr = toStr(fact);
		const subscribers = await getSubscribers();

		fastify.log.info('sending to all subscribers...');
		await Promise.all(
			subscribers.map(async (subscriber) => {
				if (await send(subscriber.number, factStr)) {
					fastify.log.info(`SEND SUCCESS: ${subscriber.number}`);
				} else {
					fastify.log.warn(`SEND FAILURE: ${subscriber.number}`);
				}
			}),
		);

		reply.code(201);
		return 'Sent';
	});

	fastify.post('/subscribe', async (request, reply) => {
		const { number } = request.body as any;

		if (typeof number !== 'string' || number.length <= 0) {
			throw fastify.httpErrors.badRequest(`must provide 'number' property!`);
		}

		const subscriber = await insertSubscriber(number);
		reply.code(201);
		return subscriber;
	});

	fastify.post('/unsubscribe', async (request, reply) => {
		const { number } = request.body as any;

		if (typeof number !== 'string' || number.length <= 0) {
			throw fastify.httpErrors.badRequest(`must provide 'number' property!`);
		}

		await removeSubscriber(number);
		reply.code(204);
		return '';
	});

	fastify.post('/bonus', async (request, reply) => {
		const key = process.env.BONUS_SECRET ?? undefined;
		if (
			key == null ||
			key.length === 0 ||
			request.headers.authorization !== key
		) {
			throw fastify.httpErrors.unauthorized(
				'missing or incorrect authorization',
			);
		}

		const fact = await generateFact();
		reply.code(201);
		return fact;
	});

	await fastify.listen({ port });
};

run()
	.then(() => logger.info('Duck facts server started!'))
	.catch((err) => logger.error('Failed to start server!', err));
