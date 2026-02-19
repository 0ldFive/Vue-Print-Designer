import { computed, reactive, ref, watch } from 'vue';

export type PrintMode = 'browser' | 'local' | 'remote';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrintOptions {
  printer: string;
  jobName: string;
  copies: number;
  intervalMs: number;
  pageRange: string;
  pageSet: '' | 'odd' | 'even';
  scale: '' | 'noscale' | 'shrink' | 'fit';
  orientation: '' | 'portrait' | 'landscape';
  colorMode: '' | 'color' | 'monochrome';
  sidesMode: '' | 'simplex' | 'duplex' | 'duplexshort' | 'duplexlong';
  paperSize: string;
  trayBin: string;
  sumatraSettings: string;
}

export interface LocalConnectionSettings {
  host: string;
  port: string;
  path: string;
  protocol: 'ws' | 'wss';
  secretKey: string;
}

export interface RemoteConnectionSettings {
  host: string;
  wsPort: string;
  wsPath: string;
  wsProtocol: 'ws' | 'wss';
  apiBaseUrl: string;
  username: string;
  password: string;
  clientId: string;
  clientKey: string;
}

interface PrintSettingsState {
  printMode: ReturnType<typeof ref<PrintMode>>;
  silentPrint: ReturnType<typeof ref<boolean>>;
  localSettings: LocalConnectionSettings;
  remoteSettings: RemoteConnectionSettings;
  localStatus: ReturnType<typeof ref<ConnectionStatus>>;
  remoteStatus: ReturnType<typeof ref<ConnectionStatus>>;
  localStatusMessage: ReturnType<typeof ref<string>>;
  remoteStatusMessage: ReturnType<typeof ref<string>>;
  localPrintOptions: PrintOptions;
  remotePrintOptions: PrintOptions;
  localWsUrl: ReturnType<typeof computed<string>>;
  remoteWsUrl: ReturnType<typeof computed<string>>;
  remoteAuthToken: ReturnType<typeof ref<string>>;
}

const storageKeys = {
  printMode: 'print-designer-print-mode',
  silentPrint: 'print-designer-silent-print',
  localSettings: 'print-designer-local-settings',
  remoteSettings: 'print-designer-remote-settings',
  localPrintOptions: 'print-designer-local-print-options',
  remotePrintOptions: 'print-designer-remote-print-options',
  remoteAuthToken: 'print-designer-remote-auth-token'
};

const defaultLocalSettings: LocalConnectionSettings = {
  host: 'localhost',
  port: '1122',
  path: '/ws',
  protocol: 'ws',
  secretKey: ''
};

const defaultRemoteSettings: RemoteConnectionSettings = {
  host: 'localhost',
  wsPort: '1122',
  wsPath: '/ws/request',
  wsProtocol: 'ws',
  apiBaseUrl: 'http://localhost:8080',
  username: '',
  password: '',
  clientId: '',
  clientKey: ''
};

const defaultPrintOptions: PrintOptions = {
  printer: '',
  jobName: '',
  copies: 1,
  intervalMs: 0,
  pageRange: '',
  pageSet: '',
  scale: 'fit',
  orientation: 'portrait',
  colorMode: 'color',
  sidesMode: 'simplex',
  paperSize: '',
  trayBin: '',
  sumatraSettings: ''
};

const loadJson = <T>(key: string, fallback: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(stored) as T) } as T;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const buildWsUrl = (protocol: string, host: string, port: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const portPart = port ? `:${port}` : '';
  return `${protocol}://${host}${portPart}${normalizedPath}`;
};

const appendQueryParam = (url: string, key: string, value: string) => {
  if (!value) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
};

let state: PrintSettingsState | null = null;

const createState = (): PrintSettingsState => {
  const printMode = ref<PrintMode>((localStorage.getItem(storageKeys.printMode) as PrintMode) || 'browser');
  const silentPrint = ref(localStorage.getItem(storageKeys.silentPrint) === 'true');

  const localSettings = reactive(loadJson(storageKeys.localSettings, defaultLocalSettings));
  const remoteSettings = reactive(loadJson(storageKeys.remoteSettings, defaultRemoteSettings));

  const localStatus = ref<ConnectionStatus>('disconnected');
  const remoteStatus = ref<ConnectionStatus>('disconnected');
  const localStatusMessage = ref('');
  const remoteStatusMessage = ref('');

  const localPrintOptions = reactive(loadJson(storageKeys.localPrintOptions, defaultPrintOptions));
  const remotePrintOptions = reactive(loadJson(storageKeys.remotePrintOptions, defaultPrintOptions));

  const remoteAuthToken = ref(localStorage.getItem(storageKeys.remoteAuthToken) || '');

  const localWsUrl = computed(() => {
    const base = buildWsUrl(localSettings.protocol, localSettings.host, localSettings.port, localSettings.path);
    return appendQueryParam(base, 'key', localSettings.secretKey.trim());
  });

  const remoteWsUrl = computed(() => {
    const base = buildWsUrl(remoteSettings.wsProtocol, remoteSettings.host, remoteSettings.wsPort, remoteSettings.wsPath);
    return appendQueryParam(base, 'token', remoteAuthToken.value.trim());
  });

  watch(printMode, (value) => {
    localStorage.setItem(storageKeys.printMode, value);
  });

  watch(silentPrint, (value) => {
    localStorage.setItem(storageKeys.silentPrint, String(value));
  });

  watch(localSettings, (value) => {
    saveJson(storageKeys.localSettings, value);
    localStatus.value = 'disconnected';
    localStatusMessage.value = '';
  }, { deep: true });

  watch(remoteSettings, (value) => {
    saveJson(storageKeys.remoteSettings, value);
    remoteStatus.value = 'disconnected';
    remoteStatusMessage.value = '';
  }, { deep: true });

  watch(localPrintOptions, (value) => {
    saveJson(storageKeys.localPrintOptions, value);
  }, { deep: true });

  watch(remotePrintOptions, (value) => {
    saveJson(storageKeys.remotePrintOptions, value);
  }, { deep: true });

  watch(remoteAuthToken, (value) => {
    localStorage.setItem(storageKeys.remoteAuthToken, value);
  });

  const ensureValidPrintMode = () => {
    const localOk = localStatus.value === 'connected';
    const remoteOk = remoteStatus.value === 'connected';

    if (printMode.value === 'local' && !localOk) {
      printMode.value = 'browser';
      return;
    }

    if (printMode.value === 'remote' && !remoteOk) {
      printMode.value = 'browser';
      return;
    }

    if (!localOk && !remoteOk) {
      printMode.value = 'browser';
    }
  };

  watch([localStatus, remoteStatus], ensureValidPrintMode, { immediate: true });

  return {
    printMode,
    silentPrint,
    localSettings,
    remoteSettings,
    localStatus,
    remoteStatus,
    localStatusMessage,
    remoteStatusMessage,
    localPrintOptions,
    remotePrintOptions,
    localWsUrl,
    remoteWsUrl,
    remoteAuthToken
  };
};

export const usePrintSettings = (): PrintSettingsState => {
  if (!state) {
    state = createState();
  }
  return state;
};
