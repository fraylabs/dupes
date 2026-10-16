import { drizzle } from 'drizzle-orm/d1';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core';
import { query, type Storage } from './storage.ts';
// D1 migrations must be applied before createApp. No Node imports in the core.
export function d1Storage(binding: Parameters<typeof drizzle>[0]): Storage {
  const db = drizzle(binding);
  const dialect = new SQLiteAsyncDialect();
  // Drizzle's raw run wrappers have no prepared D1 statement for batch binds.
  // Compile bound SQL with Drizzle, then use D1's native atomic batch API.
  const native = binding as unknown as {prepare(sql:string):{bind(...params:unknown[]):unknown};batch(statements:unknown[]):Promise<unknown>};
  return {
    async all<T>(s:string,v:unknown[]=[]) {return await db.all(query(s,v)) as T[];},
    async get<T>(s:string,v:unknown[]=[]) {return await db.get(query(s,v)) as T | undefined;},
    async run(s,v=[]) {await db.run(query(s,v));},
    async batch(statements) {
      if(statements.length) await native.batch(statements.map(s=>{
        const compiled=dialect.sqlToQuery(query(s.text,s.values));
        return native.prepare(compiled.sql).bind(...compiled.params);
      }));
    }
  };
}
