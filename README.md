# OpenCode

AI 기반의 개발 도구로, 여러 플랫폼에서 실행할 수 있습니다. CLI 터미널 UI와 서버 API 모드를 모두 지원합니다.

> **버전**: 0.0.0-local_addon
> **업데이트**: 2024-12-15

## 📋 목차

1. [빠른 시작](#-빠른-시작)
2. [설치](#-설치)
3. [사용 방법](#-사용-방법)
4. [CLI 명령어](#-cli-명령어)
5. [서버 API](#-서버-api)
6. [스크립트](#-스크립트)
7. [환경 설정](#-환경-설정)
8. [GLM 모델 설정](#glm-모델-설정)
9. [문제 해결](#-문제-해결)

## 🚀 빠른 시작

### 1. 설치
```bash
# 자동 설치 스크립트 실행
./install-opencode.sh
```

### 2. 실행
```bash
# TUI 모드 (터미널 UI)
opencode

# 서버 모드
opencode serve
```

## 🔧 설치

### 자동 설치 (권장)
```bash
# 설치 스크립트 실행
./install-opencode.sh

# 옵션 1: 사용자 설치 (권장)
# 옵션 2: 시스템 설치 (sudo 필요)
# 옵션 3: 현재 위치만 사용
```

### 전체 빌드 및 재설치
```bash
# Git pull → 빌드 → 설치 한 번에 실행
./rebuild-and-install.sh
```

### 수동 설치
```bash
# 1. 의존성 설치
bun install

# 2. 빌드
cd packages/opencode
bun run build

# 3. 설치
sudo cp dist/opencode-linux-$(uname -m | sed 's/x86_64/x64/')/bin/opencode /usr/local/bin/
# 또는
mkdir -p ~/.local/bin
cp dist/opencode-linux-$(uname -m | sed 's/x86_64/x64/')/bin/opencode ~/.local/bin/
```

## 💻 사용 방법

### TUI 모드 (터미널 UI)
```bash
# 현재 디렉토리에서 실행
opencode

# 특정 프로젝트 디렉토리에서 실행
opencode /path/to/project

# GLM 모델 사용
export GLM_API_KEY=your_api_key
opencode --model glm-4-plus
```

### 서버 모드
```bash
# 기본 포트(4096)로 서버 시작
opencode serve

# 특정 포트에서 서버 시작
opencode serve --port 8080

# 특정 호스트에서 서버 시작
opencode serve --hostname 0.0.0.0
```

## 📜 CLI 명령어

### 기본 명령어
```bash
# OpenCode TUI 시작
opencode

# 서버 모드 실행
opencode serve

# 도움말 보기
opencode --help
opencode --version
```

### 세션 관리
```bash
# 세션 목록 보기
opencode session list

# 세션 상태 보기
opencode session status

# 새 세션 시작
opencode run

# 특정 세션에 연결
opencode attach <session-id>
```

### 모델 관리
```bash
# 사용 가능한 모델 목록
opencode models

# 특정 프로바이더의 모델
opencode models openai
opencode models anthropic
```

### 인증 관리
```bash
# 인증 정보 관리
opencode auth

# 인증 상태 확인
opencode auth status
```

### 데이터 관리
```bash
# 세션 내보내기
opencode export

# 세션 가져오기
opencode import <file>

# 통계 보기
opencode stats
```

## 🌐 서버 API

OpenCode는 다양한 API 엔드포인트를 제공합니다.

### 헬스 체크
```bash
# 서버 상태 확인
curl http://localhost:4096/health

# 상세 정보
curl http://localhost:4096/health | jq .
```

### 세션 관리
```bash
# 세션 목록
curl http://localhost:4096/session

# 새 세션 생성
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "gpt-4",
    "model": "openai"
  }'
```

### 확장 API (mainServer 통합)
```bash
# 확장된 세션 생성
curl -X POST http://localhost:4096/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "gpt-4",
    "model": "openai",
    "projectId": "project-123",
    "agentRole": "frontend",
    "permissions": {
      "fileAccess": {
        "read": ["src/**/*", "public/**/*"],
        "write": ["src/**/*"]
      }
    }
  }'

# 프로젝트 생성
curl -X POST http://localhost:4096/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "path": "/workspace/my-project"
  }'
```

## 📜 스크립트

### 실행 스크립트
```bash
# OpenCode 시작 및 Watchdog 활성화
./start-opencode.sh

# 서버 시작/중지/재시작
./run-opencode.sh start
./run-opencode.sh stop
./run-opencode.sh restart

# 상태 확인
./run-opencode.sh status

# 로그 보기
./run-opencode.sh logs
```

### Watchdog (프로세스 감시)
```bash
# Watchdog 시작
./watchdog-opencode.sh

# 데몬 모드로 백그라운드 실행
./watchdog-opencode.sh daemon

# Watchdog 중지
kill $(cat /tmp/watchdog-opencode.pid)
```

## ⚙️ 환경 설정

### 환경 변수
```bash
# 서버 설정
export OPENCODE_SERVER_PORT=4096
export OPENCODE_SERVER_HOST=0.0.0.0

# 로그 레벨
export OPENCODE_LOG_LEVEL=info
export OPENCODE_DEBUG=true

# 기타
export OPENCODE_SHARE=auto
export OPENCODE_THEME=dark
```

### 설정 파일 위치
- Linux/macOS: `~/.config/opencode/config.json`
- Windows: `%APPDATA%\opencode\config.json`

### 설정 예시
```json
{
  "model": "gpt-4",
  "provider": "openai",
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0"
  },
  "share": "auto",
  "theme": "dark"
}
```

## 🤖 GLM 모델 설정

GLM(ChatGLM) 모델을 사용하려면 API 키가 필요합니다.

### 1. 환경 변수로 설정
```bash
export GLM_API_KEY=your_glm_api_key
export GLM_MODEL=glm-4-plus
export GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

### 2. 설정 파일로 설정
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

### 3. 확인
```bash
# 등록된 GLM 모델 확인
opencode models | grep glm

# GLM로 직접 실행
export GLM_API_KEY=your_key
opencode --model glm-4-plus
```

## 🔧 문제 해결

### 빌드 문제
```bash
# 캐시 정리
rm -rf node_modules dist
bun install
bun run build
```

### 권한 오류
```bash
# macOS (quarantine 해제)
sudo xattr -rd com.apple.quarantine dist/*/bin/opencode

# Linux (실행 권한)
chmod +x dist/*/bin/opencode
```

### 포트 충돌
```bash
# 다른 포트 사용
opencode serve --port 8080

# 사용 중인 포트 확인
lsof -i :4096
```

### 디버깅
```bash
# 디버그 모드
OPENCODE_LOG_LEVEL=debug opencode serve

# 상세 로그
opencode serve --debug
```

## 📚 추가 정보

- [API 통합 가이드](docs/OpenCode-API-Integration-Guide.md)
- [빌드 및 사용 가이드](docs/OpenCode-Build-and-Usage-Guide.md)
- [실행 가이드](README-EXECUTION.md)

## 🤝 기여

버그 리포트나 기능 요청은 GitHub Issues를 통해 제출해 주세요.

## 📄 라이선스

MIT License