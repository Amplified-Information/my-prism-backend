// No-op debugger stub - all debugging functionality removed
export const useDebugger = (_component: string) => {
  return {
    debug: (..._args: any[]) => {},
    log: (..._args: any[]) => {},
    warn: (..._args: any[]) => {},
    error: (..._args: any[]) => {},
  };
};

export const appDebugger = {
  log: (..._args: any[]) => {},
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  getLogs: () => [],
  clearLogs: () => {},
  exportLogs: () => '[]',
};
