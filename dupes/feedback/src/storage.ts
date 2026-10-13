import { sql } from 'drizzle-orm';

export type Statement = { text: string; values?: unknown[] };
export interface Storage {
  all<T = Record<string, any>>(text: string, values?: unknown[]): Promise<T[]>;
  get<T = Record<string, any>>(text: string, values?: unknown[]): Promise<T | undefined>;
  run(text: string, values?: unknown[]): Promise<void>;
  batch(statements: Statement[]): Promise<void>;
}
// Drizzle parameters stay bound; SQL text never contains user input.
export function query(text: string, values: unknown[] = []) {
  const parts = text.split('?');
  if (parts.length !== values.length + 1) throw new Error('SQL parameter mismatch');
  const result = sql.empty();
  parts.forEach((part, i) => { result.append(sql.raw(part)); if (i < values.length) result.append(sql`${values[i]}`); });
  return result;
}
export const migrations = [
  `CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', private INTEGER NOT NULL DEFAULT 0, private_comments INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, external_id TEXT UNIQUE, verified INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id), name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'tag', parent_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id), author_id TEXT REFERENCES users(id), title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', imported_votes INTEGER NOT NULL DEFAULT 0, merged_into TEXT REFERENCES posts(id), created TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS post_tags (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(post_id,tag_id))`,
  `CREATE TABLE IF NOT EXISTS votes (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), created TEXT NOT NULL, PRIMARY KEY(post_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), body TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, private INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS changelog (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'new', published INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS changelog_posts (entry_id TEXT NOT NULL REFERENCES changelog(id) ON DELETE CASCADE, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(entry_id,post_id))`,
  `CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, user_id TEXT REFERENCES users(id), expires INTEGER)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notifications (entry_id TEXT NOT NULL REFERENCES changelog(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(entry_id,user_id))`,
  `CREATE INDEX IF NOT EXISTS posts_board ON posts(board_id,status)`,
  `CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,created)`
];
