const cooldownMinutes = 2;
const windowMinutes = 60;
const maxSendsPerWindow = 5;
const codeExpiryMinutes = 30;

export const userAccountSettings = () => {
  return {
    cooldownMinutes,
    windowMinutes,
    maxSendsPerWindow,
    codeExpiryMinutes,
  };
};
