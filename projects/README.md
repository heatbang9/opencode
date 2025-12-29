# OpenCode Projects Directory

이 디렉토리는 OpenCode가 생성하는 모든 프로젝트를 저장하는 공간입니다.

## 사용 방법

OpenCode 서버를 시작하면 이 디렉토리가 기본 workspace로 설정됩니다:

```bash
./run-opencode.sh start 45000
# 또는
./start-opencode.sh
```

## 디렉토리 구조

```
projects/
├── project1/
│   ├── src/
│   ├── README.md
│   └── ...
├── project2/
│   └── ...
└── ...
```

## 주의사항

- 이 디렉토리는 자동으로 생성됩니다
- 프로젝트는 OpenCode가 자동으로 관리합니다
- 수동으로 파일을 삭제하거나 수정하지 마세요
