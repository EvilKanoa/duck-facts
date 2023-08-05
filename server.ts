import 'dotenv/config';

import express from 'express';
import fetch from 'node-fetch';

import { getFacts, insertFact, findFact } from './cache.ts';

const FACT_EXPIRATION_SECONDS = 60 * 60 * 24;
const PROMPTS = {
	GENERATE_FACT: () =>
		'Please list 10 interesting facts about ducks. Please start each fact with the word FACT.',
	TRANSLATE_TO_FRENCH: (message: string) =>
		`Translate the following English duck fact to French: ${message}`,
} as const;

let key: string | undefined;

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
			console.error({ status: res.status, statusText: res.statusText });
			try {
				console.error(JSON.stringify(await res.json()));
			} catch {}
			throw 'bad response from chatgpt :(';
		}

		return res.json();
	});

	const reply = (res as any)?.choices?.[0]?.message?.content;

	if (reply == null || reply.length <= 0) {
		console.warn(res);
		throw 'cannot parse reply from chatgpt response';
	}

	return reply;
};

const generateFact = async (): Promise<{ en: string; fr: string }> => {
	const reply = await chat(PROMPTS.GENERATE_FACT());
	const facts = reply
		.split(/FACT(?:\s?[0-9]*)?:/gi)
		.map((fact) => fact.trim())
		.filter((fact) => fact != null && fact.length);
	const en = facts[Math.floor(Math.random() * facts.length)];
	const fr = await chat(PROMPTS.TRANSLATE_TO_FRENCH(en));

	const fact = { en, fr };
	console.log('generated fact', fact);
	return fact;
};

const getFact = async (): Promise<{ en: string; fr: string }> => {
	const cached = await getFacts(Date.now() / 1000 - FACT_EXPIRATION_SECONDS);
	if (cached.length > 0) {
		console.log('cache hit');
		return cached[Math.floor(Math.random() * cached.length)];
	}
	console.log('cache miss');

	let fact;
	do {
		fact = await generateFact();
	} while ((await findFact(fact.en)) != null);

	console.log('inserted to cache', await insertFact(fact));

	return fact;
};

const run = async () => {
	const port = process.env.PORT ?? 8080;
	key = process.env.API_KEY;

	if (key == null || key.length <= 0) {
		throw 'cannot start server without an API_KEY specified!';
	}

	const app = express();

	app.get('/', (_req, res) => {
		res.status(200).json({
			routes: [
				{ path: '/health', description: 'Health check route' },
				{
					path: '/fact',
					description:
						'Returns a singular duck fact, returns fact in both English and French',
				},
			],
			description: 'Duck fact generation server, now powered by AI!',
		});
	});

	app.get('/health', (_req, res) => {
		res.status(200).json({ status: 'healthy' });
	});

	app.get('/fact', (_req, res) => {
		getFact()
			.then((fact) => {
				res.status(200).send(`${fact.en}\n${fact.fr}`);
			})
			.catch((err) => {
				console.error(err);
				res.status(500).send('Internal Server Error');
			});
	});

	await new Promise<void>((resolve) => app.listen(port, () => resolve()));
};

run()
	.then(() => console.log('Duck facts server started!'))
	.catch((err) => console.error('Failed to start server!', err));
