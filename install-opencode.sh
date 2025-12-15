#!/bin/bash

# OpenCode CLI 설치 스크립트
# 빌드된 바이너리를 시스템에 설치

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 설치 경로
INSTALL_DIR="$HOME/.local/bin"
SYSTEM_DIR="/usr/local/bin"

# 아키텍처 확인
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

# 아키텍처 매핑
case $ARCH in
    x86_64)
        ARCH="x64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo -e "${RED}지원하지 않는 아키텍처: $ARCH${NC}"
        exit 1
        ;;
esac

# 빌드된 바이너리 경로 (스크립트 위치 기준)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY_DIR="$SCRIPT_DIR/packages/opencode/dist/opencode-$OS-$ARCH"
BINARY_PATH="$BINARY_DIR/bin/opencode"

# 설치 함수
install() {
    local target_dir=$1
    local use_sudo=$2

    echo -e "${BLUE}OpenCode CLI 설치 중...${NC}"
    echo -e "${YELLOW}아키텍처: $OS-$ARCH${NC}"

    # 빌드 확인
    if [ ! -f "$BINARY_PATH" ]; then
        echo -e "${RED}오류: 빌드된 바이너리가 없습니다!${NC}"
        echo -e "${YELLOW}먼저 빌드를 실행하세요:${NC}"
        echo "  bun run build"
        exit 1
    fi

    # 바이너리 테스트
    echo -e "${BLUE}바이너리 테스트 중...${NC}"
    if ! "$BINARY_PATH" --version > /dev/null 2>&1; then
        echo -e "${RED}오류: 바이너리 실행 실패${NC}"
        exit 1
    fi

    # 설치 디렉토리 생성
    if [ "$use_sudo" = true ]; then
        sudo mkdir -p "$target_dir"
    else
        mkdir -p "$target_dir"
    fi

    # 복사
    if [ "$use_sudo" = true ]; then
        sudo cp "$BINARY_PATH" "$target_dir/"
        sudo chmod +x "$target_dir/opencode"
    else
        cp "$BINARY_PATH" "$target_dir/"
        chmod +x "$target_dir/opencode"
    fi

    echo -e "${GREEN}✅ 설치 완료!${NC}"
    echo -e "${YELLOW}설치 위치: $target_dir/opencode${NC}"

    # PATH 확인
    if ! echo $PATH | grep -q "$target_dir"; then
        echo -e "${RED}⚠️  경고: $target_dir 이 PATH에 없습니다.${NC}"
        echo -e "${YELLOW}다음을 ~/.bashrc 또는 ~/.zshrc에 추가하세요:${NC}"
        echo "  export PATH=\"$target_dir:\$PATH\""

        # 자동으로 .bashrc에 추가
        if [ -f "$HOME/.bashrc" ]; then
            echo "export PATH=\"$target_dir:\$PATH\"" >> "$HOME/.bashrc"
            echo -e "${GREEN}.bashrc에 PATH를 추가했습니다. source ~/.bashrc를 실행하세요.${NC}"
        fi
    fi
}

# 설치 옵션 메뉴
echo -e "${GREEN}OpenCode CLI 설치 프로그램${NC}"
echo ""
echo "설치 옵션:"
echo "1) 사용자 설치 ($HOME/.local/bin) - 권장"
echo "2) 시스템 설치 (/usr/local/bin) - sudo 필요"
echo "3) 현재 위치만 사용 (설치 안 함)"
echo ""

read -p "선택 (1-3): " choice

case $choice in
    1)
        install "$INSTALL_DIR" false
        ;;
    2)
        echo -e "${YELLOW}sudo 권한이 필요합니다...${NC}"
        install "$SYSTEM_DIR" true
        ;;
    3)
        echo -e "${BLUE}현재 위치에서 사용합니다.${NC}"
        echo -e "${YELLOW}실행 방법: ./$BINARY_PATH${NC}"
        ;;
    *)
        echo -e "${RED}잘못된 선택${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}설치 후 사용법:${NC}"
echo "  opencode --help"
echo "  opencode session list"
echo "  opencode"
echo ""

# 테스트
if command -v opencode > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 설치 확인: opencode 명령어 사용 가능${NC}"
    echo -e "${BLUE}버전 정보:${NC}"
    opencode --version
else
    echo -e "${YELLOW}⚠️  터미널을 새로 열거나 source ~/.bashrc를 실행해야 합니다.${NC}"
fi