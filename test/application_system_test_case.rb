require "test_helper"

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_chrome, screen_size: [ 1400, 900 ]

  # 테스트 DB 가 외부 서버라 요청당 왕복이 길다. 첫 요청은 Vite 테스트 빌드도 포함한다.
  Capybara.default_max_wait_time = 15
  # aria-label 로도 버튼·필드를 찾는다 (에디터의 아이콘성 버튼)
  Capybara.enable_aria_label = true

  # 로그인 화면을 거쳐 세션 쿠키를 받는다 (시스템 테스트는 브라우저가 쿠키를 들고 있어야 한다)
  def sign_in_through_browser(user, password: "password")
    visit new_session_path
    fill_in "이메일", with: user.email_address
    fill_in "비밀번호", with: password
    click_button "로그인"
    assert_selector ".topnav"
  end
end
