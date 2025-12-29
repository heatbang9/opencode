#!/bin/bash

# OpenCode 자동 시작 스크립트
# 실행과 동시에 Watchdog를 백그라운드에서 시작

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}OpenCode 시작 및 Watchdog 활성화...${NC}"

# 포트 설정
PORT=${1:-45000}

# Projects 폴더 생성
PROJECTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/projects"
mkdir -p "$PROJECTS_DIR"
echo -e "${BLUE}📁 Projects 디렉토리: ${NC}$PROJECTS_DIR"

# 스크립트 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# OpenCode 실행
echo -e "${BLUE}1. OpenCode 실행 중...${NC}"
./run-opencode.sh $PORT

# 실행 확인
sleep 5

# Watchdog 시작
echo -e "${BLUE}2. Watchdog 시작 중...${NC}"
./watchdog-opencode.sh daemon $PORT

echo ""
echo -e "${GREEN}✅ 설정 완료!${NC}"
echo ""
echo -e "${YELLOW}📍 접속 URL:${NC} http://localhost:$PORT"
echo -e "${YELLOW}📝 OpenCode 로그:${NC} $HOME/.local/share/opencode/logs/opencode-$(date +%Y%m%d).log"
echo -e "${YELLOW}🐕 Watchdog 로그:${NC} $HOME/.local/share/opencode/logs/watchdog.log"
echo ""
echo -e "${BLUE}📋 명령어:${NC}"
echo "  - 상태 확인: ./run-opencode.sh status"
echo "  - 로그 보기: ./run-opencode.sh logs"
echo "  - 중지: ./run-opencode.sh stop"
echo "  - Watchdog 중지: kill \$(cat /tmp/watchdog-opencode.pid)"
echo ""