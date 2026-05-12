const cooldownMinutes = 2;
const windowMinutes = 60;
const maxSendsPerWindow = 5;
const tokenExpiryMinutes = 30;

export const userAccountSettings = () => {
  return {
    cooldownMinutes,
    windowMinutes,
    maxSendsPerWindow,
    tokenExpiryMinutes,
  };
};
