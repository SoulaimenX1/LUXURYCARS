import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  //
  // Endpoint léger utilisé par les outils de
  // supervision et de déploiement pour vérifier
  // que l'application répond.
  // ==========================================

  @Get('health')
  getHealth(): {
    status: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
