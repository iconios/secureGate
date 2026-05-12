import dotenv from 'dotenv';
dotenv.config();

export const errorResponseHelper = (
  errorMessage: string,
  errorCode: string,
  errorDetails: string,
  error: any | undefined = undefined,
) => {
  const isDev = process.env.NODE_ENV === 'development';
  const now = new Date();
  return {
    success: false,
    message: errorMessage,
    data: {},
    error: {
      code: errorCode,
      details: isDev ? (error?.message ?? errorDetails) : errorDetails,
    },
    metadata: {
      timestamp: now.toISOString(),
    },
  };
};
