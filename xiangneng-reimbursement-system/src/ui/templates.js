import {
  ATTACHMENT_TYPES,
  BATCH_STATUSES,
  canSubmitBatch,
  createDetailSummary,
  createPersonSummary,
  createPrintPack,
  createPurposeSummary,
  createTypeSummary,
  getAutomaticChecks,
  getBatchTotals,
} from '../domain/reimbursement.js';
import { canAdvanceBatch, hasOpenIssues } from '../domain/workflow.js';

const money = (value) => `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const html = (value) => ({ __html: value });
const renderCell = (cell) => cell && typeof cell === 'object' && '__html' in cell ? cell.__html : escapeHtml(cell);

export function statusBadge(status) {
  const tone = ['已打款', '审核通过'].includes(status) ? 'success' : status === '待提交' ? 'warning' : 'info';
  return `<span class="badge badge-${tone}">${escapeHtml(status)}</span>`;
}

export function table(headers, rows, footer = null) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  ${footer ? `<tfoot><tr>${footer.map((cell) => `<td>${renderCell(cell)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}

function issuePanel(batch) {
  const issues = batch.issues || [];
  if (!issues.length) return '<p class="empty-state">当前没有待处理问题</p>';
  return `<div class="issue-list">${issues.map((issue) => {
    const detail = batch.details.find((item) => item.id === issue.detailId);
    return `<article class="issue-item ${issue.status === '已解决' ? 'resolved' : ''}">
      <div><strong>${escapeHtml(issue.type)}</strong><small>${detail ? `第${detail.sequence}笔 · ${escapeHtml(detail.purpose)}` : '批次问题'}${issue.note ? ` · ${escapeHtml(issue.note)}` : ''}</small></div>
      ${issue.status === '已解决' ? '<span class="badge badge-success">已解决</span>' : `<button class="secondary small-button" data-resolve-issue="${escapeHtml(issue.id)}">标记已补充</button>`}
    </article>`;
  }).join('')}</div>`;
}

export function renderRecordScreen({ user, projects, batch }) {
  const recent = [...batch.details].slice(-3).reverse();
  const editable = batch.status === '待提交';
  return `<section class="mobile-shell">
    <header class="mobile-header"><div><h1>记录</h1><p>随手记录费用，系统自动汇总</p></div><span class="mini-logo">祥</span></header>
    ${editable ? '' : `<p class="validation bad">当前批次已提交，新增记录将在下一批次开放。</p>`}
    <form id="expense-form" class="stack" novalidate>
      <section class="panel form-panel">
        <h2>归属与费用</h2>
        <label>报销人<input value="${escapeHtml(user.name)}" disabled></label>
        <label>分子公司<input value="${escapeHtml(user.subsidiary)}" disabled></label>
        <label>所属项目 <span class="optional">选填</span>
          <select name="project" ${editable ? '' : 'disabled'}><option value="">不选择项目</option>${projects.map((p) => `<option>${escapeHtml(p)}</option>`).join('')}</select>
        </label>
        <label>实际报销金额 <span class="required">*</span><div class="money-input"><input name="paymentAmount" inputmode="decimal" placeholder="请输入金额" ${editable ? '' : 'disabled'}><span>元</span></div></label>
        <label>费用用途 <span class="required">*</span><textarea name="purpose" maxlength="50" placeholder="简要说明用途" ${editable ? '' : 'disabled'}></textarea></label>
      </section>
      <section class="panel form-panel">
        <h2>发票信息</h2>
        <label>发票类型 <span class="auto-tag">自动识别</span>
          <select name="expenseType" ${editable ? '' : 'disabled'}><option>其他</option><option>餐饮类</option><option>交通类</option><option>住宿类</option><option>办公用品类</option><option>招聘费用类</option><option>项目物资类</option><option>车辆费用类</option></select>
        </label>
        <label>发票金额 <span class="auto-tag">自动识别</span><div class="money-input"><input name="invoiceAmount" inputmode="decimal" placeholder="识别后可修改" ${editable ? '' : 'disabled'}><span>元</span></div></label>
        <fieldset ${editable ? '' : 'disabled'}><legend>是否替票</legend><label class="radio"><input type="radio" name="substitute" value="false" checked>否</label><label class="radio"><input type="radio" name="substitute" value="true">是</label></fieldset>
        <label class="upload-zone ${editable ? '' : 'disabled-zone'}">上传发票<input id="invoice-file" name="invoiceFile" type="file" accept="image/*,.pdf" multiple ${editable ? '' : 'disabled'}><span id="invoice-file-name">拍照或选择文件，可多选</span></label>
      </section>
      <section class="panel form-panel"><h2>付款信息</h2><label class="upload-zone ${editable ? '' : 'disabled-zone'}">上传付款记录<input id="payment-file" name="paymentFile" type="file" accept="image/*" multiple ${editable ? '' : 'disabled'}><span id="payment-file-name">微信、支付宝或银行记录，可多选</span></label></section>
      <p id="form-message" class="form-message" aria-live="polite"></p>
      <button class="primary full" type="submit" ${editable ? '' : 'disabled'}>保存记录</button>
    </form>
    <section class="recent"><div class="section-title"><h2>最近记录</h2><button class="text-button" data-nav="details">全部</button></div>${recent.map((d) => `<button class="expense-row row-button" data-detail-id="${escapeHtml(d.id)}"><div><strong>${escapeHtml(d.purpose)}</strong><small>${escapeHtml(d.project || '未填写项目')} · ${escapeHtml(d.expenseType)}</small></div><div class="amount">${money(d.paymentAmount)}</div></button>`).join('')}</section>
  </section>`;
}

export function renderProgressScreen({ batch }) {
  const totals = getBatchTotals(batch.details);
  const submit = canSubmitBatch(totals.paymentAmount, totals.invoiceAmount);
  const purpose = createPurposeSummary(batch.details);
  const activeIndex = BATCH_STATUSES.indexOf(batch.status);
  return `<section class="mobile-shell">
    <header class="mobile-header"><div><h1>进度</h1><p>查看报销批次与打款状态</p></div>${statusBadge(batch.status)}</header>
    <section class="panel batch-summary"><div class="summary-heading"><div><small>当前批次</small><h2>${escapeHtml(batch.name)}</h2></div><span>${batch.details.length}笔</span></div>
      <div class="metric-grid"><div><small>报销金额</small><strong>${money(totals.paymentAmount)}</strong></div><div><small>发票金额</small><strong>${money(totals.invoiceAmount)}</strong></div><div><small>覆盖差额</small><strong class="${submit.canSubmit ? 'positive' : 'negative'}">${submit.canSubmit ? '+' + money(submit.difference).slice(1) : '不足' + money(submit.missingAmount).slice(1)}</strong></div></div>
      <p class="validation ${submit.canSubmit ? 'ok' : 'bad'}">${submit.canSubmit ? '发票金额已满足提交条件' : `发票金额不足，至少还差${money(submit.missingAmount)}`}</p>
    </section>
    <section class="panel"><h2>批次进度</h2><ol class="timeline">${BATCH_STATUSES.map((s, i) => `<li class="${i <= activeIndex ? 'active' : ''}"><span>${i < activeIndex ? '✓' : i + 1}</span><div><strong>${s}</strong><small>${i === activeIndex ? '当前状态' : i < activeIndex ? '已完成' : '未开始'}</small></div></li>`).join('')}</ol></section>
    ${(batch.issues || []).length ? `<section class="panel"><h2>待处理事项</h2>${issuePanel(batch)}</section>` : ''}
    <section class="panel"><div class="section-title"><h2>提交核对表</h2><button class="text-button" data-nav="details">查看明细</button></div>${table(['费用用途', '报销金额', '发票金额'], purpose.map((r) => [r.purpose, money(r.paymentAmount), money(r.invoiceAmount)]), ['合计', money(totals.paymentAmount), money(totals.invoiceAmount)])}
    ${batch.status === '待提交' ? `<button id="submit-batch" class="primary full" ${submit.canSubmit ? '' : 'disabled'}>提交本批次</button>` : ''}</section>
  </section>`;
}

export function renderDetailsScreen({ batch, filters = {} }) {
  const projects = [...new Set(batch.details.map((item) => item.project).filter(Boolean))];
  const filtered = batch.details.filter((detail) => {
    if (filters.project && detail.project !== filters.project) return false;
    if (filters.type && detail.expenseType !== filters.type) return false;
    if (filters.substitute === 'yes' && !detail.isSubstituteInvoice) return false;
    if (filters.substitute === 'no' && detail.isSubstituteInvoice) return false;
    return true;
  });
  return `<section class="mobile-shell"><header class="mobile-header"><div><h1>明细</h1><p>查看所有单笔报销记录</p></div><span>${filtered.length}笔</span></header>
  <div class="filter-row"><select id="filter-project"><option value="">全部项目</option>${projects.map((project) => `<option value="${escapeHtml(project)}" ${filters.project === project ? 'selected' : ''}>${escapeHtml(project)}</option>`).join('')}</select><select id="filter-type"><option value="">全部类型</option>${[...new Set(batch.details.map((item) => item.expenseType))].map((type) => `<option value="${escapeHtml(type)}" ${filters.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select><select id="filter-substitute"><option value="">全部票据</option><option value="yes" ${filters.substitute === 'yes' ? 'selected' : ''}>仅替票</option><option value="no" ${filters.substitute === 'no' ? 'selected' : ''}>非替票</option></select></div>
  <section class="detail-list">${[...filtered].sort((a,b)=>b.sequence-a.sequence).map((d) => `<button class="detail-card" data-detail-id="${escapeHtml(d.id)}"><div class="detail-card-head"><div><span class="type-dot"></span><strong>${escapeHtml(d.purpose)}</strong></div>${statusBadge(batch.status)}</div><div class="detail-amount">${money(d.paymentAmount)}</div><dl><div><dt>项目</dt><dd>${escapeHtml(d.project || '未填写')}</dd></div><div><dt>发票类型</dt><dd>${escapeHtml(d.expenseType)}</dd></div><div><dt>发票金额</dt><dd>${money(d.invoiceAmount)}</dd></div><div><dt>是否替票</dt><dd>${d.isSubstituteInvoice ? '是' : '否'}</dd></div></dl></button>`).join('') || '<p class="empty-state">没有符合条件的记录</p>'}</section></section>`;
}

export function renderDetailModal(detail, batch) {
  if (!detail) return '';
  const invoices = detail.attachments.filter((item) => item.type === ATTACHMENT_TYPES.INVOICE);
  const payments = detail.attachments.filter((item) => item.type === ATTACHMENT_TYPES.PAYMENT_PROOF);
  const attachments = (title, items) => `<section><h3>${title}</h3><div class="modal-attachments">${items.map((item) => item.preview ? `<figure><img src="${item.preview}" alt="${escapeHtml(item.name)}"><figcaption>${escapeHtml(item.name)}</figcaption></figure>` : `<div class="file-placeholder">${escapeHtml(item.name)}</div>`).join('')}</div></section>`;
  return `<div class="modal-backdrop" id="detail-modal"><article class="detail-modal"><header><div><small>第${detail.sequence}笔 · ${escapeHtml(batch.name)}</small><h2>${escapeHtml(detail.purpose)}</h2></div><button id="close-detail" aria-label="关闭">×</button></header><dl class="modal-detail-grid"><div><dt>报销人</dt><dd>${escapeHtml(detail.reimburser)}</dd></div><div><dt>项目</dt><dd>${escapeHtml(detail.project || '未填写')}</dd></div><div><dt>付款金额</dt><dd>${money(detail.paymentAmount)}</dd></div><div><dt>发票金额</dt><dd>${money(detail.invoiceAmount)}</dd></div><div><dt>发票类型</dt><dd>${escapeHtml(detail.expenseType)}</dd></div><div><dt>是否替票</dt><dd>${detail.isSubstituteInvoice ? '是' : '否'}</dd></div></dl>${attachments('付款凭证', payments)}${attachments('发票', invoices)}</article></div>`;
}

function printPack(title, items, tone) {
  return `<section class="panel print-section ${tone}" data-print-section="${tone}"><div class="section-title"><h2>${title}</h2><button class="secondary print-button" data-print="${tone}">打印预览</button></div><div class="print-grid">${items.map((item) => `<article class="print-item"><div class="print-label"><strong>${escapeHtml(item.sequence)}</strong><span>${escapeHtml(item.reimburser)} · ${escapeHtml(item.purpose)}</span><b>${money(item.amount)}</b></div>${item.preview ? `<img src="${item.preview}" alt="${escapeHtml(item.name)}">` : `<div class="file-placeholder">${escapeHtml(item.name)}</div>`}</article>`).join('')}</div></section>`;
}

function renderBatchMetrics(batch, totals) {
  return `<section class="metric-bar"><div><small>部门</small><strong>${escapeHtml(batch.department)}</strong></div><div><small>报销总金额</small><strong>${money(totals.paymentAmount)}</strong></div><div><small>发票总金额</small><strong>${money(totals.invoiceAmount)}</strong></div><div><small>报销人数</small><strong>${totals.reimburserCount}人</strong></div><div><small>明细数量</small><strong>${totals.detailCount}笔</strong></div><div><small>当前状态</small>${statusBadge(batch.status)}</div></section>`;
}

export function renderMakerDashboard({ batch }) {
  const totals = getBatchTotals(batch.details);
  const types = createTypeSummary(batch.details);
  const people = createPersonSummary(batch.details);
  const details = createDetailSummary(batch.details);
  const paymentPack = createPrintPack(batch.details, ATTACHMENT_TYPES.PAYMENT_PROOF);
  const invoicePack = createPrintPack(batch.details, ATTACHMENT_TYPES.INVOICE);
  const canSubmit = canAdvanceBatch(batch, '负责人审核中');
  return `<section class="dashboard"><header class="dashboard-header"><div><h1>部门制单端</h1><p>系统自动汇总本部门报销批次，制单人员只核对</p></div><div class="actions"><button id="export-tables" class="secondary">导出表格</button><button id="maker-submit" class="primary" ${canSubmit.allowed ? '' : 'disabled'}>提交负责人审核</button></div></header>
  ${renderBatchMetrics(batch, totals)}
  <div class="three-tables">
    <section class="panel"><h2>表1 · 费用类型汇总</h2>${table(['费用类型','付款金额','发票金额'], types.map(r=>[r.expenseType,money(r.paymentAmount),money(r.invoiceAmount)]),['合计',money(totals.paymentAmount),money(totals.invoiceAmount)])}</section>
    <section class="panel"><h2>表2 · 报销人汇总</h2>${table(['报销人','报销总金额'], people.map(r=>[r.reimburser,money(r.reimbursementTotal)]),['合计',money(totals.paymentAmount)])}</section>
    <section class="panel table-wide"><h2>表3 · 报销明细汇总</h2>${table(['序号','报销人','使用用途','付款金额','发票金额'], details.map(r=>[r.sequence,r.reimburser,r.purpose,money(r.paymentAmount),money(r.invoiceAmount)]),['合计','','',money(totals.paymentAmount),money(totals.invoiceAmount)])}</section>
  </div>${printPack('付款凭证打印包', paymentPack, 'payments')}${printPack('发票打印包', invoicePack, 'invoices')}</section>`;
}

export function renderManagerDashboard({ batch }) {
  const totals = getBatchTotals(batch.details);
  const details = createDetailSummary(batch.details);
  const canApprove = canAdvanceBatch(batch, '财务审核中');
  return `<section class="dashboard"><header class="dashboard-header"><div><h1>负责人审核端</h1><p>审核费用真实性、用途合理性与部门归属</p></div><button id="manager-approve" class="primary" ${canApprove.allowed ? '' : 'disabled'}>整批审核通过</button></header>${renderBatchMetrics(batch, totals)}<section class="panel"><h2>本批次业务明细</h2>${table(['序号','报销人','费用用途','付款金额','发票金额'],details.map(r=>[r.sequence,r.reimburser,r.purpose,money(r.paymentAmount),money(r.invoiceAmount)]),['合计','','',money(totals.paymentAmount),money(totals.invoiceAmount)])}</section><section class="panel"><h2>待处理事项</h2>${issuePanel(batch)}</section><section class="panel"><h2>负责人审核重点</h2><ul class="check-list"><li>费用是否真实发生</li><li>费用用途是否合理</li><li>是否属于本部门业务</li><li>金额是否存在明显异常</li></ul></section></section>`;
}

export function renderFinanceDashboard({ batch }) {
  const totals = getBatchTotals(batch.details);
  const checks = getAutomaticChecks(batch.details);
  const details = createDetailSummary(batch.details);
  const types = createTypeSummary(batch.details);
  const people = createPersonSummary(batch.details);
  const canApprove = canAdvanceBatch(batch, '审核通过');
  return `<section class="dashboard"><header class="dashboard-header"><div><h1>财务审核端</h1><p>系统自动校验，财务重点处理异常并整批审核</p></div><div class="actions"><button id="export-payment-list" class="secondary">生成付款清单</button><button id="finance-approve" class="primary" ${canApprove.allowed ? '' : 'disabled'}>整批审核通过</button></div></header>${renderBatchMetrics(batch, totals)}
  <section class="panel"><h2>自动校验结果</h2><div class="check-grid">${checks.map(c=>`<article class="check-card ${c.status === '通过' ? 'pass' : 'alert'}"><span>${c.status === '通过' ? '✓' : '!'}</span><div><strong>${escapeHtml(c.label)}</strong><small>${escapeHtml(c.status)}</small></div></article>`).join('')}</div></section>
  <section class="panel"><div class="section-title"><h2>问题标记</h2><span>${hasOpenIssues(batch) ? '存在待处理问题' : '无未解决问题'}</span></div><form id="issue-form" class="issue-form"><select name="detailId"><option value="">整个批次</option>${batch.details.map((detail) => `<option value="${escapeHtml(detail.id)}">第${detail.sequence}笔 · ${escapeHtml(detail.purpose)}</option>`).join('')}</select><select name="type"><option>待补发票</option><option>待补付款记录</option><option>金额待核对</option><option>费用类型待确认</option><option>图片不清晰</option><option>其他</option></select><input name="note" placeholder="可选备注"><button class="secondary" type="submit">标记问题</button></form>${issuePanel(batch)}</section>
  <div class="three-tables finance-tables"><section class="panel"><h2>表1</h2>${table(['费用类型','付款金额','发票金额'], types.map(r=>[r.expenseType,money(r.paymentAmount),money(r.invoiceAmount)]),['合计',money(totals.paymentAmount),money(totals.invoiceAmount)])}</section><section class="panel"><h2>表2</h2>${table(['报销人','报销总金额'], people.map(r=>[r.reimburser,money(r.reimbursementTotal)]),['合计',money(totals.paymentAmount)])}</section><section class="panel table-wide"><h2>表3</h2>${table(['序号','报销人','用途','付款金额','发票金额','审核标记'],details.map(r=>[r.sequence,r.reimburser,r.purpose,money(r.paymentAmount),money(r.invoiceAmount),html('<span class="badge badge-success">正常</span>')]),['合计','','',money(totals.paymentAmount),money(totals.invoiceAmount),''])}</section></div></section>`;
}

export function renderCashierDashboard({ batch }) {
  const totals = getBatchTotals(batch.details);
  const people = createPersonSummary(batch.details);
  const toPending = canAdvanceBatch(batch, '待打款');
  const toPaid = canAdvanceBatch(batch, '已打款');
  return `<section class="dashboard"><header class="dashboard-header"><div><h1>付款处理端</h1><p>付款清单直接复用报销人汇总，不再重复录入</p></div><div class="actions"><button id="cashier-pending" class="secondary" ${toPending.allowed ? '' : 'disabled'}>进入待打款</button><button id="cashier-paid" class="primary" ${toPaid.allowed ? '' : 'disabled'}>整批标记已打款</button></div></header>${renderBatchMetrics(batch, totals)}<section class="panel"><div class="section-title"><h2>付款清单</h2><button id="cashier-export" class="secondary">导出清单</button></div>${table(['报销人','报销总金额','付款状态'],people.map(row=>[row.reimburser,money(row.reimbursementTotal),batch.status]),['合计',money(totals.paymentAmount),''])}</section>${batch.paidAt ? `<section class="panel"><h2>付款结果</h2><p class="validation ok">整批已于 ${new Date(batch.paidAt).toLocaleString('zh-CN')} 标记为已打款。</p></section>` : ''}</section>`;
}
