import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { PremiumService } from './premium.service.js';
import { QuoteDto } from './dto/quote.dto.js';
import { CreateReviewDto } from './dto/review.dto.js';
import { CheckinDto } from './dto/checkin.dto.js';

interface CustomerRequest {user:{id:string}}
@Controller('premium')
export class PremiumController {
  constructor(private readonly premium:PremiumService) {}
  @Get('locations') locations(){return this.premium.publicLocations();}
  @Get('options') options(){return this.premium.publicOptions();}
  @Post('quote') quote(@Body() body:QuoteDto){return this.premium.quote(body);}
  @Get('reviews/:vehicleId') reviews(@Param('vehicleId',new ParseUUIDPipe({version:'4'})) vehicleId:string){return this.premium.reviews(vehicleId);}
  @Get('editorial-reviews/:vehicleId') editorialReviews(@Param('vehicleId',new ParseUUIDPipe({version:'4'})) vehicleId:string){return this.premium.editorialReviews(vehicleId);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Get('me/favorites') favorites(@Req() req:CustomerRequest){return this.premium.favorites(req.user.id);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Post('me/favorites/:vehicleId') favorite(@Req() req:CustomerRequest,@Param('vehicleId',new ParseUUIDPipe({version:'4'})) vehicleId:string){return this.premium.toggleFavorite(req.user.id,vehicleId);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Get('me/loyalty') loyalty(@Req() req:CustomerRequest){return this.premium.loyalty(req.user.id);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Get('me/reviewable') reviewable(@Req() req:CustomerRequest){return this.premium.reviewableReservations(req.user.id);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Post('me/reviews') review(@Req() req:CustomerRequest,@Body() body:CreateReviewDto){return this.premium.addReview(req.user.id,body);}
  @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.CUSTOMER)
  @Post('me/checkin/:number') checkin(@Req() req:CustomerRequest,@Param('number') number:string,@Body() body:CheckinDto){return this.premium.checkin(req.user.id,number,body.notes);}
}
