import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableInventory,
  inventoryFromRows,
  nextInventoryId,
  parseInventoryInput,
} from '../lib/inventory.ts';

const valid = {
  name: 'Projector',
  category: 'ការបង្ហាញ',
  serialNumber: 'PJ-001',
  acquiredDate: '2026-09-16',
  specification: '4K, HDMI',
  totalQty: 5,
  reservedQty: 1,
  inUseQty: 1,
  damagedQty: 1,
  location: 'Office',
  active: true,
  notes: '',
};

test('small-stock quantities stay consistent and availability is derived', () => {
  assert.deepEqual(parseInventoryInput(valid), valid);
  assert.equal(availableInventory(valid), 2);
  assert.equal(availableInventory({ ...valid, active: false }), 0);
  for (const change of [
    { totalQty: -1 },
    { reservedQty: 4 },
    { inUseQty: 2.5 },
    { name: '' },
    { acquiredDate: '2026-02-31' },
    { location: '' },
  ]) {
    assert.throws(() => parseInventoryInput({ ...valid, ...change }));
  }
});

test('short equipment IDs increment and the latest valid audit row wins', () => {
  const rows = [
    [
      'EQ-001',
      'Projector',
      'Display',
      5,
      0,
      0,
      0,
      'Office',
      true,
      '',
      'first',
      'owner',
    ],
    [
      'EQ-001',
      'Projector HD',
      'Display',
      5,
      1,
      0,
      0,
      'Office',
      true,
      '',
      'second',
      'owner',
    ],
    [
      'EQ-002',
      'Microphone',
      'Audio',
      3,
      5,
      0,
      0,
      'Office',
      true,
      '',
      'invalid',
      'owner',
    ],
  ];
  const items = inventoryFromRows(rows);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Projector HD');
  assert.equal(items[0].reservedQty, 1);
  assert.equal(items[0].serialNumber, '');
  assert.equal(items[0].acquiredDate, '');
  assert.equal(items[0].specification, '');
  assert.equal(nextInventoryId(items), 'EQ-002');
});
