import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ANDROID_PACKAGE = 'com.pocketwealth.app';
const publicKeys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
];
const signingKeys = [
  'ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD', 'POCKET_ANDROID_KEYSTORE_PATH',
];

export function requireValues(env, names) {
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
}

export function validatePublicConfig(env) {
  requireValues(env, publicKeys);
  const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (key.startsWith('sb_secret_')) throw new Error('Never bundle a Supabase secret key.');
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()); }
    catch { throw new Error('Use a Supabase public publishable or anon key.'); }
    if (payload.role !== 'anon') throw new Error('Only a Supabase anon key may be bundled.');
  }
  if (!env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.startsWith('goog_')) {
    throw new Error('Use the public RevenueCat Google Play SDK key, not a secret or Test Store key.');
  }
}

export function releaseConfig(config, versionCode) {
  if (!/^[1-9]\d*$/.test(String(versionCode))) throw new Error('Version code must be a positive integer.');
  const code = Number(versionCode);
  if (!Number.isSafeInteger(code) || code > 2_100_000_000) throw new Error('Version code is out of Google Play range.');
  if (config.expo?.android?.package !== ANDROID_PACKAGE) throw new Error('Android package must be com.pocketwealth.app.');
  const result = structuredClone(config);
  result.expo.android.versionCode = code;
  result.expo.android.permissions = [...new Set([
    ...(result.expo.android.permissions ?? []), 'com.android.vending.BILLING',
  ])];
  return result;
}

export function decodeKeystore(value) {
  const encoded = value.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('ANDROID_KEYSTORE_BASE64 must be valid Base64.');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 128 || bytes.toString('base64') !== encoded) {
    throw new Error('ANDROID_KEYSTORE_BASE64 does not contain a valid encoded keystore.');
  }
  return bytes;
}

export function attachSigningConfig(gradleFile) {
  const directive = "apply from: '../../scripts/android-signing.gradle'";
  const source = readFileSync(gradleFile, 'utf8');
  if (!source.includes(directive)) appendFileSync(gradleFile, `\n// Pocket's release signing never uses the debug key.\n${directive}\n`);
}

function main(command, env) {
  const pocket = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (command === 'config') {
    validatePublicConfig(env);
    const path = resolve(pocket, 'app.json');
    const result = releaseConfig(JSON.parse(readFileSync(path, 'utf8')), env.POCKET_ANDROID_VERSION_CODE);
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Prepared ${ANDROID_PACKAGE} with version code ${result.expo.android.versionCode}.`);
  } else if (command === 'signing-config') {
    attachSigningConfig(resolve(pocket, 'android/app/build.gradle'));
    console.log('Release signing configuration attached.');
  } else if (command === 'keystore') {
    requireValues(env, signingKeys);
    if (!isAbsolute(env.POCKET_ANDROID_KEYSTORE_PATH)) throw new Error('Temporary keystore path must be absolute.');
    if (existsSync(env.POCKET_ANDROID_KEYSTORE_PATH)) throw new Error('Refusing to overwrite an existing keystore file.');
    writeFileSync(env.POCKET_ANDROID_KEYSTORE_PATH, decodeKeystore(env.ANDROID_KEYSTORE_BASE64), { flag: 'wx', mode: 0o600 });
    console.log('Temporary keystore prepared without printing credentials.');
  } else throw new Error('Expected config, signing-config or keystore command.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv[2], process.env); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
