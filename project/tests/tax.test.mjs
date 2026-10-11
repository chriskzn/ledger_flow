import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAnnualTax, calculateUIF } from '../src/lib/saTax.ts';
test('2027 primary rebate and zero threshold', () => {
  assert.equal(calculateAnnualTax(99000, 30), 0);
  assert.equal(calculateAnnualTax(100000, 30), 180);
});
test('2027 bracket transitions', () => {
  assert.equal(calculateAnnualTax(245100, 30), 26298);
  assert.equal(calculateAnnualTax(383100, 30), 62178);
  assert.equal(calculateAnnualTax(530200, 30), 107779);
});
test('2027 age rebates', () => {
  assert.equal(calculateAnnualTax(300000, 30) - calculateAnnualTax(300000, 65), 9765);
  assert.equal(calculateAnnualTax(300000, 65) - calculateAnnualTax(300000, 75), 3249);
});
test('UIF contribution ceiling', () => {
  assert.deepEqual(calculateUIF(30000), { employee: 177.12, employer: 177.12 });
});
