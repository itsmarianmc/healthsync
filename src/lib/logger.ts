export const logger = {
  error: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(message);
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
