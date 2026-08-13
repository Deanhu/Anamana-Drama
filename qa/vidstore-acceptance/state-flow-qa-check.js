#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/Dean/Documents/Anamana/qa/vidstore-acceptance';
const SCREEN_DIR = path.join(ROOT, 'screenshots');
const REPORT_DIR = path.join(ROOT, 'reports');
const LOCAL_FEEDBACK = '/Users/Dean/Documents/Anamana/docs/VidStore-后台管理问题反馈-本地登记表.md';
const LOGIN_URL = 'https://tvs.dataverse.cn/admin/login.html';
const DRAMA_URL = 'https://tvs.dataverse.cn/admin/modules/business/drama-manage.html';
const COVER_PATH = '/Users/Dean/Documents/Anamana/qa/vidstore-acceptance/assets/twinborn-cover-516x765.jpg';
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `state-qa-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `state-qa-${ts}.md`);
const checks = [];
const issues = [];
let issueSeq = 1;
function addCheck(id, scene, item, status, detail = '') { checks.push({ id, scene, item, status, detail }); }
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-STATE-${String(issueSeq++).padStart(3, '0')}`;
  issues.push({ id, scene, description, expected, level, evidence });
}
async function screenshot(page, name) {
  const file = path.join(SCREEN_DIR, `${ts}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.locator('input[placeholder="账号"]').fill(USERNAME);
  await page.locator('input[placeholder="密码"]').fill(PASSWORD);
  await page.locator('button:has-text("登录")').click();
  await page.waitForTimeout(3000);
  return !page.url().includes('/login');
}
async function bodyText(page) { return page.locator('body').innerText({ timeout: 10000 }).catch(() => ''); }
async function clickExactButton(page, name) {
  const loc = page.getByRole('button', { name, exact: true }).first();
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}
async function selectVisible(page, index) {
  const select = page.locator('select:visible').nth(index);
  if (!await select.count().catch(() => 0)) return null;
  await select.selectOption({ index: 1 }).catch(() => null);
  return select.locator('option').nth(1).innerText().catch(() => 'selected');
}
async function fillAndCreatePublishableDraft(page) {
  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await clickExactButton(page, '创建新剧');
  await page.waitForTimeout(1000);
  const title = `QA State Claude ${Date.now().toString().slice(-5)}`;
  await page.locator('input[placeholder="请输入漫剧名称"]').fill(title);
  await selectVisible(page, 0);
  await selectVisible(page, 1);
  await selectVisible(page, 2);
  const textarea = page.locator('textarea:visible').first();
  if (await textarea.count().catch(() => 0)) await textarea.fill('QA state flow synopsis for acceptance testing.');
  const tagBox = page.locator('.multiselect').first();
  if (await tagBox.count().catch(() => 0)) {
    await tagBox.click().catch(() => null);
    await page.waitForTimeout(800);
    const option = page.locator('.multiselect__option').filter({ hasText: /^Dragon$/ }).first();
    if (await option.count().catch(() => 0)) await option.click().catch(() => null);
  }
  if (fs.existsSync(COVER_PATH) && await page.locator('input[type=file]').count().catch(() => 0)) {
    await page.locator('input[type=file]').nth(0).setInputFiles(COVER_PATH).catch(() => null);
    await page.waitForTimeout(4000);
  }
  await page.locator('button').filter({ hasText: /^保存$/ }).first().click().catch(() => null);
  await page.waitForTimeout(3000);
  return title;
}
async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) addCheck('CONSOLE', '浏览器控制台', msg.type(), 'INFO', msg.text());
  });
  if (!await login(page)) {
    addCheck('SF-001', '登录', '登录成功', 'FAIL');
    addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
    return finish(browser, '');
  }
  addCheck('SF-001', '登录', '登录成功', 'PASS');

  const title = await fillAndCreatePublishableDraft(page);
  await screenshot(page, 'draft-filled');
  let t = await bodyText(page);
  const draftOk = t.includes('草稿') && t.includes('已保存') && t.includes(title);
  addCheck('SF-002', '准备数据', '创建并保存可发布草稿', draftOk ? 'PASS' : 'FAIL', title);
  if (!draftOk) addIssue('状态流转', '未能创建并保存可发布草稿', '应能创建草稿并保存必填信息', 'P1', await screenshot(page, 'draft-not-ready'));

  await clickExactButton(page, '发布');
  await page.waitForTimeout(5000);
  await screenshot(page, 'after-publish');
  t = await bodyText(page);
  const publishOk = t.includes('已发布') || t.includes('发布成功') || t.includes('下线');
  addCheck('SF-003', '状态流转', '草稿发布为已发布', publishOk ? 'PASS' : 'FAIL', t.slice(0, 250).replace(/\n/g, ' / '));
  if (!publishOk) addIssue('状态流转', '草稿点击发布后未变为已发布', '填齐必填项后发布应成功，状态变为已发布', 'P1', await screenshot(page, 'publish-failed'));

  const hasOfflineButton = (await bodyText(page)).includes('下线');
  addCheck('SF-004', '状态流转', '已发布显示下线按钮', hasOfflineButton ? 'PASS' : 'FAIL');
  if (!hasOfflineButton) addIssue('状态流转', '已发布状态未显示下线按钮', '已发布状态应提供下线入口', 'P1', await screenshot(page, 'offline-button-missing'));

  if (hasOfflineButton) {
    await clickExactButton(page, '下线');
    await page.waitForTimeout(1000);
    await screenshot(page, 'offline-confirm');
    const confirmText = await bodyText(page);
    const hasConfirm = confirmText.includes('确定') || confirmText.includes('确认') || confirmText.includes('下线后');
    addCheck('SF-005', '状态流转', '下线二次确认', hasConfirm ? 'PASS' : 'FAIL', confirmText.slice(0, 200).replace(/\n/g, ' / '));
    if (!hasConfirm) addIssue('状态流转', '点击下线未出现二次确认', '下线应弹确认：下线后 App 端将不再展示该漫剧，确定下线？', 'P1', await screenshot(page, 'offline-confirm-missing'));
    if (hasConfirm) {
      const okBtn = page.getByRole('button', { name: /确定|确认/ }).last();
      if (await okBtn.count().catch(() => 0)) await okBtn.click().catch(() => null);
      await page.waitForTimeout(4000);
      await screenshot(page, 'after-offline');
      t = await bodyText(page);
      const offlineOk = t.includes('已下线') || t.includes('重新发布') || t.includes('重新上线');
      addCheck('SF-006', '状态流转', '确认下线后变已下线', offlineOk ? 'PASS' : 'FAIL', t.slice(0, 250).replace(/\n/g, ' / '));
      if (!offlineOk) addIssue('状态流转', '确认下线后状态未变为已下线', '确认下线后状态应变为已下线，操作栏仅显示重新发布', 'P1', await screenshot(page, 'offline-failed'));

      const editable = await page.locator('input:visible:not([readonly]):not([disabled]), textarea:visible:not([readonly]):not([disabled]), select:visible:not([disabled])').count().catch(() => 0);
      const hasRepublish = t.includes('重新发布') || t.includes('重新上线');
      const hasSave = t.includes('保存') && !hasRepublish;
      addCheck('SF-007', '已下线表现', '已下线只读且仅显示重新发布', editable === 0 && hasRepublish ? 'PASS' : 'FAIL', `editable=${editable}; republish=${hasRepublish}`);
      if (editable > 0 || !hasRepublish) addIssue('已下线表现', '已下线状态页面未完全只读或缺少重新发布入口', '已下线详情页应全部字段不可编辑，操作栏仅显示重新发布', 'P1', await screenshot(page, 'offline-readonly-failed'));

      if (hasRepublish) {
        await clickExactButton(page, '重新发布') || await clickExactButton(page, '重新上线');
        await page.waitForTimeout(4000);
        await screenshot(page, 'after-republish');
        t = await bodyText(page);
        const republishOk = t.includes('已发布') || t.includes('下线');
        addCheck('SF-008', '状态流转', '已下线重新发布', republishOk ? 'PASS' : 'FAIL', t.slice(0, 250).replace(/\n/g, ' / '));
        if (!republishOk) addIssue('状态流转', '重新发布后未回到已发布', '已下线点击重新发布并通过校验后应回到已发布', 'P1', await screenshot(page, 'republish-failed'));
      }
    }
  }

  await finish(browser, title);
}
async function finish(browser, title) {
  const report = { generatedAt: new Date().toISOString(), testTitle: title, checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 状态流转专项 QA 报告', '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `测试剧名：${title}`, '',
    '## 检查结果', '',
    '| ID | 场景 | 检查项 | 状态 | 说明 |',
    '|----|------|--------|------|------|',
    ...checks.map(c => `| ${c.id} | ${c.scene} | ${c.item} | ${c.status} | ${(c.detail || '').replace(/\|/g, '/')} |`),
    '', '## 发现问题', '',
    '| ID | 场景 | 问题描述 | 期待结果 | bug级别 | 证据 |',
    '|----|------|----------|----------|---------|------|',
    ...(issues.length ? issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | ${i.evidence} |`) : ['| - | - | 未发现自动化可判定问题 | - | - | - |'])
  ].join('\n');
  fs.writeFileSync(mdReportPath, md, 'utf-8');
  if (issues.length) {
    let current = fs.readFileSync(LOCAL_FEEDBACK, 'utf-8');
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 状态流转专项 QA |`).join('\n');
    current = current.replace('|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|', `|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|\n${rows}`);
    fs.writeFileSync(LOCAL_FEEDBACK, current, 'utf-8');
  }
  console.log(`REPORT_JSON=${reportPath}`);
  console.log(`REPORT_MD=${mdReportPath}`);
  console.log(`TEST_TITLE=${title}`);
  console.log(`ISSUES=${issues.length}`);
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
