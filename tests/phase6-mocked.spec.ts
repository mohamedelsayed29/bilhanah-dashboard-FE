import { expect, test } from '@playwright/test';
import type { AdminOverview, AdminPayment, AdminStandOrder, OwnerPayment, Paginated, PlatformStats, ShopSettings, StandOrderStatus } from '@bilhanah/contracts';
import { expectAccessible, expectNoOverflow } from './helpers';
import { adminUser, MockApi, PNG, signedIn } from './mock-api';

// These specs answer every API request themselves (see mock-api.ts), so they run without bilhanah-BE.
// They cover the admin side of Phase 6: stand orders, shop settings, reports and payments.

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(() => expect(errors, 'page errors').toEqual([]));

const arPrice = (piastres: number) => `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(piastres / 100)} ج.م`;

function day(offset: number) {
  return new Date(Date.UTC(2026, 9, 23 - offset)).toISOString().slice(0, 10);
}

const PAYMENT_ID = 'b7a3c1d2-0000-4000-8000-000000000001';

function onlinePayment(status: OwnerPayment['status']): OwnerPayment {
  return {
    id: PAYMENT_ID, planCode: 'ADVANCED', months: 3, amountPiastres: 3 * 70_000, method: 'PAYMOB', reference: 'PMB-778899', payerName: null, status, hasProof: false,
    rejectionReason: null, createdAt: '2026-10-23T08:00:00.000Z', reviewedAt: status === 'APPROVED' ? '2026-10-23T08:01:00.000Z' : null,
    period: status === 'APPROVED' ? { startsAt: '2026-12-01T00:00:00.000Z', endsAt: '2027-03-01T00:00:00.000Z' } : null,
  };
}

const ORDER_ID = 'c1d2e3f4-0000-4000-8000-000000000042';

function standOrder(status: StandOrderStatus = 'NEW', changes: Partial<AdminStandOrder> = {}): AdminStandOrder {
  return {
    id: ORDER_ID, reference: 'S-1042', status, paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID',
    lines: [
      { id: 'line-1', product: 'stand', shape: 'arch', nfc: true, design: 'forest', customColors: null, purpose: 'reviews', brand: 'كشري التحرير', caption: 'رأيك يهمّنا', url: 'https://g.page/r/tahrir/review',
        hasLogo: true, numbered: true, startNumber: 5, quantity: 20, notes: 'اللوجو في النص', unitPricePiastres: 45_000, lineTotalPiastres: 900_000 },
      { id: 'line-2', product: 'stand', shape: 'classic', nfc: false, design: 'signature', customColors: { background: '#112233', ink: '#FFFFFF' }, purpose: 'menu', brand: '', caption: '', url: 'https://tahrir.bilhanah.com/?src=qr',
        hasLogo: false, numbered: false, startNumber: 1, quantity: 2, notes: '', unitPricePiastres: 35_000, lineTotalPiastres: 70_000 },
    ],
    subtotalPiastres: 970_000, deliveryFeePiastres: 6_000, totalPiastres: 976_000, customerName: 'أحمد علي', city: 'القاهرة',
    createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-22T10:00:00.000Z', phone: '+201001234567', email: 'ahmed@example.test', address: '١٢ شارع قصر العيني',
    customerNotes: 'اتصل قبلها', adminNote: null, language: 'ar', paidAt: null,
    statusHistory: [{ status: 'NEW', at: '2026-10-22T10:00:00.000Z', by: null, note: null }],
    ...changes,
  };
}

const overview: AdminOverview = { restaurants: { TRIAL: 4, PAID: 9, INACTIVE: 2, SUSPENDED: 1, total: 16 }, pendingPayments: 1, monthlyRecurringPiastres: 450_000, expiringSoon: 2, newRestaurantsLast30Days: 5, newStandOrders: 3 };

function adminApi() {
  return signedIn(new MockApi(), adminUser).on('GET', '/v1/admin/overview', { json: overview });
}

test.describe('admin stand orders', () => {
  test('queue with filter, search and badge; detail with lines, logo, status moves, cash and note', async ({ page }) => {
    let order = standOrder();
    const api = adminApi()
      .on('GET', '/v1/admin/stand-orders', (_request, url): { json: Paginated<AdminStandOrder> } => ({ json: { items: url.searchParams.get('query') === 'nobody' ? [] : [order], total: 1, page: 1, pageSize: 25 } }))
      .on('GET', `/v1/admin/stand-orders/${ORDER_ID}`, () => ({ json: order }))
      .on('GET', `/v1/admin/stand-orders/${ORDER_ID}/lines/line-1/logo`, { body: PNG, contentType: 'image/png' })
      .on('PATCH', `/v1/admin/stand-orders/${ORDER_ID}/status`, request => {
        const body = request.postDataJSON() as { status: StandOrderStatus; note?: string };
        order = { ...order, status: body.status, statusHistory: [...order.statusHistory, { status: body.status, at: '2026-10-23T09:00:00.000Z', by: 'سارة الإدارة', note: body.note ?? null }] };
        return { json: order };
      })
      .on('PATCH', `/v1/admin/stand-orders/${ORDER_ID}`, request => {
        order = { ...order, ...(request.postDataJSON() as Partial<AdminStandOrder>) };
        if (order.paymentStatus === 'PAID') order.paidAt = '2026-10-23T09:30:00.000Z';
        return { json: order };
      });
    await api.install(page);
    await page.goto('/admin');
    await expect(page.locator('.sidebar').getByTestId('stand-orders-count')).toContainText('٣');
    await expect(page.getByTestId('kpi-stand-orders')).toContainText('٣');
    await page.locator('.sidebar').getByRole('link', { name: /طلبات الستاندات/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'طلبات الستاندات' })).toBeVisible();
    await expect.poll(() => api.callsTo('GET', '/v1/admin/stand-orders')[0]?.search).toBe('?status=open&page=1&pageSize=25');
    await expect(page.getByTestId('stand-order-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'جديد' }).click();
    await expect(page).toHaveURL(/status=NEW/);
    await page.getByLabel('ابحث في طلبات الستاندات').fill('nobody');
    await expect(page.getByTestId('stand-orders-empty')).toBeVisible();
    await expect.poll(() => api.callsTo('GET', '/v1/admin/stand-orders').at(-1)?.search).toBe('?status=NEW&query=nobody&page=1&pageSize=25');
    await page.getByRole('button', { name: 'امسح البحث' }).click();
    await expectAccessible(page, 'stand orders queue');
    await page.getByRole('link', { name: 'تابع الطلب S-1042' }).click();

    const detail = page.getByTestId('stand-order-detail');
    await expect(detail.getByRole('heading', { level: 1 })).toContainText('S-1042');
    await expect(page.getByTestId('customer-phone')).toHaveAttribute('href', 'tel:+201001234567');
    await expect(page.getByTestId('stand-line')).toHaveCount(2);
    await expect(page.getByTestId('stand-line').first()).toContainText('من ٥ لـ ٢٤');
    await expect(page.getByTestId('stand-line').first()).toContainText('أيوه، بشريحة NFC');
    await expect(page.getByTestId('line-url').first()).toHaveAttribute('href', 'https://g.page/r/tahrir/review');
    await expect(page.getByTestId('stand-line').nth(1)).toContainText('#112233');
    await expect(page.getByTestId('line-logo')).toHaveAttribute('src', /^blob:/);
    // Fetched with the admin's bearer token (StrictMode may repeat the first request in development).
    const logoRequests = api.callsTo('GET', `/v1/admin/stand-orders/${ORDER_ID}/lines/line-1/logo`);
    expect(logoRequests.length).toBeGreaterThanOrEqual(1);
    expect(logoRequests.every(call => call.authorization === 'Bearer token-ADMIN')).toBe(true);
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'نزّل اللوجو' }).click();
    expect((await download).suggestedFilename()).toBe('S-1042-design-1-logo.png');
    await expect(page.getByTestId('stand-total')).toHaveText(arPrice(976_000));
    await expectAccessible(page, 'stand order detail');

    // Only the allowed moves; cancelling asks for a reason.
    await expect(page.getByTestId('move-CONFIRMED')).toBeVisible();
    await expect(page.getByTestId('move-SHIPPED')).toHaveCount(0);
    await page.getByTestId('move-CANCELLED').click();
    await page.getByTestId('confirm-status').click();
    await expect(page.getByRole('dialog')).toContainText('اكتب سبب الإلغاء');
    expect(api.callsTo('PATCH', `/v1/admin/stand-orders/${ORDER_ID}/status`)).toHaveLength(0);
    await page.getByRole('button', { name: 'رجوع' }).click();

    await page.getByTestId('move-CONFIRMED').click();
    await page.getByRole('dialog').getByRole('textbox').fill('العميل أكّد في التليفون');
    await page.getByTestId('confirm-status').click();
    await expect(detail.getByRole('heading', { level: 1 })).toContainText('اتأكد');
    await expect(page.getByTestId('stand-history')).toContainText('العميل أكّد في التليفون');
    expect(api.callsTo('PATCH', `/v1/admin/stand-orders/${ORDER_ID}/status`)[0]!.body).toEqual({ status: 'CONFIRMED', note: 'العميل أكّد في التليفون' });
    await expect(page.getByTestId('move-IN_PRODUCTION')).toBeVisible();

    await page.getByTestId('collect-cash').click();
    await page.getByRole('button', { name: 'أيوه، اتحصّل' }).click();
    await expect(page.getByTestId('stand-payment-status')).toHaveText('اتدفع');
    await expect(page.getByTestId('collect-cash')).toHaveCount(0);

    await page.getByRole('textbox', { name: /^الملاحظة/ }).fill('التسليم بعد الساعة ٥');
    await page.getByRole('button', { name: 'احفظ الملاحظة' }).click();
    await expect(page.getByText('اتحفظت الملاحظة')).toBeVisible();
    expect(api.callsTo('PATCH', `/v1/admin/stand-orders/${ORDER_ID}`).map(call => call.body)).toEqual([{ paymentStatus: 'PAID' }, { adminNote: 'التسليم بعد الساعة ٥' }]);

    await page.setViewportSize({ width: 320, height: 760 });
    await expectNoOverflow(page, 'stand order at 320px');
    expect(api.unhandled).toEqual([]);
  });

  test('a status changed elsewhere (409) refreshes the order', async ({ page }) => {
    let order = standOrder('NEW');
    await adminApi()
      .on('GET', `/v1/admin/stand-orders/${ORDER_ID}`, () => ({ json: order }))
      .on('GET', `/v1/admin/stand-orders/${ORDER_ID}/lines/line-1/logo`, { body: PNG, contentType: 'image/png' })
      .on('PATCH', `/v1/admin/stand-orders/${ORDER_ID}/status`, () => {
        order = standOrder('CANCELLED', { statusHistory: [...order.statusHistory, { status: 'CANCELLED', at: '2026-10-23T09:00:00.000Z', by: 'زميل', note: 'لغى' }] });
        return { status: 409, json: { error: { code: 'INVALID_STATUS_CHANGE', message: 'x', details: { from: 'CANCELLED', to: 'CONFIRMED', allowed: [] } } } };
      }).install(page);
    await page.goto(`/admin/stand-orders/${ORDER_ID}`);
    await page.getByTestId('move-CONFIRMED').click();
    await page.getByTestId('confirm-status').click();
    await expect(page.getByText('الطلب اتحدّث من مكان تاني')).toBeVisible();
    await expect(page.getByTestId('stand-order-detail').getByRole('heading', { level: 1 })).toContainText('اتلغى');
    await expect(page.getByTestId('move-CONFIRMED')).toHaveCount(0);
  });
});

test.describe('admin settings, reports and payments', () => {
  test('shop settings: fee or by phone, at least one way to pay, saved with PUT', async ({ page }) => {
    let shop: ShopSettings = { deliveryFeePiastres: 6_000, cashOnDelivery: true, onlinePayment: false };
    const api = adminApi()
      .on('GET', '/v1/admin/settings', { json: {
        payment: { instapayAddress: 'bilhanah@instapay', vodafoneCashNumber: null, bankName: null, bankAccountName: null, bankAccountNumber: null, notesAr: null, notesEn: null }, trial: { enabled: true, durationDays: 14, planCode: 'ADVANCED' },
        plans: [{ code: 'MENU', priceMonthlyPiastres: 25_000 }, { code: 'ORDERS', priceMonthlyPiastres: 50_000 }, { code: 'ADVANCED', priceMonthlyPiastres: 70_000 }],
      } })
      .on('GET', '/v1/admin/settings/shop', () => ({ json: shop }))
      .on('PUT', '/v1/admin/settings/shop', request => { shop = request.postDataJSON() as ShopSettings; return { json: shop }; });
    await api.install(page);
    await page.goto('/admin/settings');
    // The shop has its own section in the settings list.
    await page.getByRole('link', { name: /متجر الستاندات/ }).click();
    await expect(page).toHaveURL(/\/admin\/settings\/shop$/);
    const card = page.getByTestId('shop-settings');
    await expect(card.getByTestId('delivery-fee')).toHaveValue('60');
    await card.getByRole('switch', { name: 'كاش عند الاستلام' }).click();
    await card.getByRole('button', { name: 'احفظ إعدادات المتجر' }).click();
    await expect(card.getByTestId('shop-pay-error')).toContainText('طريقة دفع واحدة على الأقل');
    await card.getByRole('switch', { name: 'دفع أونلاين (كارت أو محفظة)' }).click();
    await card.getByRole('radio', { name: 'يتأكد بالتليفون' }).check();
    await expect(card.getByTestId('shop-pay-error')).toContainText('الدفع الأونلاين مش بيظهر');
    await card.getByRole('radio', { name: 'مبلغ ثابت' }).check();
    await card.getByTestId('delivery-fee').fill('٧٥');
    await expectAccessible(page, 'admin settings with shop');
    await card.getByRole('button', { name: 'احفظ إعدادات المتجر' }).click();
    await expect(page.getByText('اتحفظت إعدادات المتجر')).toBeVisible();
    expect(api.callsTo('PUT', '/v1/admin/settings/shop')[0]!.body).toEqual({ deliveryFeePiastres: 7_500, cashOnDelivery: false, onlinePayment: true });
  });

  test('reports: KPIs, daily chart and top restaurants linking to their page', async ({ page }) => {
    const stats: PlatformStats = {
      days: Array.from({ length: 30 }, (_, index) => ({ date: day(29 - index), visits: 100 + index * 3, orders: 10 + (index % 5), newRestaurants: index % 7 === 0 ? 1 : 0, revenuePiastres: index % 4 === 0 ? 50_000 : 0 })),
      totals: { visits: 4_305, orders: 360, newRestaurants: 5, revenuePiastres: 400_000, standOrders: 7, standRevenuePiastres: 2_100_000 },
      topRestaurants: [{ id: 'r-1', name: 'كشري التحرير', subdomain: 'tahrir', visits: 900, orders: 120 }, { id: 'r-2', name: 'فطاطري منى', subdomain: 'mona', visits: 640, orders: 0 }],
    };
    const api = adminApi().on('GET', '/v1/admin/stats', { json: stats });
    await api.install(page);
    await page.goto('/admin');
    await page.getByRole('link', { name: /التقارير/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'التقارير' })).toBeVisible();
    await expect(page.getByTestId('report-stand-orders')).toContainText('٧');
    await expect(page.getByTestId('report-stand-revenue')).toContainText(arPrice(2_100_000));
    await expect(page.locator('figure table tbody tr')).toHaveCount(30);
    await expect(page.getByTestId('top-restaurants').getByRole('link', { name: 'كشري التحرير' })).toHaveAttribute('href', '/admin/restaurants/r-1');
    await expectAccessible(page, 'admin reports');
    await page.setViewportSize({ width: 320, height: 760 });
    await expectNoOverflow(page, 'reports at 320px');
  });

  test('payments: online payments are labelled and never offered for review', async ({ page }) => {
    const base: AdminPayment = { ...onlinePayment('AWAITING_PAYMENT'), restaurant: { id: 'r-1', name: 'كشري التحرير', subdomain: 'tahrir' }, reviewedBy: null };
    const transfer: AdminPayment = { ...base, id: 'p-transfer', method: 'INSTAPAY', status: 'PENDING', reference: 'IP-1' };
    const api = adminApi()
      .on('GET', '/v1/admin/payments', { json: { items: [base, transfer], total: 2, page: 1, pageSize: 20 } })
      .on('GET', `/v1/admin/payments/${PAYMENT_ID}`, { json: base })
      .on('GET', '/v1/admin/restaurants/r-1', { status: 404, json: { error: { code: 'NOT_FOUND', message: 'x' } } });
    await api.install(page);
    await page.goto('/admin/payments?status=ALL');
    const rows = page.getByTestId('payment-queue-row');
    await expect(rows.first()).toContainText('أونلاين (كارت أو محفظة)');
    await expect(rows.first()).toContainText('مستني الدفع');
    await expect(rows.first().getByRole('button', { name: 'التفاصيل' })).toBeVisible();
    await expect(rows.nth(1).getByRole('button', { name: 'راجع' })).toBeVisible();
    await rows.first().getByRole('button', { name: 'التفاصيل' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('اتدفع أونلاين عن طريق Paymob');
    await expect(dialog.getByRole('button', { name: 'اقبل التحويل' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'ارفض' })).toHaveCount(0);
    // A status the list cannot filter by falls back to the review queue.
    await page.goto('/admin/payments?status=FAILED');
    await expect.poll(() => api.callsTo('GET', '/v1/admin/payments').at(-1)?.search).toBe('?status=PENDING&page=1');
  });
});
