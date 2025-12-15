# OpenCode 실행 가이드

## 스크립트 개요

OpenCode를 쉽게 실행하고 관리하기 위한 스크립트들이 준비되어 있습니다.

### 1. run-opencode.sh
OpenCode를 시작/중지/재시작하는 메인 스크립트

### 2. watchdog-opencode.sh
OpenCode 프로세스를 감시하고 문제 시 자동 재시작

## 사용 방법

### 기본 실행
```bash
# 기본 포트(4096)로 실행
./run-opencode.sh

# 특정 포트로 실행
./run-opencode.sh 8080

# 중지
./run-opencode.sh stop

# 재시작
./run-opencode.sh restart

# 상태 확인
./run-opencode.sh status

# 실시간 로그 보기
./run-opencode.sh logs
```

### Watchdog 실행
```bash
# Watchdog 시작 (기본 포트 4096)
./watchdog-opencode.sh

# 특정 포트로 Watchdog 시작
./watchdog-opencode.sh 8080

# 데몬 모드로 백그라운드 실행
./watchdog-opencode.sh daemon

# Watchdog 중지
kill $(cat /tmp/watchdog-opencode.pid)
```

## 자동화 실행 스크립트

### start-opencode.sh (실행 후 Watchdog 시작)
```bash
#!/bin/bash
echo "OpenCode 시작 및 Watchdog 활성화..."

# OpenCode 실행
./run-opencode.sh $1

# 잠시 대기
sleep 5

# Watchdog 시작
./watchdog-opencode.sh daemon $1

echo "OpenCode와 Watchdog가 실행되었습니다."
echo "접속 URL: http://localhost:${1:-4096}"
echo "Watchdog 로그: $HOME/.local/share/opencode/logs/watchdog.log"
```

## 로그 위치

- OpenCode 로그: `~/.local/share/opencode/logs/opencode-YYYYMMDD.log`
- Watchdog 로그: `~/.local/share/opencode/logs/watchdog.log`

## 중지 방법

```bash
# OpenCode만 중지
./run-opencode.sh stop

# Watchdog도 중지하려면
kill $(cat /tmp/watchdog-opencode.pid)
./run-opencode.sh stop
```

## CLI 설치

### 자동 설치
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

## 주요 기능

### run-opencode.sh
- ✅ 포트 충돌 확인
- ✅ 프로세스 중복 실행 방지
- ✅ API 헬스체크
- ✅ 실시간 로깅
- ✅ 메모리 사용량 모니터링

### watchdog-opencode.sh
- ✅ 30초마다 프로세스 상태 확인
- ✅ API 응답성 테스트
- ✅ 자동 재시작 (최대 5회)
- ✅ 메모리 사용량 경고
- ✅ 재시작 쿨다운 (60초)

### rebuild-and-install.sh
- ✅ Git 최신화
- ✅ 의존성 업데이트
- ✅ 이전 빌드 정리
- ✅ Bun 버전 확인
- ✅ 전체 빌드 실행
- ✅ CLI 자동 설치

## OpenCode CLI 명령어

### 기본 사용
```bash
# TUI 모드 시작 (터미널 UI)
opencode

# 특정 프로젝트에서 실행
opencode /path/to/project

# 서버 모드
opencode serve
opencode serve --port 8080

# 세션 관리
opencode session list
opencode session create

# 모델 목록
opencode models

# GLM 모델 사용
export GLM_API_KEY=your_api_key
opencode --model glm-4-plus
```

### 고급 기능
```bash
# ACP 서버 시작
opencode acp

# 원격 서버 연결
opencode attach ws://localhost:4096

# 데이터 관리
opencode export session-123
opencode import session-backup.json

# 통계 보기
opencode stats
```