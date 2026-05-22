export const redactEmailUsername = (email: string): string => {
  const [username, domain] = email.split('@');
  const redactedUsername = username.replace(/.(?=.{2})/g, '*');
  return `${redactedUsername}@${domain}`;
};
