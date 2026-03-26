# Amaranth 출퇴근 체크 - 초기 설정

## 필요한 것

- Node.js 18 이상
- Chrome 브라우저
- Google 계정

## 실행 방법

```bash
cd setup
npm install
npm start
```

스크립트가 실행되면 터미널에서 순서대로 안내합니다.
지시에 따라 입력만 하면 됩니다.

---

## 스크립트가 하는 것

1. GCP 프로젝트 생성 방법 안내
2. Google Sheets API 활성화 안내
3. OAuth 동의 화면 설정 안내
4. OAuth 클라이언트 ID 생성 안내 → Client ID / Secret 입력받음
5. **Google 계정 인증 (브라우저 자동 오픈)**
6. **Spreadsheet 자동 생성** (시트 4개 + 2026 공휴일 입력)
7. Chrome 확장프로그램 로드 안내 → Extension ID 입력받음
8. Redirect URI 추가 안내
9. 최종 설정값 출력 + `result.txt` 저장

---

## 참고

- `.token.json` — 인증 토큰 캐시. 공유 금지.
- `result.txt` — 완료 후 생성되는 설정 결과. 공유 금지.
- 재실행 시 토큰이 유효하면 인증 단계를 건너뜁니다.
- 토큰 만료 시 `.token.json` 삭제 후 재실행하세요.
