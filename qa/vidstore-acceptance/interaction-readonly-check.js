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
const reportPath = path.join(REPORT_DIR, `interaction-readonly-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `interaction-readonly-${ts}.md`);
const checks = [];
const issues = [];
const failedResources = [];
let issueSeq = 1;

function addCheck(id, scene, item, status, detail = '') { checks.push({ id, scene, item, status, detail }); }
function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-INTERACT-${String(issueSeq++).padStart(3, '0')}`;
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
async function cards(page) {
  return page.locator('.card').evaluateAll(nodes => nodes.map((n, i) => ({
    index: i,
    text: n.innerText,
    title: (n.querySelector('.heading') || n).innerText.split('\n')[0]
  }))).catch(() => []);
}
async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
}
async function clickByText(page, text) {
  const loc = page.getByText(text, { exact: false }).first();
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}
async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('requestfailed', req => failedResources.push({ url: req.url(), failure: req.failure()?.errorText || '' }));
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) addCheck('CONSOLE', '浏览器控制台', msg.type(), 'INFO', msg.text());
  });

  if (!await login(page)) {
    addCheck('IR-001', '登录', '登录成功', 'FAIL');
    addIssue('登录', '无法登录测试服', '正确账号密码应进入后台', 'P0', await screenshot(page, 'login-failed'));
    return finish(browser);
  }
  addCheck('IR-001', '登录', '登录成功', 'PASS');

  await page.goto(DRAMA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'list-initial');
  const initialCards = await cards(page);
  addCheck('IR-002', '列表页', '初始卡片数量', initialCards.length > 0 ? 'PASS' : 'FAIL', `${initialCards.length}`);
  if (!initialCards.length) {
    addIssue('列表页', '初始列表无卡片数据', '列表应显示剧集卡片或明确空状态', 'P1', await screenshot(page, 'initial-no-cards'));
    return finish(browser);
  }

  const firstTitle = initialCards[0].title;
  const secondTitle = initialCards[1]?.title || '';
  const firstText = initialCards[0].text;

  const searchInput = page.locator('input[placeholder*="剧名"], input[placeholder*="作者"]').first();
  if (await searchInput.count().catch(() => 0)) {
    await searchInput.fill(firstTitle.slice(0, Math.min(4, firstTitle.length)));
    await page.waitForTimeout(800);
    const filtered = await cards(page);
    const ok = filtered.length >= 1 && filtered.every(c => c.text.includes(firstTitle) || firstText.includes(c.title));
    addCheck('IR-003', '列表搜索', '搜索剧名后列表过滤', ok ? 'PASS' : 'FAIL', `搜索 ${firstTitle.slice(0, 4)} 后 ${filtered.length} 条`);
    if (!ok) addIssue('列表搜索', '搜索剧名后列表未按预期过滤', '输入剧名关键词后应只展示匹配结果', 'P2', await screenshot(page, 'search-filter-failed'));
    await searchInput.fill('');
    await page.waitForTimeout(800);
  } else {
    addCheck('IR-003', '列表搜索', '搜索输入框存在', 'FAIL');
    addIssue('列表搜索', '未找到搜索输入框', '列表页应支持按剧名和作者搜索', 'P2', await screenshot(page, 'search-input-missing'));
  }

  const publishedClicked = await clickByText(page, '已发布');
  const publishedCards = await cards(page);
  const publishedOk = publishedClicked && publishedCards.length > 0 && publishedCards.every(c => c.text.includes('已发布'));
  addCheck('IR-004', '状态筛选', '已发布筛选生效', publishedOk ? 'PASS' : 'FAIL', `${publishedCards.length} 条`);
  if (!publishedOk) addIssue('状态筛选', '点击已发布后列表未全部为已发布状态', '状态筛选应只展示对应状态剧集', 'P2', await screenshot(page, 'published-filter-failed'));
  await clickByText(page, '全部');

  const sortCreated = await clickByText(page, '创建时间');
  const sortText = await bodyText(page);
  addCheck('IR-005', '排序', '创建时间排序按钮可点击', sortCreated && sortText.includes('创建时间') ? 'PASS' : 'FAIL');
  if (!sortCreated) addIssue('排序', '创建时间排序不可点击', '排序项应支持最近更新/创建时间/剧名/集数', 'P2', await screenshot(page, 'sort-created-failed'));

  const langClicked = await clickByText(page, '全部语言');
  await page.waitForTimeout(500);
  const langText = await bodyText(page);
  const langCodes = ['EN','ID','IT','ES','TR','TH','SV','JA','PT','NL','KO','FIL','FR','RU','DE'];
  const presentCodes = langCodes.filter(code => langText.includes(code));
  const expectedSpecCodes = ['EN','ZH','JA','KO','ES','FR','TH','PT','DE','AR','HI','ID','VI','TR','RU'];
  const missingSpecCodes = expectedSpecCodes.filter(code => !langText.includes(code));
  const extraCodes = presentCodes.filter(code => !expectedSpecCodes.includes(code));
  const langOk = langClicked && missingSpecCodes.length === 0;
  addCheck('IR-006', '语言筛选', '语言下拉语种与规格一致', langOk ? 'PASS' : 'FAIL', `缺少:${missingSpecCodes.join(', ')} 额外:${extraCodes.join(', ')}`);
  if (!langOk) addIssue('语言筛选', `语言筛选语种与规格不一致，缺少 ${missingSpecCodes.join('、')}，额外出现 ${extraCodes.join('、')}`, '语言筛选应为 15 语言：EN/ZH/JA/KO/ES/FR/TH/PT/DE/AR/HI/ID/VI/TR/RU', 'P2', await screenshot(page, 'language-options-mismatch'));

  await clickByText(page, '全部');
  await page.waitForTimeout(500);
  const cardBeforeClick = (await cards(page))[0];
  await page.locator('.card').first().click();
  await page.waitForTimeout(4000);
  await screenshot(page, 'card-detail');
  const detail = await bodyText(page);
  const jumpOk = detail.includes('返回列表') && detail.includes(cardBeforeClick.title);
  addCheck('IR-007', '卡片跳转', '点击卡片进入对应剧详情', jumpOk ? 'PASS' : 'FAIL', cardBeforeClick.title);
  if (!jumpOk) addIssue('卡片跳转', '点击卡片未进入对应剧详情', '点击卡片应进入该剧详情页，并展示对应剧名', 'P1', await screenshot(page, 'card-jump-wrong'));

  const statusExpectations = [];
  if (detail.includes('已发布')) statusExpectations.push('下线');
  if (detail.includes('已下线')) statusExpectations.push('重新发布');
  if (detail.includes('草稿')) statusExpectations.push('发布');
  const missingActions = statusExpectations.filter(w => !detail.includes(w));
  addCheck('IR-008', '状态流转', '当前状态操作按钮符合状态机', missingActions.length ? 'FAIL' : 'PASS', `缺少:${missingActions.join(', ')}`);
  if (missingActions.length) addIssue('状态流转', `当前状态缺少操作按钮：${missingActions.join('、')}`, '已发布应可下线，已下线应可重新发布，草稿应可发布', 'P1', await screenshot(page, 'state-action-missing'));

  const significantFailures = failedResources.filter(r => !r.url.includes('favicon') && !r.url.includes('cdn.tailwindcss.com'));
  addCheck('IR-009', '网络资源', '无关键资源加载失败', significantFailures.length ? 'FAIL' : 'PASS', significantFailures.map(r => `${r.failure} ${r.url}`).join('; ').slice(0, 400));
  if (significantFailures.length) addIssue('网络资源', `存在关键资源加载失败：${significantFailures.map(r => r.url).slice(0, 3).join('；')}`, '页面关键资源应稳定加载，不应出现 ERR_CONNECTION_RESET / EMPTY_RESPONSE', 'P2', await screenshot(page, 'resource-failed'));

  await finish(browser);
}
async function finish(browser) {
  const report = { generatedAt: new Date().toISOString(), checks, issues, failedResources };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    '# VidStore 交互专项只读验收报告', '',
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
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 交互专项只读巡检 |`).join('\n');
    current = current.replace('|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|', `|----|------|----------|----------|---------|--------|-----------|------|----------|----------|------|\n${rows}`);
    fs.writeFileSync(LOCAL_FEEDBACK, current, 'utf-8');
  }
  console.log(`REPORT_JSON=${reportPath}`);
  console.log(`REPORT_MD=${mdReportPath}`);
  console.log(`ISSUES=${issues.length}`);
  await browser.close();
}
main().catch(err => { console.error(err); process.exit(1); });
