# OpenCode 빌드 및 사용 가이드

> **버전**: 1.0
> **업데이트**: 2024-12-12

## 개요

OpenCode는 AI 기반 개발 도구로, 여러 플랫폼에서 실행할 수 있습니다. 이 가이드는 OpenCode를 빌드하고 실행하는 방법을 상세히 설명합니다.

## 시스템 요구사항

- **Node.js**: 18.x 이상
- **Bun**: 1.3.3 이상 (권장)
- **운영체제**:
  - Linux (x64, ARM64)
  - macOS (Intel, Apple Silicon)
  - Windows (x64)

## 빌드 방법

### 1. 사전 준비

```bash
# Bun 설치 (권장)
curl -fsSL https://bun.sh/install | bash

# 또는 npm 사용
npm install -g bun@latest

# 의존성 설치
bun install
```

### 2. OpenCode 빌드

#### 2.1 전체 플랫폼 빌드 (Release)

```bash
# 모든 플랫폼용 바이너리 빌드
cd packages/opencode
bun run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다:

```
dist/
├── opencode-linux-arm64/
│   ├── bin/
│   │   └── opencode
│   └── package.json
├── opencode-linux-x64/
├── opencode-linux-x64-baseline/
├── opencode-linux-arm64-musl/
├── opencode-linux-x64-musl/
├── opencode-darwin-arm64/
├── opencode-darwin-x64/
├── opencode-darwin-x64-baseline/
├── opencode-windows-x64/
└── opencode-windows-x64-baseline/
```

#### 2.2 현재 플랫폼만 빌드

```bash
# 현재 플랫폼용만 빌드
cd packages/opencode
bun run build --single
```

#### 2.3 의존성 설치 건너뛰기

```bash
# 이미 의존성이 설치된 경우
bun run build --skip-install
```

### 3. 바이너리 설치

#### Linux/macOS

```bash
# 빌드된 바이너리를 시스템 경로에 복사
sudo cp dist/opencode-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin/opencode /usr/local/bin/

# 또는 사용자 설치
mkdir -p ~/.local/bin
cp dist/opencode-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin/opencode ~/.local/bin/
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

#### Windows

```powershell
# PowerShell 관리자 권한으로 실행
Copy-Item "dist\opencode-windows-x64\bin\opencode.exe" "C:\Program Files\OpenCode\"

# PATH에 추가
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\OpenCode", "Machine")
```

## 사용 방법

### 1. CLI 모드

#### 기본 사용

```bash
# 도움말 보기
opencode --help

# 현재 디렉토리에서 OpenCode 실행
opencode

# 특정 디렉토리에서 실행
opencode /path/to/project

# 특정 모델 사용
opencode --model gpt-4 --provider openai

# 세션 명시
opencode --session my-project-session
```

#### 주요 명령어

```bash
# 새 세션 시작
opencode run

# 세션 목록 보기
opencode session list

# 특정 세션에 연결
opencode attach <session-id>

# 프로젝트 상태 보기
opencode status

# 설정 관리
opencode config set model gpt-4
opencode config list
```

### 2. 서버 모드 (API 서버)

#### 기본 서버 시작

```bash
# 기본 포트(4096)에서 서버 시작
opencode serve

# 특정 포트에서 서버 시작
opencode serve --port 8080

# 특정 호스트에서 서버 시작
opencode serve --hostname 0.0.0.0
```

#### 서버 모드 설정

```bash
# CORS 허용
opencode serve --cors "*"

# 개발 모드 (디버그 로그 활성화)
opencode serve --debug

# 자동 공유 비활성화
opencode serve --no-auto-share
```

### 3. TUI 모드 (터미널 UI)

```bash
# TUI 시작
opencode tui

# TUI로 특정 세션 연결
opencode tui --session <session-id>

# 전체 화면 모드
opencode tui --fullscreen
```

## API 서버 사용

### 1. 기본 API 호출

```bash
# 서버 상태 확인
curl http://localhost:4096/health

# 세션 목록 조회
curl http://localhost:4096/session

# 새 세션 생성
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "gpt-4",
    "model": "openai"
}'

## GLM Provider 설정

GLM(ChatGLM) 모델을 기본 제공자로 사용하려면 API 키와 모델 정보를 등록해야 합니다. OpenCode는 환경 변수, `~/.config/opencode/opencode.json(c)` 설정 파일, 프로젝트 로컬 설정을 모두 지원합니다.

### 1. 환경 변수

```bash
export GLM_API_KEY=your_glm_api_key
export GLM_MODEL=glm-4-plus          # 기본으로 사용할 모델
export GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

환경 변수를 지정하면 `opencode serve`와 CLI 모드 모두에서 자동으로 GLM 제공자를 활성화합니다. `GLM_MODEL` 값을 지정하면 해당 모델이 기본 선택으로 사용됩니다(설정 파일에서 `model`을 따로 지정한 경우가 아니면).

### 2. 설정 파일 예시

`~/.config/opencode/opencode.jsonc` 또는 리포지토리 루트의 `opencode.jsonc`에 다음을 추가하면 환경 변수를 사용하지 않고도 GLM을 구성할 수 있습니다.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "glm": {
      "options": {
        "apiKey": "{env:GLM_API_KEY}",
        "baseURL": "https://open.bigmodel.cn/api/paas/v4",
        "rateLimit": {
          "requestsPerInterval": 8,
          "intervalMs": 1000
        },
        "retry": {
          "maxRetries": 4,
          "baseDelayMs": 800
        }
      }
    }
  }
}
```

`rateLimit`과 `retry` 값은 선택 사항이며, API 호출이 과도하게 실패하지 않도록 OpenCode가 자체적으로 처리합니다.

### 3. 확인 방법

```bash
# 등록된 모델 확인
opencode models | grep glm

# 서버 로그에서 GLM provider 로딩 확인
OPENCODE_LOG=debug opencode serve
```

문제가 발생하면 `GLM_API_KEY`가 올바른지와 네트워크에서 `https://open.bigmodel.cn`에 접근 가능한지 확인하세요.
```

### 2. 확장된 API 사용 (mainServer 통합)

```bash
# 프로젝트 워크스페이스 생성
curl -X POST http://localhost:4096/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "path": "/workspace/my-project"
  }'

# 에이전트 세션 생성
curl -X POST http://localhost:4096/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "gpt-4",
    "model": "openai",
    "projectId": "project-123",
    "agentRole": "frontend"
  }'
```

### 3. 실시간 이벤트 구독

```javascript
// Node.js 예제
const EventSource = require('eventsource');

const events = new EventSource('http://localhost:4096/event');

events.onmessage = (event) => {
  console.log('Event:', JSON.parse(event.data));
};

// 필터링된 이벤트 구독
const filteredEvents = new EventSource(
  'http://localhost:4096/event?session=session-123&types=session,task'
);
```

## 설정

### 1. 설정 파일 위치

- **Linux/macOS**: `~/.config/opencode/config.json`
- **Windows**: `%APPDATA%\opencode\config.json`

### 2. 설정 예제

```json
{
  "model": "gpt-4",
  "provider": "openai",
  "apiKey": "your-api-key",
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0",
    "cors": "*"
  },
  "share": "auto",
  "theme": "dark",
  "debug": false
}
```

### 3. 환경 변수

```bash
# API 키 설정
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# 서버 설정
export OPENCODE_SERVER_PORT=4096
export OPENCODE_SERVER_HOST=0.0.0.0

# 기타 설정
export OPENCODE_DEBUG=true
export OPENCODE_LOG_LEVEL=info
```

## 개발

### 1. 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/sst/opencode.git
cd opencode

# 의존성 설치
bun install

# 개발 서버 시작
bun run dev
```

### 2. 테스트

```bash
# 모든 테스트 실행
bun test

# 커버리지 포함 테스트
bun run lint

# 타입 체크
bun run typecheck
```

### 3. 빌드 스크립트

```bash
# 빌드 스크립트 직접 실행
bun packages/opencode/script/build.ts

# 단일 플랫폼 빌드
bun packages/opencode/script/build.ts --single
```

## Docker 사용

### 1. Dockerfile

```dockerfile
FROM node:18-alpine

# Bun 설치
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

# 작업 디렉토리 설정
WORKDIR /app

# 소스 코드 복사
COPY . .

# 의존성 설치
RUN bun install

# 빌드
RUN cd packages/opencode && bun run build --single

# 실행
CMD ["./dist/opencode-linux-x64/bin/opencode", "serve"]
```

### 2. Docker 빌드 및 실행

```bash
# Docker 이미지 빌드
docker build -t opencode .

# 컨테이너 실행
docker run -p 4096:4096 opencode

# 볼륨 마운트
docker run -p 4096:4096 -v /path/to/project:/workspace opencode serve --directory /workspace
```

## 문제 해결

### 1. 일반적인 문제

#### 빌드 실패

```bash
# 캐시 정리
rm -rf node_modules dist
bun install

# 의존성 재설치
bun install --force
```

#### 권한 오류

```bash
# macOS
sudo xattr -rd com.apple.quarantine dist/*/bin/opencode

# Linux
chmod +x dist/*/bin/opencode
```

#### 포트 충돌

```bash
# 다른 포트 사용
opencode serve --port 8080

# 사용 중인 포트 확인
lsof -i :4096
```

### 2. 디버깅

```bash
# 디버그 모드 시작
opencode --debug serve

# 로그 레벨 설정
OPENCODE_LOG_LEVEL=debug opencode serve

# 벌브 모드에서 실행
bun --inspect packages/opencode/src/index.ts serve
```

## 성능 최적화

### 1. 서버 최적화

```bash
# 프로덕션 모드
NODE_ENV=production opencode serve

# 워커 수 설정
OPENCODE_WORKERS=4 opencode serve
```

### 2. 메모리 사용량 조절

```bash
# Node.js 메모리 제한
NODE_OPTIONS="--max-old-space-size=4096" opencode serve

# Bun GC 설정
BUN_GC_MAX_NEW_GENERATION_SIZE=64 opencode serve
```

## 모니터링

### 1. 헬스 체크

```bash
# 서버 상태 확인
curl http://localhost:4096/health

# 상세 정보
curl http://localhost:4096/health | jq .
```

### 2. 메트릭

```bash
# 프로메테우스 엔드포인트 (활성화된 경우)
curl http://localhost:4096/metrics
```

## 지원

- **GitHub Issues**: [OpenCode Repository](https://github.com/sst/opencode/issues)
- **Discord**: [OpenCode Discord](https://discord.gg/opencode)
- **문서**: [OpenCode Docs](https://opencode.ai/docs)

---

이 가이드는 OpenCode를 성공적으로 빌드하고 사용하는 데 필요한 모든 정보를 제공합니다. 추가 질문이나 문제가 있을 경우 GitHub Issues를 통해 문의해 주세요.
