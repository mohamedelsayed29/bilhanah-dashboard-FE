import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { AdminSettings, PublicMenuResponse, PublicPlan } from '@bilhanah/contracts';
import {
  API_URL, authenticator, createAdmin, expectAccessible, expectNoOverflow, makeJpeg, registerOwner, screenshot, uniqueSuffix,
} from './helpers';

// One owner and one administrator per run (registrations and admin sign-ins are rate-limited), shared by the steps below.
test.describe.configure({ mode: 'serial' });
// Each step captures three layouts with axe checks.
test.setTimeout(180_000);

const suffix = uniqueSuffix();
// Digit-free so that searching for it is exact: the API also matches the digits of a query against phone numbers.
const tag = suffix.replace(/\d/g, digit => 'abcdefghij'[Number(digit)]!);
const owner = { email: `payer-${suffix}@e2e-bilhanah.test`, password: 'Feteer-Meshaltet-2026', fullName: 'منى الاختبار', restaurant: `فطاطري منى ${tag}`, subdomain: `pay-${suffix}` };
const admin = { email: `admin-${suffix}@e2e-bilhanah.test`, password: 'Console-Password-2026!' };

let ownerContext: BrowserContext;
let adminContext: BrowserContext;
let ownerPage: Page;
let adminPage: Page;
let code: ReturnType<typeof authenticator>;
/** Bearer token of the admin session (kept current from sign-in and refresh responses), to restore settings afterwards. */
let adminToken: string | null = null;
let originalSettings: AdminSettings | null = null;
let prices: Record<string, number> = {};
const paymentIds: string[] = [];
const errors: string[] = [];

const arPrice = (piastres: number) => `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(piastres / 100)} ج.م`;

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}

function apiCall(page: Page, method: string, path: RegExp) {
  return page.waitForResponse(response => response.request().method() === method && path.test(new URL(response.url()).pathname));
}

test.beforeAll(async ({ browser }) => {
  ({ context: ownerContext, page: ownerPage } = await newPage(browser));
  ({ context: adminContext, page: adminPage } = await newPage(browser));
  adminPage.on('response', async response => {
    if (/\/v1\/auth\/(admin\/login|refresh)$/.test(new URL(response.url()).pathname) && response.ok()) {
      adminToken = ((await response.json()) as { accessToken: string }).accessToken;
    }
  });
  code = authenticator(createAdmin(admin.email, admin.password).key);
  const plans = (await (await ownerPage.request.get(`${API_URL}/v1/public/plans`)).json()) as PublicPlan[];
  prices = Object.fromEntries(plans.map(plan => [plan.code, plan.priceMonthlyPiastres]));
});

test.afterAll(async () => {
  // Never leave the shared development settings changed, even when a step failed.
  if (adminToken && originalSettings) {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const current = (await (await adminPage.request.get(`${API_URL}/v1/admin/settings`, { headers })).json()) as AdminSettings;
    if (JSON.stringify(current.payment) !== JSON.stringify(originalSettings.payment)) {
      await adminPage.request.put(`${API_URL}/v1/admin/settings/payment`, { headers, data: originalSettings.payment });
    }
    for (const plan of originalSettings.plans) {
      if (current.plans.find(entry => entry.code === plan.code)?.priceMonthlyPiastres !== plan.priceMonthlyPiastres) {
        await adminPage.request.put(`${API_URL}/v1/admin/plans/${plan.code}`, { headers, data: { priceMonthlyPiastres: plan.priceMonthlyPiastres } });
      }
    }
  }
  await ownerContext.close();
  await adminContext.close();
});

async function adminSignIn(page: Page) {
  await page.getByLabel('الإيميل').fill(admin.email);
  await page.getByLabel('كلمة السر', { exact: true }).fill(admin.password);
  await page.getByLabel('كود التحقق').fill(await code.nextCode());
  await page.getByRole('button', { name: 'دخول' }).click();
}

/** Pays from the subscription page and returns the payment id. */
async function pay(page: Page, choice: { plan: string; planCode: string; months: string; monthsCount: number; method: string; reference: string; receipt?: boolean }) {
  // The radios are visually hidden inside their cards (the card is the click target).
  await page.getByRole('radio', { name: new RegExp(`^${choice.plan}،`) }).check({ force: true });
  await page.getByRole('radio', { name: choice.months }).check();
  await expect(page.getByTestId('order-total')).toHaveText(arPrice(prices[choice.planCode]! * choice.monthsCount));
  await page.getByRole('radio', { name: choice.method }).check({ force: true });
  await expect(page.getByTestId('payment-instructions')).toContainText(arPrice(prices[choice.planCode]! * choice.monthsCount));
  await page.getByLabel('رقم العملية').fill(choice.reference);
  if (choice.receipt) {
    const uploaded = apiCall(page, 'POST', /\/v1\/media$/);
    await page.getByTestId('upload-payment_proof').setInputFiles({ name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, 900, 1200) });
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole('button', { name: 'تغيير الصورة' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'معاينة الصورة' })).toHaveAttribute('src', /^blob:/);
  }
  const submitted = apiCall(page, 'POST', /\/v1\/billing\/payments$/);
  await page.getByRole('button', { name: 'ابعت للمراجعة' }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  paymentIds.push(id);
  await expect(page.getByTestId('pending-payment')).toContainText(choice.reference);
  return id;
}

/** AR desktop, AR 390 px and EN desktop captures of the current page, with axe on each. */
async function captureLayouts(page: Page, name: string, ready: () => Promise<void>) {
  await ready();
  await expectAccessible(page, `${name} (ar)`);
  await screenshot(page, `${name}-ar-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready();
  await expectNoOverflow(page, `${name} at 390px`);
  await expectAccessible(page, `${name} (ar, 390px)`);
  // Full-page captures would show the fixed tab bar (and any toast) in the middle of the page.
  const style = await page.addStyleTag({ content: '.tabbar { position: static !important; } .toasts { display: none !important; }' });
  await screenshot(page, `${name}-ar-mobile`);
  await style.evaluate(element => (element as Element).remove());
  await page.setViewportSize({ width: 1440, height: 960 });
  // Through the stored preference and a reload, so open dialogs (deep-linked) come back too.
  await setLanguage(page, 'en');
  await ready();
  await expectAccessible(page, `${name} (en)`);
  await screenshot(page, `${name}-en-desktop`);
  await setLanguage(page, 'ar');
  await ready();
}

async function setLanguage(page: Page, language: 'ar' | 'en') {
  await page.evaluate(value => localStorage.setItem('bilhanah:language:v1', value), language);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
}

test('owner opens the subscription page from the overview and pays with a receipt', async () => {
  await registerOwner(ownerPage, owner);
  await ownerPage.locator('.plan-card').getByRole('link', { name: 'ادفع واشترك' }).click();
  await expect(ownerPage).toHaveURL(/\/subscription$/);
  await expect(ownerPage.getByRole('heading', { level: 1, name: 'الاشتراك' })).toBeVisible();
  await expect(ownerPage.getByTestId('subscription-status')).toContainText('تجربة مجانية');
  // Paying during the trial keeps the remaining trial days.
  await expect(ownerPage.getByTestId('order-summary')).toContainText('أيام التجربة الباقية محفوظة');
  await captureLayouts(ownerPage, 'subscription-choose', async () => {
    await expect(ownerPage.getByRole('heading', { name: /اختار الباقة|Choose a plan/ })).toBeVisible();
  });

  // The reference is required.
  await ownerPage.getByRole('button', { name: 'ابعت للمراجعة' }).click();
  await expect(ownerPage.getByText('اكتب 3 حروف على الأقل.')).toBeVisible();

  const first = await pay(ownerPage, { plan: 'منيو', planCode: 'MENU', months: '٣ شهور', monthsCount: 3, method: 'إنستاباي', reference: `IP-${suffix}-1`, receipt: true });
  await expect(ownerPage.getByTestId('pending-payment')).toContainText(arPrice(prices['MENU']! * 3));
  // The form is hidden while a payment waits for review.
  await expect(ownerPage.getByRole('button', { name: 'ابعت للمراجعة' })).toHaveCount(0);
  // The owner can see their own receipt (authenticated blob download).
  await ownerPage.getByTestId('pending-payment').getByRole('button', { name: 'شوف الإيصال' }).click();
  const receipt = ownerPage.getByRole('dialog', { name: 'إيصال التحويل' });
  await expect(receipt.getByTestId('receipt-image')).toHaveJSProperty('complete', true);
  expect(await receipt.getByTestId('receipt-image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(400);
  await receipt.getByRole('button', { name: 'إغلاق' }).last().click();

  // Withdraw, then send it again.
  await ownerPage.getByRole('button', { name: 'اسحب التحويل' }).click();
  const withdrawn = apiCall(ownerPage, 'DELETE', new RegExp(`/v1/billing/payments/${first}$`));
  await ownerPage.getByRole('dialog', { name: 'تسحب التحويل ده؟' }).getByRole('button', { name: 'اسحبه' }).click();
  expect((await withdrawn).status()).toBe(204);
  await expect(ownerPage.getByTestId('pending-payment')).toHaveCount(0);
  await expect(ownerPage.getByTestId('payment-row').first()).toHaveAttribute('data-status', 'CANCELLED');

  await pay(ownerPage, { plan: 'منيو وطلبات', planCode: 'ORDERS', months: 'شهر واحد', monthsCount: 1, method: 'فودافون كاش', reference: `VC-${suffix}-2`, receipt: true });
  await captureLayouts(ownerPage, 'subscription-pending', async () => {
    await expect(ownerPage.getByTestId('pending-payment')).toBeVisible();
  });
});

test('administrator signs in with an authenticator code', async () => {
  await adminPage.goto('/admin/payments');
  await expect(adminPage).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpayments$/);
  await expect(adminPage.getByRole('heading', { level: 1, name: 'دخول فريق بالهنا' })).toBeVisible();
  const codeInput = adminPage.getByLabel('كود التحقق');
  await expect(codeInput).toHaveAttribute('inputmode', 'numeric');
  await expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
  await captureLayouts(adminPage, 'admin-login', async () => {
    await expect(adminPage.getByRole('heading', { level: 1 })).toBeVisible();
  });

  // A wrong code gets the same answer as a wrong password.
  await adminPage.getByLabel('الإيميل').fill(admin.email);
  await adminPage.getByLabel('كلمة السر', { exact: true }).fill(admin.password);
  await codeInput.fill(code.wrongCode());
  await adminPage.getByRole('button', { name: 'دخول' }).click();
  await expect(adminPage.getByRole('alert')).toContainText('الإيميل أو كلمة السر أو الكود مش صح.');
  await expect(codeInput).toHaveValue('');

  await adminSignIn(adminPage);
  await expect(adminPage).toHaveURL(/\/admin\/payments$/);
  const settings = await adminPage.request.get(`${API_URL}/v1/admin/settings`, { headers: { Authorization: `Bearer ${adminToken}` } });
  originalSettings = (await settings.json()) as AdminSettings;
  await expect(adminPage.locator('.sidebar').getByTestId('pending-count')).toBeVisible();
});

test('overview shows the platform figures', async () => {
  await adminPage.locator('.sidebar').getByRole('link', { name: 'نظرة عامة' }).click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'نظرة عامة' })).toBeVisible();
  await expect(adminPage.getByTestId('kpi-pending')).toHaveAttribute('href', '/admin/payments');
  await expect(adminPage.getByTestId('kpi-mrr')).toContainText('ج.م');
  await captureLayouts(adminPage, 'admin-overview', async () => {
    await expect(adminPage.getByTestId('kpi-total')).toBeVisible();
  });
});

test('approves the payment after checking the receipt; the owner sees the paid period', async () => {
  await adminPage.getByTestId('kpi-pending').click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'التحويلات' })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'مستني المراجعة' })).toHaveAttribute('aria-pressed', 'true');
  const row = adminPage.getByTestId('payment-queue-row').filter({ hasText: owner.restaurant });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`VC-${suffix}-2`);
  await expect(row).toContainText('فودافون كاش');
  await captureLayouts(adminPage, 'admin-payments', async () => {
    await expect(adminPage.getByTestId('payment-queue-row').first()).toBeVisible();
  });

  await row.getByRole('button', { name: `راجع تحويل ${owner.restaurant}` }).click();
  await expect(adminPage).toHaveURL(new RegExp(`view=${paymentIds[1]}`));
  const dialog = adminPage.getByRole('dialog', { name: 'تفاصيل التحويل' });
  const image = dialog.getByTestId('receipt-image');
  await expect(image).toHaveJSProperty('complete', true);
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(400);
  await dialog.getByRole('button', { name: 'كبّر' }).click();
  await expect(dialog.getByRole('button', { name: 'صغّر' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'صغّر' }).click();
  await expect(dialog.getByRole('link', { name: 'افتح بالحجم الكامل' })).toHaveAttribute('href', /^blob:/);
  await captureLayouts(adminPage, 'admin-payment-detail', async () => {
    await expect(adminPage.getByRole('dialog').getByTestId('receipt-image')).toBeVisible();
    await expect(adminPage.getByRole('dialog').getByTestId('receipt-image')).toHaveJSProperty('complete', true);
  });

  await dialog.getByRole('button', { name: 'اقبل التحويل' }).click();
  const confirm = adminPage.getByRole('dialog', { name: 'تأكيد قبول التحويل' });
  await expect(confirm).toContainText(`VC-${suffix}-2`);
  await expect(confirm).toContainText('هتتعمل مدة مدفوعة شهر واحد على باقة منيو وطلبات');
  await expectAccessible(adminPage, 'approve confirmation');
  const approved = apiCall(adminPage, 'POST', /\/approve$/);
  await confirm.getByRole('button', { name: 'اقبل وفعّل' }).click();
  expect((await approved).status()).toBe(200);
  await expect(adminPage.getByText(/اتقبل التحويل\. الاشتراك ساري لحد/)).toBeVisible();
  const result = adminPage.getByRole('dialog', { name: 'تفاصيل التحويل' }).getByTestId('review-result');
  await expect(result).toContainText('المدة المدفوعة:');
  await expect(result).toContainText('راجعه E2E Admin');
  await adminPage.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).last().click();
  await expect(adminPage.getByTestId('payment-queue-row').filter({ hasText: owner.restaurant })).toHaveCount(0);

  await ownerPage.reload();
  const history = ownerPage.getByTestId('payment-row').first();
  await expect(history).toHaveAttribute('data-status', 'APPROVED');
  await expect(history).toContainText('اتقبل');
  await expect(history).toContainText('المدة:');
  await expect(ownerPage.getByTestId('pending-payment')).toHaveCount(0);
});

test('rejects a second payment with a reason the owner then sees', async () => {
  await pay(ownerPage, { plan: 'منيو', planCode: 'MENU', months: 'شهر واحد', monthsCount: 1, method: 'تحويل بنكي', reference: `BT-${suffix}-3` });

  await adminPage.reload();
  await adminPage.getByRole('button', { name: `راجع تحويل ${owner.restaurant}` }).click();
  const dialog = adminPage.getByRole('dialog', { name: 'تفاصيل التحويل' });
  await expect(dialog).toContainText('صاحب المطعم مبعتش صورة إيصال');
  await dialog.getByRole('button', { name: 'ارفض' }).click();
  const reject = adminPage.getByRole('dialog', { name: 'رفض التحويل' });
  await reject.getByLabel('سبب الرفض').fill('لا');
  await reject.getByRole('button', { name: 'ارفض التحويل' }).click();
  await expect(reject.getByText('اكتب 3 حروف على الأقل.')).toBeVisible();
  const reason = 'مفيش تحويل بالرقم ده وصل حساب البنك.';
  await reject.getByLabel('سبب الرفض').fill(reason);
  await expectAccessible(adminPage, 'reject dialog');
  await screenshot(adminPage, 'admin-reject-ar-desktop', false);
  await reject.getByRole('button', { name: 'ارفض التحويل' }).click();
  await expect(adminPage.getByText('اترفض التحويل وبعتنا السبب لصاحب المطعم.')).toBeVisible();
  await expect(adminPage.getByRole('dialog').getByTestId('review-result')).toContainText(reason);
  await adminPage.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).last().click();

  await ownerPage.reload();
  const history = ownerPage.getByTestId('payment-row').first();
  await expect(history).toHaveAttribute('data-status', 'REJECTED');
  await expect(history).toContainText(reason);
  await expect(ownerPage.getByTestId('payment-row')).toHaveCount(3); // withdrawn, approved, rejected
  await captureLayouts(ownerPage, 'subscription-history', async () => {
    await expect(ownerPage.getByTestId('payment-row').first()).toBeVisible();
  });
});

test('searches restaurants, suspends and unsuspends one, and grants a paid period', async () => {
  await adminPage.locator('.sidebar').getByRole('link', { name: 'المطاعم' }).click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'المطاعم' })).toBeVisible();
  const search = adminPage.getByRole('searchbox', { name: 'ابحث في المطاعم' });
  // By owner email (any case) and by subdomain: our restaurant is among the results.
  await search.fill(owner.email.toUpperCase());
  await expect(adminPage).toHaveURL(/query=PAYER-/);
  await expect(adminPage.getByTestId('restaurant-row').filter({ hasText: owner.email })).toHaveCount(1);
  await search.fill(owner.subdomain);
  await expect(adminPage.getByTestId('restaurant-row').filter({ hasText: owner.subdomain })).toHaveCount(1);
  // By name: exactly one.
  await search.fill(tag);
  await expect(adminPage).toHaveURL(new RegExp(`query=${tag}`));
  await expect(adminPage.getByTestId('restaurant-row')).toHaveCount(1);
  await adminPage.getByRole('button', { name: 'موقوف' }).click();
  await expect(adminPage.getByRole('heading', { name: 'مفيش مطاعم مطابقة' })).toBeVisible();
  await adminPage.getByRole('button', { name: 'تجربة مجانية' }).click();
  await expect(adminPage.getByTestId('restaurant-row')).toHaveCount(1);
  await captureLayouts(adminPage, 'admin-restaurants', async () => {
    await expect(adminPage.getByTestId('restaurant-row')).toHaveCount(1);
  });

  await adminPage.getByRole('link', { name: owner.restaurant }).click();
  await expect(adminPage.getByRole('heading', { level: 1, name: owner.restaurant })).toBeVisible();
  await expect(adminPage.getByTestId('restaurant-payment-row')).toHaveCount(3);
  await expect(adminPage.getByTestId('entitlement')).toHaveCount(2); // the trial and the approved period

  // Suspend: the public menu goes offline.
  await adminPage.getByRole('button', { name: 'أوقف المطعم' }).click();
  const suspend = adminPage.getByRole('dialog', { name: `توقف ${owner.restaurant}؟` });
  await suspend.getByLabel('السبب').fill('اختبار الإيقاف التلقائي');
  await suspend.getByRole('button', { name: 'أوقف المطعم' }).click();
  await expect(adminPage.getByText('اتوقف المطعم.')).toBeVisible();
  await expect(adminPage.locator('.alert-error')).toContainText('المطعم موقوف');
  const menu = (await (await adminPage.request.get(`${API_URL}/v1/public/restaurants/${owner.subdomain}/menu`)).json()) as PublicMenuResponse;
  expect(menu.restaurant.availability).toBe('TEMPORARILY_UNAVAILABLE');

  await adminPage.getByRole('button', { name: 'رجّع المطعم' }).click();
  await adminPage.getByRole('dialog', { name: 'ترجّع المطعم؟' }).getByRole('button', { name: 'رجّعه' }).click();
  await expect(adminPage.getByRole('button', { name: 'أوقف المطعم' })).toBeVisible();
  await expect(adminPage.locator('.alert-error')).toHaveCount(0);

  // Grant two months by hand.
  await adminPage.getByRole('button', { name: 'أضف مدة مدفوعة' }).click();
  const grant = adminPage.getByRole('dialog', { name: 'إضافة مدة مدفوعة' });
  await grant.getByLabel('الباقة').selectOption('ADVANCED');
  await grant.getByLabel('عدد الشهور').fill('2');
  await expect(grant).toContainText('شهرين من');
  await grant.getByRole('button', { name: 'أضف المدة' }).click();
  await expect(grant.getByText('اكتب 3 حروف على الأقل.')).toBeVisible();
  await grant.getByLabel('ملاحظة').fill(`دفع كاش في المكتب ${suffix}`);
  await expectAccessible(adminPage, 'grant dialog');
  await grant.getByRole('button', { name: 'أضف المدة' }).click();
  await expect(adminPage.getByText(/اتضافت المدة لحد/)).toBeVisible();
  await expect(adminPage.getByTestId('entitlement')).toHaveCount(3);
  await expect(adminPage.getByTestId('entitlement').first()).toContainText(`دفع كاش في المكتب ${suffix}`);
  await expect(adminPage.getByTestId('entitlement').first()).toContainText('أضافها E2E Admin');
  await captureLayouts(adminPage, 'admin-restaurant', async () => {
    await expect(adminPage.getByTestId('entitlement')).toHaveCount(3);
  });
});

test('edits payment details and a plan price, then puts them back', async () => {
  await adminPage.locator('.sidebar').getByRole('link', { name: 'الإعدادات' }).click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'الإعدادات' })).toBeVisible();
  const notes = adminPage.getByLabel('ملاحظات بالإنجليزي');
  const originalNotes = await notes.inputValue();
  await notes.fill(`E2E note ${suffix}`);
  await adminPage.getByRole('button', { name: 'احفظ بيانات الدفع' }).click();
  await expect(adminPage.getByText('اتحفظت بيانات الدفع')).toBeVisible();
  // Clearing a method's details hides it (shown live before saving).
  const vodafone = adminPage.getByLabel('رقم المحفظة');
  const originalNumber = await vodafone.inputValue();
  await vodafone.fill('');
  await expect(adminPage.locator('.method-group').filter({ hasText: 'فودافون كاش' })).toContainText('مخفية');
  await vodafone.fill(originalNumber);
  await notes.fill(originalNotes);
  await adminPage.getByRole('button', { name: 'احفظ بيانات الدفع' }).click();
  await expect(adminPage.getByRole('button', { name: 'احفظ بيانات الدفع' })).toBeDisabled();

  const menuPrice = adminPage.getByTestId('plan-price-MENU');
  const original = prices['MENU']!;
  await menuPrice.getByRole('textbox').fill(String(original / 100 + 15.5));
  await menuPrice.getByRole('button', { name: 'احفظ' }).click();
  await expect(menuPrice).toContainText(arPrice(original + 1550));
  const plans = (await (await adminPage.request.get(`${API_URL}/v1/public/plans`)).json()) as PublicPlan[];
  expect(plans.find(plan => plan.code === 'MENU')?.priceMonthlyPiastres).toBe(original + 1550);
  await menuPrice.getByRole('textbox').fill(String(original / 100));
  await menuPrice.getByRole('button', { name: 'احفظ' }).click();
  await expect(menuPrice).toContainText(`الحالي: ${arPrice(original)}`);
  await captureLayouts(adminPage, 'admin-settings', async () => {
    await expect(adminPage.getByTestId('plan-price-MENU')).toBeVisible();
  });
});

test('the audit log lists every change in readable words', async () => {
  await adminPage.locator('.sidebar').getByRole('link', { name: 'سجل المراجعة' }).click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'سجل المراجعة' })).toBeVisible();
  const mine = adminPage.getByTestId('audit-row').filter({ hasText: admin.email });
  for (const label of ['قبول تحويل', 'رفض تحويل', 'إيقاف مطعم', 'إرجاع مطعم', 'إضافة مدة مدفوعة', 'تعديل بيانات الدفع', 'تغيير سعر باقة']) {
    await expect(mine.filter({ hasText: label }).first()).toBeVisible();
  }
  await expect(mine.filter({ hasText: 'رفض تحويل' })).toContainText('مفيش تحويل بالرقم ده');
  await expect(mine.filter({ hasText: 'إيقاف مطعم' })).toContainText('اختبار الإيقاف التلقائي');
  await captureLayouts(adminPage, 'admin-audit', async () => {
    await expect(adminPage.getByTestId('audit-row').first()).toBeVisible();
  });
});

test('routes follow the role: owners stay out of the console, administrators out of the owner dashboard', async ({ browser }) => {
  await ownerPage.goto('/admin');
  await expect(ownerPage).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await ownerPage.goto('/admin/payments');
  await expect(ownerPage.getByRole('heading', { level: 1, name: owner.restaurant })).toBeVisible();
  await ownerPage.goto('/admin/login');
  await expect(ownerPage).toHaveURL(/127\.0\.0\.1:\d+\/$/);

  await adminPage.goto('/menu');
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto('/subscription');
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto('/login');
  await expect(adminPage).toHaveURL(/\/admin$/);

  // Signed out: the owner sign-in links to the team sign-in and rejects administrators.
  const { context, page } = await newPage(browser);
  await page.goto('/admin/restaurants');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Frestaurants$/);
  await page.goto('/login');
  await page.getByRole('link', { name: 'ادخل من هنا' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/login');
  await page.getByLabel('الإيميل').fill(admin.email);
  await page.getByLabel('كلمة السر', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('alert')).toContainText('الإيميل أو كلمة السر مش صح.');
  await context.close();

  // Signing out of the console returns to the team sign-in.
  await adminPage.locator('.sidebar').getByRole('link', { name: 'خروج' }).click();
  await expect(adminPage).toHaveURL(/\/admin\/login$/);
  await expect(adminPage.getByText('خرجت من حسابك.')).toBeVisible();
  adminToken = null;
  expect(errors).toEqual([]);
});
