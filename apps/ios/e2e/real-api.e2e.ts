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
import { ageSignIn, expireAccessTokens, insertFinishedMeal, openDatabase, waitUntil } from './fixtures.ts';

const require = createRequire(import.meta.url);

/**
 * The slice of Playwright this run uses. Playwright is preinstalled on the machine (resolved at run
 * time, never a workspace dependency), so its types are declared here structurally.
 */
interface Locator {
  click(options?: { timeout?: number }): Promise<void>;
  count(): Promise<number>;
  dispatchEvent(type: string): Promise<void>;
  fill(value: string): Promise<void>;
  waitFor(options?: { state?: 'visible'; timeout?: number }): Promise<void>;
  locator(selector: string): Locator;
  first(): Locator;
  last(): Locator;
}
interface Response { url(): string; status(): number; text(): Promise<string>; json(): Promise<unknown>; request(): { method(): string; postDataJSON(): unknown } }
interface Page {
  goto(url: string): Promise<unknown>;
  goBack(): Promise<unknown>;
  evaluate(fn: () => void): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
  innerText(selector: string): Promise<string>;
  getByRole(role: string, options: { name: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp): Locator;
  getByLabel(text: string, options?: { exact?: boolean }): Locator;
  waitForResponse(match: (response: Response) => boolean): Promise<Response>;
  waitForEvent(event: 'filechooser'): Promise<{ setFiles(files: string): Promise<void> }>;
  on(event: 'response', listener: (response: Response) => void): void;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', listener: (error: Error) => void): void;
}
interface BrowserContext { newPage(): Promise<Page> }
interface Browser { newContext(options: { viewport: { width: number; height: number }; baseURL: string; extraHTTPHeaders?: Record<string, string> }): Promise<BrowserContext>; close(): Promise<void> }
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
/**
 * One client address per simulated device (RFC 5737 documentation range), forwarded through the
 * stack's trusted local proxy, so per-IP limits such as 5 OTP codes per 15 minutes apply per device.
 */
const IP = { guest: '198.51.100.11', host: '198.51.100.12', seed: '198.51.100.21' } as const;
/** A real PNG portrait from the app's bundled artwork, uploaded through the web file chooser. */
const PHOTO = join(import.meta.dirname, '../assets/images/maya.png');
const INTRO = 'I moved to London last month and would love to meet people over a relaxed dinner.';

interface Problem { page: string; status: number; method: string; path: string; body: string }

/**
 * Responses a step deliberately provokes (e.g. the 403 REAUTH_REQUIRED that starts re-authentication);
 * a step pushes a matcher and removes it when done. Everything else ≥ 400 fails the run.
 */
const expectedProblems = new Set<(p: Problem) => boolean>();
async function expecting<T>(match: (p: Problem) => boolean, fn: () => Promise<T>): Promise<T> {
  expectedProblems.add(match);
  try { return await fn(); } finally { expectedProblems.delete(match); }
}

/** One phone-sized browser profile per person; records every failed /v1 call and console error. */
async function person(browser: Browser, name: string, baseUrl: string, problems: Problem[], clientIp: string) {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: baseUrl, extraHTTPHeaders: { 'x-forwarded-for': clientIp } });
  const page = await context.newPage();
  page.on('response', async (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith('/v1/') || res.status() < 400) return;
    const problem = { page: name, status: res.status(), method: res.request().method(), path: url.pathname + url.search, body: (await res.text().catch(() => '')).slice(0, 400) };
    if (![...expectedProblems].some((match) => match(problem))) problems.push(problem);
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
    if (i === 0) await page.goBack();
    else {
      // History that starts on a pushed screen (the create/edit flow replaces entries) would lead out
      // of the app; go to Discover client-side instead, the way the router handles a link.
      await page.evaluate(() => { window.history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    }
  }
}
async function openTab(page: Page, name: string) {
  const tab = visible(page.getByRole('tab', { name, exact: true }));
  await untilVisible(page, tab);
  await press(tab);
}
const radio = (page: Page, name: string | RegExp) => visible(page.getByRole('radio', { name, exact: typeof name === 'string' }));
const checkbox = (page: Page, name: string | RegExp) => visible(page.getByRole('checkbox', { name, exact: typeof name === 'string' }));

async function signInInBrowser(page: Page, email: string, firstOnDevice = true) {
  await see(page, 'Continue with email');
  await tap(page, 'Continue with email');
  await fill(page, 'Email address', email);
  await tap(page, 'Send code');
  await fill(page, '6-digit code', OTP);
  await tap(page, 'Verify & continue');
  // One-time optional analytics sheet after the first sign-in on a device (declining keeps everything working).
  if (firstOnDevice) await button(page, 'Decline analytics').click({ timeout: 10_000 });
}
/**
 * Taps the confirming button of a sheet whose name repeats the action that opened it (the sheet
 * renders last, so its button is the last visible one once both are on screen).
 */
async function confirmSheet(page: Page, name: string) {
  const all = page.getByRole('button', { name, exact: true }).locator('visible=true');
  await waitUntil(`sheet button “${name}”`, async () => (await all.count()) >= 2, 10_000);
  await press(all.last());
}
/** Inbox › Chats shows the row (the Inbox may open on Applications while it settles after loading). */
async function openChat(page: Page, row: RegExp) {
  for (let i = 0; i < 4; i++) {
    await press(visible(page.getByRole('tab', { name: /^Chats/ })));
    if (await button(page, row).waitFor({ timeout: 3_000 }).then(() => true, () => false)) return;
  }
  throw new Error(`no chat row ${row}`);
}
const statusOf = (r: Response) => r.status();
const isCall = (method: string, path: RegExp) => (r: Response) => r.request().method() === method && path.test(new URL(r.url()).pathname);
async function expectOk(waiting: Promise<Response>, what: string) {
  const r = await waiting;
  if (statusOf(r) >= 400) throw new Error(`${what}: ${statusOf(r)} ${await r.text()}`);
  return r;
}

async function main() {
  const stack = await startStack(stackOptions());
  const db = openDatabase(stack.databaseUrl);
  const problems: Problem[] = [];
  let browser: Browser | null = null;
  let failedPage: Page | null = null;
  try {
    // ---- Seed: a host with two published meals, created through the real API.
    const seedHost = await step('seed host and meals through the API', async () => {
      const host = await signIn(stack.apiUrl, HOST_EMAIL, OTP, IP.seed);
      await completeProfile(host, 'Hana');
      const supper = await publishMeal(host, { placeId: 'fixture_fancy_north', title: `Sunday supper ${run}`, days: 5 });
      const tapas = await publishMeal(host, { placeId: 'fixture_fancy_south', title: `Tapas night ${run}`, days: 6 });
      // The API maps the fixture restaurants' coordinates with the shipped verified London area dataset.
      if (supper.areaCode !== 'holborn-bloomsbury-south' || tapas.areaCode !== 'newington-kennington-east-walworth-west') {
        throw new Error(`unexpected meal areas ${supper.areaCode} / ${tapas.areaCode}`);
      }
      return { host, supper, tapas, signedInAt: Date.now() };
    });

    browser = await chromium.launch();
    const guest = await person(browser, 'guest', stack.webUrl, problems, IP.guest);
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
    let guestPhoto = '';
    await step('profile setup', async () => {
      await see(g, 'A face. A little story. You.');
      await fill(g, 'First name', 'Gina');
      await fill(g, 'A little about you', 'New to London, I love trying small family restaurants and long chats.');
      await radio(g, 'New to London').click();
      await radio(g, 'English').click();
      await checkbox(g, 'Food').click();
      await checkbox(g, /18 or older/).click();
      // Profile photo: the web picker's file chooser → client resize to a JPEG → PUT /v1/me/avatar.
      const chooser = g.waitForEvent('filechooser');
      const uploaded = g.waitForResponse((r) => r.url().endsWith('/v1/me/avatar') && r.request().method() === 'PUT');
      await tap(g, 'Upload photo');
      await (await chooser).setFiles(PHOTO);
      const upload = await uploaded;
      if (upload.status() !== 200) throw new Error(`photo upload failed: ${upload.status()} ${await upload.text()}`);
      const sent = (upload.request().postDataJSON() as { imageBase64: string }).imageBase64;
      if (!sent.startsWith('/9j/')) throw new Error('the app did not send a JPEG');
      const avatarUrl = ((await upload.json()) as { data: { avatarUrl: string } }).data.avatarUrl;
      const photo = await fetch(new URL(new URL(avatarUrl).pathname, stack.webUrl));
      if (photo.status !== 200 || photo.headers.get('content-type') !== 'image/jpeg') throw new Error(`photo is not served: ${photo.status} ${photo.headers.get('content-type')}`);
      guestPhoto = new URL(new URL(avatarUrl).pathname, stack.webUrl).toString();
      await button(g, 'Change photo').waitFor({ timeout: 10_000 });
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

    const host = await person(browser, 'host', stack.webUrl, problems, IP.host);
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
      // The card names the meal's area from the verified dataset, and never repeats “London, London”.
      const body = await g.innerText('body');
      if (!body.includes('Holborn & Bloomsbury South')) throw new Error('meal card does not name the meal’s area');
      if (body.includes('London, London')) throw new Error('meal card repeats “London, London”');
    });

    const message = `Hello table! Looking forward to it (${run}).`;
    await step('group chat appears in Inbox and guest sends a message', async () => {
      await openTab(g, 'Inbox');
      // Inbox opens the group chat of the meal just applied to (once); otherwise tap its row.
      const composer = visible(g.getByLabel('Message', { exact: true }));
      if (!(await composer.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false))) await tap(g, new RegExp(seedHost.supper.title));
      await fill(g, 'Message', message);
      // The bubble shows while the send is still in flight; wait for the server to accept it.
      const sent = g.waitForResponse(isCall('POST', /\/v1\/conversations\/[^/]+\/messages$/));
      await tap(g, 'Send message');
      await expectOk(sent, 'send message');
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

    // ---- J02/J03 through the app UI: withdraw, decline, cancel my place, cancel the meal.
    await step('guest applies to a second meal and withdraws the request', async () => {
      failedPage = g;
      await openTab(g, 'Discover');
      await press(visible(g.getByText(seedHost.tapas.title)));
      await tap(g, 'Apply to join');
      await fill(g, 'Your introduction', INTRO);
      await tap(g, 'Send request');
      await see(g, 'Your hello is on its way.');
      const withdrawn = g.waitForResponse(isCall('POST', /\/v1\/applications\/[^/]+\/withdraw$/));
      await tap(g, 'Withdraw request');
      await confirmSheet(g, 'Withdraw request');
      await expectOk(withdrawn, 'withdraw');
      await see(g, 'Your request is withdrawn.');
      const apps = (await seedHost.host.call('listApplications', { params: { mealId: seedHost.tapas.id } })).data;
      if (apps.length !== 1 || apps[0]!.state !== 'WITHDRAWN') throw new Error(`host sees ${JSON.stringify(apps.map((a) => a.state))}`);
    });

    await step('guest applies again and the host declines the request', async () => {
      await tap(g, 'Apply again');
      await fill(g, 'Your introduction', `${INTRO} Second try.`);
      await tap(g, 'Send request');
      await see(g, 'Your hello is on its way.');
      failedPage = h;
      await openTab(h, 'Meals');
      await openTab(h, 'Hosting');
      await press(visible(h.getByText(seedHost.tapas.title)));
      await tap(h, 'Manage applications');
      await tap(h, 'Decline Gina');
      const declined = h.waitForResponse(isCall('POST', /\/v1\/applications\/[^/]+\/decision$/));
      await tap(h, 'Decline request');
      await expectOk(declined, 'decline');
      await see(h, 'Declined');
      failedPage = g;
      // The status page polls every 15s while the request is under review.
      await see(g, 'Another table awaits.', 30_000);
    });

    await step('guest cancels their place on the first meal', async () => {
      await openTab(g, 'Meals');
      await openTab(g, 'Upcoming');
      await press(visible(g.getByText(seedHost.supper.title)));
      const left = g.waitForResponse(isCall('POST', /\/v1\/meals\/[^/]+\/leave$/));
      await tap(g, 'Cancel my place');
      await confirmSheet(g, 'Cancel my place');
      await expectOk(left, 'leave');
      await button(g, 'Apply to join').waitFor({ timeout: 10_000 });
      const meal = (await seedHost.host.call('getMeal', { params: { mealId: seedHost.supper.id } })).data.meal;
      if (meal.confirmedCount !== 1 || meal.members.some((m) => m.id === guestId)) throw new Error(`guest still seated: ${meal.confirmedCount}`);
      await openTab(g, 'Meals');
      await openTab(g, 'Cancelled');
      await see(g, seedHost.supper.title);
    });

    await step('host cancels a meal for everyone', async () => {
      failedPage = h;
      await openTab(h, 'Meals');
      await openTab(h, 'Hosting');
      await press(visible(h.getByText(editedTitle)));
      await tap(h, 'Manage applications');
      await tap(h, 'Cancel meal for everyone');
      await radio(h, 'I can’t make it').click();
      const cancelled = h.waitForResponse(isCall('POST', /\/v1\/meals\/[^/]+\/cancel$/));
      await confirmSheet(h, 'Cancel meal for everyone');
      await expectOk(cancelled, 'cancel meal');
      await see(h, 'Meal cancelled.');
      const meal = (await seedHost.host.call('getMeal', { params: { mealId: created.id } })).data.meal;
      if (meal.status !== 'CANCELLED' || meal.cancelReason !== 'host') throw new Error(`meal not cancelled: ${meal.status} ${meal.cancelReason}`);
    });

    // ---- Session lifecycle through the app.
    let signedBackInAt = 0;
    await step('guest signs out and signs back in', async () => {
      await openTab(g, 'Profile');
      await tap(g, 'Settings');
      const loggedOut = g.waitForResponse(isCall('POST', /\/v1\/auth\/logout$/));
      await tap(g, 'Sign out');
      await confirmSheet(g, 'Sign out');
      await expectOk(loggedOut, 'logout');
      await openTab(g, 'Profile');
      await tap(g, 'Sign in or create an account');
      const verified = g.waitForResponse(isCall('POST', /\/v1\/auth\/email\/verify$/));
      await signInInBrowser(g, GUEST_EMAIL, false);
      await expectOk(verified, 'second sign-in');
      signedBackInAt = Date.now();
      await openTab(g, 'Profile');
      await button(g, 'Edit profile').waitFor({ timeout: 10_000 });
      const { rows } = await db.query<{ reason: string | null }>(`SELECT revoke_reason AS reason FROM session_families WHERE user_id=$1 ORDER BY created_at`, [guestId]);
      if (rows.length !== 2 || rows[0]!.reason !== 'LOGOUT' || rows[1]!.reason !== null) throw new Error(`session families: ${JSON.stringify(rows)}`);
    });

    // ---- J04 after the meal. Two meals that already took place, completed by the real worker.
    const finishedTitle = `Supper we shared ${run}`;
    const closedTitle = `Long ago lunch ${run}`;
    const past = await step('worker completes two meals that took place (1 hour and 8 days ago)', async () => {
      const venueRef = seedHost.supper.venue.venueRef;
      const finished = await insertFinishedMeal(db, { hostId: seedHost.host.userId, guestId, venueRef, title: finishedTitle, endedAgoMs: 3_600_000 });
      const closed = await insertFinishedMeal(db, { hostId: seedHost.host.userId, guestId, venueRef, title: closedTitle, endedAgoMs: 8 * 86_400_000 });
      const state = (await seedHost.host.call('postMealState', { params: { mealId: finished } })).data;
      if (!state.windowOpen || state.eligibleMembers.length !== 2) throw new Error(`post-meal window: ${JSON.stringify(state)}`);
      if ((await seedHost.host.call('postMealState', { params: { mealId: closed } })).data.windowOpen) throw new Error('8-day-old meal still accepts feedback');
      // Before a meal ends there is no post-meal page.
      const early = await seedHost.host.call('postMealState', { params: { mealId: seedHost.tapas.id } }).then(() => 200, (e: { status?: number }) => e.status);
      if (early !== 403) throw new Error(`post-meal before the meal: ${early}`);
      return { finished, closed };
    });

    await step('guest: Meals › Past → attendance and private score; references wait for the host’s attendance', async () => {
      failedPage = g;
      await openTab(g, 'Meals');
      await openTab(g, 'Past');
      await see(g, closedTitle);
      await press(visible(g.getByText(finishedTitle)));
      await tap(g, 'After the meal');
      await see(g, 'How was your table?');
      const attended = g.waitForResponse(isCall('PUT', /\/attendance\//));
      await radio(g, 'I attended').click();
      await expectOk(attended, 'attendance');
      const scored = g.waitForResponse(isCall('PUT', /\/experience$/));
      await radio(g, '5').click();
      await expectOk(scored, 'score');
      // PRD §0.5: a reference or meet-again needs the tablemate's attendance too.
      await see(g, 'Hana hasn’t confirmed attending yet. You can leave a reference or choose to meet again once they do.');
    });

    await step('host: attendance, host report, score, reference and a private one-sided choice', async () => {
      failedPage = h;
      await openTab(h, 'Meals');
      await openTab(h, 'Past');
      await press(visible(h.getByText(finishedTitle)));
      await tap(h, 'After the meal');
      await see(h, 'How was your table?');
      const attended = h.waitForResponse(isCall('PUT', /\/attendance\//));
      await radio(h, 'I attended').click();
      await expectOk(attended, 'host attendance');
      await radio(h, 'Gina came').click();
      await tap(h, 'Review attendance for Gina');
      await tap(h, 'Confirm attendance report');
      await see(h, 'Host report saved. Each member’s own report takes priority.');
      const scored = h.waitForResponse(isCall('PUT', /\/experience$/));
      await radio(h, '4').click();
      await expectOk(scored, 'host score');
      await fill(h, 'Reference for Gina', 'Gina asked great questions and kept the conversation going.');
      await tap(h, 'Save reference for Gina');
      await see(h, 'Your reference is waiting to be published.');
      await checkbox(h, 'I’d like to share a table again with Gina').click();
      await see(h, 'Your choice is private. Gina is never told unless they choose you too.');
      // The guest sees neither the host's choice nor the unpublished reference.
      const guestApi = (await seedHost.host.call('getPublicProfile', { params: { userId: guestId } })).data.reviews;
      if (guestApi.length) throw new Error('a one-sided reference is public');
      const state = (await seedHost.host.call('postMealState', { params: { mealId: past.finished } })).data;
      const own = state.reconnect.find((r) => r.subjectId === guestId);
      if (!own?.selected || own.connection !== 'WAITING') throw new Error(`host choice: ${JSON.stringify(own)}`);
    });

    const hello = `Lovely to meet you, Hana (${run})!`;
    await step('guest: reference publishes both, mutual choice opens a private chat', async () => {
      failedPage = g;
      // Re-open the page so it reads the host's attendance.
      await g.goBack();
      await tap(g, 'After the meal');
      await fill(g, 'Reference for Hana', 'Hana made everyone feel welcome and picked a wonderful table.');
      await tap(g, 'Save reference for Hana');
      await see(g, 'Your reference is published on their profile.');
      const hana = (await seedHost.host.call('getPublicProfile', { params: { userId: seedHost.host.userId } })).data.reviews;
      const gina = (await seedHost.host.call('getPublicProfile', { params: { userId: guestId } })).data.reviews;
      if (hana.length !== 1 || gina.length !== 1) throw new Error(`published references: Hana ${hana.length}, Gina ${gina.length}`);
      await checkbox(g, 'I’d like to share a table again with Hana').click();
      await see(g, 'You and Hana both want to meet again.');
      await tap(g, 'Say hello to Hana');
      await fill(g, 'Message', hello);
      await tap(g, 'Send message');
      await see(g, hello);
      const direct = (await seedHost.host.call('getDirect', { params: { subjectId: guestId } })).data;
      if (direct.kind !== 'DIRECT' || !direct.canSend) throw new Error(`direct chat: ${JSON.stringify(direct)}`);
    });

    await step('host finds the private chat in Inbox and replies', async () => {
      failedPage = h;
      await openTab(h, 'Inbox');
      await openChat(h, /^Gina/);
      await tap(h, /^Gina/);
      await see(h, hello);
      await fill(h, 'Message', 'Likewise! Let’s find another table soon.');
      await tap(h, 'Send message');
      await see(h, 'Likewise! Let’s find another table soon.');
    });

    await step('a meal that ended 8 days ago shows a closed, read-only feedback window', async () => {
      failedPage = g;
      await openTab(g, 'Meals');
      await openTab(g, 'Past');
      await press(visible(g.getByText(closedTitle)));
      await tap(g, 'After the meal');
      await see(g, 'The feedback window for this meal has closed.');
      if (await visible(g.getByRole('radio', { name: 'I attended', exact: true })).waitFor({ timeout: 1_000 }).then(() => true, () => false)) throw new Error('closed window still offers attendance');
      const late = await seedHost.host.call('reportAttendance', { params: { mealId: past.closed, subjectId: seedHost.host.userId }, body: { value: 'present' }, ifMatch: '0', idempotencyKey: randomUUID() }).then(() => 200, (e: { status?: number }) => e.status);
      if (late !== 409) throw new Error(`late attendance: ${late}`);
    });

    await step('an expired access token is refreshed and the call replayed', async () => {
      await expireAccessTokens(db, guestId);
      const refreshed = g.waitForResponse(isCall('POST', /\/v1\/auth\/refresh$/));
      await expecting((p) => p.page === 'guest' && p.status === 401 && !p.path.startsWith('/v1/auth/'), async () => {
        await openTab(g, 'Inbox');
        await expectOk(refreshed, 'refresh');
        await openChat(g, /^Hana/);
      });
    });

    // ---- J08 account deletion: re-authentication with a second code, receipt, status, data removed.
    const deletion = await step('guest deletes the account after re-authenticating with a new code', async () => {
      // One code per email every 30s; the sign-in older than 5 minutes forces re-authentication.
      await new Promise((r) => setTimeout(r, Math.max(0, signedBackInAt + 31_000 - Date.now())));
      await ageSignIn(db, guestId);
      await openTab(g, 'Profile');
      await tap(g, 'Settings');
      await tap(g, 'Delete account');
      await see(g, 'Delete your account?');
      const reauth = g.waitForResponse(isCall('POST', /\/v1\/auth\/reauth$/));
      await expecting((p) => p.page === 'guest' && p.status === 403 && p.path === '/v1/me/deletion' && p.body.includes('REAUTH_REQUIRED'), async () => {
        await tap(g, 'Delete my account');
        await expectOk(reauth, 'reauth');
        await see(g, 'For your security, enter the code we just emailed you.');
      });
      await fill(g, '6-digit code', OTP);
      const requested = g.waitForResponse(isCall('POST', /\/v1\/me\/deletion$/));
      await tap(g, 'Confirm and delete');
      const response = await expectOk(requested, 'deletion');
      const receipt = (response.request().postDataJSON() as { receiptToken: string }).receiptToken;
      await see(g, 'Your account is being deleted');
      await see(g, receipt);
      await tap(g, 'Done');
      return { receipt };
    });

    // The host stays on the private chat: its LIVE poll is refused once the other member is gone
    // (403 CONNECTION_NOT_AUTHORIZED by contract) and the chat turns read-only.
    const hostChatClosed = (p: Problem) => p.page === 'host' && p.status === 403 && p.method === 'GET' && /\/v1\/conversations\/[^/]+\/messages$/.test(p.path.split('?')[0]!) && p.body.includes('CONNECTION_NOT_AUTHORIZED');
    expectedProblems.add(hostChatClosed);

    await step('deletion status by reference while signed out', async () => {
      await openTab(g, 'Profile');
      await tap(g, 'Check deletion status');
      // The reference was saved on this device; the status call needs no session.
      await tap(g, 'Check status');
      await see(g, /Status: (Requested|In progress|Our support team is completing this)/);
      const anon = await fetch(`${stack.apiUrl}/v1/deletion-status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receiptToken: deletion.receipt }) });
      if (anon.status !== 200) throw new Error(`deletion status: ${anon.status}`);
    });

    await step('the deleted member’s profile, photo, sessions, references and messages are gone or masked', async () => {
      // The worker's purge removes local data; the identity-provider step needs support in development.
      await waitUntil('worker purges the account', async () => {
        const { rows: [r] } = await db.query<{ local: string | null }>(`SELECT provider_steps->>'local' AS local FROM deletion_requests WHERE user_id=$1`, [guestId]);
        return r?.local === 'COMPLETED';
      });
      const { rows: [left] } = await db.query<Record<string, number>>(`SELECT
        (SELECT count(*)::int FROM profiles WHERE user_id=$1) AS profiles, (SELECT count(*)::int FROM avatar_images WHERE user_id=$1) AS photos,
        (SELECT count(*)::int FROM session_families WHERE user_id=$1) AS sessions, (SELECT count(*)::int FROM messages WHERE sender_id=$1 AND NOT redacted) AS messages`, [guestId]);
      if (Object.values(left!).some((n) => n !== 0)) throw new Error(`personal data left: ${JSON.stringify(left)}`);
      if ((await fetch(guestPhoto)).status !== 404) throw new Error('the deleted member’s photo is still served');
      const profile = await seedHost.host.call('getPublicProfile', { params: { userId: guestId } }).then(() => 200, (e: { status?: number }) => e.status);
      if (profile !== 404) throw new Error(`deleted profile is still public: ${profile}`);
      const hana = (await seedHost.host.call('getPublicProfile', { params: { userId: seedHost.host.userId } })).data.reviews;
      if (hana.length) throw new Error('the deleted member’s reference is still public');
      const meal = (await seedHost.host.call('getMeal', { params: { mealId: past.finished } })).data.meal;
      const member = meal.members.find((m) => m.id === guestId);
      if (member && (member.displayName !== 'Deleted member' || member.avatarUrl !== null)) throw new Error(`table shows ${JSON.stringify(member)}`);
      const direct = (await seedHost.host.call('getDirect', { params: { subjectId: guestId } })).data;
      const history = (await seedHost.host.call('readMessages', { params: { conversationId: direct.id }, query: { mode: 'HISTORY' } })).data;
      if (direct.canSend || history.some((m) => m.body === hello) || !history.some((m) => m.redacted && m.sender.id !== seedHost.host.userId)) throw new Error(`deleted member’s chat: canSend=${direct.canSend} ${JSON.stringify(history.map((m) => [m.sender.displayName, m.body, m.redacted]))}`);
    });

    await step('the host’s open private chat turns read-only', async () => {
      failedPage = h;
      await see(h, 'You can no longer send messages here. Earlier messages you were allowed to see stay read-only.', 20_000);
      await see(h, 'Likewise! Let’s find another table soon.');
    });
    expectedProblems.delete(hostChatClosed);

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
    await db.end();
    await stack.stop();
  }
}

export type { Actor };
await main();
