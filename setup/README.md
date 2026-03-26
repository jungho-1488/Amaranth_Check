# Amaranth 출퇴근 체크 - 초기 설정 가이드

이 스크립트를 실행하면 Google Spreadsheet 생성 + 시트 구조 + 2026 공휴일 입력까지 자동으로 완료됩니다.

사람이 직접 해야 하는 것: GCP 프로젝트 만들기 + credentials.json 다운로드 + 명령어 2줄 실행

---

## 1단계: GCP 프로젝트 설정

### 1-1. 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트**
3. 프로젝트 이름 입력 (예: `amaranth-check`) → **만들기**

### 1-2. Google Sheets API 활성화

1. 좌측 메뉴 → **API 및 서비스** → **라이브러리**
2. `Google Sheets API` 검색 → **사용 설정**

### 1-3. OAuth 동의 화면 설정

1. **API 및 서비스** → **OAuth 동의 화면**
2. User Type: **외부** → **만들기**
3. 앱 이름, 사용자 지원 이메일 입력 → **저장 후 계속** (나머지 단계도 기본값으로 계속)
4. **테스트 사용자** 단계에서 본인 Google 계정 이메일 추가

### 1-4. OAuth 2.0 클라이언트 ID 생성

1. **API 및 서비스** → **사용자 인증 정보** → **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. **승인된 리디렉션 URI** 에 아래 두 개 추가:
   ```
   http://localhost:3000/callback
   https://{확장프로그램_ID}.chromiumapp.org/
   ```
   > 확장프로그램 ID는 Chrome에 로드한 뒤 확인 가능. 지금은 첫 번째 URI만 추가해도 됩니다.
4. **만들기** 클릭

### 1-5. credentials.json 다운로드

1. 생성된 클라이언트 ID 우측의 **다운로드(↓)** 버튼 클릭
2. 다운로드된 파일을 이 폴더(`setup/`)에 **`credentials.json`** 으로 저장

---

## 2단계: 스크립트 실행

```bash
cd setup
npm install
npm start
```

브라우저가 자동으로 열리며 Google 계정 로그인 화면이 나타납니다.
로그인 후 권한 허용하면 스크립트가 자동으로 스프레드시트를 생성합니다.

완료되면 터미널에 **Spreadsheet ID** 가 출력되고 `result.txt` 파일에도 저장됩니다.

---

## 3단계: Chrome 확장프로그램 설정

### 3-1. 확장프로그램 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램을 로드합니다** → `Amaranth_Check` 폴더 선택
4. 확장프로그램 카드에 표시된 **ID** 복사 (32자리 영문)

### 3-2. 리디렉션 URI 추가 (1단계에서 생략했다면)

GCP Console → OAuth 클라이언트 ID 수정 → 승인된 리디렉션 URI 추가:
```
https://{복사한_확장프로그램_ID}.chromiumapp.org/
```

### 3-3. 확장프로그램 설정 입력

1. Chrome 툴바에서 확장프로그램 아이콘 클릭 → **설정(⚙)**
2. `result.txt` 파일을 열어 아래 값 입력:
   - **Client ID**: `client_id` 값
   - **Client Secret**: `client_secret` 값
   - **Spreadsheet ID**: 생성된 스프레드시트 ID
   - **Sheet Name**: `출퇴근 기록부`
3. **저장** → **Google 인증** 버튼 클릭

---

## 생성되는 시트 구조

| 시트명 | 용도 | 컬럼 |
|---|---|---|
| 출퇴근 기록부 | 출퇴근 자동 기록 | Date / StartTime / EndTime |
| 공휴일 | 공휴일 관리 (2026 기본 입력) | 일자 / 비고 |
| 반차/연차 | 휴가 관리 | 일자 / 휴가 |
| WeeklySettings | 금요일 예상 출근 시간 저장 | WeekID / AssumedStartTime |

---

## 참고

- `credentials.json` — GCP에서 받은 인증 정보. **절대 공유하지 마세요.**
- `.token.json` — 인증 후 자동 생성되는 토큰 캐시. 마찬가지로 공유 금지.
- `result.txt` — 설정 완료 후 생성되는 결과 파일.
- 공휴일을 추가/수정하려면 Spreadsheet의 `공휴일` 시트를 직접 편집하세요.
- 토큰이 만료되면 `.token.json`을 삭제 후 `npm start`로 재인증하세요.
