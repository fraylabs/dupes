import { drizzle } from 'drizzle-orm/d1';
import { query, type Storage } from './storage.ts';
// D1 migrations must be applied before createApp. No Node imports in the core.
export function d1Storage(binding: Parameters<typeof drizzle>[0]): Storage {
  const db = drizzle(binding);
  return {
    async all<T>(s:string,v:unknown[]=[]) {return await db.all(query(s,v)) as T[];},
    async get<T>(s:string,v:unknown[]=[]) {return await db.get(query(s,v)) as T | undefined;},
    async run(s,v=[]) {await db.run(query(s,v));},
    async batch(statements) {if(statements.length) await db.batch(statements.map(s=>db.run(query(s.text,s.values))) as any);}
  };
}
