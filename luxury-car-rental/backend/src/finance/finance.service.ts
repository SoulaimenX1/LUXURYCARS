import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DataSource,EntityManager} from 'typeorm';
import {createLuxuryPdf} from './luxury-pdf.js';
import type {ManualPaymentDto} from './dto/manual-payment.dto.js';
import type {DepositHoldDto,DepositSettleDto} from './dto/deposit.dto.js';

type RentalInfo={id:string;status:string;customerId:string;reservationNumber:string;contractNumber:string;
 totalAmount:string;depositAmount:string;vehicleName:string;customerName:string;pickupAt:Date;returnAt:Date};
@Injectable()
export class FinanceService {
 constructor(private readonly dataSource:DataSource){}
 private async rental(db:DataSource|EntityManager,id:string,customerId?:string,lock=false):Promise<RentalInfo>{
  const rows:RentalInfo[]=await db.query(`SELECT l.id,l.status,l.contract_number AS "contractNumber",
   r.customer_id AS "customerId",r.reservation_number AS "reservationNumber",
   r.total_amount AS "totalAmount",r.deposit_amount AS "depositAmount",
   CONCAT(b.name,' ',m.name) AS "vehicleName",CONCAT(u.first_name,' ',u.last_name) AS "customerName",
   r.pickup_at AS "pickupAt",r.return_at AS "returnAt"
   FROM rentals l JOIN reservations r ON r.id=l.reservation_id
   JOIN users u ON u.id=r.customer_id JOIN vehicles v ON v.id=r.vehicle_id
   JOIN vehicle_models m ON m.id=v.model_id JOIN brands b ON b.id=m.brand_id
   WHERE l.id=$1::uuid${customerId?' AND r.customer_id=$2::uuid':''}${lock?' FOR UPDATE OF l':''}`,
   customerId?[id,customerId]:[id]);
  if(!rows[0]) throw new NotFoundException('Rental not found');
  return rows[0];
 }
 async summary(rentalId:string,customerId?:string){
  const rental=await this.rental(this.dataSource,rentalId,customerId);
  const [payments,charges,deposit,invoices]=await Promise.all([
   this.dataSource.query(`SELECT id,type,method,amount,currency,paid_at AS "paidAt",reference FROM payments WHERE rental_id=$1 ORDER BY paid_at DESC`,[rentalId]),
   this.dataSource.query(`SELECT id,type,description,amount FROM additional_charges WHERE rental_id=$1 ORDER BY created_at`,[rentalId]),
   this.dataSource.query(`SELECT id,amount,status,retained_amount AS "retainedAmount",retention_reason AS "retentionReason" FROM security_deposits WHERE rental_id=$1`,[rentalId]),
   this.dataSource.query(`SELECT id,invoice_number AS "invoiceNumber",status,total_amount AS "totalAmount",issued_at AS "issuedAt" FROM invoices WHERE rental_id=$1 ORDER BY created_at DESC`,[rentalId]),
  ]);
  const cents=(v:string)=>Math.round(Number(v)*100);
  const chargesCents=(charges as {amount:string}[]).reduce((sum,c)=>sum+cents(c.amount),0);
  const paidCents=(payments as {type:string;amount:string}[]).reduce((sum,p)=>{
   if(p.type==='rental_payment'||p.type==='charge_payment') return sum+cents(p.amount);
   if(p.type==='refund') return sum-cents(p.amount);
   return sum;
  },0);
  return {rental,payments,charges,deposit:deposit[0]??null,invoices,
   outstandingEur:((cents(rental.totalAmount)+chargesCents-paidCents)/100).toFixed(2),
   note:'Manually recorded payments only; no external card charge is performed.'};
 }
 async recordPayment(adminId:string,rentalId:string,dto:ManualPaymentDto){
  return this.dataSource.transaction(async manager=>{
   // Lire l'état sous verrou avant tout contrôle ou écriture financière.
   const rental=await this.rental(manager,rentalId,undefined,true);
   if(rental.status==='closed') throw new ConflictException('Closed rentals cannot receive manual changes');
   if(dto.type==='refund'){
    const rows:{type:string;amount:string}[]=await manager.query(
     `SELECT type,amount FROM payments WHERE rental_id=$1::uuid AND type IN ('rental_payment','charge_payment','refund')`,[rentalId]);
    const net=rows.reduce((sum,p)=>sum+(p.type==='refund'?-1:1)*Math.round(Number(p.amount)*100),0);
    if(Math.round(dto.amount*100)>net){
     throw new BadRequestException('Manual refund exceeds recorded rental and charge payments');
    }
   }
   const rows:{id:string}[]=await manager.query(`INSERT INTO payments
    (rental_id,type,method,amount,reference,recorded_by,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [rentalId,dto.type,dto.method,dto.amount,dto.reference.trim(),adminId,dto.notes?.trim()??null]);
   return {paymentId:rows[0].id,recorded:true,processedExternally:false};
  });
 }
 async holdDeposit(adminId:string,rentalId:string,dto:DepositHoldDto){
  return this.dataSource.transaction(async manager=>{
   const rental=await this.rental(manager,rentalId,undefined,true);
   if(rental.status!=='active') throw new ConflictException('Hold deposit during an active rental');
   const exists:unknown[]=await manager.query(`SELECT id FROM security_deposits WHERE rental_id=$1 FOR UPDATE`,[rentalId]);
   if(exists.length) throw new ConflictException('Deposit already recorded');
   await manager.query(`INSERT INTO security_deposits(rental_id,amount,status,held_at)
    VALUES($1,$2,'held',now())`,[rentalId,rental.depositAmount]);
   if(Number(rental.depositAmount)>0) await manager.query(`INSERT INTO payments
    (rental_id,type,method,amount,reference,recorded_by) VALUES($1,'deposit_payment',$2,$3,$4,$5)`,
    [rentalId,dto.method,rental.depositAmount,dto.reference.trim(),adminId]);
   return {held:true,amountEur:rental.depositAmount,processedExternally:false};
  });
 }
 async settleDeposit(adminId:string,rentalId:string,dto:DepositSettleDto){
  return this.dataSource.transaction(async manager=>{
   const rental=await this.rental(manager,rentalId,undefined,true);
   if(rental.status!=='returned') throw new ConflictException('Vehicle must be returned before settling deposit');
   const rows:{amount:string;status:string}[]=await manager.query(`SELECT amount,status FROM security_deposits WHERE rental_id=$1 FOR UPDATE`,[rentalId]);
   const deposit=rows[0];if(!deposit||deposit.status!=='held') throw new ConflictException('Held deposit not found');
   const amount=Math.round(Number(deposit.amount)*100),retained=Math.round(dto.retainedAmount*100);
   if(retained>amount) throw new BadRequestException('Retained amount exceeds deposit');
   if(retained>0&&!dto.reason?.trim()) throw new BadRequestException('Retention reason required');
   const returned=(amount-retained)/100;
   await manager.query(`UPDATE security_deposits SET status=$2,retained_amount=$3,retention_reason=$4,
    released_at=now() WHERE rental_id=$1`,
    [rentalId,retained===amount?'retained':retained>0?'partially_retained':'released',dto.retainedAmount,dto.reason?.trim()||null]);
   if(returned>0) await manager.query(`INSERT INTO payments
    (rental_id,type,method,amount,reference,recorded_by)
    VALUES($1,'deposit_refund',$2,$3,$4,$5)`,[rentalId,dto.method,returned.toFixed(2),dto.reference.trim(),adminId]);
   return {settled:true,retainedEur:(retained/100).toFixed(2),refundEur:returned.toFixed(2),processedExternally:false};
  });
 }
 async addCharge(adminId:string,rentalId:string,input:{type:'damage'|'cleaning'|'other';description:string;amount:number;inspectionDamageId?:string}){
  return this.dataSource.transaction(async manager=>{
   const rental=await this.rental(manager,rentalId,undefined,true);
   if(rental.status!=='returned') throw new ConflictException('Charges can be finalised after vehicle return and before closure');
   const invoices:unknown[]=await manager.query(`SELECT id FROM invoices WHERE rental_id=$1 AND status='issued' LIMIT 1`,[rentalId]);
   if(invoices.length) throw new ConflictException('Issued invoices cannot be changed');
   if(input.inspectionDamageId){
    if(input.type!=='damage') throw new BadRequestException('Inspection damage references require a damage charge');
    const refs:unknown[]=await manager.query(`SELECT d.id FROM inspection_damages d JOIN inspections i ON i.id=d.inspection_id
      WHERE d.id=$1::uuid AND i.rental_id=$2::uuid`,[input.inspectionDamageId,rentalId]);
    if(!refs.length) throw new BadRequestException('Damage does not belong to this rental');
   }
   const rows:{id:string}[]=await manager.query(`INSERT INTO additional_charges
    (rental_id,type,description,amount,inspection_damage_id,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [rentalId,input.type,input.description.trim(),input.amount,input.inspectionDamageId??null,adminId]);
   return {chargeId:rows[0].id,recorded:true};
  });
 }
 async issueInvoice(adminId:string,rentalId:string){
  return this.dataSource.transaction(async manager=>{
   const rental=await this.rental(manager,rentalId,undefined,true);
   if(rental.status==='active') throw new ConflictException('Return the vehicle before issuing a final invoice');
   // La lecture verrouillée ci-dessus sérialise les émissions concurrentes.
   const existing:{id:string}[]=await manager.query(`SELECT id FROM invoices WHERE rental_id=$1 AND status='issued' LIMIT 1 FOR UPDATE`,[rentalId]);
   if(existing[0]) throw new ConflictException('Invoice already issued');
   const extra:{type:string;description:string;amount:string;id:string}[]=await manager.query(`SELECT id,type,description,amount FROM additional_charges WHERE rental_id=$1 ORDER BY created_at`,[rentalId]);
   const base=Math.round(Number(rental.totalAmount)*100);
   const total=extra.reduce((sum,c)=>sum+Math.round(Number(c.amount)*100),base);
   const number:{value:string}[]=await manager.query(`SELECT ('INV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('invoice_number_seq')::text,6,'0')) AS value`);
   const invoices:{id:string}[]=await manager.query(`INSERT INTO invoices(rental_id,invoice_number,status,subtotal,tax_rate,tax_amount,total_amount,issued_at,issued_by)
    VALUES($1,$2,'issued',$3,0,0,$3,now(),$4) RETURNING id`,
    [rentalId,number[0].value,(total/100).toFixed(2),adminId]);
   const id=invoices[0].id;
   await manager.query(`INSERT INTO invoice_items(invoice_id,description,quantity,unit_price)
    VALUES($1,'Rental service (including selected extras and discounts)',1,$2)`,[id,rental.totalAmount]);
   for(const charge of extra){
    await manager.query(`INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,additional_charge_id)
      VALUES($1,$2,1,$3,$4)`,[id,charge.description,charge.amount,charge.id]);
   }
   return {invoiceId:id,invoiceNumber:number[0].value,totalAmount:(total/100).toFixed(2),
    note:'Prototype document; local tax/legal compliance must be reviewed before commercial use.'};
  });
 }
 async document(rentalId:string,type:'contract'|'invoice',customerId?:string){
  const rental=await this.rental(this.dataSource,rentalId,customerId);
  const rows:string[]=[
   `Customer: ${rental.customerName}`,
   `Vehicle: ${rental.vehicleName}`,
   `Reservation: ${rental.reservationNumber}`,
   `Contract: ${rental.contractNumber}`,
   `Pickup: ${new Date(rental.pickupAt).toISOString().slice(0,10)}`,
   `Return: ${new Date(rental.returnAt).toISOString().slice(0,10)}`,
   `Rental amount EUR: ${rental.totalAmount}`,
   `Security deposit EUR: ${rental.depositAmount}`,
  ];
  let subtitle='Rental terms summary - unsigned demonstration document';
  if(type==='invoice'){
   const invoices:{invoiceNumber:string;totalAmount:string}[]=await this.dataSource.query(`SELECT invoice_number AS "invoiceNumber",total_amount AS "totalAmount"
    FROM invoices WHERE rental_id=$1 AND status='issued' ORDER BY issued_at DESC LIMIT 1`,[rentalId]);
   if(!invoices[0]) throw new NotFoundException('Issued invoice not found');
   subtitle='INVOICE - DEMO (not a tax-certified invoice)';
   rows.push(`Invoice number: ${invoices[0].invoiceNumber}`,`Total amount EUR: ${invoices[0].totalAmount}`);
  }else{
   rows.push('Vehicle condition is recorded at handover and return.',
    'The customer remains responsible for agreed charges per rental policy.',
    'Additional protection, if selected, is subject to separate terms.');
  }
  return createLuxuryPdf(type==='contract'?'RENTAL AGREEMENT':'RENTAL INVOICE',subtitle,rows);
 }
}
