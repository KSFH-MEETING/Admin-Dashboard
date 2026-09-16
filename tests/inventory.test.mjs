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
  brand: 'Epson',
  model: 'EB-X51',
  serialNumber: '',
  acquiredDate: '2026-09-16',
  warrantyExpiry: '2029-09-16',
  condition: 'good',
  responsiblePerson: 'I.T',
  specification: '4K, HDMI',
  totalQty: 5,
  reservedQty: 1,
  inUseQty: 1,
  damagedQty: 1,
  location: 'Office',
  allocations: [
    { location: 'Office', status: 'available', quantity: 2 },
    { location: 'Office', status: 'reserved', quantity: 1 },
    { location: 'Office', status: 'in_use', quantity: 1 },
    { location: 'Office', status: 'damaged', quantity: 1 },
  ],
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
    { warrantyExpiry: '2025-01-01' },
    { condition: 'unknown' },
    { allocations: [{ location: '', status: 'available', quantity: 5 }] },
    { serialNumber: 'PJ-001', totalQty: 2 },
  ]) {
    assert.throws(() => parseInventoryInput({ ...valid, ...change }));
  }
  assert.equal(
    parseInventoryInput({
      ...valid,
      serialNumber: 'PJ-001',
      totalQty: 1,
      reservedQty: 0,
      inUseQty: 0,
      damagedQty: 0,
      allocations: [{ location: 'Office', status: 'available', quantity: 1 }],
    }).totalQty,
    1,
  );
});

test('stock can be distributed across locations and statuses', () => {
  const parsed = parseInventoryInput({
    ...valid,
    totalQty: 4,
    reservedQty: 0,
    inUseQty: 0,
    damagedQty: 0,
    allocations: [
      { location: 'Room A', status: 'available', quantity: 1 },
      { location: 'Room B', status: 'reserved', quantity: 1 },
      { location: 'Room C', status: 'in_use', quantity: 1 },
      { location: 'Room D', status: 'damaged', quantity: 1 },
    ],
  });
  assert.equal(parsed.location, 'ច្រើនទីតាំង');
  assert.equal(parsed.reservedQty, 1);
  assert.equal(parsed.inUseQty, 1);
  assert.equal(parsed.damagedQty, 1);
  assert.equal(availableInventory(parsed), 1);
  assert.throws(() => parseInventoryInput({ ...valid, allocations: [{ location: 'Room A', status: 'available', quantity: 4 }] }));
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
    [
      'EQ-003',
      'Legacy item',
      'Other',
      0,
      0,
      0,
      0,
      'Office',
      true,
      '',
      'legacy',
      'owner',
    ],
  ];
  const items = inventoryFromRows(rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Projector HD');
  assert.equal(items[0].reservedQty, 1);
  assert.equal(items[0].serialNumber, '');
  assert.equal(items[0].acquiredDate, '');
  assert.equal(items[0].specification, '');
  assert.equal(items[0].brand, '');
  assert.equal(items[0].model, '');
  assert.equal(items[0].condition, 'good');
  assert.equal(items[0].warrantyExpiry, '');
  assert.equal(items[0].responsiblePerson, '');
  assert.equal(items[1].totalQty, 1);
  assert.equal(nextInventoryId(items), 'EQ-004');
});
