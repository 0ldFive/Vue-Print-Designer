export type ToastType = 'success' | 'error' | 'info' | 'warning';

class ToastManager {
  private container: HTMLDivElement | null = null;

  private initContainer() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '9999';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  show(message: string, type: ToastType = 'info', duration = 3000) {
    this.initContainer();

    const el = document.createElement('div');
    el.style.padding = '12px 24px';
    el.style.borderRadius = '0.5rem';
    el.style.color = '#fff';
    el.style.fontSize = '0.875rem';
    el.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    el.style.transition = 'opacity 0.2s, transform 0.2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-20px)';
    
    switch (type) {
      case 'success': el.style.backgroundColor = '#10b981'; break;
      case 'error': el.style.backgroundColor = '#ef4444'; break;
      case 'warning': el.style.backgroundColor = '#f59e0b'; break;
      case 'info': el.style.backgroundColor = '#3b82f6'; break;
    }

    el.textContent = message;
    this.container!.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      // Animate out
      el.style.opacity = '0';
      el.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (el.parentNode === this.container && this.container) {
          this.container.removeChild(el);
        }
      }, 200);
    }, duration);
  }

  success(msg: string, duration?: number) { this.show(msg, 'success', duration); }
  error(msg: string, duration?: number) { this.show(msg, 'error', duration); }
  info(msg: string, duration?: number) { this.show(msg, 'info', duration); }
  warning(msg: string, duration?: number) { this.show(msg, 'warning', duration); }
}

export const toast = new ToastManager();
