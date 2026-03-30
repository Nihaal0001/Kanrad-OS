const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SS_DIR = '/tmp/qa-screenshots';
fs.mkdirSync(SS_DIR, { recursive: true });

let stepNum = 0;
const log = [];

async function screenshot(page, label) {
  stepNum++;
  const file = path.join(SS_DIR, `step-${String(stepNum).padStart(2,'0')}-${label.replace(/[^a-z0-9]/gi,'-')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[STEP ${stepNum}] ${label} → ${file}`);
  log.push({ step: stepNum, label, file });
  return file;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // ── STEP 1: Login page ──────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await screenshot(page, 'login-page-load');

  // ── STEP 2: Fill login form ─────────────────────────────────
  await page.fill('input[type="email"]', 'nihaalkarthik876@gmail.com');
  await page.fill('input[type="password"]', 'admin1234');
  await screenshot(page, 'login-form-filled');

  // ── STEP 3: Submit login ────────────────────────────────────
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'after-login');

  // ── STEP 4: Dashboard ───────────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'dashboard');

  // ── STEP 5: Orders ──────────────────────────────────────────
  await page.goto(BASE + '/orders', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'orders-list');

  // ── STEP 6: New Order form ──────────────────────────────────
  const newOrderBtn = page.locator('text=Create Order, text=New Order, text=Add Order').first();
  if (await newOrderBtn.isVisible().catch(() => false)) {
    await newOrderBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'new-order-form');
  } else {
    await screenshot(page, 'new-order-btn-not-found');
  }

  // ── STEP 7: Production ──────────────────────────────────────
  await page.goto(BASE + '/production', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'production');

  // ── STEP 8: Warehouse ───────────────────────────────────────
  await page.goto(BASE + '/warehouse', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'warehouse');

  // ── STEP 9: Logistics ───────────────────────────────────────
  await page.goto(BASE + '/logistics', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'logistics');

  // ── STEP 10: Finance ────────────────────────────────────────
  await page.goto(BASE + '/finance', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'finance');

  // ── STEP 11: Finance Invoices ───────────────────────────────
  await page.goto(BASE + '/finance/invoices', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'finance-invoices');

  // ── STEP 12: Finance Expenses ───────────────────────────────
  await page.goto(BASE + '/finance/expenses', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'finance-expenses');

  // ── STEP 13: Inventory ──────────────────────────────────────
  await page.goto(BASE + '/inventory', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'inventory');

  // ── STEP 14: Customers ──────────────────────────────────────
  await page.goto(BASE + '/customers', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'customers');

  // ── STEP 15: Issues ─────────────────────────────────────────
  await page.goto(BASE + '/issues', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'issues');

  // ── STEP 16: Rejections ─────────────────────────────────────
  await page.goto(BASE + '/rejections', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'rejections');

  // ── STEP 17: Production Targets ─────────────────────────────
  await page.goto(BASE + '/production/targets', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'production-targets');

  // ── STEP 18: History ────────────────────────────────────────
  await page.goto(BASE + '/history', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'history');

  // ── STEP 19: Settings ───────────────────────────────────────
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'settings');

  // ── STEP 20: HR ─────────────────────────────────────────────
  await page.goto(BASE + '/hr', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'hr');

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Total steps: ${stepNum}`);
  console.log(`Screenshots saved to: ${SS_DIR}`);
})();
