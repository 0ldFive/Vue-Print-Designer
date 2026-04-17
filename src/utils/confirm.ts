export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

class ConfirmManager {
  show(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = '2000'; // z-[2000]
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.pointerEvents = 'auto';

      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark');

      const dialog = document.createElement('div');
      dialog.style.backgroundColor = isDark ? '#111827' : '#ffffff'; // dark:bg-gray-900 / bg-white
      dialog.style.borderRadius = '0.5rem'; // rounded-lg
      dialog.style.width = '24rem'; // w-96 (384px)
      dialog.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'; // shadow-xl
      dialog.style.display = 'flex';
      dialog.style.flexDirection = 'column';
      dialog.style.overflow = 'hidden';
      dialog.style.fontFamily = 'inherit';

      // Header (matches Modal header height and border)
      const header = document.createElement('div');
      header.style.height = '60px';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.padding = '0 16px';
      header.style.borderBottom = `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`; // dark:border-gray-800 / border-gray-200
      header.style.flexShrink = '0';

      const titleEl = document.createElement('h3');
      titleEl.textContent = options.title || '提示';
      titleEl.style.margin = '0';
      titleEl.style.fontSize = '1.125rem'; // text-lg
      titleEl.style.fontWeight = '600'; // font-semibold
      titleEl.style.color = isDark ? '#f3f4f6' : '#1f2937'; // dark:text-gray-100 / text-gray-800
      header.appendChild(titleEl);
      dialog.appendChild(header);

      // Body
      const body = document.createElement('div');
      body.style.padding = '16px'; // p-4

      const msgEl = document.createElement('div');
      msgEl.textContent = message;
      msgEl.style.marginBottom = '16px'; // mb-4
      msgEl.style.fontSize = '0.875rem'; // text-sm
      msgEl.style.color = isDark ? '#d1d5db' : '#374151'; // dark:text-gray-300 / text-gray-700
      msgEl.style.lineHeight = '1.5';
      body.appendChild(msgEl);

      // Footer
      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'flex-end';
      footer.style.gap = '8px'; // gap-2

      // Cancel Button
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = options.cancelText || '取消';
      cancelBtn.style.padding = '8px 16px'; // px-4 py-2
      cancelBtn.style.fontSize = '0.875rem'; // text-sm
      cancelBtn.style.fontWeight = '500'; // font-medium
      cancelBtn.style.border = 'none';
      cancelBtn.style.borderRadius = '0.375rem'; // rounded-md
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.style.transition = 'background-color 0.15s ease';
      cancelBtn.style.backgroundColor = isDark ? '#1f2937' : '#f3f4f6'; // dark:bg-gray-800 / bg-gray-100
      cancelBtn.style.color = isDark ? '#d1d5db' : '#374151'; // dark:text-gray-300 / text-gray-700

      cancelBtn.onmouseover = () => { cancelBtn.style.backgroundColor = isDark ? '#374151' : '#e5e7eb'; }; // dark:hover:bg-gray-700 / hover:bg-gray-200
      cancelBtn.onmouseout = () => { cancelBtn.style.backgroundColor = isDark ? '#1f2937' : '#f3f4f6'; };

      // Confirm Button
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = options.confirmText || '确定';
      confirmBtn.style.padding = '8px 16px';
      confirmBtn.style.fontSize = '0.875rem';
      confirmBtn.style.fontWeight = '500';
      confirmBtn.style.border = 'none';
      confirmBtn.style.borderRadius = '0.375rem';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.style.transition = 'background-color 0.15s ease';
      confirmBtn.style.backgroundColor = isDark ? '#3b82f6' : '#2563eb'; // dark:bg-blue-500 / bg-blue-600
      confirmBtn.style.color = '#ffffff';

      confirmBtn.onmouseover = () => { confirmBtn.style.backgroundColor = isDark ? '#2563eb' : '#1d4ed8'; }; // dark:hover:bg-blue-600 / hover:bg-blue-700
      confirmBtn.onmouseout = () => { confirmBtn.style.backgroundColor = isDark ? '#3b82f6' : '#2563eb'; };

      const cleanup = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };

      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(false);
      };

      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(true);
      };

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      body.appendChild(msgEl);
      body.appendChild(footer);
      dialog.appendChild(body);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Focus confirm button by default for quick keyboard submission
      setTimeout(() => confirmBtn.focus(), 10);
    });
  }
}

export const uiConfirm = new ConfirmManager();
