# GitHub local_addon 브랜치 Push 방법

## 현재 상태
- **브랜치**: `local_addon`
- **Remote**: `https://heatbang9@github.com/heatbang9/opencode.git`
- **커밋**: 4개 (dev 브랜치에서부터)

## Push 방법

### 방법 1: GitHub Personal Access Token 사용
1. GitHub에서 토큰 생성
   - GitHub 로그인 → Settings → Developer settings → Personal access tokens → Generate new token
   - `repo` 권한 체크

2. Terminal에서 push
```bash
git push -u origin local_addon
# Username: heatbang9
# Password: [여기에 생성한 토큰 붙여넣기]
```

### 방법 2: GitHub Desktop 사용
1. GitHub Desktop 설치
2. File → Add Local Repository → `/home/ubuntu/project/opencode`
3. 브랜치를 `local_addon`로 전환
4. Publish branch 버튼 클릭

### 방법 3: SSH 키 설정
```bash
# 1. SSH 키 생성
ssh-keygen -t ed25519 -C "heatbang9@gmail.com"

# 2. GitHub에 키 추가 (cat ~/.ssh/id_ed25519.pub 내용 복사)

# 3. SSH로 변경
git remote set-url origin git@github.com:heatbang9/opencode.git

# 4. Push
git push -u origin local_addon
```

### 방법 4: 웹에서 직접 파일 추가
1. GitHub에서 heatbang9/opencode 저장소 이동
2. `local_addon` 브랜치로 전환
3. Add file → 각 파일 복사 붙여넣기

## 필요한 파일 목록

### docs/
- `OpenCode-API-Integration-Guide.md`
- `OpenCode-Build-and-Usage-Guide.md`
- `OpenCode-통합-요구사항.md`
- `mainServer-OpenCode-통합-개발-검토-문서.md`

### packages/opencode/src/server/routes/
- `agents.ts`
- `api-events.ts`
- `enhanced-sessions.ts`
- `events.ts`
- `files.ts`
- `projects.ts`
- `tasks.ts`

### packages/opencode/src/server/services/
- `agent-message.ts`
- `enhanced-session.ts`
- `file-lock.ts`
- `project-workspace.ts`
- `task-tracking.ts`

### packages/opencode/src/types/
- `agent-message.ts`
- `enhanced-event.ts`
- `enhanced-session.ts`
- `file-lock.ts`
- `index.ts`
- `project-workspace.ts`
- `task-tracking.ts`

### 수정된 파일
- `packages/opencode/src/server/server.ts`

## 커밋 메시지
```
feat: mainServer와 OpenCode 통합 기능 구현

- 확장된 세션 관리 시스템
- 프로젝트 워크스페이스 관리
- 에이전트 간 통신 메시징
- 파일 잠금 관리
- 작업 상태 추적
- 확장된 이벤트 SSE 스트림
- API 가이드 및 빌드 문서
```

## 적용 후 작업
1. GitHub에서 Pull Request 생성
2. `dev` 브랜치로 Merge 요청
3. Review 후 Merge