export const maskPhone = (phone: string): string => {
  return phone.replace(/.(?=.{4})/g, '*');
};
