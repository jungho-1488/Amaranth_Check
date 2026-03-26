'use strict';

// Amaranth 출퇴근 체크 - 초기 설정 마법사
// 실행: npm start

const { google }   = require('googleapis');
const http         = require('http');
const readline     = require('readline');
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const TOKEN_FILE    = path.join(__dirname, '.token.json');
const RESULT_FILE   = path.join(__dirname, 'result.txt');
const REDIRECT_PORT = 3000;
const REDIRECT_URI  = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const HOLIDAYS_2026 = [
  ['2026-01-01', '신정'],
  ['2026-02-16', '설날 연휴'],
  ['2026-02-17', '설날'],
  ['2026-02-18', '설날 연휴'],
  ['2026-03-01', '삼일절'],
  ['2026-03-02', '삼일절 대체휴일'],
  ['2026-05-05', '어린이날'],
  ['2026-05-24', '부처님오신날'],
  ['2026-05-25', '부처님오신날 대체휴일'],
  ['2026-06-06', '현충일'],
  ['2026-06-08', '현충일 대체휴일'],
  ['2026-08-15', '광복절'],
  ['2026-08-17', '광복절 대체휴일'],
  ['2026-10-03', '개천절'],
  ['2026-10-05', '추석 연휴'],
  ['2026-10-06', '추석'],
  ['2026-10-07', '추석 연휴'],
  ['2026-10-08', '개천절 대체휴일'],
  ['2026-10-09', '한글날'],
  ['2026-12-25', '크리스마스'],
];

// ── readline 헬퍼 ─────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask     = q  => new Promise(r => rl.question(q, a => r(a.trim())));
const enter   = () => ask('  → 완료했으면 Enter...');
const line    = () => console.log('─'.repeat(52));
const blank   = () => console.log();
const say     = s  => console.log(s ?? '');

function step(n, title) {
  blank();
  line();
  say(`  [ ${n}단계 ]  ${title}`);
  line();
}

// ── 메인 흐름 ─────────────────────────────────────────────────────────────────

async function main() {
  blank();
  say('====================================================');
  say('     Amaranth 출퇴근 체크  —  초기 설정 마법사');
  say('====================================================');
  blank();
  say('  순서대로 안내합니다. 각 작업을 마치면 Enter를');
  say('  눌러서 다음 단계로 넘어가세요.');
  blank();
  await ask('  시작할 준비가 됐으면 Enter...');


  // ── 1단계: GCP 프로젝트 ───────────────────────────────────────────────────
  step(1, 'GCP 프로젝트 생성');
  blank();
  say('  1. 아래 링크를 브라우저에서 여세요:');
  say('     https://console.cloud.google.com/');
  blank();
  say('  2. 상단 프로젝트 선택 드롭다운 클릭');
  say('     → [새 프로젝트] → 이름 입력 → [만들기]');
  say('     (이름 예시: amaranth-check)');
  blank();
  await enter();


  // ── 2단계: Sheets API 활성화 ──────────────────────────────────────────────
  step(2, 'Google Sheets API 활성화');
  blank();
  say('  1. 아래 링크를 여세요 (방금 만든 프로젝트 선택 상태):');
  say('     https://console.cloud.google.com/apis/library/sheets.googleapis.com');
  blank();
  say('  2. [사용 설정] 버튼 클릭');
  blank();
  await enter();


  // ── 3단계: OAuth 동의 화면 ────────────────────────────────────────────────
  step(3, 'OAuth 동의 화면 설정');
  blank();
  say('  1. 아래 링크를 여세요:');
  say('     https://console.cloud.google.com/apis/credentials/consent');
  blank();
  say('  2. User Type: [외부] 선택 → [만들기]');
  say('  3. 앱 이름 입력 (예: Amaranth Check)');
  say('     사용자 지원 이메일: 본인 이메일 선택');
  say('     → [저장 후 계속] 반복해서 끝까지 완료');
  blank();
  say('  4. [테스트 사용자] 단계에서');
  say('     [+ ADD USERS] → 본인 Google 계정 이메일 추가');
  say('     → [저장 후 계속]');
  blank();
  await enter();


  // ── 4단계: OAuth 클라이언트 생성 ─────────────────────────────────────────
  step(4, 'OAuth 2.0 클라이언트 ID 생성');
  blank();
  say('  1. 아래 링크를 여세요:');
  say('     https://console.cloud.google.com/apis/credentials');
  blank();
  say('  2. [+ 사용자 인증 정보 만들기] → [OAuth 클라이언트 ID]');
  say('  3. 애플리케이션 유형: [웹 애플리케이션] 선택');
  say('  4. [승인된 리디렉션 URI] 섹션 → [URI 추가]:');
  say('     http://localhost:3000/callback');
  say('  5. [만들기] 클릭 → 팝업에서 ID와 Secret 확인');
  blank();
  await enter();

  blank();
  say('  팝업(또는 수정 화면)에서 아래 값을 복사해 붙여넣으세요.');
  blank();

  const clientId = await ask('  Client ID: ');
  if (!clientId) bail('Client ID를 입력해야 합니다.');

  const clientSecret = await ask('  Client Secret: ');
  if (!clientSecret) bail('Client Secret을 입력해야 합니다.');


  // ── 5단계: Google 인증 + Spreadsheet 자동 생성 ───────────────────────────
  step(5, 'Google 인증 및 Spreadsheet 자동 생성');
  blank();
  say('  잠시 후 브라우저가 자동으로 열립니다.');
  say('  Google 계정으로 로그인 후 [허용]을 클릭하세요.');
  blank();
  await ask('  준비되면 Enter...');

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  let token;
  if (fs.existsSync(TOKEN_FILE)) {
    token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    say('\n  (저장된 인증 토큰 재사용)');
  } else {
    blank();
    token = await doAuth(oauth2);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
    say('  인증 완료!');
  }
  oauth2.setCredentials(token);

  say('\n  Spreadsheet 생성 중...');
  const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet(oauth2);
  say(`  완료! Spreadsheet ID: ${spreadsheetId}`);


  // ── 6단계: Chrome 확장프로그램 로드 ──────────────────────────────────────
  step(6, 'Chrome 확장프로그램 로드');
  blank();
  say('  1. Chrome 주소창에 입력:  chrome://extensions');
  say('  2. 우측 상단 [개발자 모드] ON');
  say('  3. [압축해제된 확장 프로그램을 로드합니다]');
  say('     → Amaranth_Check 폴더 선택');
  say('  4. 카드에 표시된 ID (32자리 영문)를 복사하세요');
  blank();
  await enter();

  blank();
  const extensionId = await ask('  확장프로그램 ID: ');
  if (!extensionId) bail('확장프로그램 ID를 입력해야 합니다.');

  const redirectUri = `https://${extensionId}.chromiumapp.org/`;


  // ── 7단계: Redirect URI 추가 ──────────────────────────────────────────────
  step(7, 'Redirect URI 추가 (GCP로 돌아가서)');
  blank();
  say('  1. 아래 링크에서 방금 만든 OAuth 클라이언트 ID를 클릭:');
  say('     https://console.cloud.google.com/apis/credentials');
  blank();
  say('  2. [승인된 리디렉션 URI]에 아래 URI를 추가:');
  say(`     ${redirectUri}`);
  say('  3. [저장]');
  blank();
  await enter();


  // ── 8단계: 확장프로그램 설정 입력 ────────────────────────────────────────
  step(8, '확장프로그램 설정 입력');
  blank();
  say('  1. Chrome 툴바에서 확장프로그램 아이콘 클릭 → ⚙ 설정');
  say('  2. 아래 값을 각 입력란에 넣으세요:');
  blank();
  say(`     Client ID      :  ${clientId}`);
  say(`     Client Secret  :  ${clientSecret}`);
  say(`     Spreadsheet ID :  ${spreadsheetId}`);
  say(`     Sheet Name     :  출퇴근 기록부`);
  blank();
  say('  3. [저장] → [Google 인증] 클릭 후 로그인');
  blank();
  await enter();


  // ── 완료 ─────────────────────────────────────────────────────────────────
  const resultLines = [
    '=== Amaranth 출퇴근 체크 - 설정 결과 ===',
    '',
    `Client ID      : ${clientId}`,
    `Client Secret  : ${clientSecret}`,
    `Spreadsheet ID : ${spreadsheetId}`,
    `Sheet Name     : 출퇴근 기록부`,
    '',
    `Spreadsheet URL: ${spreadsheetUrl}`,
    `Redirect URI   : ${redirectUri}`,
  ];
  fs.writeFileSync(RESULT_FILE, resultLines.join('\n') + '\n');

  blank();
  say('====================================================');
  say('  모든 설정 완료!');
  say('====================================================');
  blank();
  say('  설정 값이 result.txt 파일에 저장되었습니다.');
  say('  나중에 재설정이 필요하면 언제든 참고하세요.');
  blank();

  rl.close();
}


// ── OAuth 인증 (localhost 콜백) ───────────────────────────────────────────────

function doAuth(oauth2) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    // 브라우저 자동 오픈
    const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32'  ? 'start'
                 : 'xdg-open';
    try {
      execSync(`${opener} "${authUrl}"`, { stdio: 'ignore' });
    } catch {
      say('\n  브라우저를 수동으로 열어 아래 URL에 접속하세요:');
      say(`  ${authUrl}`);
    }

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) { res.end(); return; }

      const code = new URL(req.url, `http://localhost:${REDIRECT_PORT}`).searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2 style="font-family:sans-serif">인증 완료! 이 창을 닫고 터미널로 돌아가세요.</h2>');
      server.close();

      if (!code) { reject(new Error('인증 코드가 없습니다.')); return; }
      try {
        const { tokens } = await oauth2.getToken(code);
        resolve(tokens);
      } catch (e) { reject(e); }
    });

    server.on('error', e => {
      if (e.code === 'EADDRINUSE')
        reject(new Error(`포트 ${REDIRECT_PORT}가 이미 사용 중입니다. 다른 프로세스를 종료 후 재시도하세요.`));
      else reject(e);
    });

    server.listen(REDIRECT_PORT);
  });
}


// ── Spreadsheet 생성 ──────────────────────────────────────────────────────────

async function createSpreadsheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Amaranth 출퇴근 기록' },
      sheets: [
        { properties: { title: '출퇴근 기록부', index: 0 } },
        { properties: { title: '공휴일',        index: 1 } },
        { properties: { title: '반차/연차',      index: 2 } },
        { properties: { title: 'WeeklySettings', index: 3 } },
      ],
    },
  });

  const { spreadsheetId, spreadsheetUrl } = createRes.data;

  const holidayData = [['일자', '비고'], ...HOLIDAYS_2026];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: '출퇴근 기록부!A1:C1',                    values: [['Date', 'StartTime', 'EndTime']] },
        { range: `공휴일!A1:B${holidayData.length}`,        values: holidayData },
        { range: '반차/연차!A1:B1',                         values: [['일자', '휴가']] },
        { range: 'WeeklySettings!A1:B1',                    values: [['WeekID', 'AssumedStartTime']] },
      ],
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}


// ── 유틸 ─────────────────────────────────────────────────────────────────────

function bail(msg) {
  say(`\n  [오류] ${msg}`);
  rl.close();
  process.exit(1);
}

main().catch(e => {
  say(`\n  [오류] ${e.message}`);
  rl.close();
  process.exit(1);
});
