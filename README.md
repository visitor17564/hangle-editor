# HWP Editor

Open, edit, and save Korean HWP and HWPX documents directly in a desktop Obsidian vault.

보관함에서 한글 파일을 클릭하면 편집기 탭이 열립니다. HOP의 한국어 메뉴·도구 모음과 rhwp의 문서 엔진을 플러그인에 포함했습니다. 문서 열기, 편집, 저장, PDF 생성은 기기 안에서 처리합니다. 별도 프로그램, 계정, 네트워크 연결이 필요하지 않습니다.

## 설치

1. GitHub 릴리스에서 `main.js`, `manifest.json`, `styles.css`를 받습니다. [릴리스](https://github.com/visitor17564/hwp-editor/releases/latest)
2. 보관함의 `.obsidian/plugins/hwp-editor/` 폴더에 세 파일을 넣습니다. Obsidian 설정 폴더 이름을 바꾼 경우 해당 폴더의 `plugins` 아래에 넣습니다.
3. Obsidian을 다시 열고 **설정 → 커뮤니티 플러그인 → HWP Editor**를 켭니다. 데스크톱 Obsidian 1.12.4 이상에서 사용할 수 있습니다.

## 사용

| 작업 | 방법 |
| --- | --- |
| 열기 | 보관함에서 `.hwp` 또는 `.hwpx` 파일을 클릭하거나 명령 팔레트에서 **HWP Editor: 한글 문서 열기**를 실행합니다. |
| 새 문서 | 보관함의 폴더를 오른쪽 클릭해 **새 한글 문서**를 선택합니다. 명령 팔레트에서도 만들 수 있습니다. |
| 편집 | 문서에서 바로 입력하고 HOP의 서식·표·그림 메뉴, 눈금자, 확대/축소를 사용합니다. |
| 저장 | **파일 → 저장** 또는 `Ctrl/Cmd+S`를 누르면 변경 사항을 보관함에 기록합니다. 저장하기 전에 탭을 닫으면 **저장**, **버리기**, **계속 편집** 중 하나를 선택할 수 있습니다. |
| 다른 이름·형식으로 저장 | **파일 → 다른 이름으로 저장**에서 같은 폴더에 만들 파일 이름을 입력합니다. `.hwp`, `.hwpx` 중 원하는 확장자를 지정하면 편집 탭이 새 파일로 전환되고 원본이 유지됩니다. |
| PDF·인쇄 | **파일 → PDF 내보내기**는 현재 쪽을 이미지로 담은 PDF를 같은 보관함 폴더에 생성합니다. **파일 → 인쇄**는 인쇄용 페이지를 준비하고 시스템 인쇄 창을 호출합니다. |
| 외부 파일 가져오기 | 열린 편집기로 HWP/HWPX 파일을 끌어 놓으면 현재 문서 폴더에 복사하고 새 탭에서 엽니다. |

### 저장과 호환성

- 마지막으로 읽은 뒤 다른 탭이나 동기화 프로그램이 원본을 바꾸면 편집 내용을 **충돌 사본**에 저장하고 경로를 알립니다.
- 원본이 구형 HWP이거나 rhwp가 개체 보존 손실을 보고하면 **변환 사본**을 만들고 원본을 유지합니다. 이 탭에서 이어지는 편집도 해당 사본에 저장합니다.
- 문서 배치는 설치된 글꼴과 rhwp의 형식 지원 범위에 따라 달라질 수 있습니다. 전용 글꼴이 필요한 문서는 같은 글꼴이 설치된 환경에서 확인하세요. PDF 내보내기로 만든 파일에서는 본문 텍스트 검색을 지원하지 않습니다.
- 문서 탭은 서로 독립된 편집기입니다. 파일은 Obsidian의 보관함 API로 읽고 씁니다. 편집 중인 문서와 글꼴 목록을 외부 서비스로 전송하지 않습니다.

## 소스에서 빌드

Node.js 22 이상과 Git이 필요합니다. 저장소 루트에서 실행합니다.

```sh
npm ci
npm run build
```

빌드 스크립트가 고정된 두 Git 커밋에서 웹 편집에 필요한 소스를 가져오고 루트에 `main.js`를 만듭니다. 첫 빌드에는 인터넷 연결이 필요합니다. 기본 소스 캐시는 `node_modules/.cache/hwp-editor`이며 `HWP_EDITOR_CACHE`로 위치를 지정할 수 있습니다.

- `src/`에 Obsidian 파일 뷰, 보관함 저장, 편집기 통신 코드가 있습니다.
- `studio/`는 HOP의 메뉴·도구 모음·편집 캔버스를 Obsidian에 연결합니다.
- 릴리스 태그는 `manifest.json`의 버전과 같아야 합니다. 해당 태그에 `main.js`, `manifest.json`, `styles.css`를 첨부합니다. [Obsidian 플러그인 제출 안내](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)

## 원본 프로젝트와 라이선스

편집기 화면·단축키·인쇄는 HOP 0.4.5를 기반으로 하고 문서 파싱·렌더링·직렬화는 HOP가 고정한 rhwp 0.8.7을 사용합니다. [HOP 원본](https://github.com/golbin/hop/tree/80888af2b8c8a18aea16f824d2d92309a290b1ad) · [rhwp 원본](https://github.com/edwardkim/rhwp/tree/1a76570e833917d15817415a53c09ad61ab3203f)

플러그인 소스는 MIT 라이선스로 배포합니다. 배포 번들에는 편집기 및 의존성의 저작권 고지를 포함합니다. [플러그인 라이선스](LICENSE) · [HOP·rhwp 라이선스](licenses/HOP-and-rhwp.txt) · [rhwp 의존성 고지](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md)

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
