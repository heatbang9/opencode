#!/bin/bash

# OpenCode 실행 스크립트
# 사용법: ./run-opencode.sh [포트]

set -e

# 기본값 설정
DEFAULT_PORT=4096
PORT=${1:-$DEFAULT_PORT}
LOG_DIR="$HOME/.local/share/opencode/logs"
PID_FILE="/tmp/opencode.pid"
LOG_FILE="$LOG_DIR/opencode-$(date +%Y%m%d).log"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# 프로세스 확인
check_process() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# 포트 확인
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 시작 함수
start() {
    if check_process; then
        warn "OpenCode가 이미 실행 중입니다 (PID: $(cat $PID_FILE))"
        return 1
    fi

    if check_port $PORT; then
        error "포트 $PORT가 이미 사용 중입니다"
        return 1
    fi

    log "OpenCode 시작 중 (포트: $PORT)..."

    # projects 폴더 생성 (없으면)
    PROJECTS_DIR="/home/ubuntu/project/opencode/projects"
    mkdir -p "$PROJECTS_DIR"

    # projects 폴더를 기본 workspace로 설정
    cd "$PROJECTS_DIR"

    # 백그라운드로 실행
    nohup bun --cwd /home/ubuntu/project/opencode/packages/opencode /home/ubuntu/project/opencode/packages/opencode/src/index.ts serve --port $PORT > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    # 시작 확인
    sleep 3
    if check_process; then
        log "OpenCode 성공적으로 시작됨 (PID: $(cat $PID_FILE))"
        log "접속 URL: http://localhost:$PORT"
        log "로그 파일: $LOG_FILE"

        # API 테스트
        sleep 2
        if curl -s http://localhost:$PORT/session > /dev/null 2>&1; then
            log "API 헬스체크 통과"
        else
            warn "API 헬스체크 실패 - 로그 확인 필요"
        fi
    else
        error "OpenCode 시작 실패"
        rm -f "$PID_FILE"
        return 1
    fi
}

# 중지 함수
stop() {
    if check_process; then
        PID=$(cat "$PID_FILE")
        log "OpenCode 중지 중 (PID: $PID)..."
        kill "$PID"

        # 강제 종료 대기
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done

        # 강제 종료
        if ps -p "$PID" > /dev/null 2>&1; then
            warn "강제 종료 중..."
            kill -9 "$PID"
        fi

        rm -f "$PID_FILE"
        log "OpenCode 중지 완료"
    else
        warn "실행 중인 OpenCode 프로세스가 없습니다"
    fi
}

# 상태 확인 함수
status() {
    if check_process; then
        PID=$(cat "$PID_FILE")
        log "OpenCode 실행 중 (PID: $PID, 포트: $PORT)"

        # 메모리 사용량
        if command -v ps > /dev/null; then
            MEM=$(ps -p "$PID" -o rss= | tr -d ' ')
            if [ -n "$MEM" ]; then
                MEM_MB=$((MEM / 1024))
                info "메모리 사용량: ${MEM_MB}MB"
            fi
        fi

        # 포트 상태
        if check_port $PORT; then
            log "포트 $PORT 활성화"
        else
            warn "포트 $PORT 비활성화"
        fi
    else
        log "OpenCode 실행 중이 아님"
    fi
}

# 재시작 함수
restart() {
    log "OpenCode 재시작 중..."
    stop
    sleep 2
    start
}

# 로그 보기 함수
logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        error "로그 파일이 없습니다: $LOG_FILE"
    fi
}

# 메인
case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        echo "사용법: $0 {start|stop|restart|status|logs} [포트]"
        echo "기본 포트: $DEFAULT_PORT"
        exit 1
        ;;
esac