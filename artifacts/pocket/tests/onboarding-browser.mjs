// Test-only CDP network fixtures. Never sends email or purchases anything.
// Usage: node artifacts/pocket/tests/onboarding-browser.mjs https://EXPO_PREVIEW_HOST
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const appUrl = process.argv[2];
if (!appUrl?.startsWith('https://')) throw new Error('Supply the running Expo HTTPS preview URL.');
const profileDir = await mkdtemp(join(tmpdir(), 'pocket-browser-'));
const browser = spawn('chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profileDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  if (!port) throw new Error('Chromium did not start.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find(t => t.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  let sequence = 0;
  const pending = new Map();
  const events = new Map();
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const call = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) call?.reject(new Error(msg.error.message)); else call?.resolve(msg.result);
    } else events.get(msg.method)?.(msg.params);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 20000) => {
    const started = Date.now();
    while (!(await evaluate(expression))) {
      if (Date.now() - started > timeout) throw new Error(`Timed out: ${expression}`);
      await delay(100);
    }
  };
  const selector = id => `[data-testid="${id}"]`;
  const click = async id => {
    const s = JSON.stringify(selector(id));
    await waitFor(`(()=>{const e=document.querySelector(${s});return e&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'})()`);
    await evaluate(`(()=>{const e=document.querySelector(${s});e.scrollIntoView({block:'nearest'});e.click()})()`);
    await delay(100);
  };
  const fill = async (id, text) => {
    const s = JSON.stringify(selector(id));
    await waitFor(`!!document.querySelector(${s})`);
    await evaluate(`(()=>{const e=document.querySelector(${s});e.focus();e.select()})()`);
    await cdp('Input.insertText', { text });
  };
  const navigate = async path => {
    await cdp('Page.navigate', { url: new URL(path, appUrl).href });
    await delay(200);
  };
  const uuid1 = '11111111-1111-4111-8111-111111111111';
  let userId = uuid1;
  let rpcFail = true;
  let selectedCurrency = 'PKR';
  const calls = { signup: 0, verify: 0, resend: 0, complete: 0, login: 0 };
  const rpcBodies = [];
  const fixtureErrors = [];
  function user() {
    return { id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid',
      email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { name: 'Browser fixture' },
      identities: [{ id: userId, user_id: userId, provider: 'email' }] };
  }
  function session() {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.dGVzdA`,
      token_type: 'bearer', refresh_token: 'test-only-refresh-token', expires_in: 3600, user: user() };
  }
  events.set('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const url = new URL(request.url);
      let status = 200;
      let body;
      const input = request.postData ? JSON.parse(request.postData) : {};
      if (request.method === 'OPTIONS') status = 204;
      else if (url.pathname.endsWith('/signup')) { calls.signup++; body = { ...user(), email_confirmed_at: null }; }
      else if (url.pathname.endsWith('/resend')) { calls.resend++; body = {}; }
      else if (url.pathname.endsWith('/verify')) {
        calls.verify++;
        if (input.token !== '123456') { status = 403; body = { code: 'otp_expired', msg: 'Token has expired or is invalid' }; }
        else body = session();
      } else if (url.pathname.endsWith('/user')) body = user();
      else if (url.pathname.endsWith('/token')) { calls.login++; body = session(); }
      else if (url.pathname.endsWith('/logout')) status = 204;
      else if (url.pathname.endsWith('/rpc/complete_onboarding')) {
        calls.complete++; rpcBodies.push(input);
        if (input.p_expected_user_id !== userId) { status = 403; body = { message: 'Account changed' }; }
        else if (rpcFail) { status = 503; body = { message: 'Test-only temporary failure' }; }
        else { selectedCurrency = input.p_currency; status = 204; }
      } else if (url.pathname.endsWith('/profiles')) {
        const profile = { id: userId, name: 'Browser fixture', email: 'fixture@example.invalid', primary_currency: selectedCurrency,
          secondary_currency: 'PKR', appearance: 'light', reminder_enabled: false, reminder_time: '13:00' };
        body = String(request.headers.Accept ?? request.headers.accept).includes('object') ? profile : [profile];
      } else if (url.pathname.startsWith('/rest/v1/')) body = [];
      else { status = 400; body = { message: 'Unexpected test endpoint' }; fixtureErrors.push(url.pathname); }
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Headers', value: 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,accept-profile,content-profile' },
          { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' }],
        body: Buffer.from(status === 204 ? '' : JSON.stringify(body)).toString('base64') });
    } catch (error) { fixtureErrors.push(error.message); }
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/*' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('/onboarding');
  await waitFor(`!!document.querySelector('${selector('onboarding-start')}')`, 150000);
  await click('onboarding-start');
  await click('onboarding-option-goal-saving');
  await mkdir('generated-artifacts/pocket-onboarding', { recursive: true });
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile('generated-artifacts/pocket-onboarding/question.png', Buffer.from(shot.data, 'base64'));
  await click('onboarding-next');
  await cdp('Page.reload');
  await click('onboarding-option-challenge-consistency');
  await click('onboarding-next');
  await click('onboarding-back');
  await click('onboarding-skip');
  await click('onboarding-option-frequency-weekly');
  await click('onboarding-next');
  await click('onboarding-option-currency-USD');
  await click('onboarding-next');
  await waitFor(`document.body.innerText.includes('Currency: USD')`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await click('onboarding-summary-cta');
  await fill('signup-name', 'Browser fixture');
  await fill('signup-email', 'fixture@example.invalid');
  await fill('signup-password', 'Fixture-only-password-123!');
  await click('signup-submit');
  await waitFor(`!!document.querySelector('${selector('verify-code')}')`);
  assert.equal(calls.signup, 1);
  assert.equal(calls.resend, 0);
  assert.equal(await evaluate(`document.querySelector('${selector('verify-resend')}').getAttribute('aria-disabled')==='true'`), true);
  await cdp('Page.reload');
  await fill('signup-verify-email', 'fixture@example.invalid');
  await fill('verify-code', '000000');
  await click('verify-submit');
  await waitFor(`document.body.innerText.includes('incorrect or has expired')`);
  await fill('verify-code', '123 456');
  await click('verify-submit');
  await waitFor(`!!document.querySelector('${selector('complete-setup-retry')}')`);
  assert.equal(await evaluate(`location.pathname.endsWith('/complete-setup')`), true);
  await cdp('Page.reload');
  await waitFor(`!!document.querySelector('${selector('complete-setup-retry')}')`);
  rpcFail = false;
  await click('complete-setup-retry');
  await waitFor(`location.pathname.endsWith('/subscribe')`);
  assert.equal(selectedCurrency, 'USD');
  assert.equal(rpcBodies.at(-1).p_challenge, null, 'Skip should clear a previous selection');
  assert.equal(rpcBodies.at(-1).p_frequency, 'weekly');
  assert.equal(rpcBodies.at(-1).p_expected_user_id, uuid1);
  await cdp('Page.reload');
  await waitFor(`location.pathname.endsWith('/subscribe')`);
  assert.equal(calls.signup, 1);
  assert.equal(calls.verify, 2);
  assert.equal(calls.resend, 0);
  const completeBeforeSwitch = calls.complete;
  await cdp('Storage.clearDataForOrigin', { origin: new URL(appUrl).origin, storageTypes: 'all' });
  await navigate('/signup?verify=1');
  await waitFor(`!!document.querySelector('${selector('verify-code')}')`);
  await evaluate(`localStorage.setItem('pocket:onboarding:v1',JSON.stringify({version:1,step:5,answers:{goal:'debt',challenge:null,frequency:null,currency:'AED'},ready:true,ownerId:'${uuid1}',nextEmailAt:0}))`);
  await cdp('Page.reload');
  userId = '22222222-2222-4222-8222-222222222222';
  await fill('signup-verify-email', 'other-fixture@example.invalid');
  await fill('verify-code', '123456');
  await click('verify-submit');
  await waitFor(`location.pathname.endsWith('/subscribe')`);
  assert.equal(calls.complete, completeBeforeSwitch, 'Another account must not receive the saved draft');
  const saved = await evaluate(`JSON.parse(localStorage.getItem('pocket:onboarding:v1'))`);
  assert.equal(saved.ownerId, null);
  assert.equal(saved.ready, false);
  await cdp('Storage.clearDataForOrigin', { origin: new URL(appUrl).origin, storageTypes: 'all' });
  await navigate('/login');
  await waitFor(`document.querySelectorAll('input').length===2`);
  for (const [index, text] of [[0, 'other-fixture@example.invalid'], [1, 'Fixture-only-password-123!']]) {
    await evaluate(`document.querySelectorAll('input')[${index}].focus()`);
    await cdp('Input.insertText', { text });
  }
  await click('login-submit');
  await waitFor(`location.pathname.endsWith('/subscribe')`);
  assert.equal(calls.login, 1);
  assert.equal(calls.complete, completeBeforeSwitch, 'Returning password login must not re-run onboarding');
  assert.deepEqual(fixtureErrors, []);
  console.log(JSON.stringify({ passed: true, cases: ['four questions', 'draft reload', 'edit and skip', 'six-digit paste',
    'wrong code', 'cooldown reload', 'no automatic sends', 'save failure and retry', 'verified session restart',
    'currency persisted before paywall', 'no second login', 'cross-account draft isolation', 'returning password login'], calls }));
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => { browser.once('exit', resolve); setTimeout(resolve, 3000); });
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
