export interface AppConfig {
  port: number;
  mongoUri: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  refreshCookieName: string;
  corsOrigins: string[];
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    mongoUri:
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/mini_ecommerce',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'refresh_token',
    corsOrigins: [process.env.CLIENT_ORIGIN, process.env.ADMIN_ORIGIN].filter(
      (origin): origin is string => Boolean(origin),
    ),
  },
});
