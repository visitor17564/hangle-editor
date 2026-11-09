# Hangle Editor

rhwp와 HOP를 보고, 제가 자주 쓰는 한글 문서 편집 기능을 제 개인 지식 체계인 Obsidian 안으로 가져오고 싶었습니다. 문서 하나를 열거나 고칠 때마다 용량이 큰 오피스 프로그램을 따로 설치하는 부담을 줄이고, 한글 문서와 관련 노트를 같은 보관함에서 다루고 싶었습니다.

[English guide](README.md)

이 편집기의 출발점은 두 프로젝트입니다. Edward Kim의 **rhwp**가 HWP·HWPX를 읽고 쓰는 엔진을 제공하고, 그 위에 만든 **HOP**가 메뉴와 도구 모음을 갖춘 편집 화면을 제공합니다. 두 프로젝트를 공개해 주신 개발자와 기여자들께 감사드립니다. [rhwp](https://github.com/edwardkim/rhwp) · [HOP](https://github.com/golbin/hop)

Hangle Editor에서는 이 편집기를 보관함 탭에 연결하고, 명령 팔레트와 리본에서 새 HWPX 만들기, PDF·Markdown 내보내기, Markdown에서 HWPX 만들기를 추가했습니다. 두 원작의 편집 동작을 기준으로 메뉴의 오려두기·복사·붙여넣기, 표 크기 조절, 단어·문단 선택이 데스크톱 Obsidian에서도 작동하는지 점검하고 수정했습니다.

## 시작하기

**설정 → 커뮤니티 플러그인 → 탐색**에서 **Hangle Editor**를 검색해 설치하고 활성화하세요. 데스크톱 Obsidian 1.12.4 이상에서 사용할 수 있습니다. [커뮤니티 플러그인 페이지](https://community.obsidian.md/plugins/hangle-editor)

직접 설치할 때는 다음 세 파일을 같은 릴리스에서 받습니다.

1. GitHub 릴리스에서 `main.js`, `manifest.json`, `styles.css`를 받습니다. [릴리스](https://github.com/visitor17564/hangle-editor/releases/latest)
2. 보관함의 `.obsidian/plugins/hangle-editor/`에 세 파일을 넣고 Obsidian을 다시 엽니다. 설정 폴더 이름을 바꿨다면 그 폴더의 `plugins`를 사용합니다.
3. **설정 → 커뮤니티 플러그인 → Hangle Editor**를 켭니다. 데스크톱 Obsidian 1.12.4 이상을 지원합니다.

이전 **visitor17564의 HWP Editor 0.1.0**을 직접 설치했다면 기존 플러그인을 끄고 새 폴더에 설치하세요. 플러그인 ID가 `hwp-editor`에서 `hangle-editor`로 바뀌었습니다.

## Windows 파일 탐색기에서 더블클릭으로 열기

Hangle Editor를 켜 둔 Obsidian 보관함을 하나 선택합니다. Windows용 압축 파일을 풀고 그 폴더에서 PowerShell을 연 뒤, 아래 명령에 실제 보관함 이름이나 전체 경로를 입력하세요. 연결 프로그램은 현재 Windows 사용자에게 등록됩니다. [Windows 연결 프로그램 다운로드](https://github.com/visitor17564/hangle-editor/releases/download/0.3.0/HangleEditor-Windows.zip)

```powershell
.\Register-HangleEditor.ps1 -Vault "보관함 이름"
```

파일 탐색기에서 `.hwpx`를 우클릭한 뒤 **연결 프로그램 → 다른 앱 선택 → Hangle Editor → 항상**을 선택합니다. `.hwp`도 기본으로 열려면 해당 확장자에서 한 번 더 선택하세요. ‘한 번만’을 고르면 그 파일만 엽니다. 연결 등록은 `.\Register-HangleEditor.ps1 -Unregister`로 해제할 수 있습니다.

외부 한글 문서는 탐색기에서 선택한 경로로 열립니다. `Ctrl+S`는 그 원본에 저장하며, 외부 탭에서 **다른 이름으로 저장**, **PDF 내보내기**, **Markdown 내보내기**를 실행하면 시스템 저장 창이 열립니다. 보관함은 편집기를 실행하는 역할을 합니다.

## 명령 팔레트와 리본

명령 팔레트는 Obsidian 안에서 기능을 이름으로 찾아 실행하는 창입니다. **Ctrl+P**(macOS: **Cmd+P**)를 누르고 `Hangle Editor` 또는 `HWPX`처럼 원하는 명령 이름의 일부를 입력하세요. 화살표 키로 고른 뒤 **Enter**를 누르거나 결과를 클릭하면 실행됩니다. **Esc**로 닫을 수 있습니다.

예를 들어 회의 노트를 열어 둔 상태에서 `첨부파일 위치`를 검색하고 **첨부파일 위치에 새 HWPX 만들기**를 선택하면, 그 노트를 기준으로 Obsidian의 첨부파일 설정에 맞춰 문서가 생깁니다. PDF가 필요하면 먼저 한글 문서를 연 뒤 `PDF 내보내기`를 실행하세요. **저장·다른 이름으로 저장·내보내기는 현재 한글 편집 탭이 준비된 뒤에만** 팔레트에 표시됩니다.

자주 쓰는 명령은 **설정 → 단축키**에서 `Hangle Editor`를 검색해 키를 지정할 수 있습니다. 왼쪽 리본의 한글 문서 아이콘은 **새 한글 문서 만들기 (HWPX)**와 같은 기능이며, **설정 → Hangle Editor → 새 한글 문서 리본 아이콘**에서 켜고 끌 수 있습니다.

| 명령 팔레트 | 사용 방법 |
| --- | --- |
| 새 한글 문서 만들기 (HWPX) | 보관함 최상위에 빈 `.hwpx`를 만들고 엽니다. **설정 → Hangle Editor → 새 문서 기본 폴더 → 폴더 선택**에서 저장 위치를 바꿀 수 있습니다. 리본과 편집기의 **파일 → 새로 만들기**도 같은 위치를 씁니다. |
| 첨부파일 위치에 새 HWPX 만들기 | **설정 → 파일 및 링크 → 새 첨부파일을 만들 위치**를 따라 빈 `.hwpx`를 만들고 엽니다. ‘현재 파일과 같은 폴더’ 또는 ‘현재 폴더의 하위 폴더’는 명령 실행 시 열려 있던 파일을 기준으로 합니다. |
| 한글 문서 열기 | 시스템 파일 탐색기에서 보관함 안팎의 HWPX·HWP 원본을 선택합니다. |
| 한글 문서 저장 | 현재 편집한 내용으로 파일을 저장합니다. 편집 중에는 `Ctrl/Cmd+S`도 쓸 수 있습니다. |
| 한글 문서 다른 이름으로 저장 | 기본 확장자는 `.hwpx`입니다. `.hwp`를 선택하면 호환 형식으로 저장합니다. `.pdf`와 `.md`도 지정할 수 있습니다. |
| PDF 내보내기 · Markdown 내보내기 | 보관함 문서는 같은 폴더에 저장하고, 외부 문서는 시스템 저장 창에서 위치와 이름을 고릅니다. |
| Markdown에서 HWPX 만들기 | 현재 Markdown 노트를 변환합니다. 다른 탭에서는 시스템 파일 탐색기로 선택하고 원본 Markdown 옆에 HWPX를 만듭니다. |

편집기 상단 **파일** 메뉴에서도 **다른 이름으로 저장**, **PDF 내보내기**, **Markdown 내보내기**, **Markdown에서 HWPX 만들기**, **인쇄**를 사용할 수 있습니다.

## 저장과 변환

- 파일 탐색기가 선택한 경로를 편집기에 전달합니다. 보관함 문서는 Obsidian의 파일 API로, 외부 문서는 해당 디스크 경로에서 읽고 씁니다. 외부 Markdown에 연결된 이미지는 원본 폴더와 그 하위 폴더에서 읽습니다. 외부 문서 탭을 다음 실행에서 복원하면 표시된 경로를 확인하고 **외부 원본 다시 열기**를 누를 수 있습니다. 커뮤니티 검사에서 이 기능은 **Direct Filesystem Access**로 표시됩니다. 외부 원본 저장은 같은 폴더에서 쓰기를 마친 뒤 선택한 파일을 교체합니다.
- 같은 문서를 여러 탭에서 편집하면 **마지막으로 저장한 탭의 내용이 원본에 남습니다**. 변경한 탭을 닫을 때는 저장·버리기·계속 편집 중에서 선택합니다.
- 기존 HWP는 원래 형식으로 저장할 수 있습니다. 구형 포맷을 전환해야 하거나 일부 개체를 보존할 수 없으면 보관함 문서는 변환 사본을 만들고, 외부 문서는 **다른 이름으로 저장**을 안내합니다.
- PDF는 rhwp가 그린 페이지를 이미지로 담습니다. 인쇄는 HOP의 인쇄용 페이지를 시스템 인쇄 창으로 보냅니다.
- Markdown 변환은 본문과 제목, 강조, 목록, 표를 옮깁니다. Markdown을 가져오면 원본 노트 옆에 독립된 HWPX가 생깁니다. 같은 이름의 파일이 있으면 새 이름에 번호를 붙입니다.
- Markdown 가져오기에서는 노트의 YAML 속성을 건너뜁니다. 보관함에 있는 PNG·JPEG·GIF·WebP·BMP 그림을 읽고 외부 그림 주소는 접속 없이 텍스트로 옮깁니다. 글꼴, 쪽 배치, 특수 개체는 형식에 따라 표현이 달라질 수 있습니다.

## 빌드

Node.js 22 이상과 Git이 필요합니다.

```sh
npm ci
npm run lint
npm run build
```

첫 빌드는 아래 두 Git 커밋에서 브라우저 편집에 필요한 소스를 가져옵니다. `HWP_EDITOR_CACHE`로 원본 캐시 위치를 지정할 수 있습니다. 빌드는 편집 화면과 rhwp 엔진을 Brotli로 압축해 `main.js`에 포함하고, 최종 파일이 5,000,000바이트 이상이면 실패합니다. 설치 후에는 엔진을 따로 다운로드하지 않습니다.

- `src/`에 파일 뷰, 명령 팔레트, 리본 설정, 보관함 입출력 코드가 있습니다.
- `studio/`에서 HOP의 메뉴·도구 모음·편집 캔버스를 연결하고 rhwp 엔진으로 문서를 변환합니다.
- 릴리스에는 `manifest.json`과 같은 버전의 태그를 붙이고 `main.js`, `manifest.json`, `styles.css`를 첨부합니다. [Obsidian 제출 안내](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- GitHub Actions가 Obsidian 설치 파일의 출처를 증명합니다. 0.3.1 본체는 내려받은 폴더에서 `gh attestation verify main.js --repo visitor17564/hangle-editor --source-ref refs/tags/0.3.1`로 검증할 수 있습니다. 별도 다운로드하는 Windows 연결 프로그램 패키지의 서명 태그는 `0.3.0`입니다. [빌드 및 서명 워크플로](.github/workflows/attest-release.yml)

## 원본과 라이선스

HOP 0.4.5의 편집 화면과 rhwp 0.8.7의 문서 엔진을 사용합니다. Markdown을 읽을 때는 Marked를, HWPX의 본문 구조를 읽을 때는 fflate를 사용합니다. [HOP](https://github.com/golbin/hop/tree/80888af2b8c8a18aea16f824d2d92309a290b1ad) · [rhwp](https://github.com/edwardkim/rhwp/tree/1a76570e833917d15817415a53c09ad61ab3203f)

이 저장소에서 작성한 플러그인 코드는 MIT 라이선스로 배포합니다. 사용하는 HOP와 rhwp 커밋도 MIT이며, 두 원본의 저작권·허가 고지와 rhwp의 제3자 고지를 보존합니다. [플러그인 라이선스](LICENSE) · [HOP·rhwp 라이선스](licenses/HOP-and-rhwp.txt) · [rhwp 의존성 고지](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md)

rhwp 엔진은 한글 인코딩 변환에 `encoding_rs` 0.8.42를 사용합니다. 소스에 대한 MIT 고지와 WHATWG 문자표에 대한 BSD 3-Clause 고지는 여기에서 읽을 수 있습니다. [encoding_rs 저작권 및 사용 조건](licenses/encoding_rs-0.8.42.txt)

0.2.3부터 편집기의 메뉴·도구 모음·확대/축소에는 [Lucide](https://lucide.dev)를 사용합니다. 사용하는 아이콘만 내장하므로 오프라인에서도 볼 수 있으며, Lucide(ISC)와 Feather 유래 아이콘(MIT)의 고지를 배포 파일에 포함합니다. Obsidian 왼쪽의 ‘새 한글 문서’ 리본은 이 프로젝트에서 만든 SVG입니다. [Lucide·Feather 라이선스](licenses/lucide-1.70.0.txt)

0.2.2의 도구 모음에는 상위 프로젝트의 밝은 테마와 어두운 테마용 SVG 아이콘이 들어 있습니다. rhwp 작업 기록에는 한컴 웹기안기의 아이콘을 복사한 뒤 어두운 테마용 색상을 만들었다고 나옵니다. 현재 확인한 자료로는 이 두 이미지의 재배포 허락을 확인할 수 없습니다. [원본 아이콘 도입 기록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/mydocs/working/archives/task_52_step_report.md#L124-L128) · [어두운 테마 아이콘 제작 기록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/mydocs/working/archives/task_m100_1158_stage5.md)

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
