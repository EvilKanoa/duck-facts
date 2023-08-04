import 'dotenv/config';

import express from 'express';
import fetch from 'node-fetch';

const PROMPTS = {
	GENERATE_FACT: () =>
		'Please list 10 interesting facts about ducks. Separate each fact with a newline.',
	TRANSLATE_TO_FRENCH: (message: string) =>
		`Translate the following English duck fact in double quotation marks to French: "${message}"`,
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
	const en = await chat(PROMPTS.GENERATE_FACT());
	console.log({ en });
	// const fr = await chat(PROMPTS.TRANSLATE_TO_FRENCH(en));

	return { en, fr: en };
};

const getFact = async (): Promise<string> => {
	// TODO: Should cache this eventually
	const { en, fr } = await generateFact();

	return `${en}\n\n${fr}`;
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
				res.status(200).send(fact);
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
