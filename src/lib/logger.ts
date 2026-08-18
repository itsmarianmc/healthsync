export const logger = {
  error: (message: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      if (error) {
        console.error(`${message}:`, String(error));
      } else {
        console.error(message);
      }
    } else {
      console.error(message);
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