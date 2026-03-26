# Amaranth 출퇴근 체크 - 설정 가이드

Amaranth HR 시스템 출퇴근 확인 시 **개인 Google Sheets에 자동 기록**하고,
주간 근무시간 대시보드를 제공하는 Chrome 확장 프로그램입니다.

> Google Sheets는 **각자 본인 계정**에 생성됩니다. 데이터는 내 구글 계정에만 저장됩니다.

---

## 사전 준비

- Node.js 18 이상 ([다운로드](https://nodejs.org/))
- Chrome 브라우저
- Google 계정

---

## 전체 흐름

```
GCP 프로젝트 생성
    ↓
Sheets API 활성화
    ↓
OAuth 클라이언트 ID 생성 (Client ID / Client Secret 발급)
    ↓
npm start  →  자동으로 내 Google Sheets 생성
    ↓
Chrome에 확장 프로그램 로드
    ↓
확장 프로그램 설정에 키값 입력
```

---

## 1단계 — GCP 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트**
3. 프로젝트 이름 입력 (예: `amaranth-check`) → **만들기**

---

## 2단계 — Google Sheets API 활성화

1. 방금 만든 프로젝트가 선택된 상태에서 아래 링크 접속:
   [console.cloud.google.com/apis/library/sheets.googleapis.com](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
2. **사용 설정** 클릭

---

## 3단계 — OAuth 동의 화면 설정

1. [console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent) 접속
2. User Type: **외부** → **만들기**
3. 앱 이름 (예: `Amaranth Check`), 사용자 지원 이메일 입력 → **저장 후 계속**
4. 이후 화면은 기본값으로 **저장 후 계속** 반복해 완료
5. **테스트 사용자** 단계에서 **+ ADD USERS** → 본인 Google 계정 이메일 추가 → **저장 후 계속**

---

## 4단계 — OAuth 2.0 클라이언트 ID 생성 (Client ID / Secret 발급)

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) 접속
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션** 선택
4. **승인된 리디렉션 URI** → **URI 추가**:
   ```
   http://localhost:3000/callback
   ```
5. **만들기** 클릭

생성 완료 팝업에서 **Client ID**와 **Client Secret**을 확인할 수 있습니다.
(나중에 다시 보려면 목록에서 해당 클라이언트 클릭 → 수정 화면에서 확인)

---

## 5단계 — 설정 마법사 실행

```bash
cd setup
npm install
npm start
```

터미널에서 순서대로 안내합니다. 준비된 **Client ID**와 **Client Secret**을 붙여넣으면 됩니다.

마법사가 완료되면:
- **내 Google 계정에 Spreadsheet 자동 생성** (시트 구조 + 2026 공휴일 포함)
- `result.txt`에 모든 설정값 저장

---

## 6단계 — Chrome 확장 프로그램 로드

1. Chrome 주소창에 입력: `chrome://extensions`
2. 우측 상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램을 로드합니다** → `setup/extension` 폴더 선택
4. 카드에 표시된 **확장 프로그램 ID (32자리 영문)** 복사

---

## 7단계 — Redirect URI 추가 (GCP로 돌아가서)

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) 에서 방금 만든 OAuth 클라이언트 클릭
2. **승인된 리디렉션 URI**에 아래 추가 (확장 프로그램 ID 반영):
   ```
   https://{확장프로그램_ID}.chromiumapp.org/
   ```
3. **저장**

---

## 8단계 — 확장 프로그램 설정

1. Chrome 툴바에서 확장 프로그램 아이콘 클릭 → **⚙ 설정**
2. `result.txt`를 열어 아래 값 입력:

   | 항목 | 값 |
   |---|---|
   | Client ID | `result.txt`의 Client ID |
   | Client Secret | `result.txt`의 Client Secret |
   | Spreadsheet ID | `result.txt`의 Spreadsheet ID |
   | Sheet Name | `출퇴근 기록부` |

3. **저장** → **Google 인증** 버튼 클릭 → 로그인 및 권한 허용

---

## 주의사항

- `result.txt`, `.token.json` — 본인 인증 정보가 담긴 파일. **절대 공유 금지**
- Spreadsheet는 본인 Google 계정에 생성되며 외부에서 접근 불가
- 공휴일 추가/수정은 Spreadsheet의 `공휴일` 시트에서 직접 편집
- 토큰 만료 시 `.token.json` 삭제 후 `npm start` 재실행
