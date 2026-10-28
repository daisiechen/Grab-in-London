/**
 * End-to-end run of the iOS app's main journeys against the REAL API (no preview fake):
 *   node apps/ios/e2e/real-api.e2e.ts
 * Starts a fresh local database + API + web export (see stack.ts), seeds a host and meals through
 * the API, then drives the app in Chromium with Playwright. The "other side" of a journey (e.g. the
 * host reading the guest's chat message) is checked through the API with the native credential path.
 * Exits non-zero on the first failed step and leaves a screenshot in FANCY_E2E_ARTIFACTS.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startStack } from './stack.ts';
import { stackOptions } from './options.ts';
import { completeProfile, londonDateIn, publishMeal, signIn, type Actor } from './driver.ts';

const require = createRequire(import.meta.url);

/**
 * The slice of Playwright this run uses. Playwright is preinstalled on the machine (resolved at run
 * time, never a workspace dependency), so its types are declared here structurally.
 */
interface Locator {
  click(options?: { timeout?: number }): Promise<void>;
  dispatchEvent(type: string): Promise<void>;
  fill(value: string): Promise<void>;
  waitFor(options?: { state?: 'visible'; timeout?: number }): Promise<void>;
  locator(selector: string): Locator;
  first(): Locator;
  last(): Locator;
}
interface Response { url(): string; status(): number; text(): Promise<string>; json(): Promise<unknown>; request(): { method(): string } }
interface Page {
  goto(url: string): Promise<unknown>;
  goBack(): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
  innerText(selector: string): Promise<string>;
  getByRole(role: string, options: { name: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp): Locator;
  getByLabel(text: string, options?: { exact?: boolean }): Locator;
  waitForResponse(match: (response: Response) => boolean): Promise<Response>;
  on(event: 'response', listener: (response: Response) => void): void;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', listener: (error: Error) => void): void;
}
interface BrowserContext { newPage(): Promise<Page> }
interface Browser { newContext(options: { viewport: { width: number; height: number }; baseURL: string }): Promise<BrowserContext>; close(): Promise<void> }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Same label as the app's date grid (lib/london.ts longDate). */
const longDate = (date: string) => { const d = new Date(`${date}T00:00:00Z`); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const { chromium } = require('playwright') as { chromium: { launch(): Promise<Browser> } };

const ARTIFACTS = process.env.FANCY_E2E_ARTIFACTS ?? join(tmpdir(), 'fancy-e2e-artifacts');
mkdirSync(ARTIFACTS, { recursive: true });
const OTP = '000000';
const run = randomUUID().slice(0, 8);
const GUEST_EMAIL = `guest.${run}@example.invalid`;
const HOST_EMAIL = `host.${run}@example.invalid`;
const INTRO = 'I moved to London last month and would love to meet people over a relaxed dinner.';

interface Problem { page: string; status: number; method: string; path: string; body: string }

/** One phone-sized browser profile per person; records every failed /v1 call and console error. */
async function person(browser: Browser, name: string, baseUrl: string, problems: Problem[], expected: (p: Problem) => boolean) {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: baseUrl });
  const page = await context.newPage();
  page.on('response', async (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith('/v1/') || res.status() < 400) return;
    const problem = { page: name, status: res.status(), method: res.request().method(), path: url.pathname + url.search, body: (await res.text().catch(() => '')).slice(0, 400) };
    if (!expected(problem)) problems.push(problem);
  });
  page.on('console', (msg) => { if (msg.type() === 'error') console.warn(`  [${name} console] ${msg.text().slice(0, 300)}`); });
  page.on('pageerror', (error) => problems.push({ page: name, status: 0, method: 'JS', path: 'pageerror', body: error.message.slice(0, 400) }));
  return { context, page };
}

let current = '';
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  current = name;
  const started = Date.now();
  const result = await fn();
  console.warn(`  ✓ ${name} (${Date.now() - started}ms)`);
  return result;
}

// The web stack keeps earlier screens mounted but hidden, so every lookup is limited to visible nodes.
const visible = <L extends { locator(s: string): L; first(): L }>(l: L) => l.locator('visible=true').first();
const button = (page: Page, name: string | RegExp) => visible(page.getByRole('button', { name, exact: typeof name === 'string' }));
/**
 * On the web build an inactive tab screen can stay stacked above the active one and swallow pointer
 * events (web-only; native tabs detach it), so a blocked click falls back to a DOM click on the node.
 */
async function press(target: Locator) {
  try { await target.click({ timeout: 4_000 }); } catch { await target.dispatchEvent('click'); }
}
async function tap(page: Page, name: string | RegExp) { await press(button(page, name)); }
async function see(page: Page, text: string | RegExp, timeout = 10_000) { await visible(page.getByText(text)).waitFor({ state: 'visible', timeout }); }
async function fill(page: Page, label: string, value: string) { await visible(page.getByLabel(label, { exact: true })).fill(value); }
// Full page loads would drop the in-memory session (the web build has no Keychain), so the run
// navigates only through the app's own tabs and buttons after signing in.
async function untilVisible(page: Page, target: Locator) {
  // Pushed screens have no tab bar: step back through history (client-side, no reload) first.
  for (let i = 0; i < 8; i++) {
    if (await target.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)) return;
    await page.goBack();
  }
}
async function openTab(page: Page, name: string) {
  const tab = visible(page.getByRole('tab', { name, exact: true }));
  await untilVisible(page, tab);
  await press(tab);
}
const radio = (page: Page, name: string | RegExp) => visible(page.getByRole('radio', { name, exact: typeof name === 'string' }));
const checkbox = (page: Page, name: string | RegExp) => visible(page.getByRole('checkbox', { name, exact: typeof name === 'string' }));

async function signInInBrowser(page: Page, email: string) {
  await see(page, 'Continue with email');
  await tap(page, 'Continue with email');
  await fill(page, 'Email address', email);
  await tap(page, 'Send code');
  await fill(page, '6-digit code', OTP);
  await tap(page, 'Verify & continue');
  // One-time optional analytics sheet after sign-in (declining keeps everything working).
  await button(page, 'Decline analytics').click({ timeout: 10_000 });
}

async function main() {
  const stack = await startStack(stackOptions());
  const problems: Problem[] = [];
  let browser: Browser | null = null;
  let failedPage: Page | null = null;
  try {
    // ---- Seed: a host with two published meals, created through the real API.
    const seedHost = await step('seed host and meals through the API', async () => {
      const host = await signIn(stack.apiUrl, HOST_EMAIL, OTP);
      await completeProfile(host, 'Hana');
      const supper = await publishMeal(host, { placeId: 'fixture_fancy_north', title: `Sunday supper ${run}`, days: 5 });
      const tapas = await publishMeal(host, { placeId: 'fixture_fancy_south', title: `Tapas night ${run}`, days: 6 });
      return { host, supper, tapas, signedInAt: Date.now() };
    });

    browser = await chromium.launch();
    const guest = await person(browser, 'guest', stack.webUrl, problems, () => false);
    failedPage = guest.page;
    const g = guest.page;

    await step('guest discovers seeded meals', async () => {
      await g.goto('/');
      await see(g, seedHost.supper.title);
      await see(g, seedHost.tapas.title);
    });

    await step('guest opens meal detail', async () => {
      await visible(g.getByText(seedHost.supper.title)).click();
      await see(g, 'A little about this meal');
      await see(g, '[Fixture] Fancy North Kitchen');
    });

    await step('apply → sign in with email OTP', async () => {
      await tap(g, 'Apply to join');
      await signInInBrowser(g, GUEST_EMAIL);
    });

    let guestId = '';
    await step('profile setup', async () => {
      await see(g, 'A face. A little story. You.');
      await fill(g, 'First name', 'Gina');
      await fill(g, 'A little about you', 'New to London, I love trying small family restaurants and long chats.');
      await radio(g, 'New to London').click();
      await radio(g, 'English').click();
      await checkbox(g, 'Food').click();
      await checkbox(g, /18 or older/).click();
      const saved = g.waitForResponse((r) => r.url().endsWith('/v1/me') && r.request().method() === 'PATCH');
      await tap(g, 'Take your seat');
      guestId = ((await (await saved).json()) as { data: { id: string } }).data.id;
    });

    await step('send application', async () => {
      await see(g, 'Pull up a chair.');
      await fill(g, 'Your introduction', INTRO);
      await tap(g, 'Send request');
      await see(g, /Request sent|Waiting|pending|review/i);
    });

    const host = await person(browser, 'host', stack.webUrl, problems, () => false);
    const h = host.page;
    await step('host signs in (second account) and approves the guest', async () => {
      failedPage = h;
      // The API allows one code per email every 30s; the host account was just signed in by the seed.
      await new Promise((r) => setTimeout(r, Math.max(0, seedHost.signedInAt + 31_000 - Date.now())));
      await h.goto('/sign-in');
      await signInInBrowser(h, HOST_EMAIL);
      await openTab(h, 'Meals');
      await openTab(h, 'Hosting');
      await press(visible(h.getByText(seedHost.supper.title)));
      await tap(h, 'Manage applications');
      await see(h, 'Gina');
      await tap(h, 'Approve Gina');
      await see(h, /2 of 4|Group chat|Open group chat/);
    });

    await step('host reports the booking for the whole table (stays fresh with 2 of 4 confirmed)', async () => {
      await see(h, 'Host to update reservation');
      await tap(h, 'Update reservation');
      await radio(h, 'Booked').click();
      await radio(h, '4').click();
      await tap(h, 'Save reservation status');
      await see(h, 'Reservation status updated.');
      await see(h, 'Restaurant booked');
      const meal = (await seedHost.host.call('getMeal', { params: { mealId: seedHost.supper.id } })).data.meal;
      if (meal.bookingDeclaration?.stale !== false || meal.bookingDeclaration.declaredCount !== 4) throw new Error(`declaration not fresh: ${JSON.stringify(meal.bookingDeclaration)}`);
    });

    await step('guest sees a confirmed seat on the meal', async () => {
      failedPage = g;
      // The status page polls while the request is under review.
      await see(g, 'You’re at the table.', 30_000);
      await tap(g, `View ${seedHost.supper.title}`);
      await see(g, 'A little about this meal');
      await button(g, 'Open group chat').waitFor({ timeout: 10_000 });
    });

    await step('guest sees the meal under Meals › Upcoming', async () => {
      await openTab(g, 'Meals');
      await openTab(g, 'Upcoming');
      await see(g, seedHost.supper.title);
      // Areas are `unknown` without a verified area dataset: the card says “London”, not “London, London”.
      if ((await g.innerText('body')).includes('London, London')) throw new Error('meal card repeats “London, London”');
    });

    const message = `Hello table! Looking forward to it (${run}).`;
    await step('group chat appears in Inbox and guest sends a message', async () => {
      await openTab(g, 'Inbox');
      await tap(g, new RegExp(seedHost.supper.title));
      await fill(g, 'Message', message);
      await tap(g, 'Send message');
      await see(g, message);
      // The host reads it through the API (same membership rules as the app).
      const inbox = await seedHost.host.call('inbox', {});
      const chat = inbox.data.find((i) => i.conversation?.mealId === seedHost.supper.id);
      if (!chat) throw new Error('host inbox has no group chat for the meal');
      const read = await seedHost.host.call('readMessages', { params: { conversationId: chat.conversation!.id }, query: { mode: 'HISTORY' } });
      if (!read.data.some((m) => m.body === message)) throw new Error('host cannot read the guest message');
    });

    const createdTitle = `Ramen and records ${run}`;
    const created = await step('host creates a meal through the 4 Create steps (map restaurant picker)', async () => {
      failedPage = h;
      await untilVisible(h, button(h, 'Create meal'));
      await tap(h, 'Create meal');
      // Step 1 · place & time: the picker loads the fixture restaurants for the visible map area.
      await tap(h, 'Choose a restaurant on the map');
      await see(h, /restaurants? in this map area/);
      await tap(h, /^\[Fixture\] Fancy North Kitchen/);
      await tap(h, 'Use this restaurant');
      await visible(h.getByLabel('Selected restaurant [Fixture] Fancy North Kitchen')).waitFor();
      const date = londonDateIn(9);
      await tap(h, 'Date: Choose a date');
      if (date.slice(0, 7) !== londonDateIn(0).slice(0, 7)) await tap(h, 'Next month');
      await radio(h, longDate(date)).click();
      await radio(h, '19:00').click();
      await tap(h, 'Continue');
      // Step 2 · introduce.
      await fill(h, 'Give your meal a name', createdTitle);
      await fill(h, 'What should people expect?', 'Slurp good noodles, talk about the music we love and swap London tips.');
      await radio(h, 'Easy conversation').click();
      await checkbox(h, 'English').click();
      await tap(h, 'Continue');
      // Step 3 · costs & reservation.
      await fill(h, 'Budget from per person in pounds', '15');
      await fill(h, 'Budget to per person in pounds', '30');
      await checkbox(h, /reserv|book/i).click();
      await tap(h, 'Continue');
      // Step 4 · review & publish.
      await see(h, createdTitle);
      await checkbox(h, 'I’ve reviewed the details guests will see.').click();
      await tap(h, 'Publish meal');
      await see(h, 'A little about this meal', 15_000);
      await see(h, createdTitle);
      const found = (await seedHost.host.call('myMeals', { query: { section: 'HOSTING' } })).data.find((i) => i.meal.title === createdTitle);
      if (!found) throw new Error('published meal is not in the host’s Hosting list');
      if (found.meal.venue.placeId !== 'fixture_fancy_north' || found.meal.startsAt.localDate !== date || found.meal.startsAt.localTime !== '19:00' || found.meal.budgetMinPence !== 1500 || found.meal.budgetMaxPence !== 3000) {
        throw new Error(`published meal does not match the form: ${JSON.stringify({ venue: found.meal.venue.placeId, startsAt: found.meal.startsAt, budget: [found.meal.budgetMinPence, found.meal.budgetMaxPence] })}`);
      }
      return found.meal;
    });

    const editedTitle = `Ramen, records and vinyl ${run}`;
    await step('host edits the meal before anyone is approved', async () => {
      await tap(h, 'Manage applications');
      await tap(h, 'Edit meal');
      await tap(h, 'Continue');
      await fill(h, 'Give your meal a name', editedTitle);
      await tap(h, 'Continue');
      await tap(h, 'Continue');
      await tap(h, 'Save changes');
      await see(h, 'Changes saved. Guests see the updated details.', 15_000);
      await see(h, editedTitle);
      // The edit response carries no provider display; the guest list must keep the restaurant name.
      await see(h, /Fancy North Kitchen/);
      const meal = (await seedHost.host.call('getMeal', { params: { mealId: created.id } })).data.meal;
      if (meal.title !== editedTitle || meal.version === created.version) throw new Error(`edit not saved: ${meal.title} v${meal.version}`);
    });

    await step('guest blocks the host from the host’s profile', async () => {
      failedPage = g;
      await openTab(g, 'Meals');
      await openTab(g, 'Upcoming');
      await press(visible(g.getByText(seedHost.supper.title)));
      await tap(g, 'Your host, Hana');
      await tap(g, 'Block Hana');
      await tap(g, 'Confirm block');
      await see(g, 'Member blocked. Private contact is disabled. Shared groups are unchanged.');
      const state = await seedHost.host.call('getBlock', { params: { subjectId: guestId } }).catch(() => null);
      if (state?.data.blocked) throw new Error('the host’s own block setting changed');
    });

    await step('guest reports the host’s profile and gets a receipt', async () => {
      await tap(g, 'Report this profile');
      await visible(g.getByLabel('Reporting Hana')).waitFor();
      await fill(g, 'What would you like us to know?', `E2E check ${run}: please ignore, this is a synthetic report.`);
      await tap(g, 'Submit report');
      await see(g, 'Report received');
      await see(g, 'Status: Received');
      await tap(g, 'Check report status');
      await see(g, 'Status: Received');
      await tap(g, 'Done');
    });

    await step('Settings › Blocked members lists the host and unblocks', async () => {
      await openTab(g, 'Profile');
      await tap(g, 'Settings');
      await tap(g, 'Blocked members');
      await button(g, 'Open Hana’s profile').waitFor();
      await tap(g, 'Unblock');
      await visible(g.getByRole('button', { name: 'Unblock', exact: true }).last()).waitFor();
      await press(g.getByRole('button', { name: 'Unblock', exact: true }).locator('visible=true').last());
      await see(g, 'Hana is unblocked. Your previous connection isn’t restored.');
      await see(g, 'You haven’t blocked anyone.');
    });

    await step('Settings › Product survey saves', async () => {
      await g.goBack();
      await tap(g, 'Product survey');
      await radio(g, 'Yes').click();
      await tap(g, 'Save survey');
      await see(g, 'Thank you. Your product survey is saved.');
      await button(g, 'Update survey').waitFor();
    });

    await step('notifications: guest sees “Booking updated” and “Request approved” and marks them read', async () => {
      await g.goBack();
      await tap(g, 'Notifications');
      await see(g, 'Request approved');
      await see(g, 'Booking updated');
      // Newest first: the booking update, then the approval; mark both read.
      await tap(g, 'Mark as read');
      await visible(g.getByRole('button', { name: /^Booking updated, .*(?<!unread)$/ })).waitFor();
      await tap(g, 'Mark as read');
      await visible(g.getByRole('button', { name: /^Request approved, .*(?<!unread)$/ })).waitFor();
    });

    if (problems.length) throw new Error('Unexpected API failures');
    console.warn(`\nAll steps passed (run ${run}).`);
  } catch (error) {
    console.error(`\n✗ FAILED at step: ${current}\n${(error as Error).stack ?? error}`);
    if (failedPage) {
      const shot = join(ARTIFACTS, `failure-${run}.png`);
      await failedPage.screenshot({ path: shot }).catch(() => undefined);
      console.error(`Screenshot: ${shot}`);
      console.error((await failedPage.innerText('body').catch(() => '')).slice(0, 1500));
    }
    process.exitCode = 1;
  } finally {
    if (problems.length) console.error(`Unexpected API responses:\n${problems.map((p) => `  [${p.page}] ${p.status} ${p.method} ${p.path} ${p.body}`).join('\n')}`);
    await browser?.close();
    await stack.stop();
  }
}

export type { Actor };
await main();
