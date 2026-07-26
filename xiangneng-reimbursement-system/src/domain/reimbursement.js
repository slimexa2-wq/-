const MONEY_SCALE = 100;

export const BATCH_STATUSES = Object.freeze([
  '待提交',
  '部门制单中',
  '负责人审核中',
  '财务审核中',
  '审核通过',
  '待打款',
  '已打款',
]);

export const ATTACHMENT_TYPES = Object.freeze({
  INVOICE: 'INVOICE',
  PAYMENT_PROOF: 'PAYMENT_PROOF',
});

function toCents(value) {
  return Math.round(Number(value || 0) * MONEY_SCALE);
}

function fromCents(value) {
  return Number((value / MONEY_SCALE).toFixed(2));
}

export function sumMoney(values) {
  return fromCents(values.reduce((sum, value) => sum + toCents(value), 0));
}

export function getBatchTotals(details) {
  return {
    paymentAmount: sumMoney(details.map((item) => item.paymentAmount)),
    invoiceAmount: sumMoney(details.map((item) => item.invoiceAmount)),
    detailCount: details.length,
    reimburserCount: new Set(details.map((item) => item.reimburser)).size,
  };
}

export function canSubmitBatch(paymentAmount, invoiceAmount) {
  const paymentCents = toCents(paymentAmount);
  const invoiceCents = toCents(invoiceAmount);
  const differenceCents = invoiceCents - paymentCents;
  const canSubmit = differenceCents > 0;

  return {
    canSubmit,
    difference: fromCents(Math.max(differenceCents, 0)),
    missingAmount: canSubmit ? 0 : fromCents(Math.max(paymentCents - invoiceCents + 1, 1)),
  };
}

function aggregateBy(details, keySelector, outputFactory) {
  const order = [];
  const groups = new Map();

  for (const detail of details) {
    const key = keySelector(detail);
    if (!groups.has(key)) {
      groups.set(key, { paymentCents: 0, invoiceCents: 0 });
      order.push(key);
    }
    const group = groups.get(key);
    group.paymentCents += toCents(detail.paymentAmount);
    group.invoiceCents += toCents(detail.invoiceAmount);
  }

  return order.map((key) => {
    const group = groups.get(key);
    return outputFactory(key, fromCents(group.paymentCents), fromCents(group.invoiceCents));
  });
}

export function createPurposeSummary(details) {
  return aggregateBy(
    details,
    (detail) => detail.purpose,
    (purpose, paymentAmount, invoiceAmount) => ({ purpose, paymentAmount, invoiceAmount }),
  );
}

export function createTypeSummary(details) {
  return aggregateBy(
    details,
    (detail) => detail.expenseType,
    (expenseType, paymentAmount, invoiceAmount) => ({ expenseType, paymentAmount, invoiceAmount }),
  );
}

export function createPersonSummary(details) {
  const totals = new Map();
  const order = [];

  for (const detail of details) {
    if (!totals.has(detail.reimburser)) {
      totals.set(detail.reimburser, 0);
      order.push(detail.reimburser);
    }
    totals.set(detail.reimburser, totals.get(detail.reimburser) + toCents(detail.paymentAmount));
  }

  return order.map((reimburser) => ({
    reimburser,
    reimbursementTotal: fromCents(totals.get(reimburser)),
  }));
}

export function createDetailSummary(details) {
  return [...details]
    .sort((a, b) => a.sequence - b.sequence)
    .map((detail) => ({
      sequence: detail.sequence,
      reimburser: detail.reimburser,
      purpose: detail.purpose,
      paymentAmount: Number(detail.paymentAmount),
      invoiceAmount: Number(detail.invoiceAmount),
    }));
}

export function createPrintPack(details, attachmentType) {
  return [...details]
    .sort((a, b) => a.sequence - b.sequence)
    .flatMap((detail) =>
      detail.attachments
        .filter((attachment) => attachment.type === attachmentType)
        .map((attachment, index) => ({
          sequence: `${detail.sequence}-${index + 1}`,
          detailSequence: detail.sequence,
          name: attachment.name,
          preview: attachment.preview || null,
          reimburser: detail.reimburser,
          purpose: detail.purpose,
          amount:
            attachmentType === ATTACHMENT_TYPES.INVOICE
              ? Number(detail.invoiceAmount)
              : Number(detail.paymentAmount),
        })),
    );
}

export function validateDetail(detail) {
  const errors = {};
  if (!(Number(detail.paymentAmount) > 0)) errors.paymentAmount = '请输入报销金额';
  if (!String(detail.purpose || '').trim()) errors.purpose = '请输入费用用途';
  if (!(Number(detail.invoiceAmount) > 0)) errors.invoiceAmount = '请确认发票金额';
  if (!String(detail.expenseType || '').trim()) errors.expenseType = '请确认发票类型';
  if (!detail.attachments?.some((item) => item.type === ATTACHMENT_TYPES.INVOICE)) {
    errors.invoiceAttachment = '请上传发票';
  }
  if (!detail.attachments?.some((item) => item.type === ATTACHMENT_TYPES.PAYMENT_PROOF)) {
    errors.paymentAttachment = '请上传付款记录';
  }
  return errors;
}

export function recognizeInvoiceFromName(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  const rules = [
    { keywords: ['餐', 'food', 'meal', 'restaurant'], type: '餐饮类' },
    { keywords: ['车', '交通', 'taxi', 'train', 'travel'], type: '交通类' },
    { keywords: ['住宿', '酒店', 'hotel'], type: '住宿类' },
    { keywords: ['办公', 'office', 'stationery'], type: '办公用品类' },
    { keywords: ['招聘', 'recruit'], type: '招聘费用类' },
    { keywords: ['物资', 'material', 'supply'], type: '项目物资类' },
  ];

  const matched = rules.find((rule) => rule.keywords.some((word) => normalized.includes(word)));
  const amountMatch = normalized.match(/(?:¥|￥)?(\d+(?:\.\d{1,2})?)/);
  return {
    expenseType: matched?.type || '其他',
    invoiceAmount: amountMatch ? Number(amountMatch[1]) : null,
    confidence: matched ? 0.88 : 0.52,
  };
}

export function getAutomaticChecks(details) {
  const totals = getBatchTotals(details);
  const typeSummary = createTypeSummary(details);
  const personSummary = createPersonSummary(details);
  const detailSummary = createDetailSummary(details);
  const typePayment = sumMoney(typeSummary.map((row) => row.paymentAmount));
  const typeInvoice = sumMoney(typeSummary.map((row) => row.invoiceAmount));
  const personPayment = sumMoney(personSummary.map((row) => row.reimbursementTotal));
  const detailPayment = sumMoney(detailSummary.map((row) => row.paymentAmount));
  const detailInvoice = sumMoney(detailSummary.map((row) => row.invoiceAmount));
  const coverage = canSubmitBatch(totals.paymentAmount, totals.invoiceAmount);

  return [
    { label: '表1与表3付款金额一致', status: typePayment === detailPayment ? '通过' : '异常' },
    { label: '表1与表3发票金额一致', status: typeInvoice === detailInvoice ? '通过' : '异常' },
    { label: '表2与批次付款金额一致', status: personPayment === totals.paymentAmount ? '通过' : '异常' },
    { label: '发票金额严格大于付款金额', status: coverage.canSubmit ? '通过' : '异常' },
    {
      label: '付款附件完整性',
      status: details.every((detail) => detail.attachments.some((a) => a.type === ATTACHMENT_TYPES.PAYMENT_PROOF))
        ? '通过'
        : '缺失',
    },
    {
      label: '发票附件完整性',
      status: details.every((detail) => detail.attachments.some((a) => a.type === ATTACHMENT_TYPES.INVOICE))
        ? '通过'
        : '缺失',
    },
  ];
}
