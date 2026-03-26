// Amaranth 출퇴근 체크 - Content Script
// document 레벨 이벤트 위임(capture phase)으로 확인 버튼 클릭을 감지합니다.
// MutationObserver로 미리 핸들러를 붙이는 방식 대신 사용 — React 렌더링 타이밍 문제 없음.

(function () {
  'use strict';

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // capture: true — React 이벤트 핸들러보다 먼저 실행됨
  document.addEventListener('click', (e) => {

    // 클릭 대상이 파란색 확인 버튼(또는 그 자식)인지 확인
    const btn = e.target.closest('.OBTButton_themeblue__3JTE9');
    if (!btn) return;

    const labelText = btn.querySelector('.OBTButton_labelText__1s2qO')?.textContent?.trim();
    if (labelText !== '확인') return;

    // 출퇴근 체크 다이얼로그 안에 있는지 확인
    const confirmBox = btn.closest('.OBTConfirm_confirmBoxStyle__3aqwI');
    if (!confirmBox) return;

    const msgEl = confirmBox.querySelector('.OBTConfirm_confirmMessageStyle__EtroK p');
    const message = msgEl?.textContent?.trim() || '';

    let checkType = null;
    if (message.includes('출근 체크'))      checkType = '출근';
    else if (message.includes('퇴근 체크')) checkType = '퇴근';
    if (!checkType) return;

    const now  = new Date();
    const date = formatDate(now);
    const time = formatTime(now);

    console.log(`[출퇴근 체크] ${checkType} 감지 → ${date} ${time}`);

    chrome.runtime.sendMessage(
      { action: 'recordAttendance', type: checkType, date, time },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[출퇴근 체크] 백그라운드 통신 오류:', chrome.runtime.lastError.message);
          return;
        }
        if (response?.success) {
          console.log(`[출퇴근 체크] ${checkType} 기록 완료 ✓ ${date} ${time}`);
        } else {
          console.error('[출퇴근 체크] 기록 실패:', response?.error);
        }
      }
    );

  }, true /* capture phase */);

})();
