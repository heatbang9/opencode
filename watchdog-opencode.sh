#!/bin/bash

# OpenCode Watchdog 스크립트
# OpenCode 프로세스를 감시하고 문제 발생 시 자동으로 재시작

set -e

# 설정
CHECK_INTERVAL=30          # 체크 간격 (초)
MAX_RESTART_ATTEMPTS=5      # 최대 재시작 횟수
RESTART_COOLDOWN=60         # 재시작 쿨다운 (초)
LOG_DIR="$HOME/.local/share/opencode/logs"
WATCHDOG_LOG="$LOG_DIR/watchdog.log"
PID_FILE="/tmp/opencode.pid"
PORT=${1:-4096}

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] WATCHDOG:${NC} $1" | tee -a "$WATCHDOG_LOG"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] WATCHDOG ERROR:${NC} $1" | tee -a "$WATCHDOG_LOG"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WATCHDOG WARN:${NC} $1" | tee -a "$WATCHDOG_LOG"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] WATCHDOG INFO:${NC} $1" | tee -a "$WATCHDOG_LOG"
}

# 전역 변수
RESTART_COUNT=0
LAST_RESTART_TIME=0

# 프로세스 확인
is_process_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            # 응답성 체크
            if kill -0 "$PID" 2>/dev/null; then
                return 0
            fi
        else
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# API 응답 확인
check_api_health() {
    # API 헬스체크
    if curl -s --max-time 5 "http://localhost:$PORT/session" > /dev/null 2>&1; then
        return 0
    fi

    # /health 엔드포인트 시도
    if curl -s --max-time 5 "http://localhost:$PORT/health" > /dev/null 2>&1; then
        return 0
    fi

    return 1
}

# 재시작 가능 여부 확인
can_restart() {
    local current_time=$(date +%s)
    local time_since_restart=$((current_time - LAST_RESTART_TIME))

    if [ $RESTART_COUNT -ge $MAX_RESTART_ATTEMPTS ]; then
        error "최대 재시작 횟수 도달 ($MAX_RESTART_ATTEMPTS)"
        return 1
    fi

    if [ $time_since_restart -lt $RESTART_COOLDOWN ]; then
        warn "재시작 쿨다운: $((RESTART_COOLDOWN - time_since_restart))초 대기 중"
        return 1
    fi

    return 0
}

# OpenCode 재시작
restart_opencode() {
    if ! can_restart; then
        return 1
    fi

    RESTART_COUNT=$((RESTART_COUNT + 1))
    LAST_RESTART_TIME=$(date +%s)

    warn "OpenCode 재시작 시도 ($RESTART_COUNT/$MAX_RESTART_ATTEMPTS)"

    # 실행 스크립트로 재시작
    /home/ubuntu/project/opencode/run-opencode.sh stop > /dev/null 2>&1
    sleep 5

    if /home/ubuntu/project/opencode/run-opencode.sh start $PORT > /dev/null 2>&1; then
        log "OpenCode 성공적으로 재시작됨"
        RESTART_COUNT=0  # 성공 시 카운트 초기화
        return 0
    else
        error "OpenCode 재시작 실패"
        return 1
    fi
}

# 시그널 핸들러
cleanup() {
    log "Watchdog 종료 중..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# 메인 루프
main() {
    log "Watchdog 시작 (포트: $PORT, 체크 간격: ${CHECK_INTERVAL}초)"

    while true; do
        sleep $CHECK_INTERVAL

        # 프로세스 상태 확인
        if ! is_process_running; then
            error "OpenCode 프로세스 실행 중이 아님"
            restart_opencode
            continue
        fi

        # API 상태 확인
        if ! check_api_health; then
            warn "API 응답 없음"
            restart_opencode
            continue
        fi

        # 메모리 사용량 확인 (선택적)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if command -v ps > /dev/null; then
                MEM=$(ps -p "$PID" -o rss= 2>/dev/null | tr -d ' ')
                if [ -n "$MEM" ] && [ "$MEM" -gt 2097152 ]; then  # 2GB 초과
                    warn "메모리 사용량 높음: $((MEM / 1024))MB"
                fi
            fi
        fi

        # 정상 상태 로그 (1시간마다)
        if [ $(($(date +%s) % 3600)) -lt $CHECK_INTERVAL ]; then
            log "OpenCode 정상 실행 중 (PID: $PID)"
        fi
    done
}

# 시작 인자 확인
if [ "$1" = "daemon" ]; then
    # 데몬 모드로 실행
    nohup "$0" "$PORT" > "$WATCHDOG_LOG" 2>&1 &
    echo $! > "/tmp/watchdog-opencode.pid"
    log "Watchdog 데몬 시작 (PID: $!)"
else
    # 포트 인자 처리
    if [ $# -gt 0 ] && [ "$1" != "daemon" ]; then
        PORT=$1
    fi

    main
fi