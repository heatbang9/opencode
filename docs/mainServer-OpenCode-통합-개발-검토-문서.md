# mainServer-OpenCode 통합 개발 검토 문서

> **작성일**: 2024-12-11
> **버전**: 1.0
> **프로젝트 상태**: 설계 단계

## 1. 프로젝트 개요

### 1.1 mainServer 프로젝트
- **목적**: AI 코딩 에이전트를 여러 개 실행하고 관리하는 서버
- **기술 스택**: Node.js, Express, WebSocket, SQLite
- **주요 기능**:
  - 에이전트 생명주기 관리
  - 프로젝트 관리 (생성, 실행, 모니터링)
  - 실시간 웹 인터페이스 제공
  - 진행상황 추적 시스템
  - 웹소켓을 통한 실시간 통신

### 1.2 OpenCode 프로젝트
- **목적**: 오픈소스 AI 코딩 에이전트
- **기술 스택**: TypeScript, Hono, Bun/Node.js
- **주요 기능**:
  - CLI 및 TUI 인터페이스
  - 서버 모드 지원 (HTTP API)
  - 다양한 에이전트 타입 (build, plan, general)
  - 실시간 협업 기능

## 2. 시나리오: 미니게임 생성 프로젝트

### 2.1 전체 워크플로우
```
1. 사용자가 mainServer 웹에서 "미니게임 생성" 프로젝트 생성
2. mainServer가 OpenCode 에이전트 2개 이상 시작
3. mainServer가 LLM API를 통해 미니게임 요구사항 구체화
4. 각 OpenCode 에이전트에게 개발任务 할당
5. OpenCode 에이전트들이 개발 진행 및 결과 통신
6. mainServer가 개발 결과를 웹 호스팅에 표시
7. mainServer가 다른 AI에게 추가 구현 사항 질문
8. 4-7 과정 반복
```

## 3. 통신 아키텍처 설계

### 3.1 기본 통신 모델
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   웹 클라이언트   │◄────► │  mainServer  │◄────► │ OpenCode Agent 1│
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ OpenCode Agent 2│
                   └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  외부 LLM API  │
                   └─────────────┘
```

### 3.2 통신 채널

#### 3.2.1 mainServer ↔ OpenCode Agent
- **HTTP API**: 명령 전송, 상태 조회
  - POST `/api/sessions/{id}/messages` - 명령 전송
  - GET `/api/sessions/{id}` - 세션 상태 조회
  - GET `/api/sessions/{id}/messages` - 메시지 히스토리
- **Server-Sent Events (SSE)**: 실시간 진행상황 수신
  - GET `/global/event` - 전역 이벤트 스트림

#### 3.2.2 mainServer ↔ 웹 클라이언트
- **WebSocket**: 양방향 실시간 통신
  - 에이전트 상태 업데이트
  - 개발 진행상황 실시간 표시
  - 코드 변경사항 실시간 전파

#### 3.2.3 mainServer ↔ 외부 LLM API
- **REST API**: 요구사항 분석, 추가 구현 아이디어 요청
  - OpenAI GPT-4/4.5, Claude 등

## 4. 구현 방안

### 방안 1: 단일 프로세스 다중 에이전트 모델

#### 특징
- mainServer가 각 프로젝트별로 독립된 OpenCode 서버 프로세스 실행
- 각 에이전트는 별도 포트에서 실행
- mainServer가 포트 매니저 역할

#### 구현
```javascript
// 프로젝트별 OpenCode 서버 관리
class ProjectAgentManager {
  constructor(projectId) {
    this.projectId = projectId;
    this.agents = new Map(); // agentId -> agentInfo
    this.basePort = 4100;
  }

  async startAgent(agentType, config) {
    const port = await this.findAvailablePort();
    const agentProcess = spawn('opencode', [
      'serve',
      '--port', port,
      '--hostname', '127.0.0.1'
    ]);

    // 에이전트 정보 저장
    this.agents.set(agentId, {
      process: agentProcess,
      port: port,
      type: agentType,
      baseUrl: `http://127.0.0.1:${port}`,
      status: 'starting'
    });

    return agentId;
  }
}
```

#### 장점
- 격리성: 각 에이전트가 독립적인 프로세스
- 확장성: 동적 에이전트 추가/제거 용이
- 안정성: 하나의 에이전트 실패가 다른 에이전트에 영향 X

#### 단점
- 자원 소모: 각 프로세스가 메모리 점유
- 포트 관리 복잡성

### 방안 2: 단일 OpenCode 서버 다중 세션 모델

#### 특징
- 하나의 OpenCode 서버에서 여러 세션 관리
- 각 세션이 독립적인 작업 공간
- 더 효율적인 자원 관리

#### 구현
```javascript
class SingleServerAgentManager {
  constructor() {
    this.serverPort = 4096;
    this.sessions = new Map();
  }

  async initializeServer() {
    // 단일 OpenCode 서버 시작
    this.serverProcess = spawn('opencode', [
      'serve',
      '--port', this.serverPort
    ]);
  }

  async createSession(projectId, agentType) {
    const response = await axios.post(
      `http://127.0.0.1:${this.serverPort}/api/sessions`,
      {
        agent: agentType,
        model: 'gpt-4',
        workspace: `/workspace/${projectId}`
      }
    );

    return response.data.id;
  }
}
```

#### 장점
- 자원 효율성: 단일 프로세스
- 관리 용이성: 중앙화된 관리
- 통신 간소화: 단일 엔드포인트

#### 단점
- 단일 장애점: 서버 실패 시 모든 세션 영향
- 리소스 경합: 메모리/CPU 공유

### 방안 3: 하이브리드 모델 (권장)

#### 특징
- 프로젝트 타입에 따라 동적 선택
- 간단한 작업: 단일 서버 다중 세션
- 복잡한 작업: 다중 프로세스

#### 구현
```javascript
class HybridAgentManager {
  constructor() {
    this.singleServer = null;
    this.multiServers = new Map();
  }

  async startAgents(projectId, agentConfigs) {
    const complexity = await this.analyzeProjectComplexity(projectId);

    if (complexity === 'simple') {
      // 단일 서버 사용
      return this.startSingleServerMode(projectId, agentConfigs);
    } else {
      // 다중 프로세스 사용
      return this.startMultiProcessMode(projectId, agentConfigs);
    }
  }
}
```

## 5. 상세 설계

### 5.1 에이전트 관리자 (AgentManager) 확장

#### 필요한 기능
1. **다중 에이전트 생명주기 관리**
   - 동시에 여러 에이전트 실행
   - 에이전트 간 작업 분배
   - 장애 복구 및 자동 재시작

2. **작업 큐 관리**
   - 각 에이전트에게 작업 할당
   - 작업 우선순위 관리
   - 병렬 실행 제어

3. **상태 동기화**
   - 에이전트 상태 실시간 추적
   - 작업 진행상황 중앙 집중
   - 충돌 방지 (파일 수정 등)

### 5.2 LLM 통합 관리자 (LLMManager)

#### 필요한 기능
1. **프롬프트 템플릿 관리**
   - 프로젝트 요구사항 분석 프롬프트
   - 코드 검토 프롬프트
   - 개선사항 제안 프롬프트

2. **컨텍스트 관리**
   - 프로젝트 전체 컨텍스트 유지
   - 대화 히스토리 관리
   - 관련 코드 조각 추출

3. **응답 처리**
   - LLM 응답 구조화
   - 작업 항목 추출
   - 실행 계획 생성

### 5.3 프로젝트 동기화 매니저 (ProjectSyncManager)

#### 필요한 기능
1. **코드 병합**
   - 여러 에이전트의 코드 변경 병합
   - 충돌 감지 및 해결
   - 버전 관리 연동

2. **실시간 파일 동기화**
   - 파일 변경 감지
   - 다른 에이전트에게 변경사항 전파
   - 백업 및 롤백

## 6. API 설계

### 6.1 mainServer 웹 API 확장

```javascript
// 에이전트 관리
POST   /api/projects/:projectId/agents          // 에이전트 생성
GET    /api/projects/:projectId/agents          // 에이전트 목록
PUT    /api/projects/:projectId/agents/:id      // 에이전트 업데이트
DELETE /api/projects/:projectId/agents/:id      // 에이전트 삭제

// 작업 관리
POST   /api/projects/:projectId/tasks           // 작업 생성
GET    /api/projects/:projectId/tasks           // 작업 목록
PUT    /api/projects/:projectId/tasks/:id       // 작업 업데이트

// LLM 상호작용
POST   /api/projects/:projectId/analyze         // 요구사항 분석
POST   /api/projects/:projectId/improve         // 개선사항 요청
```

### 6.2 WebSocket 이벤트 확장

```javascript
// 에이전트 이벤트
agent:started        // 에이전트 시작
agent:status_update  // 상태 업데이트
agent:task_complete  // 작업 완료
agent:error         // 에러 발생

// 프로젝트 이벤트
project:file_changed // 파일 변경
project:task_update  // 작업 진행상황
project:sync_status  // 동기화 상태

// LLM 이벤트
llm:analyzing       // 분석 중
llm:suggestion      // 개선 제안
```

## 7. 데이터베이스 스키마 확장

### 7.1 테이블 추가

```sql
-- 에이전트 정보
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- build, plan, general
  status TEXT NOT NULL,
  config TEXT,         -- JSON
  created_at DATETIME,
  updated_at DATETIME
);

-- 에이전트 작업
CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT,
  result TEXT,
  created_at DATETIME,
  completed_at DATETIME
);

-- LLM 상호작용 기록
CREATE TABLE llm_interactions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- analyze, improve, review
  prompt TEXT,
  response TEXT,
  created_at DATETIME
);
```

## 8. 보안 고려사항

### 8.1 에이전트 격리
- 각 에이전트 작업 공간 격리
- 파일 시스템 접근 제한
- 네트워크 접근 제어

### 8.2 API 보안
- 에이전트 API 엔드포인트 인증
- 요청 속도 제한
- 입력값 검증 및 sanitization

### 8.3 데이터 보안
- LLM API 키 안전한 관리
- 프로젝트 데이터 암호화
- 접근 권한 제어

## 9. 모니터링 및 로깅

### 9.1 모니터링 항목
- 에이전트 프로세스 상태
- 메모리/CPU 사용량
- API 응답 시간
- 에러 발생 빈도

### 9.2 로깅 레벨
- DEBUG: 상세한 실행 흐름
- INFO: 주요 이벤트
- WARN: 경고 사항
- ERROR: 에러 및 예외

## 10. 성능 최적화

### 10.1 자원 관리
- 에이전트 스케줄링 최적화
- idle 에이전트 자동 종료
- 메모리 누수 방지

### 10.2 통신 최적화
- HTTP 요청 배치 처리
- WebSocket 메시지 큐
- 데이터 압축

## 11. 구현 우선순위

### Phase 1: 기본 통신 (1주)
1. OpenCode HTTP API 통합
2. 단일 에이전트 실행 및 제어
3. 기본 상태 모니터링

### Phase 2: 다중 에이전트 (2주)
1. 다중 에이전트 관리자 구현
2. 작업 분배 시스템
3. 에이전트 간 기본 동기화

### Phase 3: LLM 통합 (1주)
1. 요구사항 분석 시스템
2. 개선사항 제안 기능
3. 피드백 루프 구현

### Phase 4: 고급 기능 (2주)
1. 실시간 협업 기능
2. 충돌 해결 시스템
3. 성능 최적화

## 12. 테스트 전략

### 12.1 단위 테스트
- 각 매니저 클래스 기능 테스트
- API 엔드포인트 테스트
- 에러 핸들링 테스트

### 12.2 통합 테스트
- mainServer-OpenCode 통신 테스트
- 다중 에이전트 협업 테스트
- LLM 통합 테스트

### 12.3 부하 테스트
- 동시 에이전트 실행 테스트
- 긴 시간 실행 안정성 테스트
- 메모리 누수 테스트

## 13. 결론

본 문서는 mainServer와 OpenCode의 통합을 위한 설계안을 제시합니다. **하이브리드 모델(방안 3)**을 채택하여 프로젝트의 복잡도에 따라 유연하게 에이전트 실행 방식을 선택하는 것을 권장합니다.

핵심 구현 요소:
1. **확장된 에이전트 관리자**: 다중 에이전트 생명주기 관리
2. **LLM 통합 관리자**: 지능적인 요구사항 분석 및 개선 제안
3. **프로젝트 동기화 매니저**: 여러 에이전트의 작업 조율
4. **실시간 통신**: WebSocket을 통한 상태 동기화

이 설계를 통해 사용자는 웹 인터페이스를 통해 여러 AI 에이전트가 협력하여 미니게임과 같은 프로젝트를 개발하는 과정을 실시간으로 관찰하고 제어할 수 있게 됩니다.