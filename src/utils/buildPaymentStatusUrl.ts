export const buildPaymentStatusUrl = (
  frontendUrl: string,
  status: 'success' | 'failed' | 'pending',
  reason?: string,
  reference?: string,
) => {
  const url = new URL('/payment/status', frontendUrl);

  url.searchParams.set('status', status);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  if (reference) {
    url.searchParams.set('reference', reference);
  }

  return url.toString();
};
