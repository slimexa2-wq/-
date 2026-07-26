import { BATCH_STATUSES, canSubmitBatch, getBatchTotals } from './reimbursement.js';

export const ROLES = Object.freeze({
  REIMBURSER: 'reimburser',
  MAKER: 'maker',
  MANAGER: 'manager',
  FINANCE: 'finance',
  CASHIER: 'cashier',
});

const NEXT_STATUS = Object.freeze({
  待提交: '部门制单中',
  部门制单中: '负责人审核中',
  负责人审核中: '财务审核中',
  财务审核中: '审核通过',
  审核通过: '待打款',
  待打款: '已打款',
});

export function getNextStatus(status) {
  return NEXT_STATUS[status] || null;
}

export function hasOpenIssues(batch) {
  return (batch.issues || []).some((issue) => issue.status !== '已解决');
}

export function canAdvanceBatch(batch, nextStatus) {
  if (!BATCH_STATUSES.includes(batch.status) || getNextStatus(batch.status) !== nextStatus) {
    return { allowed: false, reason: '当前状态不允许执行此操作' };
  }

  if (batch.status === '待提交') {
    const totals = getBatchTotals(batch.details);
    const coverage = canSubmitBatch(totals.paymentAmount, totals.invoiceAmount);
    if (!coverage.canSubmit) {
      return { allowed: false, reason: `发票金额不足，至少还差¥${coverage.missingAmount.toFixed(2)}` };
    }
  }

  if (['负责人审核中', '财务审核中'].includes(batch.status) && hasOpenIssues(batch)) {
    return { allowed: false, reason: '仍有未解决的问题，暂不能整批通过' };
  }

  return { allowed: true, reason: '' };
}

export function advanceBatch(batch, nextStatus, actor = '系统') {
  const validation = canAdvanceBatch(batch, nextStatus);
  if (!validation.allowed) return { batch, ...validation };

  const updated = structuredClone(batch);
  updated.status = nextStatus;
  updated.logs = [
    ...(updated.logs || []),
    {
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      action: `${batch.status} → ${nextStatus}`,
      actor,
      at: new Date().toISOString(),
    },
  ];

  if (nextStatus === '待打款') updated.pendingPaymentAt = new Date().toISOString();
  if (nextStatus === '已打款') updated.paidAt = new Date().toISOString();

  return { batch: updated, allowed: true, reason: '' };
}

export function addIssue(batch, { detailId = null, type, note = '', actor = '审核人' }) {
  const updated = structuredClone(batch);
  const issue = {
    id: `issue-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    detailId,
    type,
    note: note.trim(),
    status: '待处理',
    actor,
    createdAt: new Date().toISOString(),
  };
  updated.issues = [...(updated.issues || []), issue];
  updated.logs = [
    ...(updated.logs || []),
    { id: `log-${Date.now()}`, action: `标记问题：${type}`, actor, at: new Date().toISOString() },
  ];
  return { batch: updated, issue };
}

export function resolveIssue(batch, issueId, actor = '处理人') {
  const updated = structuredClone(batch);
  const issue = (updated.issues || []).find((item) => item.id === issueId);
  if (!issue) return { batch, resolved: false };
  issue.status = '已解决';
  issue.resolvedBy = actor;
  issue.resolvedAt = new Date().toISOString();
  updated.logs = [
    ...(updated.logs || []),
    { id: `log-${Date.now()}`, action: `解决问题：${issue.type}`, actor, at: new Date().toISOString() },
  ];
  return { batch: updated, resolved: true };
}
