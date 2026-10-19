import type {PrivateUpload} from './private-photos.js';
import {savePrivatePhoto,deletePrivatePhoto,readPrivatePhoto} from './private-photos.js';
import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DataSource} from 'typeorm';
import type {ReturnRentalDto} from './dto/return-rental.dto.js';
import type {FeePolicyDto} from './dto/fee-policy.dto.js';
import {recordVehicleLocation} from '../vehicle-movements/vehicle-location.js';
import {resolveServicePointDestination} from '../vehicle-movements/service-point-destination.js';

type Policy = {lateFeePerDay:string;fuelFeePerPercent:string;mileageAllowancePerDay:number;excessMileageFee:string};
@Injectable()
export class ReturnsService {
 constructor(private readonly dataSource:DataSource){}
 async getPolicy():Promise<Policy>{
  const rows:Policy[]=await this.dataSource.query(`SELECT late_fee_per_day AS "lateFeePerDay",
   fuel_fee_per_percent AS "fuelFeePerPercent",mileage_allowance_per_day AS "mileageAllowancePerDay",
   excess_mileage_fee AS "excessMileageFee" FROM rental_fee_policy WHERE id=1`);
  if(!rows[0]) throw new NotFoundException('Rental fee policy not configured');
  return rows[0];
 }
 async updatePolicy(input:FeePolicyDto){
  await this.dataSource.query(`UPDATE rental_fee_policy SET late_fee_per_day=$1,fuel_fee_per_percent=$2,
   mileage_allowance_per_day=$3,excess_mileage_fee=$4,updated_at=now() WHERE id=1`,
   [input.lateFeePerDay,input.fuelFeePerPercent,input.mileageAllowancePerDay,input.excessMileageFee]);
  return this.getPolicy();
 }
 // Le retour est une seule transaction : inspection, pénalités et état de la location.
 async registerReturn(adminId:string,rentalId:string,input:ReturnRentalDto){
  return this.dataSource.transaction(async manager=>{
   const rows:{id:string;status:string;expectedReturnAt:Date;startedAt:Date;vehicleId:string;
    vehicleMileage:number;rentalDays:number;pickupMileage:number;pickupFuel:number;
    reservationId:string;currentLocationId:string|null}[]=await manager.query(`
    SELECT l.id,l.status,l.expected_return_at AS "expectedReturnAt",l.started_at AS "startedAt",
    r.id AS "reservationId",r.vehicle_id AS "vehicleId",v.mileage_km AS "vehicleMileage",
    v.current_location_id AS "currentLocationId",r.rental_days AS "rentalDays",
    i.mileage_km AS "pickupMileage",i.fuel_level_pct AS "pickupFuel"
    FROM rentals l JOIN reservations r ON r.id=l.reservation_id
    JOIN vehicles v ON v.id=r.vehicle_id
    JOIN inspections i ON i.rental_id=l.id AND i.type='handover'
    WHERE l.id=$1::uuid FOR UPDATE OF l,v`,[rentalId]);
   const rental=rows[0];
   if(!rental) throw new NotFoundException('Active rental not found');
   if(rental.status!=='active') throw new ConflictException('Only active rentals can be returned');
   if(input.mileageKm<Number(rental.pickupMileage)||input.mileageKm<Number(rental.vehicleMileage)){
    throw new BadRequestException('Return mileage cannot be lower than pickup mileage');
   }
   const inspections:{id:string}[]=await manager.query(`INSERT INTO inspections
     (rental_id,type,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
     VALUES($1,'return',$2,$3,$4,$5,$6) RETURNING id`,
     [rentalId,adminId,input.mileageKm,input.fuelLevelPct,input.condition,input.notes?.trim()||null]);
   const inspectionId=inspections[0]?.id;
   const damageIds:string[]=[];
   for(const damage of input.damages??[]){
    const created:{id:string}[]=await manager.query(`INSERT INTO inspection_damages
     (inspection_id,vehicle_zone,description,severity,estimated_repair_cost)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
     [inspectionId,damage.zone.trim(),damage.description.trim(),damage.severity,damage.estimatedCost]);
    damageIds.push(created[0].id);
   }
   const policies:Policy[]=await manager.query(`SELECT late_fee_per_day AS "lateFeePerDay",
    fuel_fee_per_percent AS "fuelFeePerPercent",mileage_allowance_per_day AS "mileageAllowancePerDay",
    excess_mileage_fee AS "excessMileageFee" FROM rental_fee_policy WHERE id=1`);
   const policy=policies[0];
   if(!policy) throw new ConflictException('Return fee policy not configured');
   const now=new Date();
   const lateMs=Math.max(0,now.getTime()-new Date(rental.expectedReturnAt).getTime());
   const lateDays=Math.ceil(lateMs/86400000);
   const fuelShortfall=Math.max(0,Number(rental.pickupFuel)-input.fuelLevelPct);
   const travelledKm=input.mileageKm-Number(rental.pickupMileage);
   const includedKm=Number(rental.rentalDays)*Number(policy.mileageAllowancePerDay);
   const excessKm=Math.max(0,travelledKm-includedKm);
   const cents=(v:string|number)=>Math.round(Number(v)*100);
   const fees=[
    {kind:'late_return',amount:lateDays*cents(policy.lateFeePerDay),desc:`Late return: ${lateDays} day(s)`},
    {kind:'fuel',amount:fuelShortfall*cents(policy.fuelFeePerPercent),desc:`Fuel difference: ${fuelShortfall}%`},
    {kind:'mileage',amount:excessKm*cents(policy.excessMileageFee),desc:`Additional mileage: ${excessKm} km`},
   ];
   for(const fee of fees){
    if(fee.amount>0) await manager.query(`INSERT INTO additional_charges(rental_id,type,description,amount,created_by)
     VALUES($1,$2,$3,$4,$5)`,[rentalId,fee.kind,fee.desc,(fee.amount/100).toFixed(2),adminId]);
   }
   const damageFees=(input.damages??[]).reduce((sum,d)=>sum+cents(d.estimatedCost),0);
   // Les coûts de dommage restent des estimations : validation manuelle avant facturation.
   await manager.query(`UPDATE rentals SET status='returned',returned_at=$2 WHERE id=$1`,[rentalId,now]);
   await manager.query(`UPDATE vehicles SET mileage_km=$2 WHERE id=$1`,[rental.vehicleId,input.mileageKm]);
   // Registre physique : le retour figure la destination
   // CONTRACTUELLE de la réservation (point ou adresse porte).
   // Aucun lieu n'est deviné — sans destination, le véhicule devient
   // explicitement « non tracé » (projection NULL).
   const dropoffDestination=await resolveServicePointDestination(
    manager,rental.reservationId,'dropoff');
   await recordVehicleLocation(manager,{
    vehicleId:rental.vehicleId,
    eventKind:'reservation_return',
    fromLocationId:rental.currentLocationId,
    toLocationId:dropoffDestination.locationId,
    toAddress:dropoffDestination.address??undefined,
    reservationId:rental.reservationId,
    rentalId,
    actorId:adminId,
    source:'admin',
    note:'Rental returned — vehicle collected',
   });
   await manager.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_values)
    VALUES($1,'RENTAL_RETURNED','rental',$2,$3::jsonb)`,
    [adminId,rentalId,JSON.stringify({mileageKm:input.mileageKm,fuelLevelPct:input.fuelLevelPct,
     lateDays,excessKm,fuelShortfall,estimatedDamageAmount:(damageFees/100).toFixed(2)})]);
   return {rentalId,status:'returned',inspectionId,lateDays,excessKm,fuelShortfall,
    automaticChargesEur:(fees.reduce((sum,f)=>sum+f.amount,0)/100).toFixed(2),
    estimatedDamageAmountEur:(damageFees/100).toFixed(2),damageIds};
  });
 }
 async damages(rentalId:string){
  return this.dataSource.query(`SELECT d.id,d.vehicle_zone AS "zone",d.description,d.severity,
   d.estimated_repair_cost AS "estimatedCost",d.photo_path IS NOT NULL AS "hasPhoto"
   FROM inspection_damages d JOIN inspections i ON i.id=d.inspection_id
   WHERE i.rental_id=$1::uuid ORDER BY i.performed_at,d.id`,[rentalId]);
 }
 async uploadDamagePhoto(damageId:string,file:PrivateUpload){
  const found:{id:string;photo_path:string|null}[]=await this.dataSource.query(`SELECT id,photo_path FROM inspection_damages WHERE id=$1::uuid`,[damageId]);
  if(!found[0]) throw new NotFoundException('Damage record not found');
  const name=await savePrivatePhoto(file);
  try{await this.dataSource.query(`UPDATE inspection_damages SET photo_path=$2 WHERE id=$1`,[damageId,name]);}
  catch(e){await deletePrivatePhoto(name);throw e;}
  if(found[0].photo_path)await deletePrivatePhoto(found[0].photo_path);
  return {uploaded:true,damageId};
 }
 async damagePhoto(damageId:string){
  const rows:{photo_path:string|null}[]=await this.dataSource.query(`SELECT photo_path FROM inspection_damages WHERE id=$1::uuid`,[damageId]);
  if(!rows[0]?.photo_path) throw new NotFoundException('Photo not found');
  return readPrivatePhoto(rows[0].photo_path);
 }
 async close(adminId:string,rentalId:string){
  return this.dataSource.transaction(async manager=>{
   const rows:{id:string;status:string}[]=await manager.query(`SELECT id,status FROM rentals WHERE id=$1::uuid FOR UPDATE`,[rentalId]);
   if(!rows[0]) throw new NotFoundException('Rental not found');
   if(rows[0].status!=='returned') throw new ConflictException('Return inspection required before closure');
   // Contrôle de la caution avant clôture : aucun dépôt retenu par inadvertance.
   const holds:{status:string}[]=await manager.query(`SELECT status FROM security_deposits WHERE rental_id=$1`,[rentalId]);
   if(holds[0]&&['held','pending'].includes(holds[0].status)){
    throw new ConflictException('Resolve security deposit before closing rental');
   }
   // La clôture exige une facture émise et un règlement manuel équilibré.
   const issued:{id:string}[]=await manager.query(
    `SELECT id FROM invoices WHERE rental_id=$1 AND status='issued' LIMIT 1`,[rentalId]);
   if(!issued[0]) throw new ConflictException('Issue final invoice before closing rental');
   const balances:{total:string;charges:string;paid:string}[]=await manager.query(`
    SELECT r.total_amount::text AS total,
      COALESCE((SELECT sum(amount) FROM additional_charges WHERE rental_id=l.id),0)::text AS charges,
      COALESCE((SELECT sum(CASE WHEN type='refund' THEN -amount
        WHEN type IN ('rental_payment','charge_payment') THEN amount ELSE 0 END)
       FROM payments WHERE rental_id=l.id),0)::text AS paid
    FROM rentals l JOIN reservations r ON r.id=l.reservation_id WHERE l.id=$1`,[rentalId]);
   const cents=(v:string)=>Math.round(Number(v)*100);
   const due=cents(balances[0].total)+cents(balances[0].charges)-cents(balances[0].paid);
   if(due!==0) throw new ConflictException('Balance is not settled: record outstanding payment or refund before closure');
   await manager.query(`UPDATE rentals SET status='closed',closed_at=now(),closed_by=$2 WHERE id=$1`,[rentalId,adminId]);
   await manager.query(`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'RENTAL_CLOSED','rental',$2)`,[adminId,rentalId]);
   return {rentalId,status:'closed'};
  });
 }
}
