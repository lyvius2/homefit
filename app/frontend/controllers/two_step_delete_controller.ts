import { Controller } from "@hotwired/stimulus";

// 삭제 2단계 버튼. 첫 클릭은 제출을 막고 문구를 바꾸며, 3초 안의 두 번째 클릭만 폼을 제출한다.
// <form data-controller="two-step-delete" data-two-step-delete-confirm-label-value="한 번 더 누르면 삭제">
//   <button data-two-step-delete-target="button" data-action="two-step-delete#click">삭제</button>
export default class extends Controller<HTMLFormElement> {
  static override targets = ["button"];
  static override values = {
    confirmLabel: String,
    timeout: { type: Number, default: 3000 },
  };

  declare readonly buttonTarget: HTMLButtonElement;
  declare readonly confirmLabelValue: string;
  declare readonly timeoutValue: number;

  private armed = false;
  private originalLabel = "";
  private timer: number | undefined;

  override connect(): void {
    this.originalLabel = this.buttonTarget.textContent ?? "";
  }

  override disconnect(): void {
    this.reset();
  }

  click(event: Event): void {
    if (this.armed) return; // 두 번째 클릭: 그대로 제출된다

    event.preventDefault();
    this.armed = true;
    this.buttonTarget.textContent = this.confirmLabelValue;
    this.buttonTarget.classList.add("btn--armed");
    this.timer = window.setTimeout(() => this.reset(), this.timeoutValue);
  }

  private reset(): void {
    window.clearTimeout(this.timer);
    this.armed = false;
    this.buttonTarget.textContent = this.originalLabel;
    this.buttonTarget.classList.remove("btn--armed");
  }
}
