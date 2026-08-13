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
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `detail-readonly-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `detail-readonly-${ts}.md`);
const checks = [];
const issues = [];
let issueSeq = 1;

function addCheck(id, scene, item, status, detail = '') {
  checks.push({ id, scene, item, status, detail });
}
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-DETAIL-${String(issueSeq++).padStart(3, '0')}`;
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
  const ok = !page.url().includes('/login');
  addCheck('DR-001', '登录', '登录成功', ok ? 'PASS' : 'FAIL', page.url());
  if (!ok) addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
  return ok;
}
function hasAll(text, words) {
  return words.every(w => text.includes(w));
}
async function visibleInputValues(page) {
  return page.locator('input,textarea,select').evaluateAll(els => els.map(el => ({
    tag: el.tagName,
    type: el.type || '',
    placeholder: el.getAttribute('placeholder') || '',
    value: el.value || '',
    text: el.innerText || '',
    readonly: !!el.readOnly,
    disabled: !!el.disabled,
    visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  }))).catch(() => []);
}
async function clickTab(page, label) {
  const loc = page.getByText(label, { exact: false }).first();
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}
async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      checks.push({ id: 'CONSOLE', scene: '浏览器控制台', item: msg.type(), status: 'INFO', detail: msg.text() });
    }
  });

  if (!await login(page)) return finish(browser);

  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'list-before-detail');

  const firstCard = page.locator('.card').first();
  const cardCount = await firstCard.count().catch(() => 0);
  addCheck('DR-002', '列表页', '存在可点击剧集卡片', cardCount ? 'PASS' : 'FAIL');
  if (!cardCount) {
    addIssue('列表页', '没有可点击的剧集卡片，无法进入详情验收', '列表应至少存在一条剧集或明确空状态', 'P1', await screenshot(page, 'no-card-for-detail'));
    return finish(browser);
  }

  const firstCardText = await firstCard.innerText().catch(() => '');
  await firstCard.click();
  await page.waitForTimeout(5000);
  await screenshot(page, 'detail-page');
  const detailText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  const values = await visibleInputValues(page);
  const valueText = values.map(v => `${v.placeholder} ${v.value} ${v.text}`).join(' ');
  const allText = `${detailText} ${valueText}`;

  const detailLoaded = detailText.includes('返回列表') && (detailText.includes('编辑') || detailText.includes('创建'));
  addCheck('DR-003', '详情页', '详情页成功加载', detailLoaded ? 'PASS' : 'FAIL', firstCardText.split('\n').slice(0, 3).join(' / '));
  if (!detailLoaded) addIssue('详情页', '点击卡片后未进入详情页', '卡片点击应进入对应剧集详情页', 'P1', await screenshot(page, 'detail-not-loaded'));

  const baseFields = ['漫剧名称', 'SeriesId', '作者', '归属人', '语言', '剧来源', '制作模式', '横竖屏', '类型', '简介', 'Tag'];
  const missingBase = baseFields.filter(w => !allText.includes(w));
  addCheck('DR-004', '详情页-基本信息', '基本字段完整', missingBase.length ? 'FAIL' : 'PASS', missingBase.join(', '));
  if (missingBase.length) addIssue('详情页-基本信息', `基本字段缺失：${missingBase.join('、')}`, '详情页应包含漫剧名称、SeriesId、作者、归属人、语言、剧来源、制作模式、横竖屏、类型、简介、Tag', 'P1', await screenshot(page, 'detail-base-fields-missing'));

  const hasTotalEpisodes = allText.includes('总集数');
  addCheck('DR-005', '详情页-基本信息', '总集数字段不存在', hasTotalEpisodes ? 'FAIL' : 'PASS');
  if (hasTotalEpisodes) addIssue('详情页-基本信息', '详情页仍存在总集数字段', '总集数已取消，应按剧集矩阵实际行数统计', 'P1', await screenshot(page, 'detail-total-episodes-present'));

  const languageInput = values.find(v => (v.value.includes('EN') || v.value.includes('英语')) && v.visible);
  addCheck('DR-006', '详情页-基本信息', '原始语言固定 EN 且只读', languageInput && languageInput.readonly ? 'PASS' : 'FAIL', languageInput ? JSON.stringify(languageInput) : '未找到 EN 输入框');
  if (!languageInput || !languageInput.readonly) addIssue('详情页-基本信息', '原始语言不是固定 EN 只读字段', '语言应固定为 EN / 英语，且不可编辑', 'P1', await screenshot(page, 'detail-language-not-readonly'));

  const ownerVisible = allText.includes('归属人');
  addCheck('DR-007', '详情页-基本信息', '归属人展示', ownerVisible ? 'PASS' : 'FAIL');
  if (!ownerVisible) addIssue('详情页-基本信息', '详情页缺少归属人字段', '归属人应自动填入当前登录账号，并作为只读字段展示', 'P1', await screenshot(page, 'detail-owner-missing'));

  const materialWords = ['素材管理', '静态封面', '其他素材'];
  const missingMaterial = materialWords.filter(w => !allText.includes(w));
  addCheck('DR-008', '详情页-素材管理', '素材区存在', missingMaterial.length ? 'FAIL' : 'PASS', missingMaterial.join(', '));
  if (missingMaterial.length) addIssue('详情页-素材管理', `素材区缺失：${missingMaterial.join('、')}`, '应展示素材管理、静态封面、其他素材（选填）', 'P2', await screenshot(page, 'material-missing'));

  const hasMultilang = ['多语言', 'EN', '翻译', '语言'].some(w => allText.includes(w));
  addCheck('DR-009', '详情页-多语言', '多语言/EN 信息可见', hasMultilang ? 'PASS' : 'FAIL');
  if (!hasMultilang) addIssue('详情页-多语言', '未看到多语言内容管理入口或 EN 信息', '详情页应提供 EN 必传与其他语言管理能力', 'P1', await screenshot(page, 'multilang-missing'));

  const clickedEpisodes = await clickTab(page, '剧集管理');
  await screenshot(page, 'episodes-tab');
  const episodeText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  addCheck('DR-010', '剧集管理', '剧集管理 Tab 可进入', clickedEpisodes && episodeText.includes('批量') ? 'PASS' : 'FAIL');
  if (!clickedEpisodes || !episodeText.includes('批量')) addIssue('剧集管理', '剧集管理 Tab 不可进入或内容未展示', '应可进入剧集管理 Tab，并看到批量添加剧集/批量上传字幕入口', 'P1', await screenshot(page, 'episodes-tab-missing'));

  const episodeWords = ['批量添加剧集', '批量上传字幕'];
  const missingEpisode = episodeWords.filter(w => !episodeText.includes(w));
  addCheck('DR-011', '剧集管理', '批量操作入口', missingEpisode.length ? 'FAIL' : 'PASS', missingEpisode.join(', '));
  if (missingEpisode.length) addIssue('剧集管理', `缺少批量操作入口：${missingEpisode.join('、')}`, '剧集管理应展示批量添加剧集和批量上传字幕', 'P2', await screenshot(page, 'episode-bulk-actions-missing'));

  const hasMatrix = ['视频文件', '字幕', '上传', '第'].some(w => episodeText.includes(w));
  addCheck('DR-012', '剧集管理', '剧集/字幕矩阵信息', hasMatrix ? 'PASS' : 'FAIL');
  if (!hasMatrix) addIssue('剧集管理', '未发现剧集/字幕矩阵信息', '应展示剧集×字幕矩阵或明确空状态', 'P2', await screenshot(page, 'matrix-missing'));

  const hasDeleteDrama = allText.includes('删除漫剧') || episodeText.includes('删除漫剧');
  addCheck('DR-013', '删除', '不出现整部漫剧删除入口', hasDeleteDrama ? 'FAIL' : 'PASS');
  if (hasDeleteDrama) addIssue('删除', '页面出现整部漫剧删除入口', 'P0 不支持删除整部漫剧', 'P1', await screenshot(page, 'delete-drama-present'));

  await finish(browser);
}
async function finish(browser) {
  const report = { generatedAt: new Date().toISOString(), checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 详情页只读验收报告', '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`, '',
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
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 详情页只读自动化巡检 |`).join('\n');
    if (current.includes('| FB-001 | 示例：登录 |')) {
      current = current.replace('| FB-001 | 示例：登录 | 示例：输入正确账号密码后无法进入后台 | 正确账号密码应进入运营管理后台 | P0 | Dean/Claude | 待补充 | 待提交 | - | 未验收 | 示例行，正式提交前删除 |', rows);
    } else {
      current = current.replace('|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|', `|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|\n${rows}`);
    }
    fs.writeFileSync(LOCAL_FEEDBACK, current, 'utf-8');
  }

  console.log(`REPORT_JSON=${reportPath}`);
  console.log(`REPORT_MD=${mdReportPath}`);
  console.log(`ISSUES=${issues.length}`);
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
