import {describe,it,expect,vi} from 'vitest';
import type {DataSource} from 'typeorm';
import {PremiumService} from './premium.service.js';

// Prix calculés côté serveur : aucune valeur monétaire ne provient de l'interface.
describe('PremiumService secure quotation',()=>{
 it('calculates base price, daily extras, delivery and promotion',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM vehicles'))return [{id:'550e8400-e29b-41d4-a716-446655440000',daily_price:'300.00',security_deposit:'2000.00'}];
   if(sql.includes('FROM premium_extras'))return [{id:'7bf18b4c-4e28-439a-8b03-ccb2aa133614',name:'GPS',amount:'15.00',pricing:'daily'}];
   if(sql.includes('FROM premium_promotions'))return [{code:'WELCOME10',percentage:10,uses:0,max_uses:10}];
   if(sql.includes('FROM rental_fee_policy'))return [{lateFeePerDay:'0.00',fuelFeePerPercent:'0.00',mileageAllowancePerDay:200,excessMileageFee:'0.00'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  const quote=await service.quote({vehicleId:'550e8400-e29b-41d4-a716-446655440000',
   pickupDate:'2035-07-01',returnDate:'2035-07-04',extraIds:['7bf18b4c-4e28-439a-8b03-ccb2aa133614'],
   pickupMethod:'airport',promotionCode:'WELCOME10'});
  expect(quote.baseAmount).toBe('900.00');
  expect(quote.extrasAmount).toBe('45.00');
  expect(quote.deliveryAmount).toBe('80.00');
  expect(quote.discountAmount).toBe('94.50');
  expect(quote.totalAmount).toBe('930.50');
  expect(quote.depositAmount).toBe('2000.00');
 });
 it('rejects invalid rental dates',async()=>{
  const service=new PremiumService({query:vi.fn()} as unknown as DataSource);
  await expect(service.quote({vehicleId:'550e8400-e29b-41d4-a716-446655440000',
   pickupDate:'2035-02-29',returnDate:'2035-03-02'})).rejects.toThrow();
 });
 // ISSUE 10 : une durée exacte de 48 h correspond à 2 jours facturables
 // (pas 3), et toute fraction entamée au-delà ajoute un jour complet.
 it('facture 48 h comme 2 jours et 49 h comme 3 jours (pas 4)',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM vehicles'))return [{id:'550e8400-e29b-41d4-a716-446655440000',daily_price:'100.00',security_deposit:'1000.00'}];
   if(sql.includes('FROM rental_fee_policy'))return [{lateFeePerDay:'0.00',fuelFeePerPercent:'0.00',mileageAllowancePerDay:200,excessMileageFee:'0.00'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  const exactly48=await service.quote({
   vehicleId:'550e8400-e29b-41d4-a716-446655440000',
   pickupAt:'2035-07-01T09:00:00.000Z',returnAt:'2035-07-03T09:00:00.000Z'});
  expect(exactly48.rentalDays).toBe(2);
  expect(exactly48.baseAmount).toBe('200.00');
  expect(exactly48.totalAmount).toBe('200.00');
  const over48=await service.quote({
   vehicleId:'550e8400-e29b-41d4-a716-446655440000',
   pickupAt:'2035-07-01T09:00:00.000Z',returnAt:'2035-07-03T10:00:00.000Z'});
  expect(over48.rentalDays).toBe(3);
  expect(over48.baseAmount).toBe('300.00');
 });
});

// F-07 : CRUD des extras et des promotions.
describe('PremiumService admin extras and promotions',()=>{
 const EXTRA_ID='7bf18b4c-4e28-439a-8b03-ccb2aa133614';

 it('lists all extras including disabled ones',async()=>{
  const query=vi.fn<(sql: string) => Promise<unknown[]>>(async()=>[{id:EXTRA_ID,code:'GPS',name:'GPS',enabled:false}]);
  const service=new PremiumService({query} as unknown as DataSource);
  const rows=await service.allExtras();
  expect(rows).toHaveLength(1);
  expect(query.mock.calls[0][0]).toContain('FROM premium_extras');
 });

 it('lists all promotions including disabled ones',async()=>{
  const query=vi.fn<(sql: string) => Promise<unknown[]>>(async()=>[{code:'WELCOME10',percentage:10,uses:3,enabled:false}]);
  const service=new PremiumService({query} as unknown as DataSource);
  const rows=await service.allPromotions();
  expect(rows[0]).toMatchObject({code:'WELCOME10'});
  expect(query.mock.calls[0][0]).toContain('FROM premium_promotions');
 });

 it('deletes an unused extra',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM premium_extras'))return [{id:EXTRA_ID}];
   if(sql.includes('reservation_extras'))return [{count:'0'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deleteExtra(EXTRA_ID)).resolves.toEqual({deleted:1});
 });

 it('refuses to delete an extra used by a reservation',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM premium_extras'))return [{id:EXTRA_ID}];
   if(sql.includes('reservation_extras'))return [{count:'2'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deleteExtra(EXTRA_ID)).rejects.toThrow();
 });

 it('refuses to delete an unknown extra',async()=>{
  const query=vi.fn(async()=>[]);
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deleteExtra(EXTRA_ID)).rejects.toThrow();
 });

 it('deletes an unused promotion',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('SELECT uses'))return [{uses:0}];
   if(sql.includes('FROM reservations'))return [{count:'0'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deletePromotion('welcome10')).resolves.toEqual({deleted:1});
 });

 it('refuses to delete a promotion already used',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('SELECT uses'))return [{uses:5}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deletePromotion('WELCOME10')).rejects.toThrow();
 });

 it('refuses to delete a promotion referenced by a reservation',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('SELECT uses'))return [{uses:0}];
   if(sql.includes('FROM reservations'))return [{count:'1'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.deletePromotion('WELCOME10')).rejects.toThrow();
 });
});

// F-15 : un avis n'est possible qu'après une location terminée.
describe('PremiumService review eligibility',()=>{
 it('accepts a review when the rental is closed',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM rentals l'))return [{reservationId:'res-1',vehicleId:'veh-1',rentalId:'rent-1'}];
   if(sql.includes('INSERT INTO vehicle_reviews'))return [{id:'review-1'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.addReview('cust-1',{
   reservationNumber:'res-2026-000001',rating:5,title:'Superb',comment:'Wonderful experience overall',
  } as never)).resolves.toEqual({saved:true});
  expect(query.mock.calls[0][0]).toContain("l.status='closed'");
 });

 it('refuses a review when there is no completed rental',async()=>{
  const query=vi.fn(async()=>[]);
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.addReview('cust-1',{
   reservationNumber:'RES-2026-000001',rating:5,title:'Great',comment:'Excellent vehicle indeed',
  } as never)).rejects.toThrow();
 });

 it('lists only reviewable completed reservations',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM rentals l'))return [{reservationNumber:'RES-2026-000001',vehicleId:'veh-1',closedAt:'2026-01-01'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  const rows=await service.reviewableReservations('cust-1');
  expect(rows).toHaveLength(1);
  expect(query.mock.calls[0][0]).toContain("l.status = 'closed'");
  expect(query.mock.calls[0][0]).toContain('NOT EXISTS');
 });

 // Volet service : accepté seulement si la réservation a inclus des
 // services optionnels (options et/ou livraison payante).
 it('accepts a service opinion when optional services were booked',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM rentals l'))return [{reservationId:'res-1',vehicleId:'veh-1',rentalId:'rent-1'}];
   if(sql.includes('hasServices'))return [{hasServices:true}];
   if(sql.includes('INSERT INTO vehicle_reviews'))return [{id:'review-1'}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.addReview('cust-1',{
   reservationNumber:'res-2026-000001',rating:5,title:'Superb',comment:'Wonderful experience overall',
   serviceRating:4,serviceComment:'Airport delivery was flawless',
  } as never)).resolves.toEqual({saved:true});
  const insert=query.mock.calls.find(call=>String(call[0]).includes('INSERT INTO vehicle_reviews'));
  expect(String(insert?.[0])).toContain('service_rating');
  const insertArgs=insert ? ((insert as unknown as [string, unknown[]])[1] ?? []) : [];
  expect(insertArgs).toContain(4);
 });

 it('refuses a service opinion when no optional service was booked',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM rentals l'))return [{reservationId:'res-1',vehicleId:'veh-1',rentalId:'rent-1'}];
   if(sql.includes('hasServices'))return [{hasServices:false}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.addReview('cust-1',{
   reservationNumber:'RES-2026-000001',rating:5,title:'Great',comment:'Excellent vehicle indeed',
   serviceRating:4,serviceComment:'No optional service here',
  } as never)).rejects.toThrow();
 });

 it('refuses a service rating without an opinion',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM rentals l'))return [{reservationId:'res-1',vehicleId:'veh-1',rentalId:'rent-1'}];
   if(sql.includes('hasServices'))return [{hasServices:true}];
   return [];
  });
  const service=new PremiumService({query} as unknown as DataSource);
  await expect(service.addReview('cust-1',{
   reservationNumber:'RES-2026-000001',rating:5,title:'Great',comment:'Excellent vehicle indeed',
   serviceRating:4,serviceComment:'',
  } as never)).rejects.toThrow();
 });
});
