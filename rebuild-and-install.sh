#!/bin/bash

# OpenCode 전체 빌드 및 재설치 스크립트
# Git pull → 빌드 → 설치까지 한 번에 실행

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 설정
BUILD_DIR="packages/opencode"
INSTALL_SCRIPT="./install-opencode.sh"

# 로그 함수
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] INFO:${NC} $1"
}

# 시작 메시지
echo -e "${PURPLE}================================${NC}"
echo -e "${PURPLE}  OpenCode 전체 빌드 및 재설치${NC}"
echo -e "${PURPLE}================================${NC}"
echo ""

# 0. 실행 중인 OpenCode 확인 및 종료
log "0. 실행 중인 OpenCode 확인..."
OPENCODE_RUNNING=false
if pgrep -f "opencode serve" > /dev/null 2>&1; then
    warn "실행 중인 OpenCode 서버 발견"
    OPENCODE_RUNNING=true

    # run-opencode.sh가 있으면 사용, 없으면 직접 종료
    if [ -f "./run-opencode.sh" ]; then
        info "run-opencode.sh로 정상 종료 시도..."
        ./run-opencode.sh stop || true
    else
        info "OpenCode 프로세스 직접 종료..."
        pkill -f "opencode serve" || true
    fi

    # 종료 대기 (최대 10초)
    for i in {1..10}; do
        if ! pgrep -f "opencode serve" > /dev/null 2>&1; then
            log "✅ OpenCode 정상 종료됨"
            break
        fi
        sleep 1
    done

    # 강제 종료
    if pgrep -f "opencode serve" > /dev/null 2>&1; then
        warn "강제 종료 중..."
        pkill -9 -f "opencode serve" || true
        sleep 2
    fi
else
    log "실행 중인 OpenCode 없음"
fi
echo ""

# 1. Git 최신화 (선택사항)
log "1. Git 저장소 최신화..."
if [ -n "$(git status --porcelain)" ]; then
    warn "작업 중인 변경사항이 있습니다:"
    git status --short
fi

read -p "Git pull을 실행하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Git pull 실행 중..."
    git pull origin local_addon || {
        warn "Git pull 실패. 계속 진행합니다..."
    }
else
    info "Git pull 건너뜀"
fi

# 2. 의존성 업데이트
log "2. 의존성 업데이트..."
info "Root 의존성 설치..."
bun install

info "packages/opencode 의존성 설치..."
cd "$BUILD_DIR"
bun install

# 3. 이전 빌드 정리
log "3. 이전 빌드 정리..."
if [ -d "dist" ]; then
    rm -rf dist
    info "기존 dist 디렉토리 정리 완료"
fi

# 4. Bun 버전 확인
log "4. Bun 버전 확인..."
BUN_VERSION=$(bun --version)
REQUIRED_VERSION="1.3.3"
if [ "$BUN_VERSION" != "$REQUIRED_VERSION" ]; then
    warn "Bun 버전: $BUN_VERSION (요구: $REQUIRED_VERSION)"
    warn "올바른 Bun 버전이 필요합니다. 설치/다운그레이드하시겠습니까?"
    read -p "설치하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Bun $REQUIRED_VERSION 설치 중..."
        npm install -g bun@$REQUIRED_VERSION
    else
        warn "Bun 버전을 수동으로 맞춰주세요"
        exit 1
    fi
fi

# 5. 빌드 실행
log "5. OpenCode 빌드 시작..."
echo -e "${BLUE}빌드 진행 중...${NC}"
if bun run build; then
    log "✅ 빌드 성공!"
else
    error "❌ 빌드 실패!"
    exit 1
fi

# 6. 빌드 결과 확인
log "6. 빌드 결과 확인..."
if [ ! -d "dist" ]; then
    error "dist 디렉토리가 생성되지 않았습니다"
    exit 1
fi

# 빌드된 파일 목록
info "빌드된 플랫폼:"
ls -1 dist/ | sed 's/^/  - /'

# 7. 설치 스크립트 실행
log "7. OpenCode CLI 설치..."
cd ../..
if [ -f "$INSTALL_SCRIPT" ]; then
    echo "1" | "$INSTALL_SCRIPT"
else
    error "설치 스크립트를 찾을 수 없습니다: $INSTALL_SCRIPT"
    exit 1
fi

# 8. 설치 확인
log "8. 설치 확인..."
if command -v opencode > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OpenCode CLI 설치 확인 성공!${NC}"
    echo -e "${BLUE}설치된 버전:${NC}"
    opencode --version
else
    warn "PATH에 opencode 명령어가 없습니다. 터미널을 새로 열거나 source ~/.bashrc를 실행하세요"
fi

# 9. 완료
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  빌드 및 설치 완료!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# 10. OpenCode 재시작 (이전에 실행 중이었으면)
if [ "$OPENCODE_RUNNING" = true ]; then
    echo ""
    log "10. OpenCode 자동 재시작..."

    if [ -f "./run-opencode.sh" ]; then
        info "run-opencode.sh로 재시작 중..."
        ./run-opencode.sh start 45000

        if [ $? -eq 0 ]; then
            log "✅ OpenCode 재시작 완료!"
            echo ""
            echo -e "${GREEN}🚀 OpenCode가 포트 45000에서 실행 중입니다${NC}"
            echo -e "${BLUE}📍 접속 URL:${NC} http://localhost:45000"
        else
            warn "재시작 실패. 수동으로 실행하세요: ./run-opencode.sh start 45000"
        fi
    else
        warn "run-opencode.sh를 찾을 수 없습니다. 수동으로 OpenCode를 시작하세요."
    fi
else
    echo -e "${BLUE}사용 방법:${NC}"
    echo "  opencode                    # TUI 모드 실행"
    echo "  opencode serve              # 서버 모드 실행"
    echo "  opencode --help             # 도움말"
    echo ""
    echo -e "${BLUE}실행 서버 시작:${NC}"
    echo "  ./start-opencode.sh         # 자동 실행 스크립트"
    echo "  ./run-opencode.sh start 45000  # 포트 45000으로 시작"
fi
echo ""