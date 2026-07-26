import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canSubmitBatch,
  createPurposeSummary,
  createTypeSummary,
  createPersonSummary,
  createDetailSummary,
  createPrintPack,
} from '../src/domain/reimbursement.js';

const details = [
  {
    id: 'd-1',
    sequence: 1,
    reimburser: '张三',
    project: null,
    purpose: '项目员工餐费',
    expenseType: '餐饮类',
    paymentAmount: 380,
    invoiceAmount: 420,
    isSubstituteInvoice: false,
    attachments: [
      { id: 'p-1', type: 'PAYMENT_PROOF', name: '付款1.png' },
      { id: 'i-1', type: 'INVOICE', name: '发票1.png' },
    ],
  },
  {
    id: 'd-2',
    sequence: 2,
    reimburser: '李四',
    project: '四川时代项目',
    purpose: '异常处理交通费',
    expenseType: '交通类',
    paymentAmount: 46,
    invoiceAmount: 50,
    isSubstituteInvoice: true,
    attachments: [
      { id: 'p-2a', type: 'PAYMENT_PROOF', name: '付款2-1.png' },
      { id: 'p-2b', type: 'PAYMENT_PROOF', name: '付款2-2.png' },
      { id: 'i-2', type: 'INVOICE', name: '发票2.png' },
    ],
  },
];

test('项目为空时明细仍然有效', () => {
  assert.equal(details[0].project, null);
});

test('发票金额严格大于报销金额时允许提交', () => {
  assert.deepEqual(canSubmitBatch(426, 470), {
    canSubmit: true,
    difference: 44,
    missingAmount: 0,
  });
});

test('发票金额等于报销金额时不允许提交', () => {
  assert.deepEqual(canSubmitBatch(426, 426), {
    canSubmit: false,
    difference: 0,
    missingAmount: 0.01,
  });
});

test('报销人汇总表按费用用途生成', () => {
  assert.deepEqual(createPurposeSummary(details), [
    { purpose: '项目员工餐费', paymentAmount: 380, invoiceAmount: 420 },
    { purpose: '异常处理交通费', paymentAmount: 46, invoiceAmount: 50 },
  ]);
});

test('部门表1按费用类型汇总', () => {
  assert.deepEqual(createTypeSummary(details), [
    { expenseType: '餐饮类', paymentAmount: 380, invoiceAmount: 420 },
    { expenseType: '交通类', paymentAmount: 46, invoiceAmount: 50 },
  ]);
});

test('部门表2按报销人汇总', () => {
  assert.deepEqual(createPersonSummary(details), [
    { reimburser: '张三', reimbursementTotal: 380 },
    { reimburser: '李四', reimbursementTotal: 46 },
  ]);
});

test('部门表3保持稳定顺序并输出指定字段', () => {
  assert.deepEqual(createDetailSummary(details), [
    {
      sequence: 1,
      reimburser: '张三',
      purpose: '项目员工餐费',
      paymentAmount: 380,
      invoiceAmount: 420,
    },
    {
      sequence: 2,
      reimburser: '李四',
      purpose: '异常处理交通费',
      paymentAmount: 46,
      invoiceAmount: 50,
    },
  ]);
});

test('付款打印包与发票打印包分开且沿用表3序号', () => {
  const paymentPack = createPrintPack(details, 'PAYMENT_PROOF');
  const invoicePack = createPrintPack(details, 'INVOICE');

  assert.deepEqual(
    paymentPack.map(({ sequence, detailSequence, name, amount }) => ({ sequence, detailSequence, name, amount })),
    [
      { sequence: '1-1', detailSequence: 1, name: '付款1.png', amount: 380 },
      { sequence: '2-1', detailSequence: 2, name: '付款2-1.png', amount: 46 },
      { sequence: '2-2', detailSequence: 2, name: '付款2-2.png', amount: 46 },
    ],
  );
  assert.deepEqual(
    invoicePack.map(({ sequence, detailSequence, name, amount }) => ({ sequence, detailSequence, name, amount })),
    [
      { sequence: '1-1', detailSequence: 1, name: '发票1.png', amount: 420 },
      { sequence: '2-1', detailSequence: 2, name: '发票2.png', amount: 50 },
    ],
  );
});

test('文件名可同时模拟识别发票类型和金额', async () => {
  const { recognizeInvoiceFromName } = await import('../src/domain/reimbursement.js');
  assert.deepEqual(recognizeInvoiceFromName('餐饮发票_420.50.png'), {
    expenseType: '餐饮类',
    invoiceAmount: 420.5,
    confidence: 0.88,
  });
});
