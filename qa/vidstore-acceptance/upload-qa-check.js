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
const VIDEO_PATH = '/Users/Dean/Downloads/竖屏 Twinborn- The Blood Queen and her Hunter/竖屏 无字幕/24.mp4';
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `upload-qa-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `upload-qa-${ts}.md`);
const checks = [];
const issues = [];
let issueSeq = 1;
function addCheck(id, scene, item, status, detail = '') { checks.push({ id, scene, item, status, detail }); }
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-UPLOAD-${String(issueSeq++).padStart(3, '0')}`;
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
async function clickButton(page, name) {
  const loc = page.getByRole('button', { name, exact: true }).first();
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}
async function selectFirstNonEmptyVisible(page, index) {
  const select = page.locator('select:visible').nth(index);
  const ok = await select.count().catch(() => 0);
  if (!ok) return null;
  await select.selectOption({ index: 1 }).catch(() => null);
  return select.locator('option').nth(1).innerText().catch(() => 'selected');
}
async function createDraft(page) {
  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await clickButton(page, '创建新剧');
  await page.waitForTimeout(1000);
  const title = `QA Upload Claude ${Date.now().toString().slice(-5)}`;
  await page.locator('input[placeholder="请输入漫剧名称"]').fill(title);
  await page.locator('button').filter({ hasText: /^保存$/ }).first().click();
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
    addCheck('UP-001', '登录', '登录成功', 'FAIL');
    addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
    return finish(browser, '');
  }
  addCheck('UP-001', '登录', '登录成功', 'PASS');

  const title = await createDraft(page);
  await screenshot(page, 'draft-created');
  const draftText = await bodyText(page);
  const draftOk = draftText.includes('编辑漫剧') && draftText.includes('草稿') && draftText.includes('已保存');
  addCheck('UP-002', '准备数据', '创建草稿测试剧', draftOk ? 'PASS' : 'FAIL', title);
  if (!draftOk) addIssue('准备数据', '无法创建草稿测试剧', '应能创建草稿测试剧用于上传验收', 'P1', await screenshot(page, 'draft-create-failed'));

  const coverExists = fs.existsSync(COVER_PATH);
  addCheck('UP-003', '测试资源', '封面图片存在', coverExists ? 'PASS' : 'FAIL', COVER_PATH);
  if (!coverExists) addIssue('测试资源', '缺少封面测试图片', '应有可上传 jpg/png/webp 封面图', 'P2', '');

  if (coverExists) {
    const fileInputsBefore = await page.locator('input[type=file]').count().catch(() => 0);
    const coverInput = page.locator('input[type=file]').nth(0);
    if (fileInputsBefore > 0) {
      await coverInput.setInputFiles(COVER_PATH).catch(() => null);
      await page.waitForTimeout(5000);
      await screenshot(page, 'after-cover-upload');
      const t = await bodyText(page);
      const coverOk = t.includes('预览') || t.includes('重新上传') || t.includes('上传成功') || !t.includes('点击上传封面');
      addCheck('UP-004', '封面上传', '上传封面后出现预览/重新上传', coverOk ? 'PASS' : 'FAIL', t.slice(0, 200).replace(/\n/g, ' / '));
      if (!coverOk) addIssue('封面上传', '上传封面后未出现预览或重新上传状态', '封面上传成功后应显示缩略图，并提供预览/重新上传', 'P2', await screenshot(page, 'cover-upload-failed'));
    } else {
      addCheck('UP-004', '封面上传', '封面文件控件存在', 'FAIL');
      addIssue('封面上传', '未找到封面文件上传控件', '素材管理应支持上传静态封面', 'P2', await screenshot(page, 'cover-input-missing'));
    }
  }

  await page.locator('button').filter({ hasText: /^保存$/ }).first().click().catch(() => null);
  await page.waitForTimeout(2500);

  await page.getByRole('button', { name: '剧集管理' }).click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await screenshot(page, 'episodes-empty-before-video');
  const episodeText = await bodyText(page);
  const bulkOk = episodeText.includes('批量添加剧集') && episodeText.includes('批量上传字幕');
  addCheck('UP-005', '剧集管理', '批量入口存在', bulkOk ? 'PASS' : 'FAIL');
  if (!bulkOk) addIssue('剧集管理', '剧集管理缺少批量添加/批量上传字幕入口', '剧集管理应提供批量添加剧集和批量上传字幕', 'P2', await screenshot(page, 'bulk-entry-missing'));

  const videoExists = fs.existsSync(VIDEO_PATH);
  addCheck('UP-006', '测试资源', '视频文件存在', videoExists ? 'PASS' : 'FAIL', VIDEO_PATH);
  if (bulkOk && videoExists) {
    await clickButton(page, '批量添加剧集');
    await page.waitForTimeout(1000);
    await screenshot(page, 'batch-video-panel');
    // Target the video upload input specifically — avoid subtitle panel's .srt-only input
    // Strategy: find a visible file input that accepts video/mp4 (or has no accept restriction)
    const allInputs = page.locator('input[type=file]');
    const fileInputs = await allInputs.count().catch(() => 0);
    let uploadInput = null;
    for (let i = fileInputs - 1; i >= 0; i--) {
      const inp = allInputs.nth(i);
      const accept = await inp.getAttribute('accept').catch(() => '');
      if (!accept || accept.includes('mp4') || accept.includes('video')) {
        uploadInput = inp;
        break;
      }
    }
    if (!uploadInput) uploadInput = allInputs.last();
    if (fileInputs > 0) {
      await uploadInput.setInputFiles(VIDEO_PATH).catch(() => null);
      await page.waitForTimeout(4000);
      await screenshot(page, 'after-video-selected');
      const selectedText = await bodyText(page);
      const parseOk = !selectedText.includes('仅支持 SRT') && !selectedText.includes('可上传 0 个') && (selectedText.includes('24.mp4') || selectedText.includes('第24集') || selectedText.includes('已匹配'));
      addCheck('UP-007', '批量添加剧集', '视频文件解析预览', parseOk ? 'PASS' : 'FAIL', selectedText.slice(0, 300).replace(/\n/g, ' / '));
      if (!parseOk) addIssue('批量添加剧集', '选择 24.mp4 后未看到集数解析预览', '选择 MP4 后应显示匹配结果并识别为第 24 集', 'P2', await screenshot(page, 'video-parse-failed'));

      const confirmClicked = await clickButton(page, '确认上传') || await clickButton(page, '确认') || await clickButton(page, '开始上传');
      await page.waitForTimeout(8000);
      await screenshot(page, 'after-video-confirm');
      const afterUploadText = await bodyText(page);
      const uploadStarted = confirmClicked && !afterUploadText.includes('还没有剧集') && !afterUploadText.includes('仅支持 SRT') && (afterUploadText.includes('第24集') || afterUploadText.includes('24.mp4') || afterUploadText.includes('上传中') || afterUploadText.includes('待压缩') || afterUploadText.includes('压缩'));
      addCheck('UP-008', '批量添加剧集', '确认上传后矩阵/状态更新', uploadStarted ? 'PASS' : 'FAIL', afterUploadText.slice(0, 300).replace(/\n/g, ' / '));
      if (!uploadStarted) addIssue('批量添加剧集', '确认上传后未看到第 24 集或上传状态更新', '确认上传后应新增第 24 集行，并显示上传/处理状态', 'P2', await screenshot(page, 'video-upload-not-started'));
    } else {
      addCheck('UP-007', '批量添加剧集', '视频文件控件存在', 'FAIL');
      addIssue('批量添加剧集', '未找到视频文件上传控件', '批量添加剧集应支持选择 MP4 文件', 'P2', await screenshot(page, 'video-input-missing'));
    }
  }

  await finish(browser, title);
}
async function finish(browser, title) {
  const report = { generatedAt: new Date().toISOString(), testTitle: title, checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 封面与单集视频上传 QA 报告', '',
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
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 封面/视频上传 QA |`).join('\n');
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
