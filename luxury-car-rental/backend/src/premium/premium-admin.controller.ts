import {Body,Controller,Delete,Get,Param,ParseUUIDPipe,Post,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard.js';
import {RolesGuard} from '../auth/guards/roles.guard.js';
import {Roles} from '../auth/decorators/roles.decorator.js';
import {UserRole} from '../users/entities/user.entity.js';
import {PremiumService} from './premium.service.js';
import {LocationDto} from './dto/location.dto.js';
import {AdminExtraDto} from './dto/admin-extra.dto.js';
import {AdminPromotionDto} from './dto/admin-promotion.dto.js';
@Controller('premium/admin')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.ADMIN)
export class PremiumAdminController {
 constructor(private readonly premium:PremiumService){}
 @Get('locations') locations(){return this.premium.allLocations();}
 @Post('locations') upsertLocation(@Body() body:LocationDto){return this.premium.manageLocation(body);}
 @Delete('locations/:id') deleteLocation(@Param('id',new ParseUUIDPipe()) id:string){return this.premium.deleteLocation(id);}
 @Get('extras') extras(){return this.premium.allExtras();}
 @Post('extras') upsertExtra(@Body() body:AdminExtraDto){return this.premium.manageExtra(body);}
 @Delete('extras/:id') deleteExtra(@Param('id',new ParseUUIDPipe()) id:string){return this.premium.deleteExtra(id);}
 @Get('promotions') promotions(){return this.premium.allPromotions();}
 @Post('promotions') upsertPromo(@Body() body:AdminPromotionDto){return this.premium.managePromotion(body);}
 @Delete('promotions/:code') deletePromo(@Param('code') code:string){return this.premium.deletePromotion(code);}
}
