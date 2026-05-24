'use strict';

export const config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Backend API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  logging: {
    level: 'info',
  },

  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
    },
    local_decorating: {
      enabled: true,
    },
  },

  distributed_tracing: {
    enabled: true,
  },
};