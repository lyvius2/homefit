// 관리 화면(ERB + Turbo + Stimulus) 진입점.
// @hotwired/turbo-rails 는 import 만으로 Turbo.start() 를 호출하고 window.Turbo 를 노출한다.
import "@hotwired/turbo-rails";
import { Application, type ControllerConstructor } from "@hotwired/stimulus";

const application = Application.start();

// app/frontend/controllers/<name>_controller.ts 를 자동 등록한다.
// 파일명 "two_step_delete_controller.ts" → data-controller="two-step-delete"
const controllers = import.meta.glob<{ default: ControllerConstructor }>(
  "../controllers/*_controller.ts",
  { eager: true },
);

for (const [path, module] of Object.entries(controllers)) {
  const file = path.split("/").pop() ?? "";
  const name = file.replace(/_controller\.ts$/, "").replace(/_/g, "-");
  application.register(name, module.default);
}

declare global {
  interface Window {
    Stimulus: Application;
  }
}
window.Stimulus = application;
