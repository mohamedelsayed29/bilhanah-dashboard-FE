import { randomUUID } from 'node:crypto';
import { expect, request as playwrightRequest, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import type { OwnerRestaurant, PublicMenuResponse, RestaurantTable } from '@bilhanah/contracts';
import { API_URL, DASHBOARD_ORIGIN, expectAccessible, expectNoOverflow, registerOwner, screenshot, uniqueSuffix } from './helpers';

// One owner per run (registrations are rate-limited per IP) and two public orders.
test.describe.configure({ mode: 'serial' });

const suffix = uniqueSuffix();
const owner = { email: `floor-${suffix}@e2e-bilhanah.test`, password: 'Molokhia-Tuesday-2026', fullName: 'هبة الاختبار', restaurant: 'كافيه هبة', subdomain: `e2e-flr-${suffix}` };

let context: BrowserContext;
let page: Page;
let api: APIRequestContext;
let token = '';

async function ownerApi<T>(method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown): Promise<T> {
  const response = await api.fetch(`${API_URL}${path}`, { method, data, headers: { Authorization: `Bearer ${token}`, Origin: DASHBOARD_ORIGIN } });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json().catch(() => null)) as T;
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  api = await playwrightRequest.newContext();
});
test.afterAll(async () => {
  await context.close();
  await api.dispose();
});

test('an owner with ordering switched on', async () => {
  await registerOwner(page, owner);
  const login = await api.post(`${API_URL}/v1/auth/login`, { data: { email: owner.email, password: owner.password }, headers: { Origin: DASHBOARD_ORIGIN } });
  expect(login.ok()).toBe(true);
  token = ((await login.json()) as { accessToken: string }).accessToken;
  const restaurant = await ownerApi<OwnerRestaurant>('GET', '/v1/restaurants/mine');
  test.skip(!restaurant.ordering.included, 'The trial plan of this environment has no ordering.');
  await ownerApi('PATCH', '/v1/restaurants/mine', { orderingEnabled: true, acceptsDineIn: true });
  const category = await ownerApi<{ id: string }>('POST', '/v1/menu/categories', { nameAr: 'مشروبات', nameEn: 'Drinks' });
  await ownerApi('POST', '/v1/menu/items', { categoryId: category.id, nameAr: 'لاتيه', nameEn: 'Latte', variants: [{ pricePiastres: 7_500 }] });
});

test('tables keep the shape and seats the owner picks, and the floor draws them', async () => {
  await page.goto('/tables');

  // A round table for two, from the add dialog.
  await page.getByRole('button', { name: 'ضيف طاولة' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('اسم الطاولة').fill('الشباك');
  await dialog.getByRole('radio', { name: 'مدورة' }).check();
  await dialog.getByRole('button', { name: 'فرد أقل' }).click();
  await dialog.getByRole('button', { name: 'فرد أقل' }).click();
  await expect(dialog.getByLabel('عدد الأفراد')).toHaveValue('2');
  await expect(dialog.locator('.table-chair')).toHaveCount(2);
  await expectAccessible(page, 'add table dialog');
  await screenshot(page, 'tables-add-shape-ar', false);
  await dialog.getByRole('button', { name: 'ضيف', exact: true }).click();
  await expect(page.locator('[data-testid="table-item"][data-label="الشباك"]')).toContainText('مدورة · فردين');

  // Four long family tables for eight at once.
  await page.getByRole('button', { name: 'ضيف كذا طاولة' }).first().click();
  await dialog.getByLabel('الاسم قبل الرقم').fill('عائلي');
  await dialog.getByLabel('لحد رقم').fill('4');
  await dialog.getByRole('radio', { name: 'مستطيلة' }).check();
  await dialog.getByLabel('عدد الأفراد').fill('8');
  await dialog.getByLabel('عدد الأفراد').blur();
  await expect(dialog.locator('.table-chair')).toHaveCount(8);
  await dialog.getByRole('button', { name: /ضيف/ }).last().click();
  await expect(page.getByTestId('table-item')).toHaveCount(5);

  // Change one of them to a square table for six.
  const family = page.locator('[data-testid="table-item"][data-label="عائلي 2"]');
  await family.getByRole('button', { name: /مستطيلة · ٨ أفراد/ }).click();
  await dialog.getByRole('radio', { name: 'مربعة' }).check();
  await dialog.getByRole('button', { name: 'فرد أقل' }).click();
  await dialog.getByRole('button', { name: 'فرد أقل' }).click();
  await dialog.getByRole('button', { name: 'احفظ' }).click();
  await expect(family).toContainText('مربعة · ٦ أفراد');

  const saved = await ownerApi<RestaurantTable[]>('GET', '/v1/tables');
  expect(saved.map(table => [table.label, table.shape, table.seats])).toEqual([
    ['الشباك', 'ROUND', 2], ['عائلي 1', 'RECTANGLE', 8], ['عائلي 2', 'SQUARE', 6], ['عائلي 3', 'RECTANGLE', 8], ['عائلي 4', 'RECTANGLE', 8],
  ]);

  // Guests at two tables.
  const menu = (await (await api.get(`${API_URL}/v1/public/restaurants/${owner.subdomain}/menu`)).json()) as PublicMenuResponse;
  const latte = menu.categories[0]!.items[0]!;
  for (const table of [saved[0]!, saved[2]!]) {
    const response = await fetch(`${API_URL}/v1/public/restaurants/${owner.subdomain}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ type: 'DINE_IN', tableCode: table.publicCode, customerName: 'زبون', items: [{ menuItemId: latte.id, variantId: latte.variants[0]!.id, quantity: 2 }] }),
    });
    expect(response.status).toBe(201);
  }
  await page.reload();
  const floor = page.getByTestId('tables-floor');
  await expect(floor.locator('[data-state="occupied"]')).toHaveCount(2);
  await expect(floor.locator('[data-state="free"]')).toHaveCount(3);
  await expect(floor.locator('.table-graphic-round .table-chair')).toHaveCount(2);
  await expect(floor.locator('.table-graphic-rectangle')).toHaveCount(3);
  await expect(floor.getByText('كراسي مشغولة: ٨')).toBeVisible();
  await expectAccessible(page, 'floor plan');
  await screenshot(page, 'tables-floor-ar', false);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page, 'floor plan 390');
  await screenshot(page, 'tables-floor-ar-390', false);
});

test('signing out asks first; cancelling keeps the session', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const signOut = page.locator('.sidebar').getByRole('button', { name: 'تسجيل الخروج' });
  await signOut.click();
  const dialog = page.getByRole('dialog', { name: 'تسجيل الخروج' });
  await expect(dialog).toContainText('متأكد إنك عايز تخرج؟');
  await expect(dialog.getByRole('button', { name: 'إلغاء' })).toBeFocused();
  await expectAccessible(page, 'sign-out dialog');
  await screenshot(page, 'sign-out-dialog-ar', false);
  await dialog.getByRole('button', { name: 'إلغاء' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/\/login/);

  await signOut.click();
  await dialog.getByRole('button', { name: 'اخرج' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('خرجت من حسابك.')).toBeVisible();
});
