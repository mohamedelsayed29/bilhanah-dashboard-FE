import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_URL, authenticator, createAdmin, DASHBOARD_ORIGIN, expectAccessible, makeJpeg, registerOwner, uniqueSuffix } from './helpers';

// One owner and one support agent, through the whole support flow across both apps.
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const suffix = uniqueSuffix();
const owner = { email: `help-${suffix}@e2e-bilhanah.test`, password: 'Koshary-Friday-2026', fullName: 'سارة الاختبار', restaurant: 'كشري سارة', subdomain: `e2e-help-${suffix}` };
const agent = { email: `agent-${suffix}@e2e-bilhanah.test`, password: 'Console-Password-2026!', name: `وكيل ${suffix.replace(/\d/g, digit => 'ابتثجحخدذر'[Number(digit)]!)}` };

let ownerContext: BrowserContext;
let agentContext: BrowserContext;
let ownerPage: Page;
let agentPage: Page;
let code: ReturnType<typeof authenticator>;
let reference = '';
const errors: string[] = [];

async function newPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}

test.beforeAll(async ({ browser }) => {
  ({ context: ownerContext, page: ownerPage } = await newPage(browser, DASHBOARD_ORIGIN));
  ({ context: agentContext, page: agentPage } = await newPage(browser, ADMIN_URL));
  code = authenticator(createAdmin(agent.email, agent.password, agent.name).key);
});
test.afterAll(async () => {
  expect(errors).toEqual([]);
  await ownerContext.close();
  await agentContext.close();
});

test('the assistant answers from the FAQ and hands an unsolved question to support as a ticket', async () => {
  await registerOwner(ownerPage, owner);
  await ownerPage.goto('/tables');
  const panel = ownerPage.getByTestId('support-panel');
  await ownerPage.getByTestId('support-launcher').click();
  await expect(panel).toContainText('أهلًا بيك في دعم بالهنا');
  await expect(panel.getByTestId('support-category').first()).toBeVisible();
  await expectAccessible(ownerPage, 'support assistant');

  // A suggested question, its answer and related questions, then "not helpful".
  await panel.getByRole('button', { name: 'إزاي أعمل كود QR لطاولة؟' }).first().click();
  const answer = panel.getByTestId('support-answer').last();
  await expect(answer).toContainText('كل طاولة بتضيفها');
  await expect(answer.getByRole('link', { name: 'الطاولات' })).toHaveAttribute('href', '/tables');
  await expect(answer.getByTestId('support-question').first()).toBeVisible();
  // Search finds other answers; nonsense offers support.
  await panel.getByLabel('ابحث في الأسئلة').fill('أوقف الطلبات');
  await panel.getByLabel('ابحث في الأسئلة').press('Enter');
  await expect(panel.getByText('إزاي أوقف استقبال الطلبات شوية؟').last()).toBeVisible();

  // The conversation survives moving to another page.
  await ownerPage.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name: 'المنيو' }).click();
  await expect(ownerPage).toHaveURL(/\/menu$/);
  await expect(panel.getByTestId('support-answer')).toHaveCount(1);

  await panel.getByRole('button', { name: 'لأ', exact: true }).click();
  await panel.getByTestId('support-handoff').last().click();
  await panel.getByLabel('عنوان المشكلة').fill('الكود مش بيفتح المنيو');
  await panel.getByLabel('الأهمية').selectOption('HIGH');
  await panel.getByLabel('التفاصيل').fill('الزباين بيمسحوا كود طاولة ٣ ومش بيفتح حاجة.');
  await panel.getByTestId('support-attach-input').setInputFiles({ name: 'screen.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(ownerPage, 600, 400) });
  await expect(panel.locator('.support-attach-list li:not(.is-uploading)')).toHaveCount(1);
  await expectAccessible(ownerPage, 'new ticket form');
  await panel.getByTestId('support-ticket-submit').click();

  const ticket = panel.getByTestId('support-ticket');
  await expect(ticket.getByTestId('ticket-reference')).toHaveText(/^BIL-\d{5,}$/);
  reference = (await ticket.getByTestId('ticket-reference').textContent())!;
  await expect(ticket.getByTestId('ticket-status')).toHaveText('مفتوحة');
  await expect(ticket.locator('.support-thumb img')).toBeVisible();
  // The assistant's conversation shows the hand-off.
  await panel.getByRole('tab', { name: 'المساعد' }).click();
  await expect(panel.getByTestId('support-ticket-made').last()).toContainText(reference);
});

test('the support team sees it, keeps a note to itself, replies and waits for the customer', async () => {
  await agentPage.goto('/admin/login');
  await agentPage.getByLabel('الإيميل').fill(agent.email);
  await agentPage.getByLabel('كلمة السر', { exact: true }).fill(agent.password);
  // The code field is hidden when the local console runs with VITE_ADMIN_MFA_DISABLED.
  if (await agentPage.getByLabel('كود التحقق').count()) await agentPage.getByLabel('كود التحقق').fill(await code.nextCode());
  await agentPage.getByRole('button', { name: 'دخول' }).click();
  await expect(agentPage.getByTestId('support-count').first()).toBeVisible();

  await agentPage.getByRole('navigation', { name: 'قائمة الإدارة' }).getByRole('link', { name: /الدعم الفني/ }).click();
  await agentPage.getByLabel('ابحث في التذاكر').fill(reference);
  const row = agentPage.getByTestId('ticket-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(owner.restaurant);
  await expect(row).toHaveAttribute('data-unread', 'true');
  await expectAccessible(agentPage, 'support inbox');
  await row.getByRole('link').first().click();

  const detail = agentPage.getByTestId('ticket-detail');
  await expect(detail).toContainText('الزباين بيمسحوا كود طاولة ٣');
  await expect(detail).toContainText('إزاي أعمل كود QR لطاولة؟');
  await expect(detail.locator('.tk-thumb img')).toBeVisible();
  await detail.getByTestId('note-toggle').check({ force: true });
  await detail.getByLabel('الملاحظة').fill('غالبًا طبعوا الكود القديم');
  await detail.getByTestId('ticket-send').click();
  await expect(detail.locator('[data-testid="ticket-message"][data-internal]')).toContainText('غالبًا طبعوا الكود القديم');
  await detail.getByRole('radio', { name: 'رد على العميل' }).check({ force: true });
  await detail.getByLabel('الرد').fill('اعمل QR جديد للطاولة واطبعه تاني من صفحة الطاولات.');
  await detail.getByTestId('ticket-send').click();
  await expect(detail.getByTestId('ticket-status').first()).toHaveText('شغالين عليها');
  await detail.getByTestId('assign-me').click();
  await expect(detail.getByTestId('assign-me')).toHaveCount(0);
  await expect(detail.getByTestId('ticket-timeline')).toContainText(`عيّنها لـ${agent.name}`);
  await detail.getByTestId('ticket-status-select').selectOption('WAITING_FOR_CUSTOMER');
  await expect(detail.getByTestId('ticket-status').first()).toHaveText('مستنيين العميل');
  await expect(detail.getByTestId('ticket-timeline')).toContainText('كتب ملاحظة داخلية');
  await expectAccessible(agentPage, 'ticket detail');
});

test('the restaurant gets the reply (never the note), answers, and the team resolves it', async () => {
  await ownerPage.reload();
  await expect(ownerPage.getByTestId('support-panel')).toBeVisible();
  const panel = ownerPage.getByTestId('support-panel');
  await panel.getByTestId('support-tickets-tab').click();
  // Both the reply and the status change are listed as new, each linking to the ticket.
  await expect(panel.getByTestId('support-update').filter({ hasText: 'فريق الدعم رد عليك' })).toContainText(reference);
  await expect(panel.getByTestId('support-update').filter({ hasText: 'حالة التذكرة اتغيرت' })).toBeVisible();
  await expect(ownerPage.getByTestId('support-launcher')).toHaveAttribute('aria-expanded', 'true');
  await panel.getByTestId('support-ticket-row').first().click();
  const ticket = panel.getByTestId('support-ticket');
  await expect(ticket.getByTestId('ticket-status')).toHaveText('مستنيين ردك');
  await expect(ticket).toContainText('اعمل QR جديد للطاولة');
  await expect(ticket).not.toContainText('غالبًا طبعوا الكود القديم');
  await ticket.getByLabel('ردك').fill('عملت كده واشتغل، شكرًا');
  await ticket.getByTestId('support-reply-submit').click();
  await expect(ticket.getByTestId('ticket-status')).toHaveText('بنشتغل عليها');
  await expect(ticket.getByTestId('support-msg')).toHaveCount(2);

  await agentPage.reload();
  const detail = agentPage.getByTestId('ticket-detail');
  await expect(detail).toContainText('عملت كده واشتغل');
  await detail.getByTestId('status-RESOLVED').click();
  await expect(detail.getByTestId('ticket-status').first()).toHaveText('اتحلّت');

  // The restaurant can reopen a resolved ticket, or close it.
  await panel.getByRole('button', { name: 'التذاكر' }).click();
  await panel.getByTestId('support-ticket-row').first().click();
  await expect(ticket.getByTestId('ticket-status')).toHaveText('اتحلّت');
  await ticket.getByRole('button', { name: 'اقفل التذكرة' }).click();
  await expect(ticket.getByTestId('ticket-status')).toHaveText('مقفولة');
  await expect(ticket.getByLabel('ردك')).toHaveCount(0);
});

test('agents manage the FAQ content the assistant answers from', async () => {
  await agentPage.goto('/admin/support/faq');
  await expect(agentPage.getByTestId('faq-row').first()).toBeVisible();
  await expectAccessible(agentPage, 'faq content');
});
