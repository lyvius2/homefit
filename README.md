# HomeFit

![Ruby](https://img.shields.io/badge/Ruby-3.4-CC342D?logo=ruby&logoColor=white)
![Rails](https://img.shields.io/badge/Rails-8.1-D30001?logo=rubyonrails&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-R3F-000000?logo=threedotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)

도면 이미지 위에 벽을 그려 3D 주택을 만들고, 실제 치수를 가진 집기(가구·가전)를 배치해 "들어가는지, 동선이 나오는지"를 확인하는 개인용 웹앱입니다. 배치는 저장할 때마다 불변 버전으로 쌓입니다.

설계의 기준 문서는 [docs/DESIGN.md](docs/DESIGN.md)이고, 코딩 규칙은 [AGENTS.md](AGENTS.md)에 있습니다.

## 스택

| 영역 | 선택 |
|---|---|
| 백엔드 | Ruby 3.4, Rails 8, MySQL 8.0 (utf8mb4, 외부 서버) |
| 프론트 | vite_rails, React 19 + TypeScript(strict), Turbo/Stimulus |
| 3D / 2D | three + @react-three/fiber + @react-three/drei, konva + react-konva |
| 파일 / 잡 | Active Storage(Disk) + libvips, Active Job(async, 프로세스 내). Redis 없음 |
| 테스트 / 분석 | Minitest, vitest, rubocop, brakeman, erb_lint, eslint, prettier, tsc |

## 요구 사항

- macOS, Ruby 3.4.x (rbenv), Node 22.x
- 외부 MySQL 8.0 서버와 접속 계정 (`homefit_development`, `homefit_test` DB 생성 권한)
- libvips (`brew install vips`), MySQL 클라이언트 라이브러리 (`brew install mysql-client`)
- Chrome (시스템 테스트)

## 설정과 명령

```bash
cp .env.example .env         # 1. 외부 MySQL 접속 정보(HOMEFIT_DB_*)를 채운다. .env 는 커밋하지 않는다
bin/setup                    # 2. bundle install, npm ci, db:prepare(마이그레이션+시드) 를 한 번에. 이어서 bin/dev 실행
bin/setup --skip-server      #    서버를 띄우지 않고 준비만
bin/dev                      # Rails(3000) + Vite dev 서버(3036) 를 Procfile.dev 로 함께 실행 (foreman)
bin/ci                       # rubocop → brakeman → erb_lint → eslint → prettier → tsc → vitest → rails test → 시드
                             #    커밋 전 필수. 하나라도 실패하면 non-zero
bin/rails test               # Ruby 단위·통합 테스트만
bin/rails test test/lib/geometry   # 기하만 (Ruby)
npx vitest run app/frontend/lib    # 기하·유틸만 (TS)
bin/rails test:system        # 브라우저 시스템 테스트 (Chrome)
bin/rails console            # 시드 데이터 확인: House.first.plan, Layout.first.latest_version.placements
```

## 운영 (Docker, Mac mini)

Mac mini 한 대에서 `docker compose` 로 웹 컨테이너 1개를 띄웁니다. 외부 의존은 **외부 MySQL 하나**뿐입니다. Redis 는 쓰지 않습니다(캐시는 파일, 잡은 프로세스 안 async, Action Cable 미사용). 결정 배경은 [docs/decisions/0003-docker-single-db.md](docs/decisions/0003-docker-single-db.md).

### 1. 준비: 어떤 파일에 무엇을 넣는지

편집할 파일은 저장소 루트의 **`.env` 하나**입니다(커밋하지 않음). `Dockerfile`, `compose.yml` 은 손대지 않습니다.

```bash
git clone <repo> homefit && cd homefit
cp .env.example .env
openssl rand -hex 64        # SECRET_KEY_BASE 값으로 붙여 넣는다
```

| `.env` 키 | 값 | 비고 |
|---|---|---|
| `HOMEFIT_DB_HOST` / `HOMEFIT_DB_PORT` | 외부 MySQL 주소, 포트 | |
| `HOMEFIT_DB_USERNAME` / `HOMEFIT_DB_PASSWORD` | 접속 계정 | `homefit_production` DB 를 **CREATE/DROP** 할 수 있어야 첫 기동과 초기화가 됩니다 |
| `HOMEFIT_DB_SSL_MODE` | `required` | JDBC `ssl-mode=REQUIRED` 대응 |
| `HOMEFIT_DB_TIMEZONE` | `Asia/Seoul` | JDBC `serverTimezone` 대응 |
| `SECRET_KEY_BASE` | `openssl rand -hex 64` 결과 | 세션 쿠키 서명. 바꾸면 전원 로그아웃 |
| `HOMEFIT_SEED_USERS` | `a@x.com:비밀번호,b@y.com:비밀번호` | 로그인 계정 2개. 회원가입 화면이 없으므로 여기서만 만듭니다 |
| `HOMEFIT_PORT` | `3000` | 호스트(Mac mini)에서 열 포트 |
| `HOMEFIT_IMAGE` / `HOMEFIT_IMAGE_TAG` | `docker.io/<id>/homefit` / `latest` | Docker Hub 에서 받을 이미지. 비우면 로컬 빌드 `homefit:latest` |
| `HOMEFIT_FORCE_SSL` | `0` | TLS 프록시 뒤에 둘 때만 `1` |
| `RAILS_LOG_LEVEL` / `RAILS_MAX_THREADS` | 생략 가능 | 기본 `info` / `3` |

### 2. 처음 띄우기

```bash
docker compose pull           # Docker Hub 에서 이미지를 받는다 (.env 의 HOMEFIT_IMAGE). 아래 7 에서 올린 것
                              # Hub 를 쓰지 않으면 대신 docker compose build (Ruby 3.4 + libvips + Vite 빌드, 수 분)
docker compose up -d          # 컨테이너 시작. entrypoint 가 db:prepare 실행:
                              #   DB 가 없으면 생성 → 스키마 → 시드(계정 + 예시 주택·집기·배치 1건)
                              #   DB 가 있으면 미적용 마이그레이션만
docker compose ps             # web 이 healthy 가 되면 준비 끝 (/up 헬스체크, 최대 40초)
docker compose logs -f web    # JSON 로그(lograge)
```

시드가 만든 예시 주택·집기는 화면에서 지워도 됩니다. `.env` 에 `HOMEFIT_SEED_USERS` 를 나중에 넣었다면 계정만 다시 만듭니다.

```bash
docker compose run --rm web bin/rails db:seed     # 이미 있는 계정·데이터는 건드리지 않음
```

### 3. 접속과 포트

- 컨테이너 안에서 Puma 는 **3000 고정**이고, 호스트 포트는 `.env` 의 `HOMEFIT_PORT`(기본 3000)입니다. 바꾼 뒤에는 `docker compose up -d` 를 다시 실행하면 됩니다.
- 같은 LAN 의 다른 기기에서 `http://<Mac mini IP 또는 호스트명.local>:3000` 으로 엽니다. macOS 방화벽이 켜져 있으면 Docker 를 허용해 둡니다.
- 로그인은 `HOMEFIT_SEED_USERS` 의 이메일·비밀번호입니다. 상태 확인은 `http://<host>:3000/up` (200 이면 정상).
- 집 밖에서 쓰려면 Caddy 같은 TLS 프록시를 앞에 두고 `HOMEFIT_FORCE_SSL=1` 로 바꿉니다. 프록시 없이 공인망에 3000 을 직접 열지 않습니다.

### 4. 일상 운영

```bash
docker compose stop / start / restart         # 중지 · 재개 · 재시작 (데이터 유지)
docker compose pull && docker compose up -d   # 새 이미지로 갱신 (개발 Mac 에서 bin/docker-release 로 올린 뒤). 마이그레이션은 기동 시 자동
git pull                                      # compose.yml·.env.example 이 바뀌었을 때만 필요. 직접 빌드할 때는 docker compose build
docker compose run --rm web bin/rails console              # 콘솔
```

- 비밀번호 변경·계정 추가는 콘솔에서: `User.find_by!(email_address: "a@x.com").update!(password: "새값")`, `User.create!(email_address:, password:)`.
- 데이터 위치: DB 는 외부 MySQL `homefit_production`, 업로드 파일(도면·집기 이미지)은 Docker 볼륨 `homefit_homefit-storage`.

백업은 둘을 짝으로 받습니다.

```bash
mysqldump -h $HOMEFIT_DB_HOST -u $HOMEFIT_DB_USERNAME -p --ssl-mode=REQUIRED homefit_production > homefit-$(date +%F).sql
docker run --rm -v homefit_homefit-storage:/data -v "$PWD":/backup alpine tar czf /backup/storage-$(date +%F).tgz -C /data .
```

복구는 반대로: `mysql ... homefit_production < 파일.sql`, 그리고 빈 볼륨에 `tar xzf`.

### 5. 중지·삭제

단계가 나뉘어 있습니다. 필요한 만큼만 내려갑니다.

```bash
docker compose stop                     # 1. 컨테이너만 중지. 볼륨·이미지·DB 그대로
docker compose down                     # 2. 컨테이너 + 네트워크 제거. 볼륨(업로드 파일)·이미지·DB 유지
docker compose down -v                  # 3. 2 + 볼륨 homefit_homefit-storage 삭제 (업로드 파일 사라짐)
docker compose down -v --rmi all        # 4. 3 + 이미지(HOMEFIT_IMAGE 또는 homefit:latest) 삭제
docker builder prune                    # 5. 빌드 캐시까지 정리 (선택)
```

개별로 지울 때는 `docker volume rm homefit_homefit-storage`, `docker rmi homefit:latest` 입니다. **외부 MySQL 의 DB 는 어떤 단계에서도 지워지지 않습니다.** 아래 6 을 따로 합니다.

### 6. DB 초기화

DB 는 컨테이너 밖에 있으므로 명시적으로 지웁니다. 초기화하면 업로드 파일도 고아가 되므로 **볼륨과 함께** 지웁니다.

```bash
docker compose down -v
docker compose run --rm -e DISABLE_DATABASE_ENVIRONMENT_CHECK=1 web bin/rails db:drop   # homefit_production 삭제
docker compose up -d                    # 다시 생성 → 스키마 → 시드
```

`DISABLE_DATABASE_ENVIRONMENT_CHECK=1` 은 production 에서 `db:drop` 을 막는 Rails 안전장치를 끄는 것입니다. 그 한 줄에서만 씁니다. MySQL 클라이언트에서 직접 `DROP DATABASE homefit_production;` 을 해도 같고, 그 뒤 `docker compose up -d` 가 다시 만듭니다. 스키마는 두고 데이터만 비우려면 같은 변수를 붙여 `db:seed:replant` 를 실행합니다(모든 테이블 truncate 후 시드).

```bash
docker compose run --rm -e DISABLE_DATABASE_ENVIRONMENT_CHECK=1 web bin/rails db:seed:replant
```

### 7. Docker Hub 에 올리기 (개발 Mac 에서)

Mac mini 는 빌드하지 않고 Hub 의 이미지를 받기만 합니다. 올리는 쪽은 개발 Mac 입니다.

```bash
docker login                         # Docker Hub 계정 (1회)
# .env 에 HOMEFIT_IMAGE=docker.io/<docker-hub-id>/homefit  (저장소는 비공개로 만들어 두는 것을 권장)
bin/docker-release                   # 현재 커밋을 빌드해 :<short-sha> 와 :latest 로 push
bin/docker-release v1                # 태그를 직접 줄 때
PLATFORMS=linux/arm64 bin/docker-release   # Mac mini 가 Apple Silicon 이면 arm64 만 (기본은 arm64+amd64, amd64 는 QEMU 라 느림)
```

- 커밋하지 않은 변경이 있으면 경고만 하고 그대로 빌드합니다. 올린 태그는 `git log --oneline` 의 short SHA 와 같으니 되돌릴 때 `.env` 의 `HOMEFIT_IMAGE_TAG` 를 그 값으로 바꾸고 `docker compose pull && docker compose up -d` 합니다.
- 이미지에는 `.env`, `config/master.key`, `storage/`, `test/`, `docs/` 가 들어가지 않습니다(`.dockerignore`). 비밀값은 전부 실행 시 `.env` 로 들어갑니다.
- 최초 1회 `docker buildx create` 로 `homefit-builder`(docker-container 드라이버)를 만듭니다. 멀티 플랫폼 push 에 필요하며 스크립트가 알아서 합니다.

## 저장소 지도

```
app/services/        유스케이스 (Plans::*, Placements::*, LayoutVersions::*)
app/lib/geometry/    순수 Ruby 기하 (OBB, SAT)
app/schemas/         Plan JSON 스키마
app/frontend/        Vite 진입점, React 에디터 2종, TS 기하
docs/                설계서, 기하 테스트 벡터, ADR
```

## 도메인 규칙 요약

- 길이는 정수 mm, 회전은 정수 도. 좌표 원점은 도면 좌상단이고 y는 아래가 양수입니다.
- 주택은 벽 선분 JSON으로만 저장하고 메시 파일은 저장하지 않습니다.
- 배치 버전과 배치 레코드는 불변이며, 저장 시 집기 치수를 서버가 스냅샷으로 복사합니다.
- 충돌·축척 검증은 서버가 최종 판정하고, 클라이언트 판정은 같은 테스트 벡터로 동일성을 검증합니다.

자세한 규칙은 docs/DESIGN.md의 Section 1을 참고하세요.
