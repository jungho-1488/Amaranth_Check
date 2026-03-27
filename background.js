// Amaranth 출퇴근 체크 - Background Service Worker v2
'use strict';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_SPREADSHEET_ID = ''; // 설정 페이지에서 입력
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

// ── 메시지 라우터 ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    recordAttendance:  (m) => handleAttendance(m, sender),
    getDashboardData:  handleGetDashboardData,
    addLeave:          handleAddLeave,
    saveWeekSetting:   handleSaveWeekSetting,
    updateAttendance:  handleUpdateAttendance,
    signOut:           handleSignOut,
  };
  const fn = handlers[msg.action];
  if (!fn) return false;

  fn(msg)
    .then(r  => sendResponse({ success: true,  ...r }))
    .catch(e => { console.error('[출퇴근 체크]', e); sendResponse({ success: false, error: e.message }); });
  return true;
});

// ══════════════════════════════════════════════════════════════════
//  OAuth2 — launchWebAuthFlow + PKCE
// ══════════════════════════════════════════════════════════════════

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64URLEncode(buf.buffer);
}

async function generateCodeChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64URLEncode(hash);
}

async function getAuthToken() {
  const { auth = {} } = await storageGet(['auth']);

  // 캐시된 액세스 토큰 유효한지 확인
  if (auth.access_token && auth.expires_at > Date.now() + 60_000) {
    return auth.access_token;
  }

  // 리프레시 토큰으로 갱신 시도
  if (auth.refresh_token) {
    try {
      return await refreshAccessToken(auth.refresh_token);
    } catch (e) {
      console.warn('[출퇴근 체크] 토큰 갱신 실패, 재인증 진행:', e.message);
    }
  }

  // 전체 인증 플로우
  return await startAuthFlow();
}

async function startAuthFlow() {
  const config = await getConfig();
  if (!config.clientId) {
    throw new Error('Client ID가 설정되지 않았습니다.\n설정 페이지에서 입력해주세요.');
  }

  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri   = `https://${chrome.runtime.id}.chromiumapp.org/`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id',              config.clientId);
  authUrl.searchParams.set('redirect_uri',           redirectUri);
  authUrl.searchParams.set('response_type',          'code');
  authUrl.searchParams.set('scope',                  'https://www.googleapis.com/auth/spreadsheets');
  authUrl.searchParams.set('code_challenge',         codeChallenge);
  authUrl.searchParams.set('code_challenge_method',  'S256');
  authUrl.searchParams.set('access_type',            'offline');
  authUrl.searchParams.set('prompt',                 'consent');

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      url => chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(url)
    );
  });

  if (!responseUrl) throw new Error('인증이 취소되었습니다.');

  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) throw new Error('인증 코드를 받지 못했습니다.');

  return await exchangeCode(config, code, codeVerifier, redirectUri);
}

async function exchangeCode(config, code, codeVerifier, redirectUri) {
  const params = new URLSearchParams({
    client_id:     config.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri:  redirectUri,
    grant_type:    'authorization_code',
  });
  if (config.clientSecret) params.set('client_secret', config.clientSecret);

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  await storeTokens(data);
  return data.access_token;
}

async function refreshAccessToken(refreshToken) {
  const config = await getConfig();
  const params = new URLSearchParams({
    client_id:     config.clientId,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  });
  if (config.clientSecret) params.set('client_secret', config.clientSecret);

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  await storeTokens({ ...data, refresh_token: refreshToken });
  return data.access_token;
}

function storeTokens(tokenData) {
  return storageSet({
    auth: {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at:    Date.now() + (tokenData.expires_in || 3600) * 1000,
    },
  });
}

async function handleSignOut() {
  await storageRemove(['auth', 'dashboardCache']);
  return { message: '로그아웃 완료' };
}

// ══════════════════════════════════════════════════════════════════
//  출퇴근 기록
// ══════════════════════════════════════════════════════════════════

async function handleAttendance({ type, date, time }, sender) {
  const token = await getAuthToken();
  const { spreadsheetId, sheetName } = await getSheetConfig();

  if (type === '출근') {
    await recordCheckIn(token, spreadsheetId, sheetName, date, time);
  } else {
    await recordCheckOut(token, spreadsheetId, sheetName, date, time);
  }

  await storageRemove(['dashboardCache']);
  await storageSet({ lastRecord: { type, date, time, savedAt: Date.now() } });
  const windowId = sender?.tab?.windowId;
  const popupOpts = windowId != null ? { windowId } : {};
  chrome.action.openPopup(popupOpts).catch(() => {}); // Chrome 127+, 실패해도 무시
  return { message: `${type} 기록 완료: ${date} ${time}` };
}

async function recordCheckIn(token, spreadsheetId, sheetName, date, time) {
  const range = `${sheetName}!A:C`;
  const res = await sheetsRequest(token, 'POST',
    `${spreadsheetId}/values/${enc(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [[date, time, '']] }
  );
  if (!res.ok) throw new Error(`출근 기록 실패: ${await getErrMsg(res)}`);
}

async function recordCheckOut(token, spreadsheetId, sheetName, date, time) {
  const readRes = await sheetsRequest(token, 'GET', `${spreadsheetId}/values/${enc(sheetName + '!A:A')}`);
  if (!readRes.ok) throw new Error(`시트 읽기 실패: ${readRes.status}`);

  const { values = [] } = await readRes.json();

  // 오늘 날짜 행 찾기 (마지막 일치 행 우선)
  let rowNumber = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] === date) { rowNumber = i + 1; break; }
  }

  if (rowNumber < 1) {
    // 출근 기록 없으면 새 행 생성 후 재시도
    await recordCheckIn(token, spreadsheetId, sheetName, date, '');
    return recordCheckOut(token, spreadsheetId, sheetName, date, time);
  }

  const updateRes = await sheetsRequest(token, 'PUT',
    `${spreadsheetId}/values/${enc(sheetName + '!C' + rowNumber)}?valueInputOption=USER_ENTERED`,
    { values: [[time]] }
  );
  if (!updateRes.ok) throw new Error(`퇴근 기록 실패: ${await getErrMsg(updateRes)}`);
}

// ══════════════════════════════════════════════════════════════════
//  대시보드 데이터
// ══════════════════════════════════════════════════════════════════

async function handleGetDashboardData() {
  // 캐시 확인
  const { dashboardCache } = await storageGet(['dashboardCache']);
  if (dashboardCache && Date.now() - dashboardCache.fetchedAt < CACHE_TTL_MS) {
    return { data: dashboardCache.data, cached: true };
  }

  const token = await getAuthToken();
  const { spreadsheetId, sheetName } = await getSheetConfig();

  // 3개 시트 일괄 조회
  const params = new URLSearchParams([
    ['ranges', `${sheetName}!A:C`],
    ['ranges', '공휴일!A:B'],
    ['ranges', '반차/연차!A:B'],
    ['ranges', 'WeeklySettings!A:B'],
  ]);
  const batchRes = await sheetsRequest(token, 'GET', `${spreadsheetId}/values:batchGet?${params}`);
  if (!batchRes.ok) throw new Error(`데이터 조회 실패: ${batchRes.status}`);

  const { valueRanges } = await batchRes.json();
  const attendanceRows  = valueRanges[0]?.values || [];
  const holidayRows     = valueRanges[1]?.values || [];
  const leaveRows       = valueRanges[2]?.values || [];
  const weekSettingRows = valueRanges[3]?.values || [];

  const data = buildDashboardData(attendanceRows, holidayRows, leaveRows, weekSettingRows);
  await storageSet({ dashboardCache: { data, fetchedAt: Date.now() } });
  return { data };
}

function buildDashboardData(attendanceRows, holidayRows, leaveRows, weekSettingRows = []) {
  const todayStr    = formatDate(new Date());
  const weekDates   = getWeekDates();

  // 헤더 행 스킵하면서 맵 구성 (A열이 날짜 형식인 것만)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const attendanceMap  = buildLastMap(attendanceRows.filter(r => datePattern.test(r[0])), 0);
  const holidayMap     = buildLastMap(holidayRows.filter(r => datePattern.test(r[0])), 0);
  const leaveMap       = buildLastMap(leaveRows.filter(r => datePattern.test(r[0])), 0);
  const weekSettingMap = buildLastMap(weekSettingRows.filter(r => datePattern.test(r[0])), 0);

  // 이번 주 금요일 예상 출근 시간 (WeeklySettings에서 읽기, HH:MM으로 정규화)
  const currentWeekId      = weekDates[0]; // 이번 주 월요일
  const rawAssumed         = weekSettingMap[currentWeekId]?.[1] || '';
  const assumedFridayStart = rawAssumed ? normalizeTime(rawAssumed) : '';

  const days = weekDates.map(date => {
    const isToday   = date === todayStr;
    const isFuture  = date > todayStr;
    const isHoliday = !!holidayMap[date];
    const holidayName = isHoliday ? (holidayMap[date][1] || '공휴일') : '';
    const leaveType   = leaveMap[date]?.[1] || null;
    const attendance  = attendanceMap[date];
    const startTime   = attendance?.[1] || '';
    const endTime     = attendance?.[2] || '';

    // ── 근무시간 계산 ──────────────────────────────────────────────
    // 근로기준법 제54조: 4h 이상 → 30분, 8h 이상 → 1시간 휴게 공제
    let netHours = 0;
    let grossHours = 0;

    if (isHoliday) {
      netHours = 8; // 공휴일은 8h로 환산
    } else if (leaveType === '연차') {
      netHours = 8; // 연차는 8h로 환산
    } else {
      if (startTime && endTime) {
        grossHours = calcGrossHours(startTime, endTime);
        netHours   = applyBreak(grossHours);
      }
      if (leaveType === '반차') {
        netHours += 4; // 반차 4h 추가
      }
    }

    return { date, startTime, endTime, netHours, grossHours, isHoliday, holidayName, leaveType, isToday, isFuture };
  });

  // 주간 집계 — 미래 날짜라도 연차·반차·공휴일은 포함
  const weeklyHours = days.reduce((sum, d) => {
    if (d.isFuture && !d.isHoliday && !d.leaveType) return sum;
    return sum + d.netHours;
  }, 0);

  return { days, weeklyHours, todayStr, weekDates, assumedFridayStart };
}

// ══════════════════════════════════════════════════════════════════
//  출퇴근 수정
// ══════════════════════════════════════════════════════════════════

async function handleUpdateAttendance({ date, startTime, endTime }) {
  const token = await getAuthToken();
  const { spreadsheetId, sheetName } = await getSheetConfig();

  const readRes = await sheetsRequest(token, 'GET', `${spreadsheetId}/values/${enc(sheetName + '!A:A')}`);
  if (!readRes.ok) throw new Error(`시트 읽기 실패: ${readRes.status}`);

  const { values = [] } = await readRes.json();
  let rowNumber = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] === date) { rowNumber = i + 1; break; }
  }

  if (rowNumber < 1) {
    // 해당 날짜 행 없으면 새로 추가
    const res = await sheetsRequest(token, 'POST',
      `${spreadsheetId}/values/${enc(sheetName + '!A:C')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values: [[date, startTime, endTime || '']] }
    );
    if (!res.ok) throw new Error(`추가 실패: ${await getErrMsg(res)}`);
  } else {
    // 기존 행 출근/퇴근 시간 덮어쓰기
    const res = await sheetsRequest(token, 'PUT',
      `${spreadsheetId}/values/${enc(sheetName + '!B' + rowNumber + ':C' + rowNumber)}?valueInputOption=USER_ENTERED`,
      { values: [[startTime, endTime || '']] }
    );
    if (!res.ok) throw new Error(`수정 실패: ${await getErrMsg(res)}`);
  }

  await storageRemove(['dashboardCache']);
  return { message: `${date} 수정 완료` };
}

// ══════════════════════════════════════════════════════════════════
//  반차/연차 추가
// ══════════════════════════════════════════════════════════════════

async function handleAddLeave({ date, leaveType }) {
  const token = await getAuthToken();
  const { spreadsheetId } = await getSheetConfig();

  const res = await sheetsRequest(token, 'POST',
    `${spreadsheetId}/values/${enc('반차/연차!A:B')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [[date, leaveType]] }
  );
  if (!res.ok) throw new Error(`휴가 기록 실패: ${await getErrMsg(res)}`);

  await storageRemove(['dashboardCache']);
  return { message: `${date} ${leaveType} 추가 완료` };
}

// ══════════════════════════════════════════════════════════════════
//  WeeklySettings — 금요일 예상 출근 시간 저장
// ══════════════════════════════════════════════════════════════════

async function handleSaveWeekSetting({ weekId, assumedStartTime }) {
  const token = await getAuthToken();
  const { spreadsheetId } = await getSheetConfig();

  const readRes = await sheetsRequest(token, 'GET',
    `${spreadsheetId}/values/${enc('WeeklySettings!A:A')}`);
  if (!readRes.ok) throw new Error(`WeeklySettings 읽기 실패: ${readRes.status}`);

  const { values = [] } = await readRes.json();
  let rowNumber = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === weekId) { rowNumber = i + 1; break; }
  }

  if (rowNumber > 0) {
    const res = await sheetsRequest(token, 'PUT',
      `${spreadsheetId}/values/${enc(`WeeklySettings!B${rowNumber}`)}?valueInputOption=USER_ENTERED`,
      { values: [[assumedStartTime]] });
    if (!res.ok) throw new Error(`업데이트 실패: ${await getErrMsg(res)}`);
  } else {
    const res = await sheetsRequest(token, 'POST',
      `${spreadsheetId}/values/${enc('WeeklySettings!A:B')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values: [[weekId, assumedStartTime]] });
    if (!res.ok) throw new Error(`추가 실패: ${await getErrMsg(res)}`);
  }

  return { message: `${weekId} 예상 출근 저장: ${assumedStartTime}` };
}

// ══════════════════════════════════════════════════════════════════
//  유틸리티
// ══════════════════════════════════════════════════════════════════

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// "8:25" → "08:25" 정규화
function normalizeTime(t) {
  const [h = '0', m = '00'] = String(t).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

// 이번 주 월~금 날짜 배열 반환
function getWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow    = today.getDay(); // 0=일
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatDate(d);
  });
}

// 마지막 일치 행 기준으로 맵 구성 (같은 날짜 중복 시 마지막 것 사용)
function buildLastMap(rows, keyIndex) {
  const map = {};
  for (const row of rows) {
    if (row[keyIndex]) map[row[keyIndex]] = row;
  }
  return map;
}

function calcGrossHours(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

// 근로기준법 제54조 휴게시간 공제
function applyBreak(grossHours) {
  if (grossHours < 0)  return 0;
  if (grossHours >= 8) return grossHours - 1;
  if (grossHours >= 4) return grossHours - 0.5;
  return grossHours;
}

// Sheets API 요청 헬퍼
function sheetsRequest(token, method, path, body) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(`${SHEETS_API}/${path}`, opts);
}

function enc(str) { return encodeURIComponent(str); }

async function getErrMsg(res) {
  const j = await res.json().catch(() => ({}));
  return j?.error?.message || res.status;
}

async function getConfig() {
  return storageGet(['spreadsheetId', 'sheetName', 'clientId', 'clientSecret']);
}

async function getSheetConfig() {
  const cfg = await getConfig();
  const spreadsheetId = cfg.spreadsheetId || DEFAULT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID가 설정되지 않았습니다.\n설정 페이지에서 입력해주세요.');
  }
  return {
    spreadsheetId,
    sheetName: cfg.sheetName || '출퇴근 기록부',
  };
}

// Storage helpers
// auth / dashboardCache / lastRecord → chrome.storage.local
// 나머지 설정값 → chrome.storage.sync
const LOCAL_KEYS = new Set(['auth', 'dashboardCache', 'lastRecord']);

function storageGet(keys) {
  const localArr = keys.filter(k =>  LOCAL_KEYS.has(k));
  const syncArr  = keys.filter(k => !LOCAL_KEYS.has(k));

  return new Promise(resolve => {
    const result  = {};
    let   pending = (localArr.length ? 1 : 0) + (syncArr.length ? 1 : 0);
    if (!pending) return resolve(result);

    const done = data => { Object.assign(result, data); if (--pending === 0) resolve(result); };
    if (localArr.length) chrome.storage.local.get(localArr, done);
    if (syncArr.length)  chrome.storage.sync.get(syncArr, done);
  });
}

function storageSet(obj) {
  const local = {}, sync = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LOCAL_KEYS.has(k)) local[k] = v;
    else                   sync[k]  = v;
  }
  const promises = [];
  if (Object.keys(local).length) promises.push(new Promise(r => chrome.storage.local.set(local, r)));
  if (Object.keys(sync).length)  promises.push(new Promise(r => chrome.storage.sync.set(sync, r)));
  return Promise.all(promises);
}

function storageRemove(keys) {
  return new Promise(r => chrome.storage.local.remove(keys, r));
}
