# OpenCode 개발 의뢰서

> **작성일**: 2024-12-12
> **검토자**: AI 코드 분석 에이전트
> **상태**: 신규 개발 의뢰

---

## 1. 프로젝트 현황 요약

### 1.1 현재 구현된 기능
- CLI/TUI 인터페이스
- 서버 모드 (Hono 기반 HTTP API)
- 기본 세션 관리
- Server-Sent Events (SSE) 이벤트 스트림
- 에이전트 타입: build, plan, general

### 1.2 미구현/개선 필요 기능
기존 문서(`OpenCode-통합-요구사항.md`, `OpenCode-API-Integration-Guide.md`)를 검토한 결과, mainServer와의 통합을 위해 다음 기능들의 구현이 필요합니다.

---

## 2. 개발 의뢰 사항

### 2.1 [우선순위: 높음] GLM API 통합 강화

#### 배경
OpenCode가 GLM(ChatGLM) API를 주요 LLM으로 사용하므로, 안정적인 통합이 필요합니다.

#### 의뢰 내용
```
1. GLM Provider 구현
   - packages/opencode/src/providers/glm.ts (신규)
   - GLM-4, GLM-4-Plus, GLM-4-Air 모델 지원
   - 스트리밍 응답 처리
   - 토큰 사용량 추적

2. GLM API 설정
   - 환경변수: GLM_API_KEY, GLM_MODEL, GLM_BASE_URL
   - 설정 파일 지원 (~/.config/opencode/config.json)
   - Rate Limiting 처리

3. 에러 핸들링
   - API 키 유효성 검사
   - 네트워크 에러 재시도
   - 토큰 한도 초과 처리
```

#### API 스펙
```typescript
// GLM API 요청 형식
interface GLMRequest {
  model: 'glm-4' | 'glm-4-plus' | 'glm-4-air';
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// GLM API 응답 형식
interface GLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

---

### 2.2 [우선순위: 높음] mainServer 통합 API 구현

#### 배경
`OpenCode-통합-요구사항.md`에 정의된 확장 API 구현이 필요합니다.

#### 의뢰 내용

##### 2.2.1 세션 관리 API 확장
```typescript
// 필요한 엔드포인트
POST   /api/sessions                    // 세션 생성 (확장)
GET    /api/sessions/:id/metadata       // 세션 메타데이터 조회
PUT    /api/sessions/:id/metadata       // 세션 메타데이터 업데이트
POST   /api/sessions/:id/ping           // 세션 활성 상태 확인
GET    /api/sessions/:id/status         // 상세 상태 정보
DELETE /api/sessions/:id/force          // 강제 세션 종료
GET    /api/sessions/project/:projectId // 프로젝트별 세션 목록

// 확장된 세션 인터페이스
interface EnhancedSession {
  id: string;
  agent: string;
  model: string;
  projectId?: string;        // mainServer 프로젝트 ID
  agentRole?: string;        // frontend, backend, database 등
  metadata?: object;
  permissions?: object;
  createdAt: Date;
  lastActivity: Date;
  status: 'idle' | 'busy' | 'error' | 'offline';
}
```

##### 2.2.2 프로젝트 워크스페이스 API
```typescript
// 필요한 엔드포인트
POST   /api/projects                    // 워크스페이스 생성
GET    /api/projects/:id                // 워크스페이스 조회
PUT    /api/projects/:id                // 워크스페이스 업데이트
DELETE /api/projects/:id                // 워크스페이스 삭제
POST   /api/projects/:id/sessions       // 세션 추가
GET    /api/projects/:id/sessions       // 세션 목록
POST   /api/projects/:id/files/share    // 파일 공유
POST   /api/projects/:id/files/sync     // 파일 동기화
```

#### 필요 파일
- `packages/opencode/src/server/routes/sessions-extended.ts` (신규)
- `packages/opencode/src/server/routes/projects.ts` (신규)
- `packages/opencode/src/server/services/projectManager.ts` (신규)

---

### 2.3 [우선순위: 중간] 에이전트 협업 기능

#### 배경
다중 에이전트가 협업할 때 필요한 통신 및 동기화 기능입니다.

#### 의뢰 내용

##### 2.3.1 에이전트 간 메시징
```typescript
// 메시지 전송 API
POST /api/agents/message
{
  from: string;           // 보내는 세션 ID
  to: string;             // 받는 세션 ID
  type: 'request' | 'response' | 'broadcast';
  channel: 'file' | 'task' | 'sync' | 'custom';
  payload: any;
  priority?: 'high' | 'normal' | 'low';
}

// 브로드캐스트
POST /api/agents/broadcast
{
  from: string;
  channel: string;
  payload: any;
  workspaceId?: string;
}

// 메시지 조회
GET /api/agents/:sessionId/messages
GET /api/agents/:sessionId/queue
```

##### 2.3.2 파일 잠금 관리
```typescript
// 파일 잠금 API
POST   /api/files/lock
{
  filePath: string;
  sessionId: string;
  lockType: 'read' | 'write';
  timeout?: number;       // ms, 기본 300000 (5분)
}

GET    /api/files/lock/status?filePath=...
DELETE /api/files/lock/:lockId
POST   /api/files/lock/force-release
```

#### 필요 파일
- `packages/opencode/src/server/routes/agents.ts` (신규)
- `packages/opencode/src/server/routes/files.ts` (신규)
- `packages/opencode/src/server/services/collaboration.ts` (신규)
- `packages/opencode/src/server/services/fileLockManager.ts` (신규)

---

### 2.4 [우선순위: 중간] 작업 추적 시스템

#### 배경
에이전트의 작업 진행상황을 추적하고 mainServer에 보고하는 기능입니다.

#### 의뢰 내용
```typescript
// 작업 관리 API
POST   /api/tasks
{
  sessionId: string;
  projectId?: string;
  type: 'command' | 'file_edit' | 'analysis' | 'generation';
  filePath?: string;
  description: string;
  priority?: 'high' | 'normal' | 'low';
}

POST   /api/tasks/:taskId/start
POST   /api/tasks/:taskId/progress
{
  progress: number;       // 0-100
  message: string;
  currentStep?: number;
  totalSteps?: number;
}
PUT    /api/tasks/:taskId
{
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
}

GET    /api/sessions/:id/tasks
GET    /api/sessions/:id/progress
GET    /api/projects/:id/progress
```

#### 필요 파일
- `packages/opencode/src/server/routes/tasks.ts` (신규)
- `packages/opencode/src/server/services/taskTracker.ts` (신규)

---

### 2.5 [우선순위: 중간] 이벤트 시스템 확장

#### 배경
mainServer가 실시간으로 상태를 받을 수 있도록 이벤트 시스템을 확장해야 합니다.

#### 의뢰 내용
```typescript
// 확장된 이벤트 타입
type EventType =
  | 'session:created'
  | 'session:status_changed'
  | 'session:message_received'
  | 'session:message_completed'
  | 'file:changed'
  | 'file:locked'
  | 'file:unlocked'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'agent:heartbeat'
  | 'agent:message_sent'
  | 'agent:broadcast'
  | 'sync:required'
  | 'sync:completed'
  | 'error:occurred';

// 필터링된 이벤트 스트림
GET /api/events/stream?
  sessionIds=session1,session2&
  projectId=project123&
  types=session,task,file&
  priorities=high,normal&
  since=2024-12-12T00:00:00Z
```

#### 필요 파일
- `packages/opencode/src/server/routes/events.ts` (확장)
- `packages/opencode/src/server/services/eventEmitter.ts` (확장)

---

### 2.6 [우선순위: 낮음] 보안 강화

#### 배경
프로덕션 환경에서의 보안을 위한 기능입니다.

#### 의뢰 내용
```typescript
// API 키 인증 (선택적)
// 헤더: X-OpenCode-API-Key

// 샌드박스 설정
interface SandboxConfig {
  enabled: boolean;
  type: 'chroot' | 'container';
  resourceLimits: {
    maxMemory: string;      // 예: "512MB"
    maxCPU: string;         // 예: "0.5"
    maxProcesses: number;
  };
  fileSystemRestrictions: {
    readOnly: string[];
    readWrite: string[];
    hidden: string[];
  };
}
```

---

## 3. 기술 요구사항

### 3.1 환경 변수 추가
```bash
# GLM API
GLM_API_KEY=your_glm_api_key
GLM_MODEL=glm-4
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# 서버 설정
OPENCODE_SERVER_HOST=0.0.0.0
OPENCODE_SERVER_PORT=4096
OPENCODE_MAX_SESSIONS=100
OPENCODE_SESSION_TIMEOUT=3600

# 프로젝트 설정
OPENCODE_WORKSPACE_ROOT=/tmp/opencode-workspaces
OPENCODE_MAX_PROJECTS=50
OPENCODE_PROJECT_ISOLATION=true

# 협업 설정
OPENCODE_FILE_LOCK_TIMEOUT=300000
OPENCODE_SYNC_INTERVAL=5000

# 보안 설정 (선택)
OPENCODE_API_KEY_REQUIRED=false
OPENCODE_ENABLE_SANDBOX=false
```

### 3.2 설정 파일 확장
```yaml
# config/opencode.yml
server:
  host: 0.0.0.0
  port: 4096
  maxSessions: 100
  cors: "*"

providers:
  glm:
    enabled: true
    apiKey: ${GLM_API_KEY}
    model: glm-4
    baseUrl: https://open.bigmodel.cn/api/paas/v4/
  openai:
    enabled: false
  anthropic:
    enabled: false

projects:
  workspaceRoot: /tmp/opencode-workspaces
  maxProjects: 50
  isolationLevel: process

collaboration:
  enableFileSync: true
  lockTimeout: 300000
  conflictResolution: manual

agents:
  roles:
    frontend:
      fileAccess: ["src/**/*", "public/**/*"]
      commands: ["npm", "yarn", "node"]
    backend:
      fileAccess: ["server/**/*", "api/**/*"]
      commands: ["npm", "node", "python"]
    database:
      fileAccess: ["database/**/*", "migrations/**/*"]
      commands: ["npm", "node"]
```

---

## 4. mainServer 연동 흐름

### 4.1 기본 연동 시나리오
```
1. mainServer가 opencode serve 프로세스 시작
   $ opencode serve --port 4100

2. mainServer가 프로젝트 워크스페이스 생성
   POST /api/projects
   { name: "MiniGame", path: "/workspace/minigame" }

3. mainServer가 에이전트 세션 생성
   POST /api/sessions
   { agent: "glm-4", projectId: "...", agentRole: "frontend" }

4. mainServer가 이벤트 스트림 구독
   GET /api/events/stream?projectId=...

5. mainServer가 메시지 전송
   POST /api/sessions/{id}/messages
   { content: "게임 UI 컴포넌트를 만들어주세요" }

6. OpenCode가 SSE로 진행상황 전송
   event: task:progress
   data: { taskId: "...", progress: 50, message: "컴포넌트 생성 중..." }

7. OpenCode가 완료 이벤트 전송
   event: task:completed
   data: { taskId: "...", result: { files: [...] } }
```

### 4.2 다중 에이전트 협업 시나리오
```
1. Frontend 에이전트가 Backend에 API 요청
   POST /api/agents/message
   { from: "frontend-session", to: "backend-session", ... }

2. 파일 수정 전 잠금 획득
   POST /api/files/lock
   { filePath: "src/config.json", sessionId: "...", lockType: "write" }

3. 파일 수정 완료 후 브로드캐스트
   POST /api/agents/broadcast
   { channel: "file", payload: { type: "FILE_CHANGED", ... } }

4. 잠금 해제
   DELETE /api/files/lock/{lockId}
```

---

## 5. 테스트 요구사항

### 5.1 단위 테스트
```
tests/
├── providers/
│   └── glm.test.ts           # GLM API 테스트
├── api/
│   ├── sessions.test.ts      # 세션 API 테스트
│   ├── projects.test.ts      # 프로젝트 API 테스트
│   ├── agents.test.ts        # 에이전트 메시징 테스트
│   ├── tasks.test.ts         # 작업 추적 테스트
│   └── files.test.ts         # 파일 잠금 테스트
└── services/
    ├── taskTracker.test.ts
    └── collaboration.test.ts
```

### 5.2 통합 테스트
```
tests/integration/
├── mainserver-integration.test.ts  # mainServer 연동 테스트
├── multi-agent.test.ts             # 다중 에이전트 협업
├── file-sync.test.ts               # 파일 동기화
└── event-stream.test.ts            # 이벤트 스트림
```

---

## 6. 구현 우선순위 요약

| 순위 | 기능 | 예상 작업량 | 의존성 |
|-----|------|----------|-------|
| 1 | GLM API 통합 강화 | 중 | 없음 |
| 2 | mainServer 통합 API | 대 | 없음 |
| 3 | 에이전트 협업 기능 | 중 | 2 |
| 4 | 작업 추적 시스템 | 중 | 2 |
| 5 | 이벤트 시스템 확장 | 소 | 2, 3, 4 |
| 6 | 보안 강화 | 소 | 2 |

---

## 7. 참고 문서

- `docs/OpenCode-통합-요구사항.md` - 통합 요구사항 상세
- `docs/OpenCode-API-Integration-Guide.md` - API 통합 가이드
- `docs/OpenCode-Build-and-Usage-Guide.md` - 빌드 및 사용법
- `docs/mainServer-OpenCode-통합-개발-검토-문서.md` - 통합 설계

---

## 8. 주의사항

1. **하위 호환성**: 기존 CLI/TUI 기능에 영향을 주지 않도록 구현
2. **API 버저닝**: 새 API는 `/api/v2/` 또는 기존 경로 확장으로 구현
3. **에러 처리**: 모든 API에 일관된 에러 응답 형식 사용
4. **문서화**: 새 API는 OpenAPI 스펙으로 문서화

---

**문서 끝**
