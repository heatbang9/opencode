# OpenCode API 통합 가이드

> **버전**: 1.0
> **업데이트**: 2024-12-12

## 개요

OpenCode API를 통해 여러 AI 코딩 에이전트를 생성하고 관리하며, 실시간으로 상호작용할 수 있습니다. 이 가이드는 mainServer와 OpenCode를 통합하는 데 필요한 모든 API와 사용법을 상세히 설명합니다.

## 기본 정보

- **서버 주소**: `http://localhost:4096` (기본값)
- **API 베이스 URL**: `/api`
- **인증**: 현재 버전에서는 인증이 필요 없습니다 (향후 추가 예정)

## 1. 확장된 세션 관리 API

세션을 생성하고 관리하여 여러 에이전트를 동시에 운영할 수 있습니다.

### 1.1 세션 생성

```http
POST /api/sessions
Content-Type: application/json

{
  "agent": "gpt-4",
  "model": "openai",
  "projectId": "project-123",
  "agentRole": "frontend",
  "permissions": {
    "fileAccess": {
      "read": ["src/**/*", "public/**/*"],
      "write": ["src/**/*", "public/**/*"],
      "execute": ["npm", "yarn", "node"]
    },
    "commands": ["npm run dev", "npm run build"],
    "apiAccess": ["file", "terminal"],
    "networkAccess": true
  },
  "title": "Frontend Development Agent"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": "session-abc123",
    "projectID": "project-456",
    "projectId": "project-123",
    "agentRole": "frontend",
    "status": "idle",
    "createdAt": "2024-12-12T10:00:00.000Z",
    "lastActivity": "2024-12-12T10:00:00.000Z"
  }
}
```

### 1.2 세션 메타데이터 업데이트

```http
PUT /api/sessions/{sessionId}/metadata
Content-Type: application/json

{
  "agentRole": "backend",
  "metadata": {
    "specialization": "API development"
  }
}
```

### 1.3 세션 상태 확인

```http
GET /api/sessions/{sessionId}/status
```

**응답**:
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-abc123",
      "status": "busy",
      "agentRole": "frontend"
    },
    "status": {
      "sessionId": "session-abc123",
      "status": "busy",
      "currentTask": "Building UI components",
      "lastHeartbeat": "2024-12-12T10:30:00.000Z"
    }
  }
}
```

### 1.4 프로젝트별 세션 목록

```http
GET /api/sessions/project/{projectId}?status=active
```

### 1.5 세션 강제 종료

```http
DELETE /api/sessions/{sessionId}/force
Content-Type: application/json

{
  "reason": "Task completed"
}
```

## 2. 프로젝트 워크스페이스 API

프로젝트별로 작업 공간을 생성하고 여러 세션을 관리합니다.

### 2.1 워크스페이스 생성

```http
POST /api/projects
Content-Type: application/json

{
  "name": "Mini Game Project",
  "path": "/workspace/mini-game",
  "description": "Web-based mini game development",
  "isolationLevel": "process"
}
```

### 2.2 세션 추가

```http
POST /api/projects/{workspaceId}/sessions
Content-Type: application/json

{
  "sessionId": "session-abc123",
  "permissions": {
    "read": ["**/*"],
    "write": ["src/**/*"]
  }
}
```

### 2.3 파일 공유

```http
POST /api/projects/{workspaceId}/files/share
Content-Type: application/json

{
  "filePath": "/workspace/mini-game/src/game.js",
  "permissions": "read-write"
}
```

### 2.4 파일 동기화

```http
POST /api/projects/{workspaceId}/files/sync
Content-Type: application/json

{
  "filePath": "src/components/GameUI.jsx",
  "sessionId": "session-def456",
  "operation": "push",
  "content": "// Updated component code"
}
```

## 3. 에이전트 통신 API

에이전트 간 메시지를 주고받으며 협업합니다.

### 3.1 메시지 전송

```http
POST /api/agents/message
Content-Type: application/json

{
  "from": "session-abc123",
  "to": "session-def456",
  "type": "request",
  "channel": "task",
  "payload": {
    "type": "TASK_REQUEST",
    "taskType": "component_creation",
    "parameters": {
      "componentName": "GameBoard",
      "props": ["size", "theme"]
    }
  },
  "priority": "high"
}
```

### 3.2 브로드캐스트 메시지

```http
POST /api/agents/broadcast
Content-Type: application/json

{
  "from": "session-abc123",
  "channel": "file",
  "payload": {
    "type": "FILE_CHANGED",
    "filePath": "src/game.css",
    "changeType": "modified"
  },
  "workspaceId": "workspace-789"
}
```

### 3.3 메시지 목록 조회

```http
GET /api/agents/messages?from=session-abc123&since=2024-12-12T00:00:00Z
```

### 3.4 세션별 메시지 큐

```http
GET /api/agents/{sessionId}/queue
```

## 4. 작업 추적 API

에이전트의 작업을 생성하고 진행상황을 추적합니다.

### 4.1 작업 생성

```http
POST /api/tasks
Content-Type: application/json

{
  "sessionId": "session-abc123",
  "projectId": "project-123",
  "type": "file_create",
  "filePath": "src/components/GameBoard.jsx",
  "description": "Create game board component",
  "priority": "high",
  "estimatedDuration": 300000
}
```

### 4.2 작업 시작

```http
POST /api/tasks/{taskId}/start
```

### 4.3 진행상황 업데이트

```http
POST /api/tasks/{taskId}/progress
Content-Type: application/json

{
  "progress": 45,
  "message": "Creating component structure",
  "currentStep": 2,
  "totalSteps": 5
}
```

### 4.4 작업 완료

```http
PUT /api/tasks/{taskId}
Content-Type: application/json

{
  "status": "completed",
  "result": {
    "componentCreated": true,
    "filePath": "src/components/GameBoard.jsx"
  }
}
```

## 5. 파일 잠금 API

동시 파일 접근을 제어하여 충돌을 방지합니다.

### 5.1 파일 잠금

```http
POST /api/files/lock
Content-Type: application/json

{
  "filePath": "src/config/game.json",
  "sessionId": "session-abc123",
  "lockType": "write",
  "reason": "Updating game configuration",
  "timeout": 300000
}
```

### 5.2 잠금 상태 확인

```http
GET /api/files/lock/status?filePath=src/config/game.json
```

**응답**:
```json
{
  "success": true,
  "data": {
    "locked": true,
    "filePath": "src/config/game.json",
    "lock": {
      "id": "lock-xyz789",
      "sessionId": "session-abc123",
      "lockType": "write",
      "createdAt": "2024-12-12T10:00:00.000Z",
      "expiresAt": "2024-12-12T10:05:00.000Z"
    }
  }
}
```

### 5.3 잠금 해제

```http
DELETE /api/files/lock/{lockId}
Content-Type: application/json

{
  "sessionId": "session-abc123"
}
```

### 5.4 강제 잠금 해제

```http
POST /api/files/lock/force-release
Content-Type: application/json

{
  "filePath": "src/config/game.json",
  "reason": "Emergency release - owner session crashed"
}
```

## 6. 실시간 이벤트 스트림

Server-Sent Events (SSE)를 통해 실시간으로 이벤트를 수신합니다.

### 6.1 기본 이벤트 구독

```javascript
const eventSource = new EventSource('http://localhost:4096/event');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
```

### 6.2 필터링된 이벤트 구독

```javascript
const params = new URLSearchParams({
  session: 'session-abc123',
  types: 'session,task,file',
  since: '2024-12-12T00:00:00Z'
});

const eventSource = new EventSource(`http://localhost:4096/event?${params}`);
```

### 6.3 확장된 이벤트 스트림

```javascript
const params = new URLSearchParams({
  types: 'session,task',
  sessionIds: 'session-abc123,session-def456',
  priorities: 'high,normal',
  heartbeat: 'true'
});

const eventSource = new EventSource(`http://localhost:4096/api/events/stream?${params}`);
```

### 6.4 이벤트 타입

| 타입 | 서브타입 | 설명 |
|-----|---------|------|
| session | created | 세션 생성 |
| session | status_changed | 세션 상태 변경 |
| session | message_completed | 메시지 처리 완료 |
| task | started | 작업 시작 |
| task | progress | 작업 진행 |
| task | completed | 작업 완료 |
| file | locked | 파일 잠금 |
| file | unlocked | 잠금 해제 |
| file | changed | 파일 변경 |
| agent | message_sent | 메시지 전송 |
| agent | broadcast | 브로드캐스트 |

## 7. 에이전트 역할 사전 정의

미리 정의된 에이전트 역할을 사용하여 빠르게 세션을 생성할 수 있습니다.

| 역할 | 설명 | 권한 |
|-----|------|------|
| frontend | 프론트엔드 개발 전문가 | src/**/*, public/**/* 접근 |
| backend | 백엔드 개발 전문가 | server/**/*, api/**/* 접근 |
| database | 데이터베이스 전문가 | database/**/* 접근 |
| fullstack | 풀스택 개발 전문가 | 모든 파일 접근 |

## 8. 사용 예시

### 8.1 미니게임 프로젝트 설정

```javascript
// 1. 워크스페이스 생성
const workspace = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Mini Game',
    path: '/workspace/minigame'
  })
}).then(r => r.json());

// 2. Frontend 에이전트 생성
const frontendSession = await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: 'gpt-4',
    model: 'openai',
    agentRole: 'frontend',
    projectId: workspace.data.id
  })
}).then(r => r.json());

// 3. Backend 에이전트 생성
const backendSession = await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: 'gpt-4',
    model: 'openai',
    agentRole: 'backend',
    projectId: workspace.data.id
  })
}).then(r => r.json());

// 4. 에이전트들 워크스페이스에 추가
await fetch(`/api/projects/${workspace.data.id}/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: frontendSession.data.id })
});

await fetch(`/api/projects/${workspace.data.id}/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: backendSession.data.id })
});
```

### 8.2 실시간 모니터링

```javascript
// 이벤트 스트림 연결
const eventSource = new EventSource('/api/events/stream');

// 이벤트 처리
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch(data.type) {
    case 'task':
      handleTaskEvent(data);
      break;
    case 'session':
      handleSessionEvent(data);
      break;
    case 'file':
      handleFileEvent(data);
      break;
  }
};

// 작업 진행상황 UI 업데이트
function handleTaskEvent(event) {
  if (event.subType === 'progress') {
    updateProgressBar(event.data.taskId, event.data.progress);
  } else if (event.subType === 'completed') {
    markTaskComplete(event.data.taskId);
  }
}
```

### 8.3 에이전트 협업

```javascript
// Frontend 에이전트가 Backend에 API 요청
await fetch('/api/agents/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: frontendSession.data.id,
    to: backendSession.data.id,
    type: 'request',
    channel: 'task',
    payload: {
      type: 'TASK_REQUEST',
      taskType: 'api_endpoint',
      parameters: {
        endpoint: '/api/score',
        method: 'POST',
        data: { playerId: 'string', score: 'number' }
      }
    }
  })
});
```

## 9. 에러 처리

API 응답은 항상 다음 형식을 따릅니다:

```json
{
  "success": true,
  "data": { ... }
}
```

또는 에러 발생 시:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### 일반적인 에러 코드

| 상태 코드 | 설명 |
|---------|------|
| 400 | 잘못된 요청 파라미터 |
| 404 | 리소스를 찾을 수 없음 |
| 409 | 충돌 (예: 파일 잠금) |
| 500 | 서버 내부 오류 |

## 10. 팁과 모범 사례

1. **세션 관리**
   - 작업이 완료된 세션은 반드시 정리하세요
   - 적절한 타임아웃을 설정하여 자원 낭비를 방지하세요

2. **파일 잠금**
   - 파일 수정 시 반드시 잠금을 획득하세요
   - 작업 완료 후 잠금을 해제하는 것을 잊지 마세요

3. **이벤트 처리**
   - 이벤트 필터링을 활용하여 불필요한 이벤트 수신을 줄이세요
   - 재연결 로직을 구현하여 안정성을 높이세요

4. **에러 처리**
   - 모든 API 호출에 대한 에러 핸들링을 구현하세요
   - 재시도 로직을 고려하세요

## 11. 클라이언트 라이브러리 예제

```javascript
class OpenCodeClient {
  constructor(baseUrl = 'http://localhost:4096') {
    this.baseUrl = baseUrl;
  }

  async createSession(projectId, agentRole, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: options.agent || 'gpt-4',
        model: options.model || 'openai',
        projectId,
        agentRole,
        ...options
      })
    });
    return response.json();
  }

  async subscribeToEvents(filter = {}) {
    const params = new URLSearchParams(filter);
    return new EventSource(`${this.baseUrl}/api/events/stream?${params}`);
  }

  async sendMessage(from, to, payload, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/agents/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        type: options.type || 'request',
        channel: options.channel || 'task',
        payload,
        ...options
      })
    });
    return response.json();
  }

  async createTask(sessionId, taskData) {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        ...taskData
      })
    });
    return response.json();
  }

  async lockFile(filePath, sessionId, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/files/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        sessionId,
        ...options
      })
    });
    return response.json();
  }
}

// 사용 예
const client = new OpenCodeClient();

// 세션 생성 및 이벤트 구독
const session = await client.createSession('project-123', 'frontend');
const events = client.subscribeToEvents({
  sessionIds: session.data.id
});
```

## 12. 지원 및 문의

- **GitHub Issues**: [OpenCode Repository](https://github.com/sst/opencode)
- **문서**: [OpenCode Docs](https://opencode.ai/docs)

---

이 가이드는 OpenCode API를 성공적으로 통합하는 데 필요한 모든 정보를 제공합니다. 추가 질문이나 지원이 필요하면 GitHub Issues를 통해 문의해 주세요.