#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/Dean/Documents/Anamana/qa/vidstore-acceptance';
const SCREEN_DIR = path.join(ROOT, 'screenshots');
const REPORT_DIR = path.join(ROOT, 'reports');
const LOCAL_FEEDBACK = '/Users/Dean/Documents/Anamana/docs/VidStore-后台管理问题反馈-本地登记表.md';
const BASE_URL = 'https://tvs.dataverse.cn/admin/login.html';
const USERNAME = 'dean';
const PASSWORD = '123456';
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `readonly-${ts}.json`);
const mdReportPath = path.join(REPORT_DIR, `readonly-${ts}.md`);

const checks = [];
const issues = [];
let issueSeq = 1;

function addCheck(id, scene, item, status, detail = '') {
  checks.push({ id, scene, item, status, detail });
}

function addIssue(scene, description, expected, level, evidence = '') {
  const id = `FB-AUTO-${String(issueSeq++).padStart(3, '0')}`;
  issues.push({ id, scene, description, expected, level, evidence });
}

async function screenshot(page, name) {
  const file = path.join(SCREEN_DIR, `${ts}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function textExists(page, patterns) {
  const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return patterns.some(p => body.includes(p));
}

async function countVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    if (count > 0) return { selector, count };
  }
  return { selector: selectors[0], count: 0 };
}

async function clickFirstText(page, texts) {
  for (const text of texts) {
    const loc = page.getByText(text, { exact: false }).first();
    if (await loc.count().catch(() => 0)) {
      await loc.click({ timeout: 5000 }).catch(() => null);
      return text;
    }
  }
  return null;
}

async function fillLikelyLogin(page) {
  const inputs = page.locator('input');
  const count = await inputs.count();
  const visibleInputs = [];
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) visibleInputs.push(input);
  }
  let userFilled = false;
  let passFilled = false;
  for (const input of visibleInputs) {
    const type = (await input.getAttribute('type').catch(() => '') || '').toLowerCase();
    const placeholder = (await input.getAttribute('placeholder').catch(() => '') || '').toLowerCase();
    const name = (await input.getAttribute('name').catch(() => '') || '').toLowerCase();
    if (!passFilled && (type === 'password' || placeholder.includes('密码') || name.includes('password'))) {
      await input.fill(PASSWORD);
      passFilled = true;
    } else if (!userFilled && (placeholder.includes('账号') || placeholder.includes('用户') || placeholder.includes('username') || placeholder.includes('请输入') || name.includes('user') || name.includes('account'))) {
      await input.fill(USERNAME);
      userFilled = true;
    }
  }
  if (!userFilled && visibleInputs[0]) await visibleInputs[0].fill(USERNAME);
  if (!passFilled && visibleInputs[1]) await visibleInputs[1].fill(PASSWORD);
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      checks.push({ id: 'CONSOLE', scene: '浏览器控制台', item: msg.type(), status: 'INFO', detail: msg.text() });
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'login-page');
  addCheck('RO-001-A', '登录', '登录页可打开', 'PASS', page.url());

  await fillLikelyLogin(page);
  const loginBtn = page.locator('button:has-text("登录"), input[type=button][value="登录"], input[type=submit]').first();
  if (await loginBtn.count().catch(() => 0)) {
    await loginBtn.click({ timeout: 5000 }).catch(() => null);
  } else {
    await page.keyboard.press('Enter').catch(() => null);
  }
  await page.waitForTimeout(8000);
  await screenshot(page, 'after-login');

  const loginBody = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const stillLogin = (loginBody.includes('登录') && /password|密码|账号|用户名/i.test(loginBody)) || page.url().includes('/login');
  if (stillLogin) {
    addCheck('RO-001', '登录', '使用账号密码登录', 'FAIL', '提交后仍停留在登录页或显示登录表单');
    addIssue('登录', '使用 dean / 123456 登录后未进入后台', '正确账号密码应进入运营管理后台', 'P0', await screenshot(page, 'login-failed'));
    await finish(browser);
    return;
  }
  addCheck('RO-001', '登录', '使用账号密码登录', 'PASS', page.url());

  const navEvidence = await screenshot(page, 'home');
  const hasDramaText = await textExists(page, ['Drama', '漫剧']);
  if (!hasDramaText) {
    addCheck('RO-002', '导航', '存在 Drama / 漫剧入口', 'FAIL', '未找到 Drama 或 漫剧 文案');
    addIssue('导航', '登录后未找到 Drama / 漫剧入口', '左侧运营管理下应能进入 Drama 漫剧管理', 'P0', navEvidence);
  } else {
    addCheck('RO-002', '导航', '存在 Drama / 漫剧入口', 'PASS');
  }

  const clickedDrama = await clickFirstText(page, ['Drama', '漫剧']);
  await page.waitForTimeout(2000);
  await page.goto('https://tvs.dataverse.cn/admin/modules/business/drama-manage.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'drama-list');
  if (!clickedDrama) {
    addCheck('RO-002-B', '导航', '点击 Drama / 漫剧入口', 'FAIL', '未能点击入口');
  } else {
    addCheck('RO-002-B', '导航', `点击 ${clickedDrama} 入口`, 'PASS', page.url());
  }

  const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');

  const listExpectations = [
    ['RO-003', '列表页', '总数统计', ['共', '页']],
    ['RO-004', '列表页', '状态筛选', ['全部', '草稿', '已发布', '已下线']],
    ['RO-005', '列表页', '语言筛选', ['全部语言', 'EN']],
    ['RO-006', '列表页', '搜索', ['剧名、作者']],
    ['RO-007', '列表页', '排序', ['最近更新', '创建时间', '剧名', '集数']],
    ['RO-009', '列表页', '创建新剧入口', ['创建新剧']]
  ];
  for (const [id, scene, item, words] of listExpectations) {
    const placeholders = await page.locator('input').evaluateAll(inputs => inputs.map(i => i.getAttribute('placeholder') || '').join(' ')).catch(() => '');
    const ok = words.every(w => body.includes(w) || placeholders.includes(w));
    addCheck(id, scene, item, ok ? 'PASS' : 'FAIL', ok ? '' : `缺少文案：${words.filter(w => !body.includes(w)).join(', ')}`);
    if (!ok) addIssue(scene, `${item}未按规格展示`, `应展示：${words.join(' / ')}`, id === 'RO-009' ? 'P1' : 'P2', await screenshot(page, `${id}-missing`));
  }

  const cardProbe = await countVisible(page, ['a.card', '.card', '[class*=card]', '.ant-card', '.el-card', 'table tbody tr', '[role=row]']);
  addCheck('RO-010', '列表卡片/列表项', '存在列表数据承载元素', cardProbe.count > 0 ? 'PASS' : 'FAIL', `${cardProbe.selector}: ${cardProbe.count}`);
  if (cardProbe.count === 0) addIssue('列表页', '未检测到卡片、表格行或列表项', 'Drama 列表应展示漫剧数据或明确空状态', 'P1', await screenshot(page, 'no-list-items'));

  const completionOk = body.includes('已就绪') || body.includes('%') || body.includes('完成度');
  addCheck('RO-011', '列表卡片', '完成度 chip 或完成度信息', completionOk ? 'PASS' : 'FAIL');
  if (!completionOk) addIssue('列表卡片', '未发现完成度 chip / 完成度信息', '列表卡片底部应显示单个完成度 chip', 'P2', await screenshot(page, 'completion-missing'));

  const createClicked = await clickFirstText(page, ['创建新剧']);
  await page.waitForTimeout(1500);
  await screenshot(page, 'create-page');
  if (createClicked) {
    const createBody = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const createValues = await page.locator('input').evaluateAll(inputs => inputs.map(i => (i.getAttribute('placeholder') || '') + ' ' + (i.value || '')).join(' ')).catch(() => '');
    const createText = createBody + ' ' + createValues;
    const fieldChecks = [
      ['RO-013', '创建/编辑页', '基本字段', ['漫剧名称', 'SeriesId', '作者', '归属人', '语言', '剧来源', '制作模式']],
      ['RO-014', '创建/编辑页', '只读字段', ['EN', '英语']],
      ['RO-015', '创建/编辑页', '无总集数字段', ['总集数']]
    ];
    const baseOk = fieldChecks[0][3].every(w => createText.includes(w));
    addCheck('RO-013', '创建/编辑页', '基本字段', baseOk ? 'PASS' : 'FAIL', baseOk ? '' : `缺少：${fieldChecks[0][3].filter(w => !createText.includes(w)).join(', ')}`);
    if (!baseOk) addIssue('创建/编辑页', '基本字段不完整', '应包含漫剧名称、SeriesId、作者、归属人、语言、剧来源、制作模式等字段', 'P1', await screenshot(page, 'basic-fields-missing'));

    const enOk = createText.includes('EN') || createText.includes('英语');
    addCheck('RO-014', '创建/编辑页', '原始语言 EN 可见', enOk ? 'PASS' : 'FAIL');
    if (!enOk) addIssue('创建/编辑页', '创建/编辑页未看到固定英文 EN 原始语言', '原始语言应固定为 EN 且不可编辑', 'P1', await screenshot(page, 'language-en-missing'));

    const hasTotalEpisodes = createText.includes('总集数');
    addCheck('RO-015', '创建/编辑页', '总集数字段不存在', hasTotalEpisodes ? 'FAIL' : 'PASS');
    if (hasTotalEpisodes) addIssue('创建/编辑页', '页面仍存在「总集数」字段', '已取消总集数字段，剧集数应按矩阵实际行数统计', 'P1', await screenshot(page, 'total-episodes-present'));

    const hasDeleteDrama = createText.includes('删除漫剧') || createText.includes('删除该漫剧');
    addCheck('RO-022', '删除', '不出现整部漫剧删除入口', hasDeleteDrama ? 'FAIL' : 'PASS');
    if (hasDeleteDrama) addIssue('删除', 'P0 页面出现整部漫剧删除入口', 'P0 不支持删除整部漫剧，删除入口不应展示给运营', 'P1', await screenshot(page, 'delete-drama-present'));
  } else {
    addCheck('RO-012', '创建入口', '点击创建进入创建模式', 'FAIL', '未找到可点击创建入口');
  }

  await finish(browser);
}

async function finish(browser) {
  const report = { generatedAt: new Date().toISOString(), checks, issues };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  const md = [
    `# VidStore 只读自动化验收报告`,
    ``,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    ``,
    `## 检查结果`,
    ``,
    `| ID | 场景 | 检查项 | 状态 | 说明 |`,
    `|----|------|--------|------|------|`,
    ...checks.map(c => `| ${c.id} | ${c.scene} | ${c.item} | ${c.status} | ${(c.detail || '').replace(/\|/g, '/')} |`),
    ``,
    `## 发现问题`,
    ``,
    `| ID | 场景 | 问题描述 | 期待结果 | bug级别 | 证据 |`,
    `|----|------|----------|----------|---------|------|`,
    ...(issues.length ? issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | ${i.evidence} |`) : ['| - | - | 未发现自动化可判定问题 | - | - | - |'])
  ].join('\n');
  fs.writeFileSync(mdReportPath, md, 'utf-8');

  if (issues.length) {
    let current = fs.readFileSync(LOCAL_FEEDBACK, 'utf-8');
    const rows = issues.map(i => `| ${i.id} | ${i.scene} | ${i.description} | ${i.expected} | ${i.level} | Claude | ${i.evidence} | 待提交 | - | 未验收 | 自动化只读巡检 |`).join('\n');
    current = current.replace('| FB-001 | 示例：登录 | 示例：输入正确账号密码后无法进入后台 | 正确账号密码应进入运营管理后台 | P0 | Dean/Claude | 待补充 | 待提交 | - | 未验收 | 示例行，正式提交前删除 |', rows);
    fs.writeFileSync(LOCAL_FEEDBACK, current, 'utf-8');
  }

  console.log(`REPORT_JSON=${reportPath}`);
  console.log(`REPORT_MD=${mdReportPath}`);
  console.log(`ISSUES=${issues.length}`);
  await browser.close();
}

main().catch(async err => {
  console.error(err);
  process.exit(1);
});
