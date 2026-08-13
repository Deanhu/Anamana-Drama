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
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';
const TEST_TITLE = `QA Test Claude Twinborn ${new Date().toISOString().slice(0, 10)} ${Date.now().toString().slice(-5)}`;

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `write-qa-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `write-qa-${ts}.md`);
const checks = [];
const issues = [];
let issueSeq = 1;

function addCheck(id, scene, item, status, detail = '') { checks.push({ id, scene, item, status, detail }); }
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-WRITE-${String(issueSeq++).padStart(3, '0')}`;
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
async function text(page) { return page.locator('body').innerText({ timeout: 10000 }).catch(() => ''); }
async function clickText(page, label) {
  const loc = page.getByText(label, { exact: false }).first();
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}
async function firstVisible(page, selector) {
  const loc = page.locator(selector);
  const count = await loc.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const item = loc.nth(i);
    if (await item.isVisible().catch(() => false)) return item;
  }
  return null;
}
async function selectFirstNonEmpty(page, labelText) {
  const labels = page.locator('label');
  const count = await labels.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const label = labels.nth(i);
    const txt = await label.innerText().catch(() => '');
    if (!txt.includes(labelText)) continue;
    const container = label.locator('xpath=ancestor::div[contains(@class,"mb-") or contains(@class,"space") or contains(@class,"grid")][1]');
    const select = container.locator('select').first();
    if (await select.count().catch(() => 0)) {
      const options = await select.locator('option').evaluateAll(os => os.map((o, idx) => ({ idx, value: o.value, text: o.textContent.trim() })).filter(o => o.value || o.idx > 0));
      const opt = options.find(o => o.value) || options[1] || options[0];
      if (opt) {
        await select.selectOption(opt.value || { index: opt.idx }).catch(async () => select.selectOption({ index: opt.idx }));
        return opt.text;
      }
    }
  }
  return null;
}
async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) addCheck('CONSOLE', '浏览器控制台', msg.type(), 'INFO', msg.text());
  });

  if (!await login(page)) {
    addCheck('WR-001', '登录', '登录成功', 'FAIL');
    addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
    return finish(browser);
  }
  addCheck('WR-001', '登录', '登录成功', 'PASS');

  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'list-before-create');

  if (!await clickText(page, '创建新剧')) {
    addCheck('WR-002', '创建', '创建新剧入口可点击', 'FAIL');
    addIssue('创建', '无法点击创建新剧入口', '应能从列表页进入创建模式', 'P1', await screenshot(page, 'create-button-failed'));
    return finish(browser);
  }
  await screenshot(page, 'create-empty');
  const createText = await text(page);
  addCheck('WR-002', '创建', '进入创建模式', createText.includes('创建新漫剧') ? 'PASS' : 'FAIL');

  const nameInput = await firstVisible(page, 'input[placeholder="请输入漫剧名称"]');
  if (nameInput) await nameInput.fill(TEST_TITLE);
  addCheck('WR-003', '创建', '填写漫剧名称', nameInput ? 'PASS' : 'FAIL', TEST_TITLE);
  if (!nameInput) addIssue('创建', '未找到漫剧名称输入框', '创建页应提供漫剧名称输入框', 'P1', await screenshot(page, 'name-input-missing'));

  const saveBtn = page.locator('button').filter({ hasText: /^保存$/ }).first();
  const saveClicked = await saveBtn.count().then(c => c > 0).catch(() => false);
  if (saveClicked) await saveBtn.click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  await screenshot(page, 'after-save-draft');
  const afterSave = await text(page);
  const savedOk = saveClicked && (afterSave.includes('已保存') || afterSave.includes('保存成功') || (!afterSave.includes('未保存') && !afterSave.includes('自动生成')));
  addCheck('WR-004', '保存草稿', '仅填写名称后保存草稿', savedOk ? 'PASS' : 'FAIL', afterSave.slice(0, 200).replace(/\n/g, ' / '));
  if (!savedOk) addIssue('保存草稿', '仅填写漫剧名称后保存失败', '保存草稿仅校验漫剧名称，其余字段允许为空', 'P1', await screenshot(page, 'save-draft-failed'));

  const publishBtn = page.locator('button').filter({ hasText: /^发布$/ }).first();
  const publishClicked = await publishBtn.count().then(c => c > 0).catch(() => false);
  if (publishClicked) await publishBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'publish-validation');
  const publishText = await text(page);
  const validationOk = publishClicked && (publishText.includes('必') || publishText.includes('请选择') || publishText.includes('不能为空') || publishText.includes('封面') || publishText.includes('作者'));
  addCheck('WR-005', '发布校验', '缺必填项发布应拦截', validationOk ? 'PASS' : 'FAIL', publishText.slice(0, 240).replace(/\n/g, ' / '));
  if (!validationOk) addIssue('发布校验', '缺少必填项时发布未出现明确校验提示', '发布应校验名称、作者、剧来源、制作模式、封面等必填项并给出提示', 'P1', await screenshot(page, 'publish-validation-missing'));

  const visibleSelects = page.locator('select:visible');
  const author = await visibleSelects.nth(0).selectOption({ index: 1 }).then(() => visibleSelects.nth(0).locator('option').nth(1).innerText()).catch(() => null);
  const source = await visibleSelects.nth(1).selectOption({ index: 1 }).then(() => visibleSelects.nth(1).locator('option').nth(1).innerText()).catch(() => null);
  const mode = await visibleSelects.nth(2).selectOption({ index: 1 }).then(() => visibleSelects.nth(2).locator('option').nth(1).innerText()).catch(() => null);
  addCheck('WR-006', '必填项', '选择作者/剧来源/制作模式', author && source && mode ? 'PASS' : 'FAIL', `author=${author}; source=${source}; mode=${mode}`);
  if (!author || !source || !mode) addIssue('必填项', '作者/剧来源/制作模式部分必填 select 无法选择', '必填下拉应可选择有效选项', 'P1', await screenshot(page, 'required-select-failed'));

  const synopsis = await firstVisible(page, 'textarea');
  if (synopsis) await synopsis.fill('QA test synopsis for Twinborn: The Blood Queen and her Hunter. This record is created by Claude for acceptance testing.');
  addCheck('WR-007', '必填项', '填写简介', synopsis ? 'PASS' : 'FAIL');

  const videoDir = path.join(MEDIA_ROOT, '竖屏 无字幕');
  const videoFiles = fs.readdirSync(videoDir)
    .filter(f => f.endsWith('.mp4') && !f.startsWith('._'))
    .map(f => ({ f, size: fs.statSync(path.join(videoDir, f)).size }))
    .sort((a, b) => a.size - b.size);
  const coverCandidate = videoFiles[0]?.f || '';
  const videoPath = coverCandidate ? path.join(videoDir, coverCandidate) : '';
  addCheck('WR-008', '测试资源', '可用测试视频资源', videoPath ? 'PASS' : 'FAIL', videoPath);

  await screenshot(page, 'after-fill-required-text');

  await page.getByRole('button', { name: '剧集管理' }).click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await screenshot(page, 'episodes-before-upload');
  const episodeText = await text(page);
  const hasBatchEpisode = episodeText.includes('批量添加剧集');
  const hasBatchSubtitle = episodeText.includes('批量上传字幕');
  addCheck('WR-009', '剧集管理', '批量入口存在', hasBatchEpisode && hasBatchSubtitle ? 'PASS' : 'FAIL', `批量添加=${hasBatchEpisode}; 批量字幕=${hasBatchSubtitle}`);
  if (!hasBatchEpisode || !hasBatchSubtitle) addIssue('剧集管理', '剧集管理缺少批量入口', '应提供批量添加剧集和批量上传字幕入口', 'P2', await screenshot(page, 'batch-entry-missing'));

  if (hasBatchEpisode && videoPath) {
    await clickText(page, '批量添加剧集');
    await page.waitForTimeout(1000);
    await screenshot(page, 'batch-episode-panel');
    const fileInput = page.locator('input[type=file]').last();
    const fileInputCount = await fileInput.count().catch(() => 0);
    if (fileInputCount) {
      await fileInput.setInputFiles(videoPath).catch(() => null);
      await page.waitForTimeout(3000);
      await screenshot(page, 'after-video-file-selected');
      const uploadText = await text(page);
      const parsedOk = uploadText.includes('1.mp4') || uploadText.includes(coverCandidate) || uploadText.includes('第1集') || uploadText.includes('已匹配');
      addCheck('WR-010', '批量添加剧集', '选择视频后有解析/预览反馈', parsedOk ? 'PASS' : 'FAIL', coverCandidate);
      if (!parsedOk) addIssue('批量添加剧集', '选择视频文件后未看到解析或匹配预览', '选择 MP4 后应显示文件匹配结果，支持确认前预览', 'P2', await screenshot(page, 'video-parse-missing'));
    } else {
      addCheck('WR-010', '批量添加剧集', '存在文件选择控件', 'FAIL');
      addIssue('批量添加剧集', '未找到视频文件选择控件', '批量添加剧集应支持选择 MP4 文件', 'P2', await screenshot(page, 'video-input-missing'));
    }
  }

  await finish(browser);
}
async function finish(browser) {
  const report = { generatedAt: new Date().toISOString(), testTitle: TEST_TITLE, checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 写入类 QA 验收报告', '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `测试剧名：${TEST_TITLE}`, '',
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
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 写入类 QA 验收 |`).join('\n');
    current = current.replace('|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|', `|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|\n${rows}`);
    fs.writeFileSync(LOCAL_FEEDBACK, current, 'utf-8');
  }
  console.log(`REPORT_JSON=${reportPath}`);
  console.log(`REPORT_MD=${mdReportPath}`);
  console.log(`TEST_TITLE=${TEST_TITLE}`);
  console.log(`ISSUES=${issues.length}`);
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
