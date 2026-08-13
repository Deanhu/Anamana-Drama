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
const MEDIA_ROOT = '/Users/Dean/Downloads/竖屏 Twinborn- The Blood Queen and her Hunter';
const SUBTITLE_PATH = path.join(MEDIA_ROOT, 'subtitles', '24_en.srt');
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `subtitle-qa-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `subtitle-qa-${ts}.md`);
const checks = [];
const issues = [];
let issueSeq = 1;
function addCheck(id, scene, item, status, detail = '') { checks.push({ id, scene, item, status, detail }); }
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-SUBTITLE-${String(issueSeq++).padStart(3, '0')}`;
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
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}
async function openDramaByText(page, text) {
  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const card = page.locator('.card').filter({ hasText: text }).first();
  if (await card.count().catch(() => 0)) {
    await card.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}
async function createDraft(page) {
  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await clickButton(page, '创建新剧');
  await page.waitForTimeout(1000);
  const title = `QA Subtitle Claude ${Date.now().toString().slice(-5)}`;
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
    addCheck('ST-001', '登录', '登录成功', 'FAIL');
    addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
    return finish(browser, '');
  }
  addCheck('ST-001', '登录', '登录成功', 'PASS');

  const subtitleExists = fs.existsSync(SUBTITLE_PATH);
  addCheck('ST-002', '测试资源', '24_en.srt 存在', subtitleExists ? 'PASS' : 'FAIL', SUBTITLE_PATH);
  if (!subtitleExists) addIssue('测试资源', '缺少 24_en.srt 字幕文件', '应有可用于字幕上传的 SRT 文件', 'P2', '');

  const title = await createDraft(page);
  await page.getByRole('button', { name: '剧集管理' }).click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await screenshot(page, 'subtitle-empty-drama');
  const emptyText = await bodyText(page);
  addCheck('ST-003', '准备数据', '创建无剧集草稿并进入剧集管理', emptyText.includes('还没有剧集') ? 'PASS' : 'FAIL', title);

  if (subtitleExists) {
    const subtitleClicked = await clickButton(page, '批量上传字幕');
    await page.waitForTimeout(1000);
    await screenshot(page, 'subtitle-panel-empty-drama');
    addCheck('ST-004', '批量上传字幕', '字幕上传面板可展开', subtitleClicked ? 'PASS' : 'FAIL');
    if (!subtitleClicked) addIssue('批量上传字幕', '无法展开批量上传字幕面板', '点击批量上传字幕应展开折叠面板', 'P2', await screenshot(page, 'subtitle-panel-not-open'));

    const input = page.locator('input[type=file]').last();
    if (await input.count().catch(() => 0)) {
      await input.setInputFiles(SUBTITLE_PATH).catch(() => null);
      await page.waitForTimeout(3000);
      await screenshot(page, 'subtitle-selected-empty-drama');
      const selectedText = await bodyText(page);
      const seesFile = selectedText.includes('24_en.srt');
      const detectsMissingEpisode = selectedText.includes('不存在') || selectedText.includes('无法匹配') || selectedText.includes('无效') || selectedText.includes('可上传 0') || selectedText.includes('未匹配');
      addCheck('ST-005', '批量上传字幕', '无对应剧集时字幕匹配失败提示', seesFile && detectsMissingEpisode ? 'PASS' : 'FAIL', selectedText.slice(0, 300).replace(/\n/g, ' / '));
      if (!seesFile || !detectsMissingEpisode) addIssue('批量上传字幕', '无对应剧集时未给出明确匹配失败提示', '上传 24_en.srt 但没有第 24 集时，应显示无法匹配/集数不存在且不可上传', 'P2', await screenshot(page, 'subtitle-missing-episode-feedback'));
    } else {
      addCheck('ST-005', '批量上传字幕', '字幕文件控件存在', 'FAIL');
      addIssue('批量上传字幕', '未找到字幕文件上传控件', '批量上传字幕应支持选择 SRT 文件', 'P2', await screenshot(page, 'subtitle-input-missing'));
    }
  }

  const existingOpened = await openDramaByText(page, '厉总别动');
  addCheck('ST-006', '已有剧详情', '打开已有有字幕剧', existingOpened ? 'PASS' : 'FAIL');
  if (existingOpened) {
    await page.getByRole('button', { name: '剧集管理' }).click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
    await screenshot(page, 'existing-episodes-tab');
    const existingText = await bodyText(page);
    const hasSubtitleFile = existingText.includes('1_en.srt') || existingText.includes('_en.srt');
    const hasHoverActions = existingText.includes('预览') && existingText.includes('替换') && existingText.includes('删除');
    addCheck('ST-007', '字幕矩阵', '已上传字幕展示文件名和操作', hasSubtitleFile && hasHoverActions ? 'PASS' : 'FAIL', `file=${hasSubtitleFile}; actions=${hasHoverActions}`);
    if (!hasSubtitleFile || !hasHoverActions) addIssue('字幕矩阵', '已上传字幕未展示完整文件名/预览/替换/删除操作', '已上传字幕单元格应展示文件名，hover 显示预览/替换/删除', 'P2', await screenshot(page, 'subtitle-actions-missing'));
  } else {
    addIssue('已有剧详情', '无法打开已有剧用于字幕矩阵验收', '应能打开已有剧并查看字幕矩阵', 'P1', await screenshot(page, 'existing-drama-open-failed'));
  }

  await finish(browser, title);
}
async function finish(browser, title) {
  const report = { generatedAt: new Date().toISOString(), testTitle: title, checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 字幕专项 QA 报告', '',
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
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 字幕专项 QA |`).join('\n');
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
