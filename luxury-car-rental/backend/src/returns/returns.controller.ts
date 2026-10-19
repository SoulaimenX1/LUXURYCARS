import {FileInterceptor} from '@nestjs/platform-express';
import type {Response} from 'express';
import type {PrivateUpload} from './private-photos.js';
import {Body,Controller,Get,Param,ParseUUIDPipe,Post,Put,Req,UseGuards,UploadedFile,UseInterceptors,Res,StreamableFile} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard.js';
import {RolesGuard} from '../auth/guards/roles.guard.js';
import {Roles} from '../auth/decorators/roles.decorator.js';
import {UserRole} from '../users/entities/user.entity.js';
import {ReturnsService} from './returns.service.js';
import {ReturnRentalDto} from './dto/return-rental.dto.js';
import {FeePolicyDto} from './dto/fee-policy.dto.js';
@Controller('returns/admin')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.ADMIN)
export class ReturnsController{
 constructor(private readonly service:ReturnsService){}
 @Get('policy') policy(){return this.service.getPolicy();}
 @Get(':rentalId/damages') damages(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string){return this.service.damages(id);}
 @Post('damages/:damageId/photo') @UseInterceptors(FileInterceptor('photo',{limits:{fileSize:5*1024*1024}}))
 upload(@Param('damageId',new ParseUUIDPipe({version:'4'})) id:string,@UploadedFile() file:PrivateUpload){return this.service.uploadDamagePhoto(id,file);}
 @Get('damages/:damageId/photo')
 async photo(@Param('damageId',new ParseUUIDPipe({version:'4'})) id:string,@Res({passthrough:true}) res:Response){
  const output=await this.service.damagePhoto(id);
  res.setHeader('Content-Type',output.mime);res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Content-Disposition','inline; filename="inspection-photo"');
  return new StreamableFile(output.content);
 }

 @Put('policy') setPolicy(@Body() dto:FeePolicyDto){return this.service.updatePolicy(dto);}
 @Post(':rentalId/return') returnRental(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Body() body:ReturnRentalDto,@Req() req:{user:{id:string}}){return this.service.registerReturn(req.user.id,id,body);}
 @Post(':rentalId/close') closeRental(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Req() req:{user:{id:string}}){return this.service.close(req.user.id,id);}
}
