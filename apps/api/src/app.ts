import 'reflect-metadata';
import { MiddlewareConsumer, Module, type DynamicModule, type NestModule } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { AppConfig } from './config.js';
import type { Db } from './db/pool.js';
import { AllExceptionsFilter, RequestIdMiddleware } from './common/http.js';
import { HealthController } from './health/health.controller.js';
import { AccessGuard } from './identity/access.guard.js';
import { createAuth, type Auth } from './identity/auth.js';
import { InvitationsController } from './organizations/invitations.js';
import { MembersController } from './organizations/members.js';
import { AUTH, CONFIG, DB } from './tokens.js';
import { FEATURE_CONTROLLERS } from './features.js';

@Module({})
class AppModule implements NestModule {
  static register(config: AppConfig, db: Db, auth: Auth): DynamicModule {
    return {
      module: AppModule,
      global: true,
      controllers: [
        HealthController,
        MembersController,
        InvitationsController,
        ...FEATURE_CONTROLLERS,
      ],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: auth },
        { provide: APP_GUARD, useClass: AccessGuard },
      ],
      exports: [CONFIG, DB, AUTH],
    };
  }
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}

export const API_PREFIX = 'api/v1';

export async function createApp(config: AppConfig, db: Db): Promise<NestExpressApplication> {
  const auth = createAuth(config, db);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, db, auth),
    {
      logger: config.APP_ENV === 'test' ? false : ['error', 'warn'],
      bodyParser: false,
    },
  );
  app.set('trust proxy', 'loopback'); // confia apenas no proxy local (brief 11.3)
  app.disable('x-powered-by');
  const express = app.getHttpAdapter().getInstance();
  // Cadastro público bloqueado: contas só são criadas ao aceitar convite (ADR-0002).
  express.all('/api/auth/sign-up/*splat', (_req, res) => {
    res
      .status(404)
      .json({ code: 'NOT_FOUND', message: 'Cadastro somente por convite.', requestId: '-' });
  });
  // better-auth precisa do corpo bruto: montado ANTES do body parser.
  express.all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json', { limit: '100kb' });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
