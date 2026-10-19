import {AddChargeDto} from './dto/add-charge.dto.js';
import {Body,Controller,Get,Param,ParseUUIDPipe,Post,Req,Res,StreamableFile,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {Roles} from '../auth/decorators/roles.decorator.js';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard.js';
import {RolesGuard} from '../auth/guards/roles.guard.js';
import {UserRole} from '../users/entities/user.entity.js';
import {FinanceService} from './finance.service.js';
import {ManualPaymentDto} from './dto/manual-payment.dto.js';
import {DepositHoldDto,DepositSettleDto} from './dto/deposit.dto.js';
interface AuthorizedRequest{user:{id:string}}
type Doc='contract'|'invoice';
@Controller('finance/admin')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.ADMIN)
export class FinanceAdminController{
 constructor(private readonly service:FinanceService){}
 @Get(':rentalId') summary(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string){return this.service.summary(id);}
 @Post(':rentalId/payments') payment(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Req() req:AuthorizedRequest,@Body() body:ManualPaymentDto){return this.service.recordPayment(req.user.id,id,body);}
 @Post(':rentalId/deposit/hold') hold(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Req() req:AuthorizedRequest,@Body() body:DepositHoldDto){return this.service.holdDeposit(req.user.id,id,body);}
 @Post(':rentalId/deposit/settle') settle(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Req() req:AuthorizedRequest,@Body() body:DepositSettleDto){return this.service.settleDeposit(req.user.id,id,body);}
 @Post(':rentalId/charges') addCharge(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,
  @Req() req:AuthorizedRequest,@Body() body:AddChargeDto){return this.service.addCharge(req.user.id,id,body);}
 @Post(':rentalId/invoice') issue(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Req() req:AuthorizedRequest){return this.service.issueInvoice(req.user.id,id);}
 @Get(':rentalId/documents/contract') adminContract(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Res({passthrough:true}) res:Response){return this.pdf(id,'contract',res);}
 @Get(':rentalId/documents/invoice') adminInvoice(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Res({passthrough:true}) res:Response){return this.pdf(id,'invoice',res);}
 private async pdf(id:string,type:Doc,res:Response){
  const buffer=await this.service.document(id,type);
  res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Disposition',`attachment; filename="luxury-${type}-${id}.pdf"`);
  return new StreamableFile(buffer);
 }
}
@Controller('finance/me')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.CUSTOMER)
export class FinanceCustomerController{
 constructor(private readonly service:FinanceService){}
 @Get(':rentalId') summary(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Req() req:AuthorizedRequest){return this.service.summary(id,req.user.id);}
 @Get(':rentalId/documents/contract') contract(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Req() req:AuthorizedRequest,
  @Res({passthrough:true}) res:Response){return this.pdf(id,'contract',req.user.id,res);}
 @Get(':rentalId/documents/invoice') invoice(@Param('rentalId',new ParseUUIDPipe({version:'4'})) id:string,@Req() req:AuthorizedRequest,
  @Res({passthrough:true}) res:Response){return this.pdf(id,'invoice',req.user.id,res);}
 private async pdf(id:string,type:Doc,customerId:string,res:Response){
  const buffer=await this.service.document(id,type,customerId);
  res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Disposition',`attachment; filename="luxury-${type}-${id}.pdf"`);
  return new StreamableFile(buffer);
 }
}
