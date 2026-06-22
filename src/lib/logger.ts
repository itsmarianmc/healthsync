export const logger = {
  error: (message: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(message, error);
    } else {
      console.error(message);
      // In production, consider sending to external logging service
    }
  },
  warn: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(message);
    }
  },
  log: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(message);
    }
  }
};