# frozen_string_literal: true

# DB 커넥션 keepalive 겸 헬스체크. HikariCP 의 keepaliveTime / connectionTestQuery 에 해당한다.
#
# Rails 의 커넥션 풀(database.yml 의 max_connections)은 주기적으로 핑을 보내지 않고, 체크아웃 때 검증·재연결하고
# 5분(idle_timeout) 유휴 커넥션을 회수한다. 외부 MySQL 이나 중간 장비가 유휴 커넥션을 끊는 환경에서는
# 첫 요청이 재연결 비용을 치르고 끊김 자체가 로그에 남지 않으므로, interval 초마다 풀에서 커넥션 하나를 빌려
# SELECT 1 을 보낸다. 커넥션은 매번 반납하고 프로세스당 스레드 1개만 둔다.
#
# 로그: 성공은 debug, 실패는 warn(JSON 한 줄), 실패 뒤 첫 성공은 info("recovered").
# 설정: config.x.db_keepalive_interval (환경변수 HOMEFIT_DB_KEEPALIVE_SECONDS, 0 이면 끔). 시작은 initializers/db_keepalive.rb.
class DbKeepalive
  QUERY = "SELECT 1"

  class << self
    def start(interval: Rails.configuration.x.db_keepalive_interval, logger: Rails.logger)
      seconds = interval.to_i
      return nil unless seconds.positive?

      stop
      @thread = Thread.new { run(seconds, logger) }
      @thread.name = "db-keepalive"
      @thread.report_on_exception = false
      @thread
    end

    def stop
      @thread&.kill&.join(1)
      @thread = nil
    end

    def running? = @thread&.alive? || false

    # 한 번 핑. 성공 true, 실패 false (예외는 로그로만 남기고 삼킨다). pool 은 테스트용 주입점
    def ping(logger: Rails.logger, pool: ActiveRecord::Base.connection_pool)
      value = pool.with_connection { |c| c.select_value(QUERY) }
      logger.debug { log_line(ok: true, value:) }
      true
    rescue StandardError => e
      logger.warn(log_line(ok: false, error: e.class.name, message: e.message.lines.first&.strip))
      false
    end

    private

    def run(seconds, logger)
      healthy = true
      loop do
        sleep seconds
        ok = ping(logger:)
        logger.info(log_line(ok: true, recovered: true)) if ok && !healthy
        healthy = ok
      end
    end

    def log_line(**fields)
      { event: "db_keepalive", time: Time.current.utc.iso8601(3), **fields }.to_json
    end
  end
end
