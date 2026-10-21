import { Controller, Get, Post, Patch, Delete, Req, Res, Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiRouter } from '@campusloop/core';
export const ROUTER = Symbol('CAMPUSLOOP_ROUTER');
@Injectable()
export class HttpGateway {
    constructor(
    @Inject(ROUTER)
    private router: ApiRouter) { }
    async respond(req: Request, res: Response) {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers))
            headers[k] = Array.isArray(v) ? v[0] : v;
        const result = await this.router.handle({ method: req.method, path: req.originalUrl, headers, body: req.body, ip: req.ip ?? req.socket.remoteAddress ?? 'unknown' });
        for (const [k, v] of Object.entries(result.headers))
            res.setHeader(k, v);
        if (typeof result.body === 'string')
            res.status(result.status).send(result.body);
        else
            res.status(result.status).json(result.body);
    }
}
@Controller('api')
export class ApiController {
    constructor(private readonly gateway: HttpGateway) { }
    @Get('health')
    route0(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('catalog')
    route1(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/register')
    route2(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/verify')
    route3(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/login')
    route4(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/logout')
    route5(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/request-reset')
    route6(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('auth/reset')
    route7(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('me')
    route8(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Patch('me')
    route9(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('summary')
    route10(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('courses')
    route11(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('courses')
    route12(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Delete('courses/:id')
    route13(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('vehicles')
    route14(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('vehicles')
    route15(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('matches')
    route16(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides')
    route17(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('rides/mine')
    route18(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('rides/:id')
    route19(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('bookings')
    route20(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('driver/requests')
    route21(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/bookings')
    route22(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('bookings/:id/approve')
    route23(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('bookings/:id/decline')
    route24(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('bookings/:id/cancel')
    route25(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/cancel')
    route26(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/complete')
    route27(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('rides/:id/messages')
    route28(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/messages')
    route29(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/report')
    route30(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('rides/:id/reviews')
    route31(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('rides/:id/reviews')
    route32(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('rides/:id/calendar.ics')
    route33(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('notifications')
    route34(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('notifications/:id/read')
    route35(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Get('admin/reports')
    route36(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
    @Post('admin/reports/:id/resolve')
    route37(
    @Req()
    req: Request, 
    @Res()
    res: Response) { return this.gateway.respond(req, res); }
}
