# bin/ci 로 실행한다. 모든 단계를 끝까지 돌린 뒤 하나라도 실패했으면 non-zero 로 종료한다
# (ActiveSupport::ContinuousIntegration). 순서는 CLAUDE.md / 킥오프 8번 그대로.

CI.run do
  step "Style: Ruby (rubocop)", "bin/rubocop"
  step "Security: Brakeman", "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error"
  step "Style: ERB (erb_lint)", "bin/erb_lint --lint-all"
  step "Style: TypeScript (eslint)", "npm run -s lint"
  step "Style: Prettier", "npm run -s format:check"
  step "Types: tsc --noEmit", "npm run -s typecheck"
  step "Tests: Vitest", "npm run -s test"
  step "Tests: Rails", "bin/rails test"
  step "Tests: Seeds", "env RAILS_ENV=test bin/rails db:seed:replant"
end
