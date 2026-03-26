'use strict';

// Amaranth 출퇴근 체크 - Google Sheets 초기 설정 스크립트
// 실행: node setup.js
// 필요 파일: credentials.json (GCP Console에서 다운로드)

const { google }     = require('googleapis');
const http           = require('http');
const fs             = require('fs');
const path           = require('path');
const { execSync }   = require('child_process');

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const TOKEN_FILE       = path.join(__dirname, '.token.json');
const RESULT_FILE      = path.join(__dirname, 'result.txt');
const REDIRECT_PORT    = 3000;
const REDIRECT_URI     = `http://localhost:${REDIRECT_PORT}/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// ── 2026 대한민국 공휴일 ─────────────────────────────────────────────────────
const HOLIDAYS = [
  // 2026
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

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Amaranth 출퇴근 체크 - 초기 설정 ===\n');

  // 1. credentials.json 확인
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.error('[오류] credentials.json 파일이 없습니다.');
    console.error('  README.md의 1단계를 참고해 GCP에서 다운로드 후 이 폴더에 저장하세요.');
    console.error(`  참고 형식: credentials.json.example`);
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  } catch {
    console.error('[오류] credentials.json 파싱 실패. 파일 내용을 확인하세요.');
    process.exit(1);
  }

  const creds = raw.installed || raw.web;
  if (!creds?.client_id || !creds?.client_secret) {
    console.error('[오류] credentials.json에 client_id 또는 client_secret이 없습니다.');
    process.exit(1);
  }

  // 2. OAuth2 클라이언트
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);

  // 3. 기존 토큰 재사용 또는 신규 발급
  let token;
  if (fs.existsSync(TOKEN_FILE)) {
    token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    console.log('[인증] 저장된 토큰 재사용');
  } else {
    token = await authorize(oauth2);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
    console.log('[인증] 완료. 토큰 저장됨 (.token.json)');
  }
  oauth2.setCredentials(token);

  // 4. Spreadsheet 생성
  console.log('\n[Sheets] Spreadsheet 생성 중...');
  const sheets = google.sheets({ version: 'v4', auth: oauth2 });

  let spreadsheetId, spreadsheetUrl;
  try {
    const res = await sheets.spreadsheets.create({
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
    spreadsheetId  = res.data.spreadsheetId;
    spreadsheetUrl = res.data.spreadsheetUrl;
  } catch (e) {
    console.error('[오류] Spreadsheet 생성 실패:', e.message);
    console.error('  토큰이 만료됐을 수 있습니다. .token.json 파일을 삭제 후 재시도하세요.');
    process.exit(1);
  }

  console.log(`[Sheets] 생성 완료: ${spreadsheetId}`);

  // 5. 헤더 + 공휴일 데이터 입력
  console.log('[Sheets] 시트 구조 및 공휴일 데이터 입력 중...');

  const holidayValues = [
    ['일자', '비고'],
    ...HOLIDAYS,
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: '출퇴근 기록부!A1:C1',
          values: [['Date', 'StartTime', 'EndTime']],
        },
        {
          range: `공휴일!A1:B${holidayValues.length}`,
          values: holidayValues,
        },
        {
          range: '반차/연차!A1:B1',
          values: [['일자', '휴가']],
        },
        {
          range: 'WeeklySettings!A1:B1',
          values: [['WeekID', 'AssumedStartTime']],
        },
      ],
    },
  });

  console.log('[Sheets] 데이터 입력 완료');

  // 6. 결과 출력 및 저장
  const resultText = [
    '=== Amaranth 출퇴근 체크 - 설정 완료 ===',
    '',
    `Spreadsheet ID : ${spreadsheetId}`,
    `Spreadsheet URL: ${spreadsheetUrl}`,
    `Client ID      : ${creds.client_id}`,
    `Client Secret  : ${creds.client_secret}`,
    '',
    '--- 확장프로그램 설정 페이지에 입력할 값 ---',
    `Client ID      : ${creds.client_id}`,
    `Client Secret  : ${creds.client_secret}`,
    `Spreadsheet ID : ${spreadsheetId}`,
    `Sheet Name     : 출퇴근 기록부`,
  ].join('\n');

  fs.writeFileSync(RESULT_FILE, resultText + '\n');

  console.log('\n' + '='.repeat(50));
  console.log('설정 완료!');
  console.log('='.repeat(50));
  console.log(`\nSpreadsheet ID : ${spreadsheetId}`);
  console.log(`Spreadsheet URL: ${spreadsheetUrl}`);
  console.log(`\n결과가 result.txt 파일에도 저장되었습니다.`);
  console.log('\n[다음 단계]');
  console.log('  Chrome 확장프로그램 설정 페이지에서');
  console.log('  result.txt의 값을 복사해 입력하세요.');
  console.log('='.repeat(50) + '\n');
}

// ── OAuth 인증 (로컬 서버 콜백) ───────────────────────────────────────────────

function authorize(oauth2) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    console.log('\n[인증] 브라우저에서 Google 계정 로그인이 필요합니다.');

    // 브라우저 자동 오픈
    try {
      const opener = process.platform === 'darwin' ? 'open'
                   : process.platform === 'win32'  ? 'start'
                   : 'xdg-open';
      execSync(`${opener} "${authUrl}"`, { stdio: 'ignore' });
    } catch {
      console.log('[인증] 브라우저를 수동으로 열어 아래 URL로 접속하세요:');
      console.log(`  ${authUrl}`);
    }

    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/callback')) {
        res.end();
        return;
      }

      const code = new URL(req.url, `http://localhost:${REDIRECT_PORT}`).searchParams.get('code');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>인증 완료!</h2><p>이 창을 닫고 터미널로 돌아가세요.</p>');
      server.close();

      if (!code) { reject(new Error('인증 코드 없음')); return; }

      try {
        const { tokens } = await oauth2.getToken(code);
        resolve(tokens);
      } catch (e) {
        reject(e);
      }
    });

    server.on('error', e => {
      if (e.code === 'EADDRINUSE') {
        reject(new Error(`포트 ${REDIRECT_PORT}가 이미 사용 중입니다. 다른 프로세스를 종료 후 재시도하세요.`));
      } else {
        reject(e);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`[인증] 로컬 서버 대기 중 (포트 ${REDIRECT_PORT})...`);
    });
  });
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

main().catch(e => {
  console.error('\n[오류]', e.message);
  process.exit(1);
});
