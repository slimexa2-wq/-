# 给 Codex 的后续开发顺序

1. 先运行 `npm run verify`，确认现有业务规则不被破坏。
2. 保留 `src/domain/reimbursement.js` 和 `src/domain/workflow.js` 的行为，迁移到 TypeScript 并补齐测试。
3. 将当前 ES Modules UI 迁移到 React/Next.js，小组件拆分，不得把全部页面塞进单一组件。
4. 引入数据库后，汇总表继续由明细计算，不创建可被人工修改的独立汇总数据。
5. 接入附件存储，保持 `INVOICE` 与 `PAYMENT_PROOF` 两种附件类型严格分离。
6. OCR 通过 Provider 接口接入，低置信度允许人工确认；报销人端仍不得出现发票号码、开票日期等无效字段。
7. 实现正式 XLSX/PDF、打印模板、身份认证、部门权限和审计日志。
8. 用 Playwright 或 Codex Browser 完整点击报销人、部门、负责人、财务、付款流程。
9. 全部端到端测试通过后再录制浏览器演示。
