import { expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
