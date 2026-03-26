'use strict';

const $ = id => document.getElementById(id);

// ── 리다이렉트 URI 표시 ──────────────────────────────────────────────────────

const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
$('redirect-uri').textContent = redirectUri;

$('btn-copy-uri').addEventListener('click', () => {
  navigator.clipboard.writeText(redirectUri).then(() => {
    $('btn-copy-uri').textContent = '복사됨!';
    setTimeout(() => { $('btn-copy-uri').textContent = '복사'; }, 2000);
  });
});

// ── 저장된 설정 불러오기 ─────────────────────────────────────────────────────

chrome.storage.sync.get(['clientId', 'clientSecret', 'spreadsheetId', 'sheetName'], (result) => {
  if (result.clientId)      $('client-id').value       = result.clientId;
  if (result.clientSecret)  $('client-secret').value   = result.clientSecret;
  if (result.spreadsheetId) $('spreadsheet-id').value  = result.spreadsheetId;
  if (result.sheetName)     $('sheet-name').value       = result.sheetName;
});

// ── 저장 ─────────────────────────────────────────────────────────────────────

$('btn-save').addEventListener('click', () => {
  const clientId      = $('client-id').value.trim();
  const clientSecret  = $('client-secret').value.trim();
  const spreadsheetId = $('spreadsheet-id').value.trim();
  const sheetName     = $('sheet-name').value.trim() || '출퇴근 기록부';

  if (!clientId) {
    setStatus('Client ID를 입력해주세요.', 'err');
    return;
  }
  if (!spreadsheetId) {
    setStatus('Spreadsheet ID를 입력해주세요.', 'err');
    return;
  }

  chrome.storage.sync.set({ clientId, clientSecret, spreadsheetId, sheetName }, () => {
    // 저장 후 캐시 초기화
    chrome.storage.local.remove(['dashboardCache'], () => {
      setStatus('저장 완료! 이제 "Google 인증" 버튼으로 로그인하세요.', 'ok');
    });
  });
});

// ── Google 인증 테스트 ────────────────────────────────────────────────────────

$('btn-auth-test').addEventListener('click', () => {
  setStatus('Google 인증창을 여는 중...', '');
  // getDashboardData 호출 → background에서 auth 플로우 트리거
  chrome.runtime.sendMessage({ action: 'getDashboardData' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(`오류: ${chrome.runtime.lastError.message}`, 'err');
      return;
    }
    if (response?.success) {
      setStatus('Google 인증 성공! 데이터 조회가 가능합니다.', 'ok');
    } else {
      setStatus(`인증 실패: ${response?.error || '알 수 없는 오류'}`, 'err');
    }
  });
});

// ── 로그아웃 ─────────────────────────────────────────────────────────────────

$('btn-signout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
    if (response?.success) {
      setStatus('로그아웃 완료. 다음 사용 시 재인증이 필요합니다.', 'ok');
    }
  });
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function setStatus(msg, cls) {
  const el = $('save-status');
  el.textContent = msg;
  el.className   = cls;
}
