import { expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const API_URL = process.env['E2E_API_URL'] ?? 'http://127.0.0.1:3000';
export const MAILPIT_URL = process.env['E2E_MAILPIT_URL'] ?? 'http://127.0.0.1:8025';
export const screenshotDir = fileURLToPath(new URL('../test-results/screens/', import.meta.url));

/** Unique per run: the development database is shared. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Polls Mailpit for the newest email to `to` that contains a dashboard link to `path`, and returns the link. */
export async function emailLink(request: APIRequestContext, to: string, path: 'verify-email' | 'reset-password', after = 0): Promise<string> {
  const pattern = new RegExp(`https?://\\S+/${path}#token=[\\w-]+`);
  let link: string | null = null;
  await expect.poll(async () => {
    const search = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${to}"` } });
    const { messages } = (await search.json()) as { messages: { ID: string; Created: string }[] };
    for (const message of messages.filter(entry => new Date(entry.Created).getTime() >= after)) {
      const detail = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as { Text: string };
      const match = pattern.exec(detail.Text);
      if (match) { link = match[0]; return true; }
    }
    return false;
  }, { timeout: 30_000, intervals: [500, 1000, 2000] }).toBe(true);
  return link!;
}

/** Fails on serious or critical axe violations, listing them. */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious.map(violation => `${violation.id}: ${violation.help} (${violation.nodes.map(node => node.target.join(' ')).slice(0, 3).join(', ')})`), `axe on ${label}`).toEqual([]);
}

export async function screenshot(page: Page, name: string, fullPage = true) {
  await mkdir(screenshotDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  // Full-page captures of a scrolled page misplace fixed and sticky elements.
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage, animations: 'disabled' });
}

/** No horizontal scrolling at the current viewport. */
export async function expectNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} overflows horizontally`).toBeLessThanOrEqual(0);
}

/** A JPEG fixture of the given size, drawn in the browser (no binary file in the repository). */
export async function makeJpeg(page: Page, width = 800, height = 600): Promise<Buffer> {
  const base64 = await page.evaluate(([w, h]) => {
    const canvas = document.createElement('canvas');
    canvas.width = w!;
    canvas.height = h!;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, w!, h!);
    gradient.addColorStop(0, '#ff7868');
    gradient.addColorStop(1, '#075e54');
    context.fillStyle = gradient;
    context.fillRect(0, 0, w!, h!);
    context.fillStyle = '#fff8ef';
    context.beginPath();
    context.arc(w! / 2, h! / 2, Math.min(w!, h!) / 4, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  }, [width, height]);
  return Buffer.from(base64, 'base64');
}

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const DASHBOARD_ORIGIN = `http://127.0.0.1:${process.env['DASHBOARD_E2E_PORT'] ?? 5174}`;

/**
 * Creates an administrator with the API's CLI (built by the running API dev watcher; it reads the root .env)
 * and returns the authenticator key it prints once.
 */
export function createAdmin(email: string, password: string, name = 'E2E Admin'): { key: string } {
  const output = execFileSync('node', ['apps/api/dist/commands/create-admin.cli.js', '--email', email, '--name', name], {
    cwd: REPO_ROOT, input: `${password}\n`, encoding: 'utf8',
  });
  const key = /Key:\s+([A-Z2-7 ]+)/.exec(output)?.[1]?.replace(/\s/g, '');
  if (!key) throw new Error(`No authenticator key in the create-admin output:\n${output}`);
  return { key };
}

function base32Decode(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/[\s=]/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

/** RFC 6238 (HMAC-SHA1, 30-second steps, 6 digits), as authenticator apps compute it. */
export function totpCode(key: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(key)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export const totpStep = (at = Date.now()) => Math.floor(at / 30_000);

/**
 * Hands out authenticator codes the API will accept: each step only once, and at most one step ahead of now
 * (waiting for the next window when both are used up).
 */
export function authenticator(key: string) {
  let lastStep = 0;
  return {
    async nextCode(): Promise<string> {
      let step = Math.max(totpStep(), lastStep + 1);
      while (step > totpStep() + 1) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        step = Math.max(totpStep(), lastStep + 1);
      }
      lastStep = step;
      return totpCode(key, step);
    },
    /** A well-formed code that is certainly not valid now. */
    wrongCode: () => totpCode(key, totpStep() - 20),
  };
}

/**
 * A new owner: registered through the API, email confirmed from Mailpit, signed in and onboarded
 * through the dashboard. Ends on the overview.
 */
export async function registerOwner(page: Page, owner: { email: string; password: string; fullName: string; restaurant: string; subdomain: string }) {
  const startedAt = Date.now() - 5_000;
  const registered = await page.request.post(`${API_URL}/v1/auth/register`, {
    data: { email: owner.email, password: owner.password, fullName: owner.fullName, preferredLanguage: 'ar' },
    headers: { Origin: DASHBOARD_ORIGIN },
  });
  expect(registered.status()).toBe(202);
  await page.goto(await emailLink(page.request, owner.email, 'verify-email', startedAt));
  await expect(page.getByRole('heading', { level: 1, name: 'إيميلك اتأكد' })).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('الإيميل').fill(owner.email);
  await page.getByLabel('كلمة السر', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('اسم المطعم').fill(owner.restaurant);
  await page.getByLabel('عنوان المنيو على الإنترنت').fill(owner.subdomain);
  await expect(page.locator('#subdomain-status')).toContainText('متاح');
  await page.getByLabel('رقم الموبايل').fill('0109 876 5432');
  await page.getByLabel('المدينة').fill('طنطا');
  await page.getByLabel('العنوان', { exact: true }).fill('٥ شارع البحر');
  await page.getByRole('button', { name: 'أنشئ مطعمي وابدأ التجربة' }).click();
  await expect(page.getByRole('heading', { level: 1, name: owner.restaurant })).toBeVisible();
}
