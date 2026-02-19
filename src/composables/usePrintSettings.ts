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
}

export interface LocalPrinterInfo {
  name: string;
  isDefault?: boolean;
}

export interface RemotePrinterInfo {
  printer_name: string;
  printer_type?: string;
  paper_spec?: string;
  is_ready?: boolean;
  supported_format?: string;
}

export interface RemoteClientInfo {
  client_id: string;
  client_name?: string;
  online?: boolean;
  last_heartbeat?: string;
}

export interface LocalPrinterCaps {
  paperSizes?: string[];
  printerPaperNames?: string[];
  duplexSupported?: boolean;
  colorSupported?: boolean;
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
  localPrinters: ReturnType<typeof ref<LocalPrinterInfo[]>>;
  remotePrinters: ReturnType<typeof ref<RemotePrinterInfo[]>>;
  remoteClients: ReturnType<typeof ref<RemoteClientInfo[]>>;
  remoteSelectedClientId: ReturnType<typeof ref<string>>;
  localPrinterCaps: Record<string, LocalPrinterCaps | undefined>;
  fetchLocalPrinters: () => Promise<LocalPrinterInfo[]>;
  fetchRemoteClients: () => Promise<RemoteClientInfo[]>;
  fetchRemotePrinters: (clientId?: string) => Promise<RemotePrinterInfo[]>;
  fetchLocalPrinterCaps: (printer: string) => Promise<LocalPrinterCaps | undefined>;
  connectLocal: () => Promise<void>;
  disconnectLocal: () => void;
  connectRemote: () => Promise<void>;
  disconnectRemote: () => void;
}

const storageKeys = {
  printMode: 'print-designer-print-mode',
  preferredPrintMode: 'print-designer-preferred-print-mode',
  silentPrint: 'print-designer-silent-print',
  localSettings: 'print-designer-local-settings',
  remoteSettings: 'print-designer-remote-settings',
  localPrintOptions: 'print-designer-local-print-options',
  remotePrintOptions: 'print-designer-remote-print-options',
  remoteAuthToken: 'print-designer-remote-auth-token',
  remoteSelectedClientId: 'print-designer-remote-selected-client-id'
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
  apiBaseUrl: '/api',
  username: '',
  password: ''
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

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

type MessageWaiter = {
  match: (data: any) => boolean;
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

const waitForWsMessage = <T>(
  url: string,
  initMessage: Record<string, any> | null,
  isTarget: (data: any) => data is T,
  timeoutMs = 5000
) => new Promise<T>((resolve, reject) => {
  let settled = false;
  const socket = new WebSocket(url);
  const timeoutId = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    socket.close();
    reject(new Error('WebSocket timeout'));
  }, timeoutMs);

  socket.onopen = () => {
    if (initMessage) {
      socket.send(JSON.stringify(initMessage));
    }
  };

  socket.onmessage = (event) => {
    if (settled) return;
    try {
      const data = JSON.parse(event.data);
      if (isTarget(data)) {
        settled = true;
        window.clearTimeout(timeoutId);
        socket.close();
        resolve(data);
      }
    } catch (error) {
      settled = true;
      window.clearTimeout(timeoutId);
      socket.close();
      reject(error instanceof Error ? error : new Error('WebSocket parse error'));
    }
  };

  socket.onerror = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    socket.close();
    reject(new Error('WebSocket error'));
  };
});

let state: PrintSettingsState | null = null;

const createState = (): PrintSettingsState => {
  const storedPreferred = localStorage.getItem(storageKeys.preferredPrintMode) as PrintMode | null;
  const printMode = ref<PrintMode>(storedPreferred || (localStorage.getItem(storageKeys.printMode) as PrintMode) || 'browser');
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
  const remoteSelectedClientId = ref(localStorage.getItem(storageKeys.remoteSelectedClientId) || '');

  const localPrinters = ref<LocalPrinterInfo[]>([]);
  const remotePrinters = ref<RemotePrinterInfo[]>([]);
  const remoteClients = ref<RemoteClientInfo[]>([]);
  const localPrinterCaps = reactive<Record<string, LocalPrinterCaps | undefined>>({});

  const localSocket = ref<WebSocket | null>(null);
  const remoteSocket = ref<WebSocket | null>(null);
  const localWaiters: MessageWaiter[] = [];
  const remoteWaiters: MessageWaiter[] = [];
  let localConnectPromise: Promise<void> | null = null;
  let remoteConnectPromise: Promise<void> | null = null;
  const localRetryCount = ref(0);
  const remoteRetryCount = ref(0);
  const localRetryTimer = ref<number | null>(null);
  const remoteRetryTimer = ref<number | null>(null);
  const localManualDisconnect = ref(false);
  const remoteManualDisconnect = ref(false);
  const retryIntervalMs = 3000;
  const maxRetries = 10;

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
    if (value !== 'browser') {
      localStorage.setItem(storageKeys.preferredPrintMode, value);
    }
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

  watch(remoteSelectedClientId, (value) => {
    localStorage.setItem(storageKeys.remoteSelectedClientId, value);
  });

  const applyPreferredIfConnected = () => {
    const preferred = localStorage.getItem(storageKeys.preferredPrintMode) as PrintMode | null;
    if (!preferred || preferred === 'browser') return;
    if (printMode.value !== 'browser') return;

    if (preferred === 'local' && localStatus.value === 'connected') {
      printMode.value = 'local';
    }
    if (preferred === 'remote' && remoteStatus.value === 'connected') {
      printMode.value = 'remote';
    }
  };

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

  watch([localStatus, remoteStatus], () => {
    ensureValidPrintMode();
    applyPreferredIfConnected();
  }, { immediate: true });

  const resolveWaiters = (waiters: MessageWaiter[], data: any) => {
    waiters.slice().forEach((waiter) => {
      if (waiter.match(data)) {
        window.clearTimeout(waiter.timeoutId);
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(data);
      }
    });
  };

  const rejectAllWaiters = (waiters: MessageWaiter[], error: Error) => {
    waiters.slice().forEach((waiter) => {
      window.clearTimeout(waiter.timeoutId);
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.reject(error);
    });
  };

  const clearLocalRetry = () => {
    if (localRetryTimer.value) {
      window.clearTimeout(localRetryTimer.value);
      localRetryTimer.value = null;
    }
    localRetryCount.value = 0;
  };

  const clearRemoteRetry = () => {
    if (remoteRetryTimer.value) {
      window.clearTimeout(remoteRetryTimer.value);
      remoteRetryTimer.value = null;
    }
    remoteRetryCount.value = 0;
  };

  const scheduleLocalReconnect = () => {
    if (localManualDisconnect.value) return;
    if (localRetryTimer.value) return;
    if (localRetryCount.value >= maxRetries) {
      localStatus.value = 'error';
      localStatusMessage.value = 'Local connection failed';
      return;
    }
    localRetryCount.value += 1;
    localStatus.value = 'connecting';
    localRetryTimer.value = window.setTimeout(() => {
      localRetryTimer.value = null;
      connectLocal();
    }, retryIntervalMs);
  };

  const scheduleRemoteReconnect = () => {
    if (remoteManualDisconnect.value) return;
    if (remoteRetryTimer.value) return;
    if (remoteRetryCount.value >= maxRetries) {
      remoteStatus.value = 'error';
      remoteStatusMessage.value = 'Remote connection failed';
      return;
    }
    remoteRetryCount.value += 1;
    remoteStatus.value = 'connecting';
    remoteRetryTimer.value = window.setTimeout(() => {
      remoteRetryTimer.value = null;
      connectRemote();
    }, retryIntervalMs);
  };

  const sendWithWait = <T>(
    socketRef: typeof localSocket,
    waiters: MessageWaiter[],
    payload: Record<string, any>,
    match: (data: any) => data is T,
    timeoutMs = 5000
  ) => new Promise<T>((resolve, reject) => {
    const socket = socketRef.value;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const idx = waiters.findIndex(w => w.resolve === resolve);
      if (idx >= 0) waiters.splice(idx, 1);
      reject(new Error('WebSocket timeout'));
    }, timeoutMs);

    waiters.push({ match, resolve, reject, timeoutId });
    socket.send(JSON.stringify(payload));
  });

  const attachLocalHandlers = (socket: WebSocket) => {
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'printer_list') {
          localPrinters.value = Array.isArray(data.data) ? data.data : [];
        }
        if (data?.type === 'printer_caps' && data.printer) {
          localPrinterCaps[data.printer] = data?.data || {};
        }
        resolveWaiters(localWaiters, data);
      } catch (error) {
        rejectAllWaiters(localWaiters, error as Error);
      }
    };

    socket.onclose = () => {
      localSocket.value = null;
      if (localStatus.value !== 'error') {
        localStatus.value = 'disconnected';
      }
      rejectAllWaiters(localWaiters, new Error('WebSocket closed'));
      scheduleLocalReconnect();
    };

    socket.onerror = () => {
      localStatus.value = 'error';
      localStatusMessage.value = 'Local connection failed';
      rejectAllWaiters(localWaiters, new Error('WebSocket error'));
      scheduleLocalReconnect();
    };
  };

  const attachRemoteHandlers = (socket: WebSocket) => {
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.cmd === 'clients_list') {
          remoteClients.value = Array.isArray(data.clients) ? data.clients : [];
          if (remoteClients.value.length > 0) {
            const exists = remoteClients.value.some(c => c.client_id === remoteSelectedClientId.value);
            if (!exists) {
              const onlineClient = remoteClients.value.find(c => c.online) || remoteClients.value[0];
              remoteSelectedClientId.value = onlineClient?.client_id || '';
            }
          } else {
            remoteSelectedClientId.value = '';
          }
        }
        if (data?.cmd === 'printers_list') {
          remotePrinters.value = Array.isArray(data.printers) ? data.printers : [];
        }
        resolveWaiters(remoteWaiters, data);
      } catch (error) {
        rejectAllWaiters(remoteWaiters, error as Error);
      }
    };

    socket.onclose = () => {
      remoteSocket.value = null;
      if (remoteStatus.value !== 'error') {
        remoteStatus.value = 'disconnected';
      }
      rejectAllWaiters(remoteWaiters, new Error('WebSocket closed'));
      scheduleRemoteReconnect();
    };

    socket.onerror = () => {
      remoteStatus.value = 'error';
      remoteStatusMessage.value = 'Remote connection failed';
      rejectAllWaiters(remoteWaiters, new Error('WebSocket error'));
      scheduleRemoteReconnect();
    };
  };

  const connectLocal = async () => {
    if (localConnectPromise) return localConnectPromise;
    if (localSocket.value && localSocket.value.readyState === WebSocket.OPEN) {
      localStatus.value = 'connected';
      return Promise.resolve();
    }

    localManualDisconnect.value = false;
    localStatus.value = 'connecting';
    localStatusMessage.value = '';

    const socket = new WebSocket(localWsUrl.value);
    localSocket.value = socket;
    attachLocalHandlers(socket);

    localConnectPromise = new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => {
        localStatus.value = 'connected';
        clearLocalRetry();
        localConnectPromise = null;
        socket.send(JSON.stringify({ type: 'get_printers' }));
        resolve();
      });
      socket.addEventListener('error', () => {
        localStatus.value = 'error';
        localStatusMessage.value = 'Local connection failed';
        localConnectPromise = null;
        scheduleLocalReconnect();
        reject(new Error('WebSocket error'));
      });
    });

    return localConnectPromise;
  };

  const disconnectLocal = () => {
    localManualDisconnect.value = true;
    clearLocalRetry();
    if (localSocket.value) {
      localSocket.value.close();
    }
    localSocket.value = null;
    localStatus.value = 'disconnected';
    localStatusMessage.value = '';
  };

  const connectRemote = async () => {
    if (remoteConnectPromise) return remoteConnectPromise;
    if (remoteSocket.value && remoteSocket.value.readyState === WebSocket.OPEN) {
      remoteStatus.value = 'connected';
      return Promise.resolve();
    }

    remoteManualDisconnect.value = false;
    remoteStatus.value = 'connecting';
    remoteStatusMessage.value = '';

    remoteConnectPromise = (async () => {
      try {
        if (!remoteSettings.apiBaseUrl || !remoteSettings.username || !remoteSettings.password) {
          remoteStatus.value = 'error';
          remoteStatusMessage.value = 'Missing remote connection fields';
          return;
        }

        const baseUrl = normalizeBaseUrl(remoteSettings.apiBaseUrl);
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: remoteSettings.username,
            password: remoteSettings.password
          })
        });

        if (!loginResponse.ok) {
          const msg = await loginResponse.text();
          throw new Error(msg || `HTTP ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        if (!loginData?.token) {
          throw new Error('Missing auth token');
        }

        remoteAuthToken.value = loginData.token;

        const socket = new WebSocket(remoteWsUrl.value);
        remoteSocket.value = socket;
        attachRemoteHandlers(socket);

        await new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => {
            remoteStatus.value = 'connected';
            clearRemoteRetry();
            socket.send(JSON.stringify({ cmd: 'get_clients' }));
            resolve();
          });
          socket.addEventListener('error', () => {
            remoteStatus.value = 'error';
            remoteStatusMessage.value = 'Remote connection failed';
            scheduleRemoteReconnect();
            reject(new Error('WebSocket error'));
          });
        });
      } catch (error) {
        remoteStatus.value = 'error';
        remoteStatusMessage.value = (error as Error).message || 'Remote connection failed';
        scheduleRemoteReconnect();
      } finally {
        remoteConnectPromise = null;
      }
    })();

    return remoteConnectPromise;
  };

  const disconnectRemote = () => {
    remoteManualDisconnect.value = true;
    clearRemoteRetry();
    if (remoteSocket.value) {
      remoteSocket.value.close();
    }
    remoteSocket.value = null;
    remoteStatus.value = 'disconnected';
    remoteStatusMessage.value = '';
  };

  const fetchLocalPrinters = async () => {
    await connectLocal();
    const data = await sendWithWait<{ type: 'printer_list'; data: LocalPrinterInfo[] }>(
      localSocket,
      localWaiters,
      { type: 'get_printers' },
      (msg): msg is { type: 'printer_list'; data: LocalPrinterInfo[] } => msg?.type === 'printer_list'
    );
    localPrinters.value = Array.isArray(data.data) ? data.data : [];
    return localPrinters.value;
  };

  const fetchLocalPrinterCaps = async (printer: string) => {
    if (!printer) return undefined;
    if (localPrinterCaps[printer]) return localPrinterCaps[printer];

    await connectLocal();
    const data = await sendWithWait<{ type: 'printer_caps'; printer: string; data: LocalPrinterCaps }>(
      localSocket,
      localWaiters,
      { type: 'get_printer_caps', printer },
      (msg): msg is { type: 'printer_caps'; printer: string; data: LocalPrinterCaps } => msg?.type === 'printer_caps'
    );

    localPrinterCaps[printer] = data?.data || {};
    return localPrinterCaps[printer];
  };

  const fetchRemoteClients = async () => {
    await connectRemote();
    const data = await sendWithWait<{ cmd: 'clients_list'; clients: RemoteClientInfo[] }>(
      remoteSocket,
      remoteWaiters,
      { cmd: 'get_clients' },
      (msg): msg is { cmd: 'clients_list'; clients: RemoteClientInfo[] } => msg?.cmd === 'clients_list'
    );

    remoteClients.value = Array.isArray(data.clients) ? data.clients : [];
    if (remoteClients.value.length > 0) {
      const exists = remoteClients.value.some(c => c.client_id === remoteSelectedClientId.value);
      if (!exists) {
        const onlineClient = remoteClients.value.find(c => c.online) || remoteClients.value[0];
        remoteSelectedClientId.value = onlineClient?.client_id || '';
      }
    } else {
      remoteSelectedClientId.value = '';
    }
    return remoteClients.value;
  };

  const fetchRemotePrinters = async (clientId?: string) => {
    const targetClientId = clientId || remoteSelectedClientId.value;
    if (!targetClientId) {
      remotePrinters.value = [];
      return remotePrinters.value;
    }

    await connectRemote();
    const data = await sendWithWait<{ cmd: 'printers_list'; printers: RemotePrinterInfo[] }>(
      remoteSocket,
      remoteWaiters,
      { cmd: 'get_printers', client_id: targetClientId },
      (msg): msg is { cmd: 'printers_list'; printers: RemotePrinterInfo[] } => msg?.cmd === 'printers_list'
    );

    remotePrinters.value = Array.isArray(data.printers) ? data.printers : [];
    return remotePrinters.value;
  };

  const autoConnectIfReady = () => {
    const hasLocalConfig = Boolean(localSettings.host && localSettings.port);
    const hasRemoteConfig = Boolean(remoteSettings.apiBaseUrl && remoteSettings.username && remoteSettings.password);

    if (hasLocalConfig) {
      connectLocal();
    }
    if (hasRemoteConfig) {
      connectRemote();
    }
  };

  autoConnectIfReady();

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
    remoteAuthToken,
    localPrinters,
    remotePrinters,
    remoteClients,
    remoteSelectedClientId,
    localPrinterCaps,
    fetchLocalPrinters,
    fetchRemoteClients,
    fetchRemotePrinters,
    fetchLocalPrinterCaps,
    connectLocal,
    disconnectLocal,
    connectRemote,
    disconnectRemote
  };
};

export const usePrintSettings = (): PrintSettingsState => {
  if (!state) {
    state = createState();
  }
  return state;
};
