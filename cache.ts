import sqlite3 from 'sqlite3';

let connected = false;
const db = new sqlite3.Database(
	'cache.sqlite3',
	sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
	async (err) => {
		if (err != null) {
			console.error('failed to open cache', err);
		} else {
			createTables()
				.then(() => (connected = true))
				.catch((err) => {
					console.error('failed to create tables', err);
				});
		}
	},
);

const createTables = async () => {
	await new Promise<void>((resolve, reject) =>
		db.run(
			'CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY AUTOINCREMENT, en TEXT NOT NULL, fr TEXT, created INTEGER NOT NULL)',
			(err) => (err != null ? reject(err) : resolve()),
		),
	);
};

export const getFacts = async (
	cutoff?: number,
): Promise<[{ id: number; en: string; fr: string; created: number }]> => {
	const query =
		cutoff != null
			? `SELECT id, en, fr, created FROM facts WHERE created >= ${Math.floor(cutoff)} ORDER BY created DESC`
			: 'SELECT id, en, fr, created FROM facts ORDER BY created DESC';
	return new Promise((resolve, reject) =>
		db.all(query, (err, rows: any) =>
			err != null ? reject(err) : resolve(rows),
		),
	);
};

export const findFact = async (
	en: string,
): Promise<{ id: number; en: string; fr: string; created: number }> => {
	return new Promise((resolve, reject) =>
		db.get(
			'SELECT id, en, fr, created FROM facts WHERE en = ? COLLATE NOCASE LIMIT 1',
			en,
			(err, row: any) => (err != null ? reject(err) : resolve(row)),
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

	return new Promise((resolve, reject) =>
		db.get(
			'INSERT INTO facts (en, fr, created) VALUES (?, ?, ?) RETURNING *',
			fact.en,
			fact.fr,
			fact.created,
			(err: any, row: any) => (err != null ? reject(err) : resolve(row)),
		),
	);
};
