import { createHash } from "node:crypto";
export function orderRequestHash(body: Record<string,unknown>): string {
  const canonical = (value:unknown):unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)])) : value;
  const {requestKey: _key,...data}=body;
  return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}
export const validRequestKey = (key:unknown):key is string => typeof key==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key);
