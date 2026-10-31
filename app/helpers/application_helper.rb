module ApplicationHelper
  # 길이 표기는 항상 정수 mm + 천 단위 구분자 (설계서 Section 5 공통)
  def format_mm(value)
    return "—" if value.nil?

    "#{number_with_delimiter(value.to_i)} mm"
  end

  # "1,540 × 2,050 × 900 mm"
  def format_dimensions(width_mm, depth_mm, height_mm)
    "#{[ width_mm, depth_mm, height_mm ].map { |v| number_with_delimiter(v.to_i) }.join(' × ')} mm"
  end

  def nav_link_class(path)
    current = request.path == path || (path != root_path && request.path.start_with?(path))
    class_names("topnav__link", "topnav__link--current": current)
  end

  # 2단계 삭제 버튼 (Turbo confirm 대신, 설계서 Section 5 공통). 첫 클릭에 문구가 바뀌고 두 번째 클릭에 제출된다.
  def two_step_delete_button(label, path, confirm_label: "한 번 더 누르면 삭제", **options)
    button_to label, path, method: :delete,
      form: { data: { controller: "two-step-delete", two_step_delete_confirm_label_value: confirm_label } },
      data: { two_step_delete_target: "button", action: "two-step-delete#click" },
      class: class_names("btn btn--danger", options[:class]), **options.except(:class)
  end
end
