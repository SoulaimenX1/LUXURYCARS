'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import styles from './operations.module.css';
import {useConfirm} from '@/components/confirm-dialog';
import {useToast} from '@/components/toast';
interface Rental{id:string;contractNumber:string;reservationNumber:string;vehicleName:string;customerName:string;status:'active'|'returned'|'closed';expectedReturnAt:string}
interface Summary{rental:{totalAmount:string;depositAmount:string;contractNumber:string};outstandingEur:string;
 deposit:{status:string;amount:string}|null;payments:{id:string;type:string;amount:string}[];invoices:{invoiceNumber:string;totalAmount:string}[];charges:{type:string;amount:string;description:string}[]}
interface Damage {id:string;zone:string;description:string;severity:string;estimatedCost:string|null;hasPhoto:boolean}
interface Policy{lateFeePerDay:string;fuelFeePerPercent:string;mileageAllowancePerDay:number;excessMileageFee:string}
const EuroAmount=({value}:{value:string})=><>{new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(value))}</>;
const endpoint=(path:string)=>`/api/admin/operations/${path}`;
async function errorOf(r:Response){try{const data=await r.json();return typeof data.message==='string'?data.message:JSON.stringify(data.message);}catch{return `HTTP ${r.status}`;}}
const STATUS_CLASS:Record<string,string>={active:styles.statusActive,returned:styles.statusReturned,closed:styles.statusClosed};
function statusClass(status:string){return STATUS_CLASS[status]??styles.statusClosed;}
export default function AdminOperationsPage(){
 const confirm=useConfirm();
 const toast=useToast();
 const [rentals,setRentals]=useState<Rental[]>([]);
 const [selected,setSelected]=useState('');
 const [summary,setSummary]=useState<Summary|null>(null);
 const [damages,setDamages]=useState<Damage[]>([]);
 const [policy,setPolicy]=useState<Policy|null>(null);
 const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);
 const [mileageKm,setMileageKm]=useState('');const [fuel,setFuel]=useState('100');
 const [condition,setCondition]=useState('good');const [notes,setNotes]=useState('');
 const [method,setMethod]=useState('bank_transfer');const [reference,setReference]=useState('');
 const [paymentType,setPaymentType]=useState('rental_payment');const [paymentAmount,setPaymentAmount]=useState('');
 const [chargeAmount,setChargeAmount]=useState('');const [chargeDescription,setChargeDescription]=useState('');const [chargeType,setChargeType]=useState('damage');
 const [retained,setRetained]=useState('0');const [retainReason,setRetainReason]=useState('');
 const [damageZone,setDamageZone]=useState('');const [damageDescription,setDamageDescription]=useState('');
 const [damageSeverity,setDamageSeverity]=useState('minor');const [damageCost,setDamageCost]=useState('0');
 const active=rentals.find(r=>r.id===selected);
 async function refresh(){
  const [r,p]=await Promise.all([fetch('/api/admin/rentals',{cache:'no-store'}),fetch(endpoint('returns/policy'),{cache:'no-store'})]);
  if(!r.ok||!p.ok) throw new Error('Unable to load rental operations');
  const data:Rental[]=await r.json();setRentals(data);setPolicy(await p.json());
 }
 useEffect(()=>{const initialize=async()=>{try{await refresh();}catch(e){setError(e instanceof Error?e.message:'Unable to load data');}};void initialize();},[]);
 useEffect(()=>{
  const ctrl=new AbortController();
  void (async()=>{
   if(!selected){setSummary(null);return;}
   void fetch(endpoint(`returns/${selected}`),{cache:'no-store',signal:ctrl.signal})
    .then(r=>r.ok?r.json():[])
    .then((rows:Damage[])=>{if(!ctrl.signal.aborted)setDamages(rows);}).catch(()=>{});
   void fetch(endpoint(`finance/${selected}`),{cache:'no-store',signal:ctrl.signal})
    .then(async r=>{if(!r.ok) throw new Error(await errorOf(r));return r.json();})
    .then(d=>{if(!ctrl.signal.aborted)setSummary(d);})
    .catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Unable to load statement');});
  })();
  return()=>ctrl.abort();
 },[selected]);
 async function request(path:string,body:unknown,verb:'POST'|'PUT'='POST'){
  setBusy(true);setError('');setSuccess('');
  try{
   const r=await fetch(endpoint(path),{method:verb,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.ok) throw new Error(await errorOf(r));
   await refresh();
   if(selected){
     const [result,damagesResponse]=await Promise.all([
       fetch(endpoint(`finance/${selected}`),{cache:'no-store'}),
       fetch(endpoint(`returns/${selected}`),{cache:'no-store'}),
     ]);
     if(result.ok)setSummary(await result.json());
     if(damagesResponse.ok)setDamages(await damagesResponse.json());
   }
   setSuccess('Operation saved successfully in PostgreSQL.');
   toast.success('Operation saved successfully in PostgreSQL.');
  }catch(e){
   const message=e instanceof Error?e.message:'Operation failed';
   setError(message);
   toast.error(message,'Operations');
  }
  finally{setBusy(false);}
 }
 async function uploadPhoto(damageId:string,file:File){
  if(file.size>5*1024*1024){setError('Photos are limited to 5 MB.');toast.error('Photos are limited to 5 MB.','Inspection photo');return;}
  const form=new FormData();form.set('photo',file);
  const response=await fetch(`/api/admin/inspection-photo/${damageId}`,{method:'POST',body:form});
  if(!response.ok){const message=await errorOf(response);setError(message);toast.error(message,'Inspection photo');return;}
  const result=await fetch(endpoint(`returns/${selected}`),{cache:'no-store'});
  if(result.ok)setDamages(await result.json());
  setSuccess('Private inspection photograph saved.');
  toast.success('Private inspection photograph saved.','Inspection photo');
 }
 async function submitReturn(e:FormEvent){e.preventDefault();if(!active||active.status!=='active')return;
  if(!(await confirm({title:'Record return',message:`Record the physical return of ${active.contractNumber}?`,confirmLabel:'Record return',tone:'success'})))return;
  const damages=damageDescription.trim()? [{zone:damageZone||'other',description:damageDescription,severity:damageSeverity,estimatedCost:Number(damageCost)}]:[];
  await request(`returns/${selected}/return`,{mileageKm:Number(mileageKm),fuelLevelPct:Number(fuel),condition,notes,damages});
 }
 async function submitPolicy(e:FormEvent){e.preventDefault();if(policy&&await confirm({title:'Apply fee policy',message:'Apply this fee policy to future rental returns?',confirmLabel:'Apply policy'}))await request('returns/policy',{
  lateFeePerDay:Number(policy.lateFeePerDay),fuelFeePerPercent:Number(policy.fuelFeePerPercent),
  mileageAllowancePerDay:Number(policy.mileageAllowancePerDay),excessMileageFee:Number(policy.excessMileageFee)},'PUT');}
 return <main className={styles.page}>
  <header className={styles.hero}>
   <Link href="/admin" className={styles.back}>← Admin overview</Link>
   <p className={styles.eyebrow}>BACK OFFICE · FINANCE & FLEET</p>
   <h1 className={styles.title}>Rental operations</h1>
   <p className={styles.intro}>Record payments, return inspections and deposits. External card processing is not connected.</p>
  </header>
  {error&&<p className={styles.error} role="alert">{error}</p>}{success&&<p className={styles.success} role="status">{success}</p>}
  <section className={styles.panel}><h2>Choose rental</h2>
   <select value={selected} onChange={e=>{setSelected(e.target.value);setError('');}}><option value="">Choose a rental</option>
    {rentals.map(r=><option key={r.id} value={r.id}>{r.contractNumber} — {r.vehicleName} / {r.customerName} ({r.status})</option>)}
   </select>
   {active&&<p className={styles.rentalMeta}><span>{active.reservationNumber}</span><span className={`${styles.status} ${statusClass(active.status)}`}>{active.status}</span><span>expected return {new Date(active.expectedReturnAt).toLocaleDateString('en-GB')}</span></p>}
  </section>
  {active&&summary&&<>
   <section className={styles.panel}><h2>Financial overview</h2>
    <div className={styles.stats}><p>Rental <strong><EuroAmount value={summary.rental.totalAmount}/></strong></p>
     <p>Deposit <strong><EuroAmount value={summary.rental.depositAmount}/></strong></p>
     <p>Balance <strong><EuroAmount value={summary.outstandingEur}/></strong></p></div>
    <p>Security deposit: {summary.deposit?.status??'Not recorded'}.</p>
    <p>{summary.payments.length} manual payment records · {summary.charges.length} additional charges · {summary.invoices.length} invoices</p>
    {summary.charges.map((c,i)=><p key={i}>{c.description}: <EuroAmount value={c.amount}/></p>)}
    <div className={styles.links}>
     <a href={endpoint(`finance/${selected}/documents/contract`)}>Download contract PDF</a>
     {summary.invoices.length>0&&<a href={endpoint(`finance/${selected}/documents/invoice`)}>Download invoice PDF</a>}
    </div>
   </section>
   <div className={styles.grid}>
    {active.status==='active'&&<form className={styles.panel} onSubmit={e=>void submitReturn(e)}>
     <h2>Vehicle return inspection</h2>
     <label>Final mileage (km)<input required type="number" min={0} value={mileageKm} onChange={e=>setMileageKm(e.target.value)}/></label>
     <label>Fuel level (%)<input required type="number" min={0} max={100} value={fuel} onChange={e=>setFuel(e.target.value)}/></label>
     <label>Return condition<select value={condition} onChange={e=>setCondition(e.target.value)}>
      {['excellent','good','fair','damaged'].map(c=><option key={c} value={c}>{c}</option>)}
     </select></label>
     <label>Inspection notes<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <h3>Damage assessment (optional)</h3>
     <label>Vehicle area<input maxLength={60} value={damageZone} onChange={e=>setDamageZone(e.target.value)}/></label>
     <label>Description<input maxLength={500} value={damageDescription} onChange={e=>setDamageDescription(e.target.value)}/></label>
     <label>Severity<select value={damageSeverity} onChange={e=>setDamageSeverity(e.target.value)}>
      {['minor','moderate','major'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <label>Estimated repair EUR<input type="number" min={0} max={100000} step="0.01" value={damageCost} onChange={e=>setDamageCost(e.target.value)}/></label>
     <button disabled={busy||!mileageKm}>Record return inspection</button>
    </form>}
    <form className={styles.panel} onSubmit={async e=>{e.preventDefault();
      if(!(await confirm({title:'Record payment',message:`Record a manual ${paymentType.replace('_',' ')} of ${paymentAmount} EUR for ${active?.contractNumber}? No payment gateway transaction is initiated.`,confirmLabel:'Record payment'})))return;
      void request(`finance/${selected}/payments`,{
      type:paymentType,method,amount:Number(paymentAmount),reference});}}>
     <h2>Record manual payment</h2>
     <p>No payment gateway transaction is initiated.</p>
     <label>Type<select value={paymentType} onChange={e=>setPaymentType(e.target.value)}>
      {['rental_payment','charge_payment','refund'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></label>
     <label>Method<select value={method} onChange={e=>setMethod(e.target.value)}>
      {['bank_transfer','cash','card'].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
     <label>Amount EUR<input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label>
     <label>External receipt reference<input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/></label>
     <button disabled={busy||active.status==='closed'}>Record payment</button>
    </form>
    <section className={styles.panel}><h2>Security deposit</h2>
     <p>Deposit is recorded as held only after external collection.</p>
     {!summary.deposit&&active.status==='active'&&<button disabled={busy||!reference} onClick={async()=>{if(await confirm({title:'Record held deposit',message:`Record the security deposit for ${active.contractNumber} as held after external collection?`,confirmLabel:'Record deposit'}))void request(`finance/${selected}/deposit/hold`,{method,reference});}}>Record held deposit</button>}
     {summary.deposit?.status==='held'&&active.status==='returned'&&<form onSubmit={async e=>{e.preventDefault();
      if(!(await confirm({title:'Settle deposit',message:`Settle the deposit for ${active.contractNumber}, retaining ${retained} EUR? The refund is recalculated and recorded.`,confirmLabel:'Settle and refund',tone:'danger'})))return;
      void request(`finance/${selected}/deposit/settle`,{
      retainedAmount:Number(retained),reason:retainReason,method,reference});}}>
      <label>Retained EUR<input type="number" min={0} step="0.01" value={retained} onChange={e=>setRetained(e.target.value)}/></label>
      <label>Reason<input maxLength={500} value={retainReason} onChange={e=>setRetainReason(e.target.value)}/></label>
      <button disabled={busy||!reference}>Settle and record refund</button>
     </form>}
    </section>
    {active.status==='returned'&&summary.invoices.length===0&&<form className={styles.panel}
      onSubmit={async e=>{e.preventDefault();
        if(!(await confirm({title:'Record additional charge',message:`Record a ${chargeType} charge of ${chargeAmount} EUR on ${active.contractNumber}? Confirm the damage review is complete.`,confirmLabel:'Record charge',tone:'danger'})))return;
        void request(`finance/${selected}/charges`,{
        type:chargeType,description:chargeDescription,amount:Number(chargeAmount)});}}>
      <h2>Approved additional charges</h2><p>Review estimated damage costs before recording a confirmed charge.</p>
      <label>Type<select value={chargeType} onChange={e=>setChargeType(e.target.value)}>
       <option value="damage">Damage</option><option value="cleaning">Cleaning</option><option value="other">Other</option>
      </select></label>
      <label>Reason<input required minLength={5} maxLength={255} value={chargeDescription} onChange={e=>setChargeDescription(e.target.value)}/></label>
      <label>Amount EUR<input required type="number" min="0.01" step="0.01" value={chargeAmount} onChange={e=>setChargeAmount(e.target.value)}/></label>
      <button disabled={busy||!chargeAmount}>Record additional charge</button>
     </form>}
    {active.status!=='active'&&<section className={styles.panel}><h2>Closing & invoices</h2>
      <p>Invoice generation is for the university prototype, not tax certification.</p>
      <button disabled={busy||summary.invoices.length>0} onClick={async()=>{if(await confirm({title:'Issue invoice',message:`Generate an invoice for ${active.contractNumber}? It is recorded in the rental history.`,confirmLabel:'Issue invoice'}))void request(`finance/${selected}/invoice`,{});}}>Issue invoice</button>
      {active.status==='returned'&&<button disabled={busy} onClick={async()=>{if(await confirm({title:'Close rental',message:'Close this rental permanently?',confirmLabel:'Close rental',tone:'danger'}))void request(`returns/${selected}/close`,{});}}>Close rental</button>}
     </section>}
   </div>
  </>}
  {selected&&damages.length>0&&<section className={styles.panel}>
    <h2>Private inspection photographs</h2>
    <p>Uploaded photographs are visible only to authorised administrators.</p>
    {damages.map(d=><div key={d.id} className={styles.damageRow}>
     <strong>{d.zone}: {d.description}</strong><span>{d.severity} · Estimated repair {d.estimatedCost??'—'} EUR</span>
     {d.hasPhoto&&<a href={`/api/admin/inspection-photo/${d.id}`} target="_blank" rel="noreferrer">View photo</a>}
     <label>Attach photo (5MB max)<input type="file" accept="image/jpeg,image/png,image/webp"
       onChange={e=>{const file=e.target.files?.[0];if(file)void uploadPhoto(d.id,file);}}/></label>
    </div>)}
  </section>}
  <form className={styles.panel} onSubmit={e=>void submitPolicy(e)}><h2>Contract fee policy</h2>
   <p>Fees are zero by default until staff configure them. Inform customers before booking.</p>
   {policy&&<div className={styles.grid}>
    <label>Late fee EUR per day<input required type="number" min="0" step="0.01" value={policy.lateFeePerDay} onChange={e=>setPolicy({...policy,lateFeePerDay:e.target.value})}/></label>
    <label>Fuel shortfall EUR per percent<input required type="number" min="0" step="0.01" value={policy.fuelFeePerPercent} onChange={e=>setPolicy({...policy,fuelFeePerPercent:e.target.value})}/></label>
    <label>Included mileage km/day<input required type="number" min="0" value={policy.mileageAllowancePerDay} onChange={e=>setPolicy({...policy,mileageAllowancePerDay:Number(e.target.value)})}/></label>
    <label>Excess mileage EUR/km<input required type="number" min="0" step="0.01" value={policy.excessMileageFee} onChange={e=>setPolicy({...policy,excessMileageFee:e.target.value})}/></label>
   </div>}
   <button disabled={busy||!policy}>Save fee policy</button>
  </form>
 </main>;
}
