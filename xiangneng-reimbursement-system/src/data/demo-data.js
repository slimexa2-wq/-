export const demoUsers = {
  reimburser: { name: '王小明', subsidiary: '成都分公司', department: '现场运营部' },
  maker: { name: '王小华', department: '现场运营部' },
  manager: { name: '李经理', department: '现场运营部' },
  finance: { name: '刘会计', department: '财务部' },
  cashier: { name: '陈出纳', department: '财务部' },
};

export const projects = ['四川时代项目', '京东方项目', '长虹项目'];

function svgPreview(title, subtitle, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" rx="24" fill="#f8fafc"/>
  <rect x="28" y="28" width="584" height="364" rx="18" fill="white" stroke="#dbe4f0"/>
  <circle cx="78" cy="78" r="20" fill="${color}" opacity=".16"/>
  <text x="112" y="88" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#172033">${title}</text>
  <text x="54" y="150" font-family="Arial, sans-serif" font-size="20" fill="#667085">${subtitle}</text>
  <line x1="54" y1="185" x2="586" y2="185" stroke="#e5eaf1"/>
  <text x="54" y="236" font-family="Arial, sans-serif" font-size="18" fill="#344054">合成演示材料，仅用于界面与流程测试</text>
  <rect x="54" y="285" width="220" height="44" rx="10" fill="${color}" opacity=".12"/>
  <rect x="294" y="285" width="150" height="44" rx="10" fill="#eef2f7"/>
  <rect x="464" y="285" width="122" height="44" rx="10" fill="#eef2f7"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const defaultBatch = {
  id: 'batch-2026-07-3',
  name: '2026年7月第三批',
  department: '现场运营部',
  subsidiary: '成都分公司',
  status: '待提交',
  expectedPaymentDate: '2026-07-28',
  issues: [],
  logs: [],
  details: [
    {
      id: 'd-1', sequence: 1, reimburser: '王小明', project: null,
      purpose: '项目员工餐费', expenseType: '餐饮类', paymentAmount: 380, invoiceAmount: 420,
      isSubstituteInvoice: false,
      attachments: [
        { id: 'd1-p1', type: 'PAYMENT_PROOF', name: '付款凭证1.png', preview: svgPreview('付款凭证', '项目员工餐费 ¥380.00', '#2f6fed') },
        { id: 'd1-i1', type: 'INVOICE', name: '餐饮发票1.png', preview: svgPreview('电子发票', '餐饮类 ¥420.00', '#12a36d') },
      ],
    },
    {
      id: 'd-2', sequence: 2, reimburser: '王小明', project: '四川时代项目',
      purpose: '异常处理交通费', expenseType: '交通类', paymentAmount: 126, invoiceAmount: 130,
      isSubstituteInvoice: false,
      attachments: [
        { id: 'd2-p1', type: 'PAYMENT_PROOF', name: '付款凭证2.png', preview: svgPreview('付款凭证', '异常处理交通费 ¥126.00', '#2f6fed') },
        { id: 'd2-i1', type: 'INVOICE', name: '交通发票2.png', preview: svgPreview('电子发票', '交通类 ¥130.00', '#12a36d') },
      ],
    },
    {
      id: 'd-3', sequence: 3, reimburser: '张三', project: '京东方项目',
      purpose: '项目临时物资采购', expenseType: '项目物资类', paymentAmount: 360, invoiceAmount: 400,
      isSubstituteInvoice: true,
      attachments: [
        { id: 'd3-p1', type: 'PAYMENT_PROOF', name: '付款凭证3.png', preview: svgPreview('付款凭证', '项目临时物资采购 ¥360.00', '#2f6fed') },
        { id: 'd3-i1', type: 'INVOICE', name: '物资发票3.png', preview: svgPreview('替票', '项目物资类 ¥400.00', '#f59e0b') },
      ],
    },
    {
      id: 'd-4', sequence: 4, reimburser: '李四', project: null,
      purpose: '员工住宿费', expenseType: '住宿类', paymentAmount: 650, invoiceAmount: 720,
      isSubstituteInvoice: false,
      attachments: [
        { id: 'd4-p1', type: 'PAYMENT_PROOF', name: '付款凭证4.png', preview: svgPreview('付款凭证', '员工住宿费 ¥650.00', '#2f6fed') },
        { id: 'd4-i1', type: 'INVOICE', name: '住宿发票4.png', preview: svgPreview('电子发票', '住宿类 ¥720.00', '#12a36d') },
      ],
    },
  ],
};
