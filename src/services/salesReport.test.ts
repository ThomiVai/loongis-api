import test from 'node:test';
import assert from 'node:assert/strict';
import { salesRange } from './salesReport';
test('ventas usa días argentinos completos y cruza meses', () => {
 const r = salesRange('2026-08-31', '2026-09-01');
 assert.equal(r.start.toISOString(), '2026-08-31T03:00:00.000Z');
 assert.equal(r.end.toISOString(), '2026-09-02T03:00:00.000Z');
 assert.deepEqual(r.days, ['2026-08-31', '2026-09-01']);
});
test('ventas rechaza fechas imposibles, rangos inversos y consultas sin límite', () => {
 for (const [a,b] of [['2026-02-30','2026-03-01'],['2026-09-02','2026-09-01'],['2026-01-01','2026-12-31'],['','2026-09-01']]) assert.throws(() => salesRange(a,b));
});
