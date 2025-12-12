# OpenCode 통합 요구사항 문서

> **작성일**: 2024-12-11
> **버전**: 1.0
> **프로젝트**: OpenCode - AI 코딩 에이전트 통합

## 1. 개요

본 문서는 mainServer와 통합하기 위해 OpenCode 프로젝트에 필요한 수정사항과 확장 기능을 정의합니다. OpenCode는 독립적으로 실행될 수 있지만, mainServer와의 통합을 위해 추가적인 기능과 API 확장이 필요합니다.

## 2. 현재 OpenCode 아키텍처 분석

### 2.1 기존 기능
- **CLI 모드**: 터미널에서 직접 실행
- **서버 모드**: HTTP API 서버로 실행 (Hono 프레임워크)
- **에이전트 타입**: build, plan, general
- **실시간 통신**: Server-Sent Events (SSE) 지원

### 2.2 서버 모드 API
```
GET  /global/event      - SSE 이벤트 스트림
POST /global/dispose    - 모든 인스턴스 정리
GET  /pty               - PTY 세션 목록
POST /pty               - 새 PTY 세션 생성
... (기타 PTY 관련 API)
```

## 3. mainServer 통합을 위한 확장 요구사항

### 3.1 세션 관리 API 확장

#### 3.1.1 다중 세션 지원
```typescript
// 현재 구조
interface Session {
  id: string;
  agent: string;
  model: string;
}

// 확장 필요 구조
interface EnhancedSession {
  id: string;
  agent: string;
  model: string;
  projectId?: string;        // mainServer 프로젝트 ID
  agentRole?: string;        // frontend, backend, database 등
  metadata?: object;         // 추가 메타데이터
  permissions?: object;      // 권한 설정
  createdAt: Date;
  lastActivity: Date;
}
```

#### 3.1.2 필요한 API 엔드포인트
```typescript
// 새로운 엔드포인트
POST   /api/sessions                    // 세션 생성 (확장)
GET    /api/sessions/:id/metadata       // 세션 메타데이터 조회
PUT    /api/sessions/:id/metadata       // 세션 메타데이터 업데이트
POST   /api/sessions/:id/ping           // 세션 활성 상태 확인
GET    /api/sessions/:id/status         // 상세 상태 정보
DELETE /api/sessions/:id/force          // 강제 세션 종료
```

### 3.2 프로젝트 관리 API

#### 3.2.1 프로젝트 워크스페이스 관리
```typescript
interface ProjectWorkspace {
  id: string;
  path: string;
  sessions: string[];      // 연결된 세션 ID 목록
  sharedFiles: string[];   // 공유 파일 목록
  isolationLevel: 'none' | 'process' | 'container';
  permissions: {
    read: string[];        // 읽기 권한 세션
    write: string[];       // 쓰기 권한 세션
    execute: string[];     // 실행 권한 세션
  };
}
```

#### 3.2.2 필요한 API
```typescript
// 프로젝트 관리
POST   /api/projects                    // 프로젝트 워크스페이스 생성
GET    /api/projects/:id                // 프로젝트 정보 조회
PUT    /api/projects/:id                // 프로젝트 설정 업데이트
DELETE /api/projects/:id                // 프로젝트 삭제
GET    /api/projects/:id/sessions       // 프로젝트 세션 목록

// 파일 공유
POST   /api/projects/:id/files/share    // 파일 공유
GET    /api/projects/:id/files/shared   // 공유 파일 목록
POST   /api/projects/:id/files/sync     // 파일 동기화
```

### 3.3 협업 기능 확장

#### 3.3.1 세션 간 통신
```typescript
// 세션 간 메시지 전달
POST   /api/sessions/:id/messages/send-to/:targetId
GET    /api/sessions/:id/messages/from/:sourceId

// 공유 상태 관리
GET    /api/sessions/:id/shared-state
PUT    /api/sessions/:id/shared-state
POST   /api/sessions/:id/shared-state/events
```

#### 3.3.2 파일 잠금 관리
```typescript
// 파일 잠금 API
POST   /api/files/lock                  // 파일 잠금
DELETE /api/files/lock/:lockId          // 잠금 해제
GET    /api/files/locks                 // 잠금 목록 조회
```

### 3.4 이벤트 시스템 확장

#### 3.4.1 세부 이벤트 타입
```typescript
// 기존 SSE 이벤트 확장
interface Event {
  type: 'session' | 'file' | 'task' | 'agent' | 'sync' | 'error';
  sessionId?: string;
  projectId?: string;
  data: any;
  timestamp: Date;
}

// 이벤트 타입 상세
type EventType =
  | 'session:created'
  | 'session:status_changed'
  | 'session:message_received'
  | 'session:message_completed'
  | 'file:changed'
  | 'file:locked'
  | 'file:unlocked'
  | 'task:started'
  | 'task:completed'
  | 'agent:heartbeat'
  | 'sync:required'
  | 'sync:completed'
  | 'error:occurred';
```

#### 3.4.2 이벤트 필터링
```typescript
// SSE 엔드포인트 확장
GET /api/events?session={sessionId}&project={projectId}&types={type1,type2}

// 이벤트 필터 옵션
interface EventFilter {
  sessionIds?: string[];
  projectId?: string;
  types?: EventType[];
  since?: Date;
  limit?: number;
}
```

### 3.5 상세 상태 추적

#### 3.5.1 작업 상태 모델
```typescript
interface Task {
  id: string;
  sessionId: string;
  type: 'command' | 'file_edit' | 'analysis' | 'generation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  command?: string;
  filePath?: string;
  progress: number;         // 0-100
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}
```

#### 3.5.2 상태 추적 API
```typescript
// 작업 관리
GET    /api/sessions/:id/tasks           // 작업 목록
POST   /api/sessions/:id/tasks           // 새 작업 생성
GET    /api/sessions/:id/tasks/:taskId   // 작업 상세
PUT    /api/sessions/:id/tasks/:taskId   // 작업 업데이트

// 진행상황 조회
GET    /api/sessions/:id/progress        // 전체 진행상황
GET    /api/projects/:id/progress        // 프로젝트 진행상황
```

## 4. 에이전트 확장 요구사항

### 4.1 에이전트 역할 기반 권한
```typescript
// 에이전트 역할 정의
interface AgentRole {
  name: string;
  permissions: {
    fileAccess: {
      read: string[];     // 읽기 가능한 경로 패턴
      write: string[];    // 쓰기 가능한 경로 패턴
      execute: string[];  // 실행 가능한 파일 패턴
    };
    commands: string[];   // 실행 가능한 명령어
    apiAccess: string[];  // 접근 가능한 API
    networkAccess: boolean;
  };
}

// 미리 정의된 역할
const AgentRoles = {
  FRONTEND: {
    fileAccess: {
      read: ['src/**/*', 'public/**/*'],
      write: ['src/**/*', 'public/**/*'],
      execute: ['npm', 'yarn', 'node']
    },
    commands: ['npm run dev', 'npm run build'],
    apiAccess: ['file', 'terminal'],
    networkAccess: true
  },
  BACKEND: {
    fileAccess: {
      read: ['server/**/*', 'api/**/*'],
      write: ['server/**/*', 'api/**/*'],
      execute: ['npm', 'node', 'python', 'java']
    },
    commands: ['npm start', 'python manage.py'],
    apiAccess: ['file', 'terminal', 'database'],
    networkAccess: true
  }
};
```

### 4.2 에이전트 커뮤니케이션
```typescript
// 에이전트 간 메시징 시스템
interface AgentMessage {
  from: string;           // 보내는 세션 ID
  to: string;             // 받는 세션 ID
  type: 'request' | 'response' | 'broadcast';
  channel: 'file' | 'task' | 'sync' | 'custom';
  payload: any;
  timestamp: Date;
}

// 에이전트 메시징 API
POST   /api/agents/message               // 메시지 전송
GET    /api/agents/:id/messages          // 메시지 목록
POST   /api/agents/broadcast             // 브로드캐스트
```

### 4.3 에이전트 모니터링 확장
```typescript
// 상세한 상태 정보
interface AgentStatus {
  sessionId: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: Task;
  resourceUsage: {
    memory: number;
    cpu: number;
    diskIO: number;
    networkIO: number;
  };
  performance: {
    tasksCompleted: number;
    averageTaskTime: number;
    errorRate: number;
  };
  lastHeartbeat: Date;
}
```

## 5. 보안 강화 요구사항

### 5.1 세션 격리
```typescript
// 샌드박스 설정
interface SandboxConfig {
  enabled: boolean;
  type: 'chroot' | 'container' | 'vm';
  resourceLimits: {
    maxMemory: string;      // 예: "512MB"
    maxCPU: string;         // 예: "0.5"
    maxProcesses: number;
  };
  networkRestrictions: {
    allowedHosts: string[];
    blockedPorts: number[];
  };
  fileSystemRestrictions: {
    readOnly: string[];
    readWrite: string[];
    hidden: string[];
  };
}
```

### 5.2 API 보안
```typescript
// API 키 관리
interface APIKey {
  id: string;
  name: string;
  key: string;             // 해시된 값
  permissions: string[];
  rateLimit: {
    requests: number;
    window: string;         // 예: "1m", "1h"
  };
  expiresAt?: Date;
}

// 인증 미들웨어 확장
app.use('/api/*', authMiddleware({
  apiKeyHeader: 'X-OpenCode-API-Key',
  sessionCookie: 'opencode-session',
  csrfProtection: true
}));
```

## 6. 구현 방안

### 6.1 서버 코드 수정 위치

#### 6.1.1 기존 파일 수정
```
packages/opencode/src/
├── server/
│   ├── server.ts                    # 메인 서버 파일
│   ├── routes/
│   │   ├── sessions.ts              # 세션 관리 라우트
│   │   └── global.ts                # 전역 라우트
│   └── middleware/
│       └── auth.ts                  # 인증 미들웨어
├── agent/
│   ├── session.ts                   # 세션 관리
│   └── executor.ts                  # 명령 실행기
└── types/
    └── index.ts                     # 타입 정의
```

#### 6.1.2 새로운 파일 추가
```
packages/opencode/src/
├── server/
│   ├── routes/
│   │   ├── projects.ts              # 프로젝트 관리 (신규)
│   │   ├── agents.ts                # 에이전트 통신 (신규)
│   │   ├── tasks.ts                 # 작업 관리 (신규)
│   │   └── events.ts                # 이벤트 API (신규)
│   ├── services/
│   │   ├── projectManager.ts        # 프로젝트 관리 서비스 (신규)
│   │   ├── taskTracker.ts           # 작업 추적 서비스 (신규)
│   │   ├── collaboration.ts         # 협업 서비스 (신규)
│   │   └── sandbox.ts               # 샌드박스 서비스 (신규)
│   └── models/
│       ├── Project.ts               # 프로젝트 모델 (신규)
│       ├── Task.ts                  # 작업 모델 (신규)
│       └── AgentMessage.ts          # 메시지 모델 (신규)
```

### 6.2 클라이언트 API 확장

#### 6.2.1 JavaScript SDK
```typescript
// packages/sdk/src/client.ts 확장
export class OpenCodeClient {
  // 기존 기능...

  // 새로운 기능
  async createProject(config: ProjectConfig): Promise<Project>
  async createSession(projectId: string, agentType: string, role?: string): Promise<Session>
  async shareFile(projectId: string, filePath: string): Promise<void>
  async sendAgentMessage(fromId: string, toId: string, message: any): Promise<void>
  async getProjectProgress(projectId: string): Promise<Progress>
  async subscribeToEvents(filter: EventFilter): Promise<EventStream>
}
```

### 6.3 설정 확장

#### 6.3.1 환경 변수
```bash
# 서버 설정
OPENCODE_SERVER_HOST=0.0.0.0
OPENCODE_SERVER_PORT=4096
OPENCODE_MAX_SESSIONS=100
OPENCODE_SESSION_TIMEOUT=3600

# 보안 설정
OPENCODE_ENABLE_SANDBOX=true
OPENCODE_SANDBOX_TYPE=chroot
OPENCODE_API_KEY_REQUIRED=false
OPENCODE_CORS_ORIGIN=*

# 프로젝트 설정
OPENCODE_WORKSPACE_ROOT=/tmp/opencode-workspaces
OPENCODE_MAX_PROJECTS=50
OPENCODE_PROJECT_ISOLATION=true

# 모니터링
OPENCODE_ENABLE_METRICS=true
OPENCODE_METRICS_PORT=9090
OPENCODE_LOG_LEVEL=info
```

#### 6.3.2 설정 파일
```yaml
# config/opencode.yml
server:
  host: 0.0.0.0
  port: 4096
  maxSessions: 100

security:
  enableSandbox: true
  sandboxType: chroot
  apiKeys:
    enabled: false

projects:
  workspaceRoot: /tmp/opencode-workspaces
  maxProjects: 50
  isolationLevel: process

agents:
  defaultRoles:
    frontend: "Frontend Developer"
    backend: "Backend Developer"
    database: "Database Specialist"

collaboration:
  enableFileSync: true
  lockTimeout: 300000  -- 5분
  conflictResolution: manual
```

## 7. 테스트 요구사항

### 7.1 API 테스트
```typescript
// tests/api/
├── sessions.test.ts
├── projects.test.ts
├── agents.test.ts
├── tasks.test.ts
└── events.test.ts
```

### 7.2 통합 테스트
```typescript
// tests/integration/
├── multi-agent-collaboration.test.ts
├── file-sync-conflict.test.ts
├── project-isolation.test.ts
└── performance.test.ts
```

### 7.3 부하 테스트
```typescript
// tests/load/
├── concurrent-sessions.test.ts
├── message-throughput.test.ts
└── resource-usage.test.ts
```

## 8. 배포 고려사항

### 8.1 Docker 지원
```dockerfile
# Dockerfile 확장
FROM node:18-alpine
RUN addgroup -g 1001 -S opencode
RUN adduser -S opencode -u 1001
WORKDIR /app
COPY --chown=opencode:opencode . .
RUN npm ci --only=production
USER opencode
EXPOSE 4096
CMD ["npm", "run", "serve"]
```

### 8.2 헬스체크
```typescript
// 헬스체크 엔드포인트 확장
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    sessions: sessionManager.count(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

## 9. 문서화 요구사항

### 9.1 API 문서
- OpenAPI 3.1.1 스펙 자동 생성
- 모든 새 엔드포인트 문서화
- 예제 코드 포함

### 9.2 개발자 가이드
- 다중 세션 사용법
- 프로젝트 설정 방법
- 협업 기능 사용법
- 보안 설정 가이드

## 10. 마이그레이션 가이드

### 10.1 기존 버전 호환성
- 기존 API는 그대로 유지
- 새 기능은 옵션으로 제공
- 점진적 업그레이드 지원

### 10.2 데이터 마이그레이션
```typescript
// 기존 세션 데이터 마이그레이션
async function migrateSessions() {
  const sessions = await loadLegacySessions();
  for (const session of sessions) {
    const enhancedSession = {
      ...session,
      metadata: {},
      permissions: getDefaultPermissions(session.agent),
      createdAt: new Date(),
      lastActivity: new Date()
    };
    await saveEnhancedSession(enhancedSession);
  }
}
```

## 11. 구현 우선순위

### Phase 1: 핵심 API 확장 (1주)
1. 세션 관리 API 확장
2. 프로젝트 워크스페이스 API
3. 기본 이벤트 시스템 확장

### Phase 2: 협업 기능 (1주)
1. 파일 공유 및 동기화
2. 에이전트 간 통신
3. 파일 잠금 관리

### Phase 3: 고급 기능 (2주)
1. 샌드박스 격리
2. 상세 모니터링
3. 성능 최적화

### Phase 4: 안정화 (1주)
1. 전체 테스트
2. 문서 완성
3. 버그 수정

## 12. 결론

본 문서는 OpenCode가 mainServer와 효과적으로 통합되기 위해 필요한 확장 기능을 정의합니다. 핵심 목표는 **다중 세션 관리**, **프로젝트 격리**, **실시간 협업**, 그리고 **보안 강화**입니다.

주요 구현 포인트:
1. **세션 관리 확장**: 프로젝트별 세션 그룹화
2. **협업 API**: 파일 공유, 메시징, 잠금 관리
3. **이벤트 시스템**: 상세한 상태 추적 및 알림
4. **보안**: 샌드박스 격리 및 권한 관리

이러한 확장을 통해 OpenCode는 단독 실행뿐만 아니라, 여러 에이전트가 협력하는 복잡한 시나리오에서도 안정적으로 동작할 수 있게 됩니다.