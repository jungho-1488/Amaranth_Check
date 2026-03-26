# Amaranth 출퇴근 체크 - 초기 설정

Amaranth HR 시스템 출퇴근 확인 시 Google Sheets에 자동 기록하고,
주간 근무시간 대시보드를 제공하는 Chrome 확장 프로그램입니다.

## 필요한 것

- Node.js 18 이상
- Chrome 브라우저
- Google 계정

## 설정 순서

### 1단계 — 설정 마법사 실행

```bash
cd setup
npm install
npm start
```

터미널에서 순서대로 안내합니다. 지시에 따라 입력만 하면 됩니다.

마법사가 완료되면:
- Google Sheets 자동 생성 (시트 구조 + 2026 공휴일 포함)
- `result.txt`에 설정값 저장

### 2단계 — Chrome 확장 프로그램 로드

1. Chrome 주소창에 입력: `chrome://extensions`
2. 우측 상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램을 로드합니다** → `setup/extension` 폴더 선택
4. 카드에 표시된 **ID (32자리)** 복사

### 3단계 — 확장 프로그램 설정

1. 확장 프로그램 아이콘 클릭 → **⚙ 설정**
2. `result.txt`의 값을 입력:
   - Client ID
   - Client Secret
   - Spreadsheet ID
   - Sheet Name: `출퇴근 기록부`
3. **저장** → **Google 인증** 클릭

---

## 참고

- `.token.json`, `result.txt` — 자동 생성되는 민감 파일. 절대 공유 금지.
- 토큰 만료 시 `.token.json` 삭제 후 `npm start` 재실행.
- 공휴일 추가/수정은 Spreadsheet의 `공휴일` 시트에서 직접 편집.
