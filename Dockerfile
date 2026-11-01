# syntax=docker/dockerfile:1
# check=error=true

# HomeFit production 이미지 (Rails 8 기본 Dockerfile 을 외부 MySQL + vite_rails + libvips 에 맞춰 조정).
# 빌드:  docker compose build
# 실행:  docker compose up -d      (.env 의 HOMEFIT_DB_*, SECRET_KEY_BASE 를 읽는다)

ARG RUBY_VERSION=3.4.8
ARG NODE_VERSION=22.17.1

# Node 바이너리는 공식 이미지에서 복사한다 (Vite 빌드에만 쓰고 최종 이미지에는 없다)
FROM docker.io/library/node:${NODE_VERSION}-slim AS node

FROM docker.io/library/ruby:${RUBY_VERSION}-slim AS base

WORKDIR /rails

# 런타임 패키지: mysql2(libmariadb), image_processing(libvips), jemalloc
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips default-mysql-client && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development:test" \
    LD_PRELOAD="/usr/local/lib/libjemalloc.so"

# --- 빌드 단계 (gem 컴파일, npm ci, Vite 빌드) ---
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git pkg-config default-libmysqlclient-dev libyaml-dev && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile -j 1 --gemfile

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN bundle exec bootsnap precompile -j 1 app/ lib/

# Vite 빌드 (vite_rails 가 assets:precompile 에 붙는다). SECRET_KEY_BASE 없이도 되도록 DUMMY
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile && rm -rf node_modules

# --- 최종 이미지 ---
FROM base

RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    mkdir -p /rails/storage /rails/tmp /rails/log && chown -R rails:rails /rails
USER 1000:1000

COPY --chown=rails:rails --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --chown=rails:rails --from=build /rails /rails

# 서버로 시작할 때 db:prepare (마이그레이션) 를 먼저 돌린다
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

EXPOSE 3000
CMD ["./bin/rails", "server"]
