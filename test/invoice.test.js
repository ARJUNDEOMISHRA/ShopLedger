'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(id, name, price, qty, hsn) {
  return { id, name, price, qty, hsn, gstRate: null };
}

function order(id, items, coupon) {
  return { id, items, coupon };
}

function figuresFor(orderData) {
  return {
    invoice: invoice.computeInvoiceFigures(orderData),
    checkout: pricing.computeTotals(orderData.items, orderData.coupon)
  };
}

test('FIXED BEHAVIOUR: #1001 invoice uses HSN GST slabs when gstRate is absent', function () {
  const result = figuresFor(order(1001, [
    item('rice', 'Rice', 120, 2, '1006'),
    item('ghee', 'Ghee', 250, 1, '0405')
  ], ''));

  assert.deepEqual(
    { subtotal: result.invoice.subtotal, discount: result.invoice.discount, tax: result.invoice.tax, total: result.invoice.total },
    { subtotal: 490, discount: 0, tax: 42, total: 532 }
  );
  assert.deepEqual(result.invoice.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(
    { subtotal: result.checkout.subtotal, discount: result.checkout.discount, tax: result.checkout.tax, total: result.checkout.total },
    { subtotal: 490, discount: 0, tax: 42, total: 532 }
  );
});

test('FIXED BEHAVIOUR: #1002 invoice applies SAVE10 before tax', function () {
  const result = figuresFor(order(1002, [
    item('tea', 'Tea', 400, 2, '0902'),
    item('chilli', 'Chilli Powder', 160, 1, '0904')
  ], 'SAVE10'));

  assert.deepEqual(
    { subtotal: result.invoice.subtotal, discount: result.invoice.discount, tax: result.invoice.tax, total: result.invoice.total },
    { subtotal: 960, discount: 96, tax: 146.88, total: 1010.88 }
  );
  assert.deepEqual(
    { subtotal: result.checkout.subtotal, discount: result.checkout.discount, tax: result.checkout.tax, total: result.checkout.total },
    { subtotal: 960, discount: 96, tax: 146.88, total: 1010.88 }
  );
});

test('FIXED BEHAVIOUR: #1004 invoice applies the ₹150 SAVE10 cap', function () {
  const result = figuresFor(order(1004, [
    item('rice-bulk', 'Rice Bulk Pack', 1040, 1, '1006'),
    item('ghee-bulk', 'Ghee Bulk Pack', 1200, 1, '0405')
  ], 'SAVE10'));

  assert.deepEqual(
    { subtotal: result.invoice.subtotal, discount: result.invoice.discount, tax: result.invoice.tax, total: result.invoice.total },
    { subtotal: 2240, discount: 150, tax: 182.88, total: 2272.88 }
  );
  assert.deepEqual(
    { subtotal: result.checkout.subtotal, discount: result.checkout.discount, tax: result.checkout.tax, total: result.checkout.total },
    { subtotal: 2240, discount: 150, tax: 182.88, total: 2272.88 }
  );
});

test('CURRENT BEHAVIOUR: #1008 invoice and checkout agree for all-18% items without a coupon', function () {
  const result = figuresFor(order(1008, [
    item('coffee', 'Coffee', 350, 2, '0901'),
    item('syrup', 'Syrup', 250, 1, '2106')
  ], ''));

  assert.deepEqual(
    { subtotal: result.invoice.subtotal, discount: result.invoice.discount, tax: result.invoice.tax, total: result.invoice.total },
    { subtotal: 950, discount: 0, tax: 171, total: 1121 }
  );
  assert.deepEqual(
    { subtotal: result.checkout.subtotal, discount: result.checkout.discount, tax: result.checkout.tax, total: result.checkout.total },
    { subtotal: 950, discount: 0, tax: 171, total: 1121 }
  );
});

test('FIXED BEHAVIOUR: #1004 invoice matches checkout tax slabs and capped pre-tax discount', function () {
  const orderData = order(1004, [
    item('rice-bulk', 'Rice Bulk Pack', 1040, 1, '1006'),
    item('ghee-bulk', 'Ghee Bulk Pack', 1200, 1, '0405')
  ], 'SAVE10');
  const checkout = pricing.computeTotals(orderData.items, orderData.coupon);
  const actual = invoice.computeInvoiceFigures(orderData);

  assert.deepEqual({
    subtotal: actual.subtotal,
    discount: actual.discount,
    taxable: actual.taxable,
    tax: actual.tax,
    cgst: actual.cgst,
    sgst: actual.sgst,
    total: actual.total,
    rows: actual.rows.map(function (row) {
      return {
        hsn: row.hsn,
        gstPercent: row.gstPercent,
        discount: row.discount,
        taxable: row.taxable,
        lineTax: row.lineTax,
        net: row.net
      };
    })
  }, {
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    taxable: checkout.taxable,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total,
    rows: checkout.lines.map(function (line) {
      return {
        hsn: line.hsn,
        gstPercent: line.gstPercent,
        discount: line.discount,
        taxable: line.taxable,
        lineTax: line.tax,
        net: line.net
      };
    })
  });
});
