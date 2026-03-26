// E2E test: verify that unskipping a group restores it in recommendations.
//
// Uses Playwright to interact with the real UI in a browser. Sets up
// localStorage with synthetic item data, navigates to a mode, and exercises
// the skip/unskip controls on the Progress tab's level progress cards.
//
// Tests both semitone math (all-generic-mode path) and guitar fretboard
// (which has a useController hook) to catch mode-specific regressions.
//
// Usage: npx tsx tests/e2e/skip-unskip.test.ts

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type Browser, chromium, type Page } from 'playwright';
import { type ChildProcess } from 'node:child_process';
import {
  generateLocalStorageData,
} from '../../src/fixtures/recommendation-scenarios.ts';
import { GUITAR } from '../../src/music-data.ts';
import { getItemIdsForGroup as guitarGetItemIds } from '../../src/modes/fretboard/logic.ts';
import { startServer } from './helpers/server.ts';

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

let browser: Browser;
let server: ChildProcess;
let baseUrl: string;

before(async () => {
  const { proc, portReady } = startServer(8003);
  server = proc;
  const port = await portReady;
  baseUrl = `http://localhost:${port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

// ---------------------------------------------------------------------------
// Helper: set up a page with localStorage data and navigate to a mode
// ---------------------------------------------------------------------------

async function setupMode(
  modeId: string,
  storageData: Record<string, string>,
  enabledGroupsKey: string,
  enabledGroups: number[],
): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 873 },
  });
  const page = await ctx.newPage();

  // First load to get access to localStorage
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  // Inject localStorage
  await page.evaluate(
    ({ items, key, groups }) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(items)) {
        localStorage.setItem(k, v);
      }
      localStorage.setItem(key, JSON.stringify(groups));
    },
    { items: storageData, key: enabledGroupsKey, groups: enabledGroups },
  );

  // Reload and navigate to mode
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await page.click(`[data-mode="${modeId}"]`);
  await page.waitForSelector(`#mode-${modeId}.mode-active`);

  return page;
}

// ---------------------------------------------------------------------------
// Shared test logic: skip/unskip cycle via progress tab level cards
// ---------------------------------------------------------------------------

async function runSkipUnskipTests(
  page: Page,
  modeSelector: string,
  targetLabel: string,
) {
  // --- Initial: target group should be in recommendation on practice tab ---
  const initialText = await page.textContent(
    `${modeSelector} .suggestion-lines`,
  );
  assert.ok(initialText, 'suggestion lines should have text');
  assert.ok(
    initialText.includes(targetLabel),
    `initial recommendation should include "${targetLabel}": "${initialText}"`,
  );

  // --- Switch to Progress tab to access skip/unskip controls ---
  await page.click(`${modeSelector} [data-tab="progress"]`);
  await page.waitForTimeout(200);

  // --- Skip: click the X button on the target level card ---
  await page
    .locator(
      `${modeSelector} [aria-label="Skip ${targetLabel}"]`,
    )
    .click();
  await page.waitForTimeout(300);

  // --- Switch back to Practice tab to check recommendation ---
  await page.click(`${modeSelector} [data-tab="practice"]`);
  await page.waitForTimeout(200);

  const afterSkipText = await page.textContent(
    `${modeSelector} .suggestion-lines`,
  );
  assert.ok(afterSkipText, 'suggestion lines should have text after skip');
  assert.ok(
    !afterSkipText.includes(targetLabel),
    `should NOT include "${targetLabel}" after skip: "${afterSkipText}"`,
  );

  // --- Unskip: switch to Progress tab, click the X button again to clear ---
  await page.click(`${modeSelector} [data-tab="progress"]`);
  await page.waitForTimeout(200);

  await page
    .locator(
      `${modeSelector} [aria-label="Skip ${targetLabel}"]`,
    )
    .click();
  await page.waitForTimeout(300);

  // --- Switch back to Practice tab to verify recommendation restored ---
  await page.click(`${modeSelector} [data-tab="practice"]`);
  await page.waitForTimeout(200);

  const afterUnskipText = await page.textContent(
    `${modeSelector} .suggestion-lines`,
  );
  assert.ok(
    afterUnskipText,
    'suggestion lines should have text after unskip',
  );
  assert.ok(
    afterUnskipText.includes(targetLabel),
    `should include "${targetLabel}" after unskip: "${afterUnskipText}"`,
  );
}

// ---------------------------------------------------------------------------
// Test: Semitone Math
// ---------------------------------------------------------------------------

// 5 semitone-math groups (±1–2, ±3–4, ±5–6, ±7–8, ±9–11).
// Groups 0–1 have high work, groups 2–4 are mostly automatic.
// This should produce a recommendation including groups 0 and 1.
const SEMITONE_STATS = {
  0: { automaticCount: 20, workingCount: 20, unseenCount: 8, totalCount: 48 },
  1: { automaticCount: 15, workingCount: 25, unseenCount: 8, totalCount: 48 },
  2: { automaticCount: 45, workingCount: 3, unseenCount: 0, totalCount: 48 },
  3: { automaticCount: 45, workingCount: 3, unseenCount: 0, totalCount: 48 },
  4: { automaticCount: 22, workingCount: 2, unseenCount: 0, totalCount: 24 },
};

describe('skip/unskip — semitone math (E2E)', () => {
  let page: Page;

  before(async () => {
    const storageData = generateLocalStorageData(
      'semitoneMath',
      SEMITONE_STATS,
    );
    page = await setupMode(
      'semitoneMath',
      storageData,
      'semitoneMath_enabledGroups',
      [0, 1, 2, 3, 4],
    );
  });

  after(async () => {
    await page?.context().close();
  });

  const MODE = '#mode-semitoneMath';

  it('skip/unskip cycle preserves recommendations', async () => {
    // Read the recommendation to find which group to target
    const recText = await page.textContent(
      `${MODE} .suggestion-lines`,
    );
    assert.ok(recText, 'should have recommendation text');

    // Find a group label that appears in the recommendation.
    // Level progress cards have aria-label="Skip <label>" buttons.
    // Switch to progress tab to read the labels.
    await page.click(`${MODE} [data-tab="progress"]`);
    await page.waitForTimeout(200);

    const skipButtons = page.locator(
      `${MODE} [aria-label^="Skip "]`,
    );
    const count = await skipButtons.count();
    let target = '';
    for (let i = 0; i < count; i++) {
      const label = (await skipButtons.nth(i).getAttribute('aria-label'))
        ?.replace('Skip ', '') ?? '';
      if (label && recText.includes(label)) {
        target = label;
        break;
      }
    }

    // Switch back to practice tab before running the test
    await page.click(`${MODE} [data-tab="practice"]`);
    await page.waitForTimeout(200);

    assert.ok(target, `should find a group in recommendation: "${recText}"`);

    await runSkipUnskipTests(page, MODE, target);
  });
});

// ---------------------------------------------------------------------------
// Test: Guitar Fretboard (synthetic data)
// ---------------------------------------------------------------------------

// 8 guitar fretboard groups with mixed progress.
const GUITAR_STATS = {
  0: { automaticCount: 5, workingCount: 9, unseenCount: 2, totalCount: 16 },
  1: { automaticCount: 7, workingCount: 1, unseenCount: 0, totalCount: 8 },
  2: { automaticCount: 7, workingCount: 1, unseenCount: 0, totalCount: 8 },
  3: { automaticCount: 7, workingCount: 1, unseenCount: 0, totalCount: 8 },
  4: { automaticCount: 7, workingCount: 1, unseenCount: 0, totalCount: 8 },
  5: { automaticCount: 9, workingCount: 1, unseenCount: 0, totalCount: 10 },
  6: { automaticCount: 3, workingCount: 5, unseenCount: 2, totalCount: 10 },
  7: { automaticCount: 3, workingCount: 5, unseenCount: 2, totalCount: 10 },
};

describe('skip/unskip — guitar fretboard synthetic (E2E)', () => {
  let page: Page;

  before(async () => {
    const storageData = generateLocalStorageData(
      'fretboard',
      GUITAR_STATS,
      Date.now(),
      (idx: number) => guitarGetItemIds(GUITAR, idx),
    );
    page = await setupMode(
      'fretboard',
      storageData,
      'fretboard_enabledGroups',
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
  });

  after(async () => {
    await page?.context().close();
  });

  const MODE = '#mode-fretboard';

  it('skip/unskip cycle preserves recommendations', async () => {
    const recText = await page.textContent(
      `${MODE} .suggestion-lines`,
    );
    assert.ok(recText, 'should have recommendation text');

    await page.click(`${MODE} [data-tab="progress"]`);
    await page.waitForTimeout(200);

    const skipButtons = page.locator(
      `${MODE} [aria-label^="Skip "]`,
    );
    const count = await skipButtons.count();
    let target = '';
    for (let i = 0; i < count; i++) {
      const label = (await skipButtons.nth(i).getAttribute('aria-label'))
        ?.replace('Skip ', '') ?? '';
      if (label && recText.includes(label)) {
        target = label;
        break;
      }
    }

    await page.click(`${MODE} [data-tab="practice"]`);
    await page.waitForTimeout(200);

    assert.ok(target, `should find a group in recommendation: "${recText}"`);

    await runSkipUnskipTests(page, MODE, target);
  });
});

// ---------------------------------------------------------------------------
// Test: Guitar Fretboard (real user data — exact localStorage snapshot)
// ---------------------------------------------------------------------------

const REAL_FRETBOARD_DATA: Record<string, string> = JSON.parse(
  '{"adaptive_fretboard_4-8":"{\\"recentTimes\\":[3772],\\"ewma\\":3772,\\"sampleCount\\":1,\\"lastSeen\\":1773248142139,\\"stability\\":4,\\"lastCorrectAt\\":1773248142139}","adaptive_fretboard_5-8":"{\\"recentTimes\\":[3987,3086,1428,648,1078,1420,8136,4734,1815,1313],\\"ewma\\":2747.0773782019996,\\"sampleCount\\":11,\\"lastSeen\\":1773182605495,\\"stability\\":336,\\"lastCorrectAt\\":1773182605495}","adaptive_fretboard_3-5":"{\\"recentTimes\\":[3856,8136,6713,7970,1357],\\"ewma\\":4830.631,\\"sampleCount\\":5,\\"lastSeen\\":1773248132425,\\"stability\\":16.759656083650363,\\"lastCorrectAt\\":1773248132425}","adaptive_fretboard_1-8":"{\\"recentTimes\\":[871,5096,1876,1728,828,3890,1736,1263,799,1664],\\"ewma\\":1817.5409725226998,\\"sampleCount\\":10,\\"lastSeen\\":1771203823812,\\"stability\\":336,\\"lastCorrectAt\\":1771203823812}","adaptive_fretboard_3-12":"{\\"recentTimes\\":[2778,2031,1850,4208,4587,4209,2371,1471],\\"ewma\\":2726.7801710999993,\\"sampleCount\\":8,\\"lastSeen\\":1773248151535,\\"stability\\":336,\\"lastCorrectAt\\":1773248151535}","adaptive_fretboard_0-2":"{\\"recentTimes\\":[2950,7254,4332,5710,1821],\\"ewma\\":3836.9356,\\"sampleCount\\":5,\\"lastSeen\\":1771872295786,\\"stability\\":10.740694789081886,\\"lastCorrectAt\\":1771872295786}","adaptive_fretboard_2-7":"{\\"recentTimes\\":[7254,7254,3371,5182],\\"ewma\\":5816.969999999999,\\"sampleCount\\":4,\\"lastSeen\\":1772142000564,\\"stability\\":4,\\"lastCorrectAt\\":1772141995919}","adaptive_fretboard_3-7":"{\\"recentTimes\\":[3405,5021],\\"ewma\\":3889.8,\\"sampleCount\\":2,\\"lastSeen\\":1772492901801,\\"stability\\":7.445796460176991,\\"lastCorrectAt\\":1772492901801}","adaptive_fretboard_0-6":"{\\"recentTimes\\":[3722,6921,5081,7254,7254],\\"ewma\\":6052.270099999998,\\"sampleCount\\":5,\\"lastSeen\\":1771871799787,\\"stability\\":4,\\"lastCorrectAt\\":1771871799787}","adaptive_fretboard_0-7":"{\\"recentTimes\\":[2120,1414,1098,1411,1682,891,1221,1461,1593,2949],\\"ewma\\":1944.8417878070168,\\"sampleCount\\":16,\\"lastSeen\\":1773182636154,\\"stability\\":336,\\"lastCorrectAt\\":1773182636154}","adaptive_fretboard_2-1":"{\\"recentTimes\\":[1973,2243,6467],\\"ewma\\":6729.695999999998,\\"sampleCount\\":3,\\"lastSeen\\":1772002972408,\\"stability\\":4,\\"lastCorrectAt\\":1771817189850}","adaptive_fretboard_2-5":"{\\"recentTimes\\":[3564],\\"ewma\\":3564,\\"sampleCount\\":1,\\"lastSeen\\":1771954933997,\\"stability\\":4,\\"lastCorrectAt\\":1771954933997}","adaptive_fretboard_2-3":"{\\"recentTimes\\":[3187,3029],\\"ewma\\":3139.5999999999995,\\"sampleCount\\":2,\\"lastSeen\\":1771895882544,\\"stability\\":4,\\"lastCorrectAt\\":1771807982121}","adaptive_fretboard_1-1":"{\\"recentTimes\\":[1126,1186,875,1988],\\"ewma\\":1340.71,\\"sampleCount\\":4,\\"lastSeen\\":1773248153764,\\"stability\\":336,\\"lastCorrectAt\\":1773248153764}","adaptive_fretboard_5-1":"{\\"recentTimes\\":[1306,1092,1139,1442,1083,1264,940,1129,1083,1311],\\"ewma\\":1168.6572755495697,\\"sampleCount\\":12,\\"lastSeen\\":1773182615007,\\"stability\\":336,\\"lastCorrectAt\\":1773182615007}","adaptive_fretboard_2-2":"{\\"recentTimes\\":[],\\"ewma\\":7254,\\"sampleCount\\":0,\\"lastSeen\\":1771883879332,\\"stability\\":4,\\"lastCorrectAt\\":null}","adaptive_fretboard_3-0":"{\\"recentTimes\\":[2060,1954,1782,2544,8136],\\"ewma\\":3932.6665999999996,\\"sampleCount\\":5,\\"lastSeen\\":1772645217331,\\"stability\\":74.25266141736529,\\"lastCorrectAt\\":1772645217331}","adaptive_fretboard_5-7":"{\\"recentTimes\\":[1597,1524,1174,2224,1521,1274,1035,1419,1132,1821],\\"ewma\\":1465.8730388109996,\\"sampleCount\\":10,\\"lastSeen\\":1773182613409,\\"stability\\":336,\\"lastCorrectAt\\":1773182613409}","adaptive_fretboard_2-6":"{\\"recentTimes\\":[3405,7254,1973],\\"ewma\\":6644.309999999999,\\"sampleCount\\":3,\\"lastSeen\\":1771895920470,\\"stability\\":10.55210918114144,\\"lastCorrectAt\\":1771895920470}","adaptive_fretboard_0-11":"{\\"recentTimes\\":[5090,4761,7254,4816,2968,2469],\\"ewma\\":4016.7797299999993,\\"sampleCount\\":6,\\"lastSeen\\":1771871808434,\\"stability\\":23.146650585866542,\\"lastCorrectAt\\":1771871808434}","adaptive_fretboard_0-8":"{\\"recentTimes\\":[1329,1005,1478,1466,1710,1523,1391,1271,2051,3728],\\"ewma\\":2357.428194300008,\\"sampleCount\\":13,\\"lastSeen\\":1773182629753,\\"stability\\":336,\\"lastCorrectAt\\":1773182629753}","adaptive_fretboard_0-3":"{\\"recentTimes\\":[1300,1400,1495,1157,6247,1738,1260,1396,3053],\\"ewma\\":2243.7255024999995,\\"sampleCount\\":9,\\"lastSeen\\":1773182620005,\\"stability\\":336,\\"lastCorrectAt\\":1773182620005}","adaptive_fretboard_5-3":"{\\"recentTimes\\":[1010,2281,1446,2201,1163,1076,1463,1374,1823,3189],\\"ewma\\":2056.984586621854,\\"sampleCount\\":15,\\"lastSeen\\":1773182623376,\\"stability\\":336,\\"lastCorrectAt\\":1773182623376}","adaptive_fretboard_3-3":"{\\"recentTimes\\":[3971,3760],\\"ewma\\":3907.7,\\"sampleCount\\":2,\\"lastSeen\\":1773248130547,\\"stability\\":8.84070796460177,\\"lastCorrectAt\\":1773248130547}","adaptive_fretboard_0-12":"{\\"recentTimes\\":[4518,1274,1616,2290,1010,1023,933,926,881,1118],\\"ewma\\":1142.6651644639396,\\"sampleCount\\":12,\\"lastSeen\\":1773182625935,\\"stability\\":336,\\"lastCorrectAt\\":1773182625935}","adaptive_fretboard_5-10":"{\\"recentTimes\\":[1131,2771,4251,1110,1798,2693,1065,4937,1645,2765],\\"ewma\\":2609.3688168630997,\\"sampleCount\\":14,\\"lastSeen\\":1773248156807,\\"stability\\":336,\\"lastCorrectAt\\":1773248156807}","adaptive_fretboard_2-11":"{\\"recentTimes\\":[5818],\\"ewma\\":6823.199999999999,\\"sampleCount\\":1,\\"lastSeen\\":1772092282506,\\"stability\\":4,\\"lastCorrectAt\\":1772092267707}","adaptive_fretboard_0-1":"{\\"recentTimes\\":[797,1691,1171,1123,1007,1027,1261,1325,1094],\\"ewma\\":1155.7061870599998,\\"sampleCount\\":9,\\"lastSeen\\":1773182633102,\\"stability\\":336,\\"lastCorrectAt\\":1773182633102}","adaptive_fretboard_1-6":"{\\"recentTimes\\":[1928,7019,6005,1661,3408,8136,6842],\\"ewma\\":5446.325320999999,\\"sampleCount\\":7,\\"lastSeen\\":1773248163895,\\"stability\\":14.106073898891264,\\"lastCorrectAt\\":1773248163895}","adaptive_fretboard_5-0":"{\\"recentTimes\\":[620,1472,1433,867,996,1060,792,993,893,1215],\\"ewma\\":1061.1927460891998,\\"sampleCount\\":11,\\"lastSeen\\":1773182591852,\\"stability\\":336,\\"lastCorrectAt\\":1773182591852}","adaptive_fretboard_5-5":"{\\"recentTimes\\":[2727,3301,1312,1933,1880,1299,6191,1012,763,1479],\\"ewma\\":1818.4871432764696,\\"sampleCount\\":12,\\"lastSeen\\":1773182600575,\\"stability\\":336,\\"lastCorrectAt\\":1773182600575}","adaptive_fretboard_3-6":"{\\"recentTimes\\":[7254,2890,7254,4523,1695,8136],\\"ewma\\":5596.2369629999985,\\"sampleCount\\":6,\\"lastSeen\\":1772668743879,\\"stability\\":15.703749769256847,\\"lastCorrectAt\\":1772492918342}","adaptive_fretboard_2-12":"{\\"recentTimes\\":[2824,3075,3514,2451],\\"ewma\\":2893.897,\\"sampleCount\\":4,\\"lastSeen\\":1772002981759,\\"stability\\":49.39632811142708,\\"lastCorrectAt\\":1772002981759}","adaptive_fretboard_0-10":"{\\"recentTimes\\":[3047,1263,1202,1481,1302,1480,1004,2531,1368,3122],\\"ewma\\":2121.869794115104,\\"sampleCount\\":16,\\"lastSeen\\":1773248101097,\\"stability\\":336,\\"lastCorrectAt\\":1773248101097}","adaptive_fretboard_0-9":"{\\"recentTimes\\":[7254,7254],\\"ewma\\":7090.829999999999,\\"sampleCount\\":2,\\"lastSeen\\":1771872277429,\\"stability\\":4,\\"lastCorrectAt\\":1771870196896}","adaptive_fretboard_2-8":"{\\"recentTimes\\":[2903,7254],\\"ewma\\":8540.88,\\"sampleCount\\":2,\\"lastSeen\\":1772003009806,\\"stability\\":9.398263027295286,\\"lastCorrectAt\\":1772003009806}","adaptive_fretboard_1-12":"{\\"recentTimes\\":[1588,1197,939,1118,1059],\\"ewma\\":1194.9630999999997,\\"sampleCount\\":5,\\"lastSeen\\":1771203821883,\\"stability\\":324,\\"lastCorrectAt\\":1771203821883}","adaptive_fretboard_5-12":"{\\"recentTimes\\":[982,614,1369,2712,1189],\\"ewma\\":1426.4218,\\"sampleCount\\":5,\\"lastSeen\\":1773182624714,\\"stability\\":255.2944855486987,\\"lastCorrectAt\\":1773182624714}","adaptive_fretboard_1-0":"{\\"recentTimes\\":[4632,871,1528,942,1821],\\"ewma\\":2170.5050999999994,\\"sampleCount\\":5,\\"lastSeen\\":1773248108008,\\"stability\\":292.3879443851083,\\"lastCorrectAt\\":1773248108008}","adaptive_fretboard_1-3":"{\\"recentTimes\\":[3451,849,2379,4952,2029,1269,678,1082,1092,3008],\\"ewma\\":1941.7493432139995,\\"sampleCount\\":10,\\"lastSeen\\":1773248145673,\\"stability\\":336,\\"lastCorrectAt\\":1773248145673}","adaptive_fretboard_1-5":"{\\"recentTimes\\":[1550,970,1638,736],\\"ewma\\":1239.02,\\"sampleCount\\":4,\\"lastSeen\\":1771203830314,\\"stability\\":105.70344827586206,\\"lastCorrectAt\\":1771203830314}","adaptive_fretboard_3-11":"{\\"recentTimes\\":[6921,6552,3270,4505,5941,7015,4263,4687],\\"ewma\\":5234.460704699999,\\"sampleCount\\":8,\\"lastSeen\\":1772668741109,\\"stability\\":150.50826248134035,\\"lastCorrectAt\\":1772668741109}","adaptive_fretboard_3-1":"{\\"recentTimes\\":[2580,4877,6917,1827,5275,5408],\\"ewma\\":5045.2806359999995,\\"sampleCount\\":6,\\"lastSeen\\":1772646207221,\\"stability\\":37.25533204757478,\\"lastCorrectAt\\":1772646207221}","adaptive_fretboard_3-4":"{\\"recentTimes\\":[7254,3007,7254,7254,6555,8136,5304],\\"ewma\\":6537.329012999999,\\"sampleCount\\":7,\\"lastSeen\\":1772646200809,\\"stability\\":4,\\"lastCorrectAt\\":1772492878606}","adaptive_fretboard_2-4":"{\\"recentTimes\\":[10565,5106,7254,6996],\\"ewma\\":7996.516999999998,\\"sampleCount\\":4,\\"lastSeen\\":1772141980041,\\"stability\\":5.261061946902655,\\"lastCorrectAt\\":1772141980041}","adaptive_fretboard_2-9":"{\\"recentTimes\\":[8321,2529,6559,7254,3833,1604],\\"ewma\\":4608.063439999999,\\"sampleCount\\":6,\\"lastSeen\\":1772141998525,\\"stability\\":24.58407936212702,\\"lastCorrectAt\\":1772141998525}","adaptive_fretboard_0-5":"{\\"recentTimes\\":[3156,3344,2787,2059,5734,1165,1826,1201,1387,1552],\\"ewma\\":1835.1253162541996,\\"sampleCount\\":11,\\"lastSeen\\":1773182590089,\\"stability\\":336,\\"lastCorrectAt\\":1773182590089}","adaptive_fretboard_3-10":"{\\"recentTimes\\":[4316,6314,1322,4897,6469,8136,4307,3808],\\"ewma\\":5184.526058879998,\\"sampleCount\\":8,\\"lastSeen\\":1773248105552,\\"stability\\":336,\\"lastCorrectAt\\":1773248105552}","adaptive_fretboard_3-9":"{\\"recentTimes\\":[4160,4412,8136,2109],\\"ewma\\":4416.704,\\"sampleCount\\":4,\\"lastSeen\\":1773248126437,\\"stability\\":10.667035398230087,\\"lastCorrectAt\\":1773248126437}","adaptive_fretboard_0-0":"{\\"recentTimes\\":[1302,755,2624,1041,979,1148,1108,1007,1510,1428],\\"ewma\\":1306.763557239,\\"sampleCount\\":10,\\"lastSeen\\":1773248149679,\\"stability\\":336,\\"lastCorrectAt\\":1773248149679}","adaptive_fretboard_3-8":"{\\"recentTimes\\":[7254,6350,7254,3970,8136],\\"ewma\\":6735.938399999999,\\"sampleCount\\":5,\\"lastSeen\\":1772646185066,\\"stability\\":8.074441687344912,\\"lastCorrectAt\\":1772646185066}","adaptive_fretboard_1-10":"{\\"recentTimes\\":[1671,1249,1364],\\"ewma\\":1490.28,\\"sampleCount\\":3,\\"lastSeen\\":1771203815249,\\"stability\\":35.864367816091956,\\"lastCorrectAt\\":1771203815249}","adaptive_fretboard_0-4":"{\\"recentTimes\\":[5254,4069,4075,7254,5317],\\"ewma\\":5397.6505,\\"sampleCount\\":5,\\"lastSeen\\":1771872292963,\\"stability\\":4,\\"lastCorrectAt\\":1771871790763}"}',
);

describe('skip/unskip — guitar fretboard real data (E2E)', () => {
  let page: Page;

  before(async () => {
    const storageData: Record<string, string> = { ...REAL_FRETBOARD_DATA };
    storageData['fretboard_enabledGroups'] = JSON.stringify([0, 2, 1, 3, 4]);
    storageData['fretboard_enabledGroups_skipped'] = JSON.stringify([]);

    page = await setupMode(
      'fretboard',
      storageData,
      'fretboard_enabledGroups',
      [0, 2, 1, 3, 4],
    );
  });

  after(async () => {
    await page?.context().close();
  });

  const MODE = '#mode-fretboard';

  it('skip/unskip cycle preserves recommendations', async () => {
    const recText = await page.textContent(`${MODE} .suggestion-lines`);
    assert.ok(recText, 'should have recommendation text');

    // With this data, recommendation includes an accidental group.
    // Find the actual target from the skip buttons (labels changed with regrouping).
    const skipButtons = page.locator(
      `${MODE} [aria-label^="Skip "]`,
    );
    const count = await skipButtons.count();
    let target = '';
    for (let i = 0; i < count; i++) {
      const label = (await skipButtons.nth(i).getAttribute('aria-label'))
        ?.replace('Skip ', '') ?? '';
      if (label && recText.includes(label)) {
        target = label;
        break;
      }
    }
    assert.ok(target, `should find a group in recommendation: "${recText}"`);

    await runSkipUnskipTests(page, MODE, target);
  });
});
