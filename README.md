# Hangle Editor

Create and edit HWPX documents in Obsidian. Open existing HWP files, export the current document to PDF or Markdown, and turn a Markdown note into an editable HWPX file.

보관함에서 한글 파일을 클릭하면 HOP 편집기가 탭으로 열립니다. 새 문서의 기본 형식은 **HWPX**입니다. 편집과 변환은 데스크톱 Obsidian 안에서 오프라인으로 동작합니다.

## 시작하기

1. GitHub 릴리스에서 `main.js`, `manifest.json`, `styles.css`를 받습니다. [릴리스](https://github.com/visitor17564/hangle-editor/releases/latest)
2. 보관함의 `.obsidian/plugins/hangle-editor/`에 세 파일을 넣고 Obsidian을 다시 엽니다. 설정 폴더 이름을 바꿨다면 그 폴더의 `plugins`를 사용합니다.
3. **설정 → 커뮤니티 플러그인 → Hangle Editor**를 켭니다. 데스크톱 Obsidian 1.12.4 이상을 지원합니다.

이전 **visitor17564의 HWP Editor 0.1.0**을 직접 설치했다면 기존 플러그인을 끄고 새 폴더에 설치하세요. 플러그인 ID가 `hwp-editor`에서 `hangle-editor`로 바뀌었습니다.

## 명령 팔레트와 리본

**Ctrl+P**(macOS에서는 **Cmd+P**)로 Obsidian 명령 팔레트를 열고 `Hangle Editor`를 검색하세요. 왼쪽 리본의 한글 문서 아이콘을 클릭하면 새 HWPX 파일을 만듭니다. 아이콘은 **설정 → Hangle Editor → 새 한글 문서 리본 아이콘**에서 켜고 끌 수 있습니다.

| 명령 팔레트 | 사용 방법 |
| --- | --- |
| 새 한글 문서 만들기 (HWPX) | 보관함에 빈 `.hwpx` 파일을 만들고 엽니다. |
| 한글 문서 열기 | 보관함 안의 HWPX·HWP 파일을 검색합니다. |
| 한글 문서 저장 | 현재 편집한 내용으로 파일을 저장합니다. 편집 중에는 `Ctrl/Cmd+S`도 쓸 수 있습니다. |
| 한글 문서 다른 이름으로 저장 | 기본 확장자는 `.hwpx`입니다. `.hwp`를 선택하면 호환 형식으로 저장합니다. `.pdf`와 `.md`도 지정할 수 있습니다. |
| PDF 내보내기 · Markdown 내보내기 | 열린 한글 문서의 현재 편집 내용을 같은 폴더에 새 파일로 저장합니다. |
| Markdown에서 HWPX 만들기 | 현재 Markdown 노트를 편집 가능한 HWPX로 만듭니다. 다른 화면에서는 보관함에서 노트를 선택합니다. |

편집기 상단 **파일** 메뉴에서도 **다른 이름으로 저장**, **PDF 내보내기**, **Markdown 내보내기**, **Markdown에서 HWPX 만들기**, **인쇄**를 사용할 수 있습니다.

## 저장과 변환

- 같은 문서를 여러 탭에서 편집하면 **마지막으로 저장한 탭의 내용이 원본에 남습니다**. 변경한 탭을 닫을 때는 저장·버리기·계속 편집 중에서 선택합니다.
- 기존 HWP는 원래 형식으로 저장할 수 있습니다. 구형 HWP 포맷을 전환해야 하거나 rhwp가 개체 보존 손실을 보고하면 변환 사본을 만들고 경로를 표시합니다.
- PDF는 rhwp가 그린 페이지를 이미지로 담습니다. 인쇄는 HOP의 인쇄용 페이지를 시스템 인쇄 창으로 보냅니다.
- Markdown 변환은 본문과 제목, 강조, 목록, 표를 옮깁니다. Markdown을 가져오면 원본 노트 옆에 독립된 HWPX가 생깁니다. 같은 이름의 파일이 있으면 새 이름에 번호를 붙입니다.
- Markdown 가져오기에서는 노트의 YAML 속성을 건너뜁니다. 보관함에 있는 PNG·JPEG·GIF·WebP·BMP 그림을 읽고 외부 그림 주소는 접속 없이 텍스트로 옮깁니다. 글꼴, 쪽 배치, 특수 개체는 형식에 따라 표현이 달라질 수 있습니다.

## 빌드

Node.js 22 이상과 Git이 필요합니다.

```sh
npm ci
npm run build
```

첫 빌드는 아래 두 Git 커밋에서 브라우저 편집에 필요한 소스를 가져옵니다. `HWP_EDITOR_CACHE`로 원본 캐시 위치를 지정할 수 있습니다. 빌드가 끝나면 저장소 루트에 `main.js`가 생성됩니다.

- `src/`에 파일 뷰, 명령 팔레트, 리본 설정, 보관함 입출력 코드가 있습니다.
- `studio/`에서 HOP의 메뉴·도구 모음·편집 캔버스를 연결하고 rhwp 엔진으로 문서를 변환합니다.
- 릴리스에는 `manifest.json`과 같은 버전의 태그를 붙이고 `main.js`, `manifest.json`, `styles.css`를 첨부합니다. [Obsidian 제출 안내](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)

## 원본과 라이선스

HOP 0.4.5의 편집 화면과 rhwp 0.8.7의 문서 엔진을 사용합니다. Markdown을 읽을 때는 Marked를, HWPX의 본문 구조를 읽을 때는 fflate를 사용합니다. [HOP](https://github.com/golbin/hop/tree/80888af2b8c8a18aea16f824d2d92309a290b1ad) · [rhwp](https://github.com/edwardkim/rhwp/tree/1a76570e833917d15817415a53c09ad61ab3203f)

플러그인 소스는 MIT 라이선스로 배포합니다. 번들에는 편집기 및 의존성의 저작권 고지를 포함합니다. [플러그인 라이선스](LICENSE) · [HOP·rhwp 라이선스](licenses/HOP-and-rhwp.txt) · [rhwp 의존성 고지](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md)

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
