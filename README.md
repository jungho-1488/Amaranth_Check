# Amaranth 출퇴근 체크 - Chrome 확장 프로그램

Amaranth HR 시스템에서 출퇴근 확인 버튼을 클릭하면 Google Sheets에 자동으로 기록하고,
대시보드에서 오늘 근무시간과 주간 누적 시간을 한눈에 확인할 수 있습니다.

## 주요 기능

- **자동 출퇴근 기록**: Amaranth 확인 버튼 클릭 시 Sheets에 즉시 기록
- **오늘 근무 현황**: 출근/퇴근 시각, 순근무시간(휴게 공제 후) 실시간 표시
- **주간 누적 시간**: 이번 주 월~금 근무시간 합산, 40h 기준 진행률 표시
- **근로기준법 §54 자동 적용**: 4h↑→30분, 8h↑→1시간 휴게시간 자동 공제
- **공휴일 자동 인식**: Sheets의 `공휴일` 시트에서 읽어 8h 환산
- **반차/연차 관리**: 팝업에서 직접 추가, 연차 8h·반차 4h 주간 집계 반영

---

## 설치 가이드

### 1단계: Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (예: `Amaranth-Check`)
3. **API 및 서비스 → 라이브러리** → `Google Sheets API` 검색 후 **사용** 클릭
4. **API 및 서비스 → 사용자 인증 정보 → + 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
5. 애플리케이션 유형: **웹 애플리케이션** 선택
6. 리디렉션 URI 등록은 **3단계 이후** 진행 (확장 프로그램 ID가 필요)

### 2단계: Chrome에 확장 프로그램 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램을 로드합니다** → 이 폴더(`Amaranth_Check`) 선택
4. 카드에 표시된 **확장 프로그램 ID** 복사 (32자리 영문)

### 3단계: Redirect URI 등록

1. Google Cloud Console → OAuth 클라이언트 ID 수정
2. **승인된 리디렉션 URI** 에 아래 형식으로 추가:
   ```
   https://{확장프로그램ID}.chromiumapp.org/
   ```
   예시: `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`
3. 저장

> **팁**: 확장 프로그램 팝업 → 설정 페이지에서 **Redirect URI**가 자동으로 표시됩니다. 복사 버튼으로 클립보드에 복사하세요.

### 4단계: 확장 프로그램 설정

1. Chrome 툴바에서 확장 프로그램 아이콘 클릭 → **⚙ 설정**
2. **Client ID** 와 **Client Secret** 입력 (Google Cloud Console에서 복사)
3. **Spreadsheet ID** 입력:
   - 시트 URL의 `/d/` 와 `/edit` 사이 값
   - 예: `1O53G4kisu2hCERDlUowk85s7p3qYnt13TucVbEy_wf8`
4. **저장** 클릭
5. **Google 인증** 버튼 클릭 → Google 계정 로그인 및 권한 허용

---

## Google Sheets 구조

### 출퇴근 기록부 (자동 기록)

| A (Date)   | B (StartTime) | C (EndTime) |
|------------|---------------|-------------|
| 2026-03-26 | 08:54         | 17:23       |

### 공휴일 (읽기 전용, 수동 관리)

| A (일자)   | B (비고)     |
|------------|-------------|
| 2026-03-01 | 삼일절       |

### 반차/연차 (팝업에서 추가 가능)

| A (일자)   | B (휴가) |
|------------|---------|
| 2026-03-05 | 연차     |
| 2026-03-10 | 반차     |

---

## 근무시간 계산 규칙

### 근로기준법 제54조(휴게) 자동 적용

| 실근무 시간 | 공제 휴게 |
|------------|---------|
| 4시간 미만  | 없음     |
| 4시간 이상  | 30분     |
| 8시간 이상  | 1시간    |

### 주간 집계 기준 (40시간)

| 유형     | 주간 시간 환산 |
|---------|------------|
| 실근무    | 순근무시간(휴게공제) |
| 연차     | 8시간 환산   |
| 반차     | 실근무 + 4시간 |
| 공휴일   | 8시간 환산   |

---

## 파일 구조

```
Amaranth_Check/
├── manifest.json   - 확장 프로그램 설정
├── content.js      - Amaranth 다이얼로그 감지
├── background.js   - OAuth2 + Google Sheets API
├── popup.html/js   - 대시보드 UI
└── options.html/js - OAuth & Sheets 설정 페이지
```
