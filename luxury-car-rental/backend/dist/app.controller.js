function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
export class AppController {
    getHello() {
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
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString()
        };
    }
    constructor(appService){
        this.appService = appService;
    }
}
_ts_decorate([
    Get(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
_ts_decorate([
    Get('health'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Object)
], AppController.prototype, "getHealth", null);
AppController = _ts_decorate([
    Controller(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AppService === "undefined" ? Object : AppService
    ])
], AppController);

//# sourceMappingURL=app.controller.js.map