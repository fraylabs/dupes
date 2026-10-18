import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { query, migrations, type Storage } from './storage.ts';
export function openStorage(path: string,schema:readonly string[]=migrations): Storage {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL'); sqlite.pragma('foreign_keys = ON'); sqlite.pragma('busy_timeout = 5000');
  sqlite.transaction(()=>schema.forEach(m=>sqlite.exec(m)))();
  const db = drizzle(sqlite);
  return {
    async all<T>(s: string,v: unknown[] = []) {return db.all(query(s,v)) as T[];},
    async get<T>(s: string,v: unknown[] = []) {return db.get(query(s,v)) as T | undefined;},
    async run(s,v=[]) {db.run(query(s,v));},
    async batch(statements) {sqlite.transaction(()=>statements.forEach(s=>db.run(query(s.text,s.values))))();}
  };
}
