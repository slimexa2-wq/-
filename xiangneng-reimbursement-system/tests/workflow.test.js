import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBatch } from '../src/data/demo-data.js';
import { addIssue, advanceBatch, canAdvanceBatch, resolveIssue } from '../src/domain/workflow.js';

function batchAt(status) {
  return { ...structuredClone(defaultBatch), status };
}

test('七个状态必须按固定顺序整批流转', () => {
  let batch = batchAt('待提交');
  for (const next of ['部门制单中','负责人审核中','财务审核中','审核通过','待打款','已打款']) {
    const result = advanceBatch(batch, next, '测试人');
    assert.equal(result.allowed, true);
    batch = result.batch;
    assert.equal(batch.status, next);
  }
});

test('禁止跳过状态', () => {
  const result = advanceBatch(batchAt('部门制单中'), '财务审核中', '测试人');
  assert.equal(result.allowed, false);
  assert.equal(result.batch.status, '部门制单中');
});

test('问题标记不改变主状态且未解决时不能审核通过', () => {
  const original = batchAt('财务审核中');
  const withIssue = addIssue(original, { detailId: 'd-1', type: '待补发票', actor: '财务' }).batch;
  assert.equal(withIssue.status, '财务审核中');
  assert.equal(canAdvanceBatch(withIssue, '审核通过').allowed, false);
  const resolved = resolveIssue(withIssue, withIssue.issues[0].id, '报销人').batch;
  assert.equal(canAdvanceBatch(resolved, '审核通过').allowed, true);
});

test('待提交批次发票金额不足时不能进入部门制单中', () => {
  const batch = batchAt('待提交');
  batch.details[0].invoiceAmount = 1;
  assert.equal(canAdvanceBatch(batch, '部门制单中').allowed, false);
});
