import { defaultBatch, demoUsers, projects } from './data/demo-data.js';
import {
  ATTACHMENT_TYPES,
  recognizeInvoiceFromName,
  validateDetail,
  createTypeSummary,
  createPersonSummary,
  createDetailSummary,
} from './domain/reimbursement.js';
import { addIssue, advanceBatch, resolveIssue } from './domain/workflow.js';
import {
  renderCashierDashboard,
  renderDetailModal,
  renderDetailsScreen,
  renderFinanceDashboard,
  renderMakerDashboard,
  renderManagerDashboard,
  renderProgressScreen,
  renderRecordScreen,
} from './ui/templates.js';

const STORAGE_KEY = 'xiangneng-reimbursement-demo-v2';

function clone(value) {
  return structuredClone(value);
}

function initialState() {
  return {
    role: 'reimburser',
    mobileView: 'record',
    selectedDetailId: null,
    filters: { project: '', type: '', substitute: '' },
    notice: '',
    batch: clone(defaultBatch),
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...initialState(), ...JSON.parse(saved) };
  } catch (error) {
    console.warn('无法读取本地演示数据', error);
  }
  return initialState();
}

let state = loadState();
let invoiceFiles = [];
let paymentFiles = [];

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    state.notice = '附件预览较大，本次修改仅保留在当前页面。正式版需使用对象存储。';
    console.warn('本地存储空间不足', error);
  }
}

function setNotice(message) {
  state.notice = message;
  saveState();
}

function appTemplate() {
  const roleContent = {
    reimburser: () => {
      const views = {
        record: renderRecordScreen({ user: demoUsers.reimburser, projects, batch: state.batch }),
        progress: renderProgressScreen({ batch: state.batch }),
        details: renderDetailsScreen({ batch: state.batch, filters: state.filters }),
      };
      return `<div class="mobile-stage">${views[state.mobileView]()}<nav class="bottom-nav"><button data-mobile-view="record" class="${state.mobileView === 'record' ? 'selected' : ''}"><span>▣</span>记录</button><button data-mobile-view="progress" class="${state.mobileView === 'progress' ? 'selected' : ''}"><span>◷</span>进度</button><button data-mobile-view="details" class="${state.mobileView === 'details' ? 'selected' : ''}"><span>▤</span>明细</button></nav></div>`;
    },
    maker: () => renderMakerDashboard({ batch: state.batch }),
    manager: () => renderManagerDashboard({ batch: state.batch }),
    finance: () => renderFinanceDashboard({ batch: state.batch }),
    cashier: () => renderCashierDashboard({ batch: state.batch }),
  };
  const selectedDetail = state.batch.details.find((item) => item.id === state.selectedDetailId);
  return `<div class="app-layout"><aside class="role-sidebar"><div class="brand"><span>祥</span><div><strong>报销系统</strong><small>交互原型 V0.2</small></div></div><p>演示角色</p>${[
    ['reimburser','报销人端'],['maker','部门制单端'],['manager','负责人审核端'],['finance','财务审核端'],['cashier','付款处理端'],
  ].map(([key,label])=>`<button data-role="${key}" class="${state.role===key?'active':''}">${label}</button>`).join('')}<div class="sidebar-bottom"><button id="reset-demo">重置演示数据</button><small>仅使用合成演示数据</small></div></aside><main class="content">${state.notice ? `<div class="global-notice"><span>${state.notice}</span><button id="dismiss-notice">×</button></div>` : ''}${roleContent[state.role]()}</main>${selectedDetail ? renderDetailModal(selectedDetail, state.batch) : ''}</div>`;
}

function render() {
  document.querySelector('#app').innerHTML = appTemplate();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => {
    state.role = button.dataset.role;
    state.selectedDetailId = null;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-mobile-view]').forEach((button) => button.addEventListener('click', () => {
    state.mobileView = button.dataset.mobileView;
    state.selectedDetailId = null;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => {
    state.mobileView = button.dataset.nav;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-detail-id]').forEach((button) => button.addEventListener('click', () => {
    state.selectedDetailId = button.dataset.detailId;
    render();
  }));
  document.querySelector('#close-detail')?.addEventListener('click', () => {
    state.selectedDetailId = null;
    render();
  });
  document.querySelector('#detail-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'detail-modal') {
      state.selectedDetailId = null;
      render();
    }
  });

  document.querySelector('#reset-demo')?.addEventListener('click', () => {
    state = initialState();
    invoiceFiles = [];
    paymentFiles = [];
    saveState();
    render();
  });
  document.querySelector('#dismiss-notice')?.addEventListener('click', () => {
    state.notice = '';
    saveState();
    render();
  });

  document.querySelector('#filter-project')?.addEventListener('change', (event) => updateFilter('project', event.target.value));
  document.querySelector('#filter-type')?.addEventListener('change', (event) => updateFilter('type', event.target.value));
  document.querySelector('#filter-substitute')?.addEventListener('change', (event) => updateFilter('substitute', event.target.value));

  const invoiceInput = document.querySelector('#invoice-file');
  invoiceInput?.addEventListener('change', (event) => {
    invoiceFiles = [...(event.target.files || [])];
    document.querySelector('#invoice-file-name').textContent = invoiceFiles.length ? invoiceFiles.map((file) => file.name).join('、') : '拍照或选择文件，可多选';
    if (invoiceFiles[0]) {
      const recognition = recognizeInvoiceFromName(invoiceFiles[0].name);
      const form = document.querySelector('#expense-form');
      form.elements.expenseType.value = recognition.expenseType;
      if (recognition.invoiceAmount) form.elements.invoiceAmount.value = recognition.invoiceAmount;
      document.querySelector('#form-message').textContent = `已识别为${recognition.expenseType}${recognition.invoiceAmount ? `，金额¥${recognition.invoiceAmount.toFixed(2)}` : ''}，置信度${Math.round(recognition.confidence * 100)}%，请确认。`;
    }
  });

  const paymentInput = document.querySelector('#payment-file');
  paymentInput?.addEventListener('change', (event) => {
    paymentFiles = [...(event.target.files || [])];
    document.querySelector('#payment-file-name').textContent = paymentFiles.length ? paymentFiles.map((file) => file.name).join('、') : '微信、支付宝或银行记录，可多选';
  });

  document.querySelector('#expense-form')?.addEventListener('submit', handleExpenseSubmit);
  document.querySelector('#submit-batch')?.addEventListener('click', () => changeBatchStatus('部门制单中', demoUsers.reimburser.name));
  document.querySelector('#maker-submit')?.addEventListener('click', () => changeBatchStatus('负责人审核中', demoUsers.maker.name));
  document.querySelector('#manager-approve')?.addEventListener('click', () => changeBatchStatus('财务审核中', demoUsers.manager.name));
  document.querySelector('#finance-approve')?.addEventListener('click', () => changeBatchStatus('审核通过', demoUsers.finance.name));
  document.querySelector('#cashier-pending')?.addEventListener('click', () => changeBatchStatus('待打款', demoUsers.cashier.name));
  document.querySelector('#cashier-paid')?.addEventListener('click', () => changeBatchStatus('已打款', demoUsers.cashier.name));

  document.querySelector('#issue-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = addIssue(state.batch, {
      detailId: data.get('detailId') || null,
      type: String(data.get('type')),
      note: String(data.get('note') || ''),
      actor: demoUsers.finance.name,
    });
    state.batch = result.batch;
    setNotice('问题已标记，批次仍保持当前审核状态。');
    render();
  });
  document.querySelectorAll('[data-resolve-issue]').forEach((button) => button.addEventListener('click', () => {
    const result = resolveIssue(state.batch, button.dataset.resolveIssue, currentActor());
    state.batch = result.batch;
    setNotice(result.resolved ? '问题已标记为已解决。' : '未找到对应问题。');
    render();
  }));

  document.querySelector('#export-tables')?.addEventListener('click', exportAllTables);
  document.querySelector('#export-payment-list')?.addEventListener('click', exportPaymentList);
  document.querySelector('#cashier-export')?.addEventListener('click', exportPaymentList);
  document.querySelectorAll('.print-button').forEach((button) => button.addEventListener('click', () => {
    document.body.dataset.printTarget = button.dataset.print;
    window.print();
    delete document.body.dataset.printTarget;
  }));
}

function currentActor() {
  return demoUsers[state.role]?.name || '系统';
}

function updateFilter(key, value) {
  state.filters[key] = value;
  saveState();
  render();
}

async function fileToAttachment(file, type, id) {
  let preview = null;
  if (file.type.startsWith('image/')) {
    preview = await readImageAsCompressedDataUrl(file);
  }
  return { id, type, name: file.name, preview };
}

function readImageAsCompressedDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.onerror = () => resolve(null);
      image.src = String(reader.result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const nextSequence = Math.max(0, ...state.batch.details.map((item) => item.sequence)) + 1;
  const stamp = Date.now();
  const attachments = [
    ...(await Promise.all(invoiceFiles.map((file, index) => fileToAttachment(file, ATTACHMENT_TYPES.INVOICE, `invoice-${stamp}-${index + 1}`)))),
    ...(await Promise.all(paymentFiles.map((file, index) => fileToAttachment(file, ATTACHMENT_TYPES.PAYMENT_PROOF, `payment-${stamp}-${index + 1}`)))),
  ];
  const detail = {
    id: `detail-${stamp}`,
    sequence: nextSequence,
    reimburser: demoUsers.reimburser.name,
    project: formData.get('project') || null,
    purpose: String(formData.get('purpose') || '').trim(),
    expenseType: String(formData.get('expenseType') || '其他'),
    paymentAmount: Number(formData.get('paymentAmount')),
    invoiceAmount: Number(formData.get('invoiceAmount')),
    isSubstituteInvoice: formData.get('substitute') === 'true',
    attachments,
  };
  const errors = validateDetail(detail);
  const message = document.querySelector('#form-message');
  if (Object.keys(errors).length > 0) {
    message.className = 'form-message error';
    message.textContent = Object.values(errors)[0];
    return;
  }
  state.batch.details.push(detail);
  state.batch.logs = [...(state.batch.logs || []), { id: `log-${stamp}`, action: `新增第${nextSequence}笔费用`, actor: demoUsers.reimburser.name, at: new Date().toISOString() }];
  invoiceFiles = [];
  paymentFiles = [];
  state.mobileView = 'details';
  state.notice = '记录已保存，部门、负责人和财务端已同步更新。';
  saveState();
  render();
}

function changeBatchStatus(nextStatus, actor) {
  const result = advanceBatch(state.batch, nextStatus, actor);
  if (!result.allowed) {
    setNotice(result.reason);
    render();
    return;
  }
  state.batch = result.batch;
  setNotice(`批次已进入“${nextStatus}”。`);
  render();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, sections) {
  const rows = ['\ufeff'];
  for (const section of sections) {
    rows.push(section.title);
    rows.push(section.headers.map(csvEscape).join(','));
    section.rows.forEach((row) => rows.push(row.map(csvEscape).join(',')));
    rows.push('');
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportAllTables() {
  const types = createTypeSummary(state.batch.details);
  const people = createPersonSummary(state.batch.details);
  const details = createDetailSummary(state.batch.details);
  downloadCsv(`${state.batch.name}-部门制单汇总.csv`, [
    { title: '表1-费用类型汇总', headers: ['费用类型','付款金额','发票金额'], rows: types.map((row) => [row.expenseType,row.paymentAmount,row.invoiceAmount]) },
    { title: '表2-报销人汇总', headers: ['报销人','报销总金额'], rows: people.map((row) => [row.reimburser,row.reimbursementTotal]) },
    { title: '表3-报销明细汇总', headers: ['序号','报销人','使用用途','付款金额','发票金额'], rows: details.map((row) => [row.sequence,row.reimburser,row.purpose,row.paymentAmount,row.invoiceAmount]) },
  ]);
  setNotice('三张汇总表已生成 CSV 下载。');
}

function exportPaymentList() {
  const people = createPersonSummary(state.batch.details);
  downloadCsv(`${state.batch.name}-付款清单.csv`, [
    { title: '付款清单', headers: ['报销人','报销总金额','批次','状态'], rows: people.map((row) => [row.reimburser,row.reimbursementTotal,state.batch.name,state.batch.status]) },
  ]);
  setNotice('付款清单已生成 CSV 下载。');
}

render();
