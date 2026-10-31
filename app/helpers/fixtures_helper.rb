module FixturesHelper
  KIND_LABELS = { "furniture" => "가구", "appliance" => "가전", "etc" => "기타" }.freeze

  def kind_label(kind)
    KIND_LABELS.fetch(kind.to_s, kind.to_s)
  end

  def kind_options
    Fixture.kinds.keys.map { |k| [ kind_label(k), k ] }
  end
end
