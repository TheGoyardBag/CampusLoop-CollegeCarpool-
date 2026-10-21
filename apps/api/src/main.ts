import 'reflect-metadata';
import { Module, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import { ApiRouter, CarpoolService } from '@campusloop/core';
import { PrismaStore } from './prisma-store';
import { ApiController, HttpGateway, ROUTER } from './controller';
import { loadConfig } from './config';
const prisma = new PrismaClient();
@Module({ controllers: [ApiController], providers: [HttpGateway, { provide: ROUTER, useFactory: () => new ApiRouter(new CarpoolService(new PrismaStore(prisma), loadConfig())) }] })
class AppModule {
}
async function main() {
    await prisma.$connect();
    const app = await NestFactory.create(AppModule, { bodyParser: false });
    const express = await import('express');
    app.use(express.json({ limit: '32kb', strict: true }));
    app.use(helmet());
    // Do not trust arbitrary X-Forwarded-For. Configure only an audited proxy hop count.
    const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
    if (Number.isInteger(hops) && hops > 0 && hops <= 3)
        app.getHttpAdapter().getInstance().set('trust proxy', hops);
    app.enableShutdownHooks();
    const close = () => { void prisma.$disconnect(); };
    process.on('SIGTERM', close);
    process.on('SIGINT', close);
    await app.listen(Number(process.env.API_PORT ?? 4000), process.env.API_HOST ?? '127.0.0.1');
    Logger.log('CampusLoop API ready. Browser traffic should use the same-origin Next.js proxy.');
}
main().catch(() => { console.error('Startup failed: check configuration and PostgreSQL connectivity.'); void prisma.$disconnect(); process.exitCode = 1; });
