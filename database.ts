import sqlite3 from 'sqlite3';
import { logger } from './logger.ts';

const db = new sqlite3.Database(
	'ducks.sqlite3',
	sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
	async (err) => {
		if (err != null) {
			logger.error('failed to open cache', err);
		} else {
			createTables().catch((err) => {
				logger.error('failed to create tables', err);
			});
		}
	},
);

const p = async (run: (cb: any) => void): Promise<any> =>
	new Promise((resolve, reject) =>
		run((err: any, res: any) =>
			err != null ? reject(err) : resolve(res ?? undefined),
		),
	);

const createTables = async () => {
	await p((cb) =>
		db.run(
			'CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY AUTOINCREMENT, en TEXT NOT NULL, fr TEXT, created INTEGER NOT NULL)',
			cb,
		),
	);
	await p((cb) =>
		db.run(
			'CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL)',
			cb,
		),
	);
};

export const getFacts = async (
	cutoff?: number,
): Promise<[{ id: number; en: string; fr: string; created: number }]> => {
	const query =
		cutoff != null
			? `SELECT id, en, fr, created FROM facts WHERE created >= ${Math.floor(
					cutoff,
			  )} ORDER BY created DESC`
			: 'SELECT id, en, fr, created FROM facts ORDER BY created DESC';
	return p((cb) => db.all(query, cb));
};

export const findFact = async (
	en: string,
): Promise<{ id: number; en: string; fr: string; created: number }> => {
	return p((cb) =>
		db.get(
			'SELECT id, en, fr, created FROM facts WHERE en = ? COLLATE NOCASE LIMIT 1',
			en,
			cb,
		),
	);
};

export const insertFact = async (fact: {
	en: string;
	fr?: string;
	created?: number;
}): Promise<{ id: number; en: string; fr: string; created: number }> => {
	if (fact.fr == null) {
		fact.fr = '';
	}
	if (fact.created == null) {
		fact.created = Math.floor(Date.now() / 1000);
	}

	return p((cb) =>
		db.get(
			'INSERT INTO facts (en, fr, created) VALUES (?, ?, ?) RETURNING *',
			fact.en,
			fact.fr,
			fact.created,
			cb,
		),
	);
};

export const getSubscribers = async (): Promise<
	{ id: number; number: string }[]
> => {
	return p((cb) =>
		db.all('SELECT id, number FROM subscribers ORDER BY id ASC', cb),
	);
};

export const insertSubscriber = async (
	number: string,
): Promise<{ id: number; number: string }> => {
	return p((cb) =>
		db.get(
			'INSERT INTO subscribers (number) VALUES (?) RETURNING *',
			number,
			cb,
		),
	);
};

export const removeSubscriber = async (number: string): Promise<void> => {
	await p((cb) =>
		db.run(
			'DELETE FROM subscribers WHERE number = ? COLLATE NOCASE',
			number,
			cb,
		),
	);
};
