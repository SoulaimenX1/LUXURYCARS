import {describe,expect,it,vi} from 'vitest';
import type {DataSource} from 'typeorm';
import {PremiumService} from './premium.service.js';

const A='550e8400-e29b-41d4-a716-446655440001';
const B='550e8400-e29b-41d4-a716-446655440002';
const VEHICLE='550e8400-e29b-41d4-a716-446655440000';

// Vérifier la facturation réelle de prise en charge et restitution côté NestJS.
function service(){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('FROM vehicles WHERE'))return [{id:VEHICLE,daily_price:'300.00',security_deposit:'2000.00'}];
  if(sql.includes('FROM rental_locations'))return [
   {id:A,name:'Airport A',city:'Test city',category:'airport',pickup_fee:'50.00',dropoff_fee:'25.00',one_way_fee:'35.00',can_pickup:true,can_dropoff:true},
   {id:B,name:'Hotel B',city:'Test city',category:'hotel',pickup_fee:'80.00',dropoff_fee:'15.00',one_way_fee:'0.00',can_pickup:true,can_dropoff:true},
  ];
  if(sql.includes('FROM rental_fee_policy'))return [{lateFeePerDay:'0.00',fuelFeePerPercent:'0.00',mileageAllowancePerDay:250,excessMileageFee:'0.00'}];
  return [];
 });
 return new PremiumService({query} as unknown as DataSource);
}
const base={vehicleId:VEHICLE,pickupDate:'2035-07-01',returnDate:'2035-07-04'};
describe('PremiumService rental location quotations',()=>{
 it('adds configured one-way, pickup, and drop-off fees',async()=>{
  const quote=await service().quote({...base,pickupLocationId:A,dropoffLocationId:B});
  expect(quote.deliveryAmount).toBe('100.00');
  expect(quote.locationFees).toEqual({pickup:'50.00',dropoff:'15.00',oneWay:'35.00'});
  expect(quote.totalAmount).toBe('1000.00');
  expect(quote.pickupMethod).toBe('airport');
 });
 it('does not apply a one-way charge at the same point',async()=>{
  const quote=await service().quote({...base,pickupLocationId:A,dropoffLocationId:A});
  expect(quote.deliveryAmount).toBe('75.00');
  expect(quote.totalAmount).toBe('975.00');
 });
 it('preserves legacy airport fee for prior clients',async()=>{
  const quote=await service().quote({...base,pickupMethod:'airport'});
  expect(quote.deliveryAmount).toBe('80.00');
 });
 it('defaults the drop-off to the pick-up point when only one is given',async()=>{
  const quote=await service().quote({...base,pickupLocationId:A});
  expect(quote.dropoffLocationId).toBe(A);
  expect(quote.dropoffLocationName).toBe('Airport A — Test city');
  expect(quote.deliveryAmount).toBe('75.00');
  expect(quote.totalAmount).toBe('975.00');
 });
});
