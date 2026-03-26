# Amaranth 출퇴근 체크 — 설치 가이드

Amaranth HR 시스템에서 출퇴근 확인 버튼을 누르면 **내 Google Sheets에 자동으로 기록**하고,
오늘 근무 시간과 이번 주 누적 시간을 팝업으로 보여주는 Chrome 확장 프로그램입니다.

> 모든 데이터는 **내 구글 계정**에만 저장됩니다. 다른 사람은 볼 수 없습니다.

---

## 파일 받기

1. 아래 GitHub 링크에 접속합니다:
   [github.com/jungho-1488/Amaranth_Check](https://github.com/jungho-1488/Amaranth_Check)

2. 초록색 **"< > Code"** 버튼 클릭 → **"Download ZIP"** 클릭

3. 다운로드된 ZIP 파일을 압축 해제합니다
   - Mac: 파일 더블클릭
   - Windows: 우클릭 → "압축 풀기"

4. 압축을 풀면 **`Amaranth_Check`** 폴더가 생깁니다
   - 이 폴더 안에 `setup/`, `popup.js`, `manifest.json` 등이 있어야 합니다
   - 이후 단계에서 이 폴더를 계속 사용합니다

---

## 시작 전 준비

### 1. Node.js 설치 확인

터미널(맥: `Command + Space` → "터미널" / 윈도우: 윈도우키 → "cmd")을 열고 아래를 입력하세요:

```
node -v
```

숫자(예: `v20.11.0`)가 나오면 OK. 아무것도 안 나오면 [nodejs.org](https://nodejs.org/) 에서 **LTS** 버전을 설치하세요.

### 2. 필요한 것
- Chrome 브라우저
- Google 계정

---

## 전체 흐름 (한눈에)

```
[1단계] GCP 프로젝트 만들기   ← 구글에 "내 앱 등록"
[2단계] Sheets API 켜기       ← 구글 시트 읽기/쓰기 허용
[3단계] OAuth 동의 화면 설정  ← 내 앱 정보 등록
[4단계] Client ID 발급        ← 앱의 아이디/비밀번호 받기
[5단계] npm start 실행        ← 내 구글 시트 자동 생성
[6단계] 확장프로그램 설치     ← Chrome에 프로그램 올리기
[7단계] Redirect URI 추가     ← 확장프로그램 ID 구글에 등록
[8단계] 설정값 입력           ← 확장프로그램에 키값 연결
```

---

## 1단계 — GCP 프로젝트 생성

> **GCP(Google Cloud Platform)** 는 구글 API를 사용할 때 필요한 관리 콘솔입니다.
> 이 확장프로그램이 구글 시트에 접근하려면 여기서 등록이 필요합니다.

1. [console.cloud.google.com](https://console.cloud.google.com/) 에 접속합니다 (구글 계정 로그인)
2. 화면 상단, 구글 로고 오른쪽 옆에 있는 **프로젝트 선택** 드롭다운을 클릭합니다
3. 팝업 우측 상단 **"새 프로젝트"** 를 클릭합니다
4. 프로젝트 이름에 아무거나 입력합니다 (예: `amaranth-check`)
5. **"만들기"** 클릭

✅ **완료 확인:** 화면 상단에 내가 만든 프로젝트 이름이 표시됩니다

---

## 2단계 — Google Sheets API 활성화

> 이 확장프로그램이 구글 시트에 기록을 남기려면, 구글에서 해당 기능을 허용해야 합니다.

1. 아래 링크에 접속합니다 (1단계에서 만든 프로젝트가 선택된 상태여야 합니다):
   [console.cloud.google.com/apis/library/sheets.googleapis.com](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
2. 파란색 **"사용 설정"** 버튼을 클릭합니다

> ⚠️ 버튼이 **"API 사용 중지"** 로 표시되면? → 이미 활성화된 것입니다. 다음 단계로 넘어가세요.

✅ **완료 확인:** 버튼이 "API 사용 중지"로 바뀝니다

---

## 3단계 — OAuth 동의 화면 설정

> **OAuth 동의 화면**은 이 앱이 내 구글 계정에 접근할 때 보여주는 허락 화면입니다.
> 구글이 "이 앱이 뭔지 등록해라"고 요구하는 과정입니다.

1. 아래 링크에 접속합니다:
   [console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)

2. User Type 선택 화면에서 **"외부"** 를 선택하고 **"만들기"** 를 클릭합니다
   > ⚠️ "내부"는 구글 워크스페이스 조직 전용입니다. 반드시 **"외부"** 를 선택하세요.

3. **앱 정보** 페이지:
   - 앱 이름: 아무거나 입력 (예: `Amaranth Check`)
   - 사용자 지원 이메일: 드롭다운에서 내 이메일 선택
   - 나머지 항목: 비워두어도 됩니다
   - **"저장 후 계속"** 클릭

4. **범위** 페이지: 아무것도 건드리지 않고 **"저장 후 계속"** 클릭

5. **테스트 사용자** 페이지:
   > ⚠️ 여기서 내 이메일을 추가하지 않으면 나중에 구글 로그인이 안 됩니다. 반드시 추가하세요.
   - **"+ ADD USERS"** 클릭
   - 내 구글 이메일 주소 입력 → **"추가"** 클릭
   - **"저장 후 계속"** 클릭

6. **요약** 페이지: **"대시보드로 돌아가기"** 클릭

✅ **완료 확인:** "앱 게시 상태: 테스트 중" 이라고 표시됩니다

---

## 4단계 — OAuth 2.0 Client ID 발급

> **Client ID** = 이 앱의 아이디 / **Client Secret** = 이 앱의 비밀번호
> 5단계와 8단계에서 사용하니 반드시 저장해두세요.

1. 아래 링크에 접속합니다:
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

2. 화면 상단 **"+ 사용자 인증 정보 만들기"** 클릭 → **"OAuth 클라이언트 ID"** 선택

3. 애플리케이션 유형: **"웹 애플리케이션"** 선택

4. 이름: 아무거나 입력 (예: `Amaranth Check`)

5. **"승인된 리디렉션 URI"** 섹션에서 **"+ URI 추가"** 클릭 후 아래 주소 입력:
   ```
   http://localhost:3000/callback
   ```
   > 이 주소는 5단계(npm start) 실행 시 구글 로그인에 사용됩니다.

6. **"만들기"** 클릭

7. 팝업창에 **Client ID** 와 **Client Secret** 이 표시됩니다

> ⚠️ **지금 바로** Client ID와 Client Secret을 메모장에 복사해 저장하세요.
> 팝업을 닫으면 Client Secret은 다시 볼 수 없습니다.
> (나중에 다시 필요하면 목록에서 클라이언트 클릭 → Secret 재발급해야 합니다)

✅ **완료 확인:** 팝업에 긴 문자열 두 개(Client ID, Client Secret)가 보입니다

---

## 5단계 — 설정 마법사 실행 (npm start)

> 이 단계에서 내 구글 계정에 스프레드시트가 자동으로 만들어집니다.

1. 터미널을 열고 아래 명령어를 **순서대로** 입력합니다:

   ```bash
   cd [Amaranth_Check 폴더가 있는 경로]/Amaranth_Check/setup
   npm install
   npm start
   ```

   예시 (Mac, 다운로드 폴더에 있는 경우):
   ```bash
   cd ~/Downloads/Amaranth_Check/setup
   npm install
   npm start
   ```

   > `cd`는 폴더 이동 명령어입니다. `npm install`은 최초 1회만 실행하면 됩니다.

2. 터미널이 단계별로 안내합니다. 4단계에서 저장한 값을 순서대로 붙여넣으세요.

3. "잠시 후 브라우저가 자동으로 열립니다" → 브라우저에서 구글 로그인
   > ⚠️ **"앱이 확인되지 않았습니다"** 화면이 뜨면:
   > **"고급"** 클릭 → **"Amaranth Check(안전하지 않음)으로 이동"** 클릭 → 허용
   >
   > 이건 구글에 공식 등록된 앱이 아니라서 뜨는 경고입니다. 내가 만든 앱이라 안전합니다.

4. "허용" 클릭 → 브라우저 창을 닫고 터미널로 돌아옵니다

✅ **완료 확인:** 터미널에 "모든 설정 완료!" 표시 + `setup/result.txt` 파일이 생성됩니다

---

## 6단계 — Chrome 확장프로그램 로드

1. Chrome 주소창(URL 입력하는 곳)에 아래를 그대로 입력합니다:
   ```
   chrome://extensions
   ```

2. 화면 **우측 상단** "개발자 모드" 토글을 켭니다 (파란색이 되어야 합니다)

3. 화면 **좌측 상단**에 새로 생긴 **"압축해제된 확장 프로그램을 로드합니다"** 버튼을 클릭합니다

4. 폴더 선택 창에서 **Amaranth_Check 폴더 전체**를 선택합니다
   > ⚠️ `setup` 폴더가 아닙니다. `Amaranth_Check` 폴더 자체를 선택하세요.

5. **"Amaranth 출퇴근 체크"** 카드가 생기면 성공입니다

6. 카드 아래에 표시된 **영문 32자리 ID**를 복사해 메모장에 저장합니다
   > 예: `abcdefghijklmnopqrstuvwxyzabcdef`

✅ **완료 확인:** chrome://extensions 화면에 "Amaranth 출퇴근 체크" 카드가 보입니다

---

## 7단계 — Redirect URI 추가

> Chrome 확장프로그램은 로그인할 때 고유한 주소를 사용합니다.
> 그 주소를 구글에 알려줘야 확장프로그램에서 구글 로그인이 됩니다.

1. 4단계에서 접속했던 링크에 다시 접속합니다:
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

2. 목록에서 4단계에서 만든 OAuth 클라이언트 이름을 클릭합니다

3. 수정 화면 중간에 **"승인된 리디렉션 URI"** 섹션이 보입니다
   - 현재 `http://localhost:3000/callback` 이 있을 것입니다

4. **"+ URI 추가"** 클릭 → 새 칸에 아래 주소를 입력합니다:
   ```
   https://[6단계에서 복사한 32자리 ID].chromiumapp.org/
   ```
   예시: `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`

   > ⚠️ **기존의 `localhost` 주소는 지우지 마세요.** 두 개 모두 있어야 합니다.
   > - `http://localhost:3000/callback` → npm start 로그인용
   > - `https://...chromiumapp.org/` → Chrome 확장 로그인용
   >
   > ⚠️ 주소 맨 끝에 `/` 가 있는지 확인하세요.

5. **"저장"** 클릭

✅ **완료 확인:** "승인된 리디렉션 URI" 목록에 두 개의 주소가 보입니다

---

## 8단계 — 확장프로그램 설정 입력

1. Chrome 우측 상단 **퍼즐 조각 모양** 아이콘을 클릭합니다
2. "Amaranth 출퇴근 체크" 옆 **핀 아이콘**을 클릭해 툴바에 고정합니다
3. 툴바에 생긴 아이콘을 클릭 → 팝업 우측 상단 **⚙ (설정)** 클릭
4. `setup/result.txt` 파일을 메모장으로 열어 아래 값을 각 항목에 입력합니다:

   | 항목 | 어디서 복사하나요 |
   |---|---|
   | Client ID | result.txt의 `Client ID :` 줄 |
   | Client Secret | result.txt의 `Client Secret :` 줄 |
   | Spreadsheet ID | result.txt의 `Spreadsheet ID :` 줄 |
   | Sheet Name | `출퇴근 기록부` 그대로 입력 |

5. **"저장"** 클릭
6. **"Google 인증"** 버튼 클릭 → 구글 로그인 → 허용

✅ **완료 확인:** "Google 인증 성공!" 메시지가 표시되면 끝입니다.
이제 Amaranth에서 출퇴근 확인 버튼을 누르면 자동으로 기록됩니다!

---

## 문제 해결

| 증상 | 해결 방법 |
|---|---|
| "앱이 확인되지 않았습니다" | "고급" 클릭 → "...안전하지 않음으로 이동" 클릭 |
| 포트 3000이 이미 사용 중이라는 오류 | 터미널을 닫고 다시 열어서 `npm start` 재실행 |
| 확장프로그램 아이콘이 보이지 않음 | 퍼즐 조각 아이콘 클릭 → 핀 고정 |
| 구글 로그인이 안 됨 | 3단계 테스트 사용자에 내 이메일이 추가됐는지 확인 |
| 토큰 만료 오류 | `setup/.token.json` 파일 삭제 후 `npm start` 재실행 |
| 확장프로그램을 다시 설치해야 함 | chrome://extensions에서 기존 카드 삭제 후 6단계부터 재진행 |

---

## 주의사항

- `setup/result.txt`, `setup/.token.json` — 내 인증 정보가 담긴 파일입니다. **절대 공유하지 마세요.**
- 공휴일 추가/수정은 스프레드시트의 `공휴일` 시트에서 직접 편집하세요.
