# ADR 0003 — Docker 이미지 + compose, production 은 DB 하나, SSL 은 환경변수

- 날짜: 2026-11-01
- 상태: 승인 (소유자가 "Dockerizing" 을 추가 요청)
- 관련: 설계서 Section 6, 7(M7), AGENTS.md "컨테이너 전제 구성 제안 금지"

## 결정

1. **Docker 로 배포한다.** 소유자가 명시적으로 요청했다. `Dockerfile`(Rails 8 기본 템플릿을 외부 MySQL·vite_rails·libvips 에 맞게 조정, 멀티스테이지, non-root)과 `compose.yml`(web 서비스 1개, Active Storage 볼륨, `/up` 헬스체크)을 둔다. MySQL 컨테이너는 없다 — DB 는 외부 서버(ADR 이전 결정)이고 접속 정보는 `.env` 를 `env_file` 로 읽는다.
2. **production 도 DB 하나만 쓴다.** `rails new` 가 만든 cache/queue/cable 용 DB 설정을 지웠다. Solid Queue/Cache/Cable 설정 파일이 생성되지 않았고(gem 만 Gemfile 에 있음), 현재 잡은 Active Storage 분석·purge 뿐이라 `async` 어댑터로 충분하다. 외부 서버에 DB 를 4개 만드는 비용을 피한다. 잡이 늘어나면 Solid Queue + `homefit_production_queue` 를 추가한다.
3. **`force_ssl`/`assume_ssl` 은 `HOMEFIT_FORCE_SSL=1` 일 때만 켠다.** Mac mini 는 LAN 에서 http 로 접속한다. TLS 프록시(Caddy 등)를 앞에 두면 켠다.
4. 비밀값은 `.env` 의 `SECRET_KEY_BASE` 로 넘긴다. `config/master.key` 는 이미지에 넣지 않는다(.dockerignore).

## 운영 메모

- 최초: `docker compose build && docker compose up -d`. entrypoint 의 `db:prepare` 가 DB 가 없으면 생성·스키마·시드까지 하고, 있으면 마이그레이션만 적용한다.
- Action Cable 은 쓰지 않으므로 `config/cable.yml` production 도 `async` 다. Redis 없음.
- 백업: `mysqldump`(외부 서버) + `homefit-storage` 볼륨.
- M7(설계서) 의 "Puma + MySQL 직접 설치" 대신 이 구성을 쓴다. 설계서 Section 7 M7 행을 갱신했다.
