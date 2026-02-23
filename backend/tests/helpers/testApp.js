/**
 * Хелпер для интеграционных тестов: создаёт Express-приложение с нужными роутами.
 * Используется, когда server.js пропускает роуты в режиме NODE_ENV=test.
 */
import express from 'express';
import cors from 'cors';

export async function createTestAppWithRoutes(routeMap) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  for (const [prefix, modulePath] of Object.entries(routeMap)) {
    const mod = await import(modulePath);
    const router = mod.default || mod;
    app.use(prefix, router);
  }

  return app;
}
