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