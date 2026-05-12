export const successResponseHelper = (message: string, data: any = null) => {
  const now = new Date();

  return {
    success: true,
    message,
    data,
    error: null,
    metadata: {
      timestamp: now.toISOString(),
    },
  };
};
