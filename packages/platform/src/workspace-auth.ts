import type { Storage } from '../../../dupes/feedback/src/storage.ts';
import { hash,equal } from '../../../dupes/feedback/src/auth.ts';

// Bootstrap env keys retain their existing owner digest. Issued keys resolve
// to a stable workspace ID, so future signup/key rotation need not change any
// instance ownership or update Worker environment secrets.
export async function platformOwner(db:Storage,configured:string,bearer:string) {
  if(bearer.length<32||bearer.length>512)return null;
  const digest=await hash(bearer);
  const keys=(configured||'').split(',').map(v=>v.trim()).filter(v=>v.length>=32);
  if((await Promise.all(keys.map(async key=>equal(digest,await hash(key))))).some(Boolean))return digest;
  const key=await db.get('SELECT owner_hash FROM workspace_keys WHERE hash=? AND revoked=0',[digest]);
  return key?String(key.owner_hash):null;
}
