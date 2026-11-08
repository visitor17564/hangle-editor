# Hangle Editor

rhwp와 HOP를 보고, 제가 자주 쓰는 한글 문서 편집 기능을 제 개인 지식 체계인 Obsidian 안으로 가져오고 싶었습니다. 문서 하나를 열거나 고칠 때마다 용량이 큰 오피스 프로그램을 따로 설치하는 부담을 줄이고, 한글 문서와 관련 노트를 같은 보관함에서 다루고 싶었습니다.

이 편집기의 출발점은 두 프로젝트입니다. Edward Kim의 **rhwp**가 HWP·HWPX를 읽고 쓰는 엔진을 제공하고, 그 위에 만든 **HOP**가 메뉴와 도구 모음을 갖춘 편집 화면을 제공합니다. 두 프로젝트를 공개해 주신 개발자와 기여자들께 감사드립니다. [rhwp](https://github.com/edwardkim/rhwp) · [HOP](https://github.com/golbin/hop)

Hangle Editor에서는 이 편집기를 보관함 탭에 연결하고, 명령 팔레트와 리본에서 새 HWPX 만들기, PDF·Markdown 내보내기, Markdown에서 HWPX 만들기를 추가했습니다. 두 원작의 편집 동작을 기준으로 메뉴의 오려두기·복사·붙여넣기, 표 크기 조절, 단어·문단 선택이 데스크톱 Obsidian에서도 작동하는지 점검하고 수정했습니다.

Seeing rhwp and HOP made me want to bring the Hangul editing tools I use into Obsidian, where I keep my personal knowledge. I wanted to open a Korean document alongside my notes without installing a full office suite. rhwp supplies the document engine, and HOP supplies the editor interface.

## Installation

Download `main.js`, `manifest.json`, and `styles.css` from a GitHub release. Put the three files in `.obsidian/plugins/hangle-editor/` inside your vault, reopen desktop Obsidian, and enable **Hangle Editor** in **Settings → Community plugins**. [GitHub releases](https://github.com/visitor17564/hangle-editor/releases)

## Usage

Click an HWP or HWPX file in your vault to edit it in a tab. Use the ribbon icon or the **Hangle Editor** commands in the command palette to create a new HWPX document. Save with **Ctrl+S** (**Cmd+S** on macOS). The **File** menu also lets you export to PDF or Markdown and turn a Markdown note into an editable HWPX document. Editing and conversion work offline.

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

이 저장소에서 작성한 플러그인 코드는 MIT 라이선스로 배포합니다. 사용하는 HOP와 rhwp 커밋도 MIT이며, 두 원본의 저작권·허가 고지와 rhwp의 제3자 고지를 보존합니다. [플러그인 라이선스](LICENSE) · [HOP·rhwp 라이선스](licenses/HOP-and-rhwp.txt) · [rhwp 의존성 고지](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md)

0.2.2에 포함된 rhwp 엔진은 한글 인코딩 변환에 `encoding_rs` 0.8.42를 사용합니다. 소스에 대한 MIT 고지와 WHATWG 문자표에 대한 BSD 3-Clause 고지는 여기에서 읽을 수 있습니다. [encoding_rs 저작권 및 사용 조건](licenses/encoding_rs-0.8.42.txt)

0.2.2의 도구 모음에는 상위 프로젝트의 밝은 테마와 어두운 테마용 SVG 아이콘이 들어 있습니다. rhwp 작업 기록에는 한컴 웹기안기의 아이콘을 복사한 뒤 어두운 테마용 색상을 만들었다고 나옵니다. 현재 확인한 자료로는 이 두 이미지의 재배포 허락을 확인할 수 없습니다. [원본 아이콘 도입 기록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/mydocs/working/archives/task_52_step_report.md#L124-L128) · [어두운 테마 아이콘 제작 기록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/mydocs/working/archives/task_m100_1158_stage5.md)

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
