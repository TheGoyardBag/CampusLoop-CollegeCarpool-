import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { CarpoolService } from '@campusloop/core';
import { PrismaStore } from './prisma-store';
import { loadConfig } from './config';
async function main() {
    const prisma = new PrismaClient();
    const service = new CarpoolService(new PrismaStore(prisma), loadConfig());
    const host = process.env.SMTP_HOST;
    if (!host)
        throw new Error('SMTP_HOST is required.');
    const mail = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT ?? 1025), secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.NODE_ENV === 'production', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined, disableFileAccess: true, disableUrlAccess: true });
    let stopping = false;
    process.on('SIGTERM', () => { stopping = true; });
    process.on('SIGINT', () => { stopping = true; });
    while (!stopping) {
        const item = await service.claimMail();
        if (!item) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }
        try {
            await mail.sendMail({ from: process.env.MAIL_FROM ?? 'CampusLoop <no-reply@campusloop.example>', to: item.to, subject: item.subject, text: item.body, messageId: `<${item.id}@campusloop.example>` });
            await service.finishMail(item.id, true);
        }
        catch {
            await service.finishMail(item.id, false);
            console.error('Mail delivery failed; retry scheduled. Message:', item.id);
        }
    }
    mail.close();
    await prisma.$disconnect();
}
main().catch(() => { console.error('Mail worker failed. Check SMTP/database configuration.'); process.exitCode = 1; });
