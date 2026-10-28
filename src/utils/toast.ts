export type ToastType = "success" | "error" | "info" | "warning";

const TOAST_COLORS: Record<ToastType, string> = {
  success: "#16a34a",
  error: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
};

const TOAST_ICON_PATHS: Record<ToastType, string> = {
  success: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  error: "M10 3h4v12h-4zM10 17h4v4h-4z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  info: "M11 7h2v2h-2zm0 4h2v6h-2z",
};

const CLOSE_ICON_PATH =
  "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

/** 同时最多显示的条数，超出时移除最早的一条。 */
const MAX_VISIBLE = 5;

const isDarkMode = () =>
  typeof document !== "undefined" &&
  document.body.classList.contains("dark");

const iconMarkup = (type: ToastType, size: number) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${TOAST_ICON_PATHS[type]}"/></svg>`;

class ToastManager {
  private container: HTMLDivElement | null = null;

  private timers = new WeakMap<HTMLElement, number>();

  private initContainer() {
    if (this.container) return;
    const container = document.createElement("div");
    container.style.cssText = [
      "position:fixed",
      "top:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:9999",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "gap:8px",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(container);
    this.container = container;
  }

  private dismiss(el: HTMLElement) {
    const timer = this.timers.get(el);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.timers.delete(el);
    }
    if (el.dataset.leaving === "1") return;
    el.dataset.leaving = "1";
    el.style.opacity = "0";
    el.style.transform = "translateY(-12px) scale(0.97)";
    window.setTimeout(() => el.remove(), 180);
  }

  show(message: string, type: ToastType = "info", duration = 3000) {
    if (typeof document === "undefined") return;
    this.initContainer();
    const container = this.container as HTMLDivElement;
    const dark = isDarkMode();
    const color = TOAST_COLORS[type] || TOAST_COLORS.info;

    while (container.children.length >= MAX_VISIBLE) {
      container.firstElementChild?.remove();
    }

    const card = document.createElement("div");
    card.setAttribute("role", type === "error" ? "alert" : "status");
    card.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:10px",
      "box-sizing:border-box",
      "width:356px",
      "max-width:calc(100vw - 32px)",
      "padding:13px 36px 13px 14px",
      "border-radius:8px",
      "overflow:hidden",
      `background:${dark ? "#18181b" : "#ffffff"}`,
      `border:1px solid ${dark ? "#27272a" : "#e4e4e7"}`,
      `color:${dark ? "#fafafa" : "#18181b"}`,
      `box-shadow:${dark ? "0 8px 24px rgba(0, 0, 0, 0.5)" : "0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06)"}`,
      "font-size:13px",
      "line-height:1.5",
      "position:relative",
      "cursor:pointer",
      "pointer-events:auto",
      "opacity:0",
      "transform:translateY(-12px) scale(0.97)",
      "transition:opacity 0.2s ease, transform 0.2s cubic-bezier(0.21, 1.02, 0.73, 1)",
    ].join(";");

    const icon = document.createElement("span");
    icon.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "flex:none",
      "width:20px",
      "height:20px",
      "border-radius:9999px",
      "color:#ffffff",
      `background:${color}`,
    ].join(";");
    icon.innerHTML = iconMarkup(type, 14);

    const text = document.createElement("span");
    text.style.cssText =
      "flex:1 1 auto;white-space:pre-wrap;word-break:break-word;";
    text.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.style.cssText = [
      "position:absolute",
      "right:8px",
      "top:50%",
      "transform:translateY(-50%)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "width:20px",
      "height:20px",
      "padding:0",
      "border:none",
      "border-radius:9999px",
      "background:transparent",
      `color:${dark ? "#a1a1aa" : "#71717a"}`,
      "cursor:pointer",
      "opacity:0",
      "transition:opacity 0.15s ease, background-color 0.15s ease",
    ].join(";");
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${CLOSE_ICON_PATH}"/></svg>`;

    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.background = dark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.06)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.background = "transparent";
    });
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.dismiss(card);
    });

    card.appendChild(icon);
    card.appendChild(text);
    card.appendChild(closeBtn);

    // 底部进度条：颜色跟随当前主题色，长度与自动关闭时间同步
    const progress = document.createElement("div");
    if (duration > 0) {
      progress.style.cssText = [
        "position:absolute",
        "left:0",
        "bottom:0",
        "height:3px",
        "width:100%",
        "transform:scaleX(1)",
        "transform-origin:left center",
        `background:${color}`,
        "pointer-events:none",
      ].join(";");
      card.appendChild(progress);
    }

    card.addEventListener("mouseenter", () => {
      closeBtn.style.opacity = "1";
    });
    card.addEventListener("mouseleave", () => {
      closeBtn.style.opacity = "0";
    });
    card.addEventListener("click", () => this.dismiss(card));

    container.appendChild(card);

    // 入场动画
    requestAnimationFrame(() => {
      card.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
      if (duration > 0) {
        requestAnimationFrame(() => {
          progress.style.transition = `transform ${duration}ms linear`;
          progress.style.transform = "scaleX(0)";
        });
      }
    });

    if (duration > 0) {
      this.timers.set(
        card,
        window.setTimeout(() => this.dismiss(card), duration),
      );
    }
  }

  success(msg: string, duration?: number) {
    this.show(msg, "success", duration);
  }
  error(msg: string, duration?: number) {
    this.show(msg, "error", duration);
  }
  info(msg: string, duration?: number) {
    this.show(msg, "info", duration);
  }
  warning(msg: string, duration?: number) {
    this.show(msg, "warning", duration);
  }
}

export const toast = new ToastManager();
