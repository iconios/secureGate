export const generatePaymentReference = () => {
  const prefix = 'SG';
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

  return `${prefix}-${timestamp}-${randomPart}`;
};
