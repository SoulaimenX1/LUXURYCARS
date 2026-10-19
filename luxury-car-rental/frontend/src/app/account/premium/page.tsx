'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Price} from '@/components/currency-provider';
import {useToast} from '@/components/toast';
import styles from './premium.module.css';
interface Favorite {vehicleId:string;createdAt:string}
interface Vehicle {id:string;brandName:string;modelName:string;dailyPrice:string;imageUrl?:string|null}
interface Loyalty {tier:string;completedRentals:number;spentEur:string;note:string}
interface Reviewable {reservationNumber:string;vehicleId:string;closedAt:string;vehicleLabel?:string|null;hasServices?:boolean;services?:string[]}

export default function PremiumCustomerPage(){
 const toast=useToast();
 const [favorite,setFavorite]=useState<Favorite[]>([]);
 const [catalog,setCatalog]=useState<Vehicle[]>([]);
 const [loyalty,setLoyalty]=useState<Loyalty|null>(null);
 const [reviewable,setReviewable]=useState<Reviewable[]>([]);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [reviewReservation,setReviewReservation]=useState('');
 const [rating,setRating]=useState(5);
 const [title,setTitle]=useState('');
 const [comment,setComment]=useState('');
 const [serviceRating,setServiceRating]=useState(5);
 const [serviceComment,setServiceComment]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  async function load(){try{
   const [f,c,l,r]=await Promise.all([
    fetch('/api/premium/me/favorites',{signal:ctrl.signal,cache:'no-store'}),
    fetch('/api/vehicles/catalog',{signal:ctrl.signal,cache:'no-store'}),
    fetch('/api/premium/me/loyalty',{signal:ctrl.signal,cache:'no-store'}),
    fetch('/api/premium/me/reviewable',{signal:ctrl.signal,cache:'no-store'})
   ]);
   if(!f.ok||!c.ok||!l.ok||!r.ok) throw new Error('Please sign in to view your private collection.');
   const [fav,cars,tier,reservs]=await Promise.all([f.json(),c.json(),l.json(),r.json()]);
   if(!ctrl.signal.aborted){setFavorite(fav);setCatalog(cars);setLoyalty(tier);setReviewable(reservs);}
  }catch{if(!ctrl.signal.aborted)setError('Unable to load your private collection.');}}
  void load();return()=>ctrl.abort();
 },[]);
 async function removeFavorite(id:string){
  const response=await fetch(`/api/premium/me/favorites/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(response.ok){setFavorite(previous=>previous.filter(v=>v.vehicleId!==id));toast.success('Removed from your saved vehicles.','Saved vehicles');}
  else {const d=await response.json().catch(()=>({message:'Unable to update your saved vehicles.'}));toast.error(typeof d.message==='string'?d.message:'Unable to update your saved vehicles.','Saved vehicles');}
 }
 async function submitReview(e:React.FormEvent){
  e.preventDefault();setMessage('');
  const selected=reviewable.find(r=>r.reservationNumber===reviewReservation);
  const payload:{reservationNumber:string;rating:number;title:string;comment:string;serviceRating?:number;serviceComment?:string}=
   {reservationNumber:reviewReservation,rating,title,comment};
  if(selected?.hasServices){payload.serviceRating=serviceRating;payload.serviceComment=serviceComment;}
  const res=await fetch('/api/premium/me/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){const done=reviewReservation;const ok='Thank you. Your review has been published.';setMessage(ok);toast.success(ok,'Review');setReviewReservation('');setTitle('');setComment('');setServiceComment('');setServiceRating(5);setReviewable(previous=>previous.filter(r=>r.reservationNumber!==done));}
  else {const d=await res.json().catch(()=>({message:'Unable to save review'}));const problem=typeof d.message==='string'?d.message:'Unable to save review';setMessage(problem);toast.error(problem,'Review');}
 }
 const saved=favorite.map(f=>catalog.find(c=>c.id===f.vehicleId)).filter((v):v is Vehicle=>Boolean(v));
 const eligible=reviewable;
 const selected=eligible.find(r=>r.reservationNumber===reviewReservation);
 const labelFor=(vehicleId:string)=>{const v=catalog.find(c=>c.id===vehicleId);return v?`${v.brandName} ${v.modelName}`:vehicleId.slice(0,8);};
 return <main className={styles.page}><div className={styles.container}>
  <Link href="/account">← Back to account</Link>
  <p className={styles.eyebrow}>THE PRIVATE COLLECTION</p><h1>Your premium experience</h1>
  {error&&<p role="alert">{error}</p>}
  {loyalty&&<section className={styles.panel}><p className={styles.eyebrow}>MEMBERSHIP</p>
   <h2>{loyalty.tier}</h2><p>{loyalty.completedRentals} completed rentals · <Price value={loyalty.spentEur}/> in recorded rentals</p>
   <small>{loyalty.note}</small></section>}
  <section className={styles.panel}><h2>Saved vehicles ({saved.length})</h2>
   {saved.length===0?<p>No saved vehicles yet. Discover our collection to add your favourites.</p>:
    <div className={styles.collection}>{saved.map(v=><article key={v.id} className={styles.item}>
     {v.imageUrl&&<img src={v.imageUrl} alt={`${v.brandName} ${v.modelName}`}/>}
     <h3>{v.brandName} {v.modelName}</h3><p>From <Price value={v.dailyPrice}/> / day</p>
     <div><Link href={`/vehicles/${encodeURIComponent(v.id)}`}>View vehicle</Link>
     <button onClick={()=>void removeFavorite(v.id)} type="button">Remove</button></div>
    </article>)}</div>}
  </section>
  <section className={styles.panel}><h2>Review your reservation</h2>
   <p>Only customers whose rental is complete may leave a review.</p>
   {eligible.length===0?<p>No completed rental to review yet. Your eligible completed rentals appear here.</p>:
   <form onSubmit={e=>void submitReview(e)} className={styles.form}>
    <label>Your reservation<select required value={reviewReservation} onChange={e=>setReviewReservation(e.target.value)}>
     <option value="">Select your reservation</option>{eligible.map(r=><option value={r.reservationNumber} key={r.reservationNumber}>{labelFor(r.vehicleId)} — {r.reservationNumber}</option>)}
    </select></label>
    <label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label>
    <label>Title<input required minLength={3} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Your experience<textarea required minLength={10} maxLength={1500} rows={4} value={comment} onChange={e=>setComment(e.target.value)}/></label>
    {selected?.hasServices&&<fieldset className={styles.reviewService}>
     <legend>About the services</legend>
     {selected.services&&selected.services.length>0&&<ul className={styles.reviewServices}>{selected.services.map(s=><li key={s}>{s}</li>)}</ul>}
     <label>Service rating<select value={serviceRating} onChange={e=>setServiceRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label>
     <label>Your opinion on the service<textarea required minLength={10} maxLength={1500} rows={3} value={serviceComment} onChange={e=>setServiceComment(e.target.value)}/></label>
    </fieldset>}
    <button type="submit" disabled={!reviewReservation}>Publish review</button>
    {message&&<p role="status">{message}</p>}
   </form>}
  </section>
 </div></main>;
}
