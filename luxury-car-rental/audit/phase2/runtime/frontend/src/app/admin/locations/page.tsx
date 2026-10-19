'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {useConfirm} from '@/components/confirm-dialog';
import {useToast} from '@/components/toast';
import styles from './locations.module.css';

type Category='showroom'|'airport'|'hotel'|'city_center'|'custom';
type Location={id?:string;code:string;name:string;category:Category;city:string;country:string;address:string;
 pickupFee:string;dropoffFee:string;oneWayFee:string;canPickup:boolean;canDropoff:boolean;enabled:boolean;
 timezone:string;opensAt:string;closesAt:string;turnaroundMinutes:number};
type Vehicle={id:string;brandName:string;modelName:string;licensePlate:string;status:string};

const empty:Location={code:'',name:'',category:'showroom',city:'',country:'',address:'',pickupFee:'0.00',dropoffFee:'0.00',oneWayFee:'0.00',canPickup:true,canDropoff:true,enabled:true,
 timezone:'Europe/Paris',opensAt:'09:00',closesAt:'18:00',turnaroundMinutes:0};
const categories:Category[]=['showroom','airport','hotel','city_center','custom'];
// Fuseaux les plus courants (saisie libre possible, format IANA attendu).
const timezones=['Europe/Paris','Europe/London','Europe/Berlin','Europe/Zurich','Europe/Madrid','Europe/Rome','Europe/Monaco','Europe/Amsterdam','Europe/Brussels','Europe/Budapest','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Hong_Kong','Asia/Tokyo'];

// Les lignes anciennes peuvent manquer de colonnes récentes :
// on repasse toujours par les valeurs par défaut.
function toForm(item:Location):Location{
 const minutes=Number(item.turnaroundMinutes);
 return {...empty,...item,
  timezone:item.timezone||empty.timezone,
  opensAt:item.opensAt||empty.opensAt,
  closesAt:item.closesAt||empty.closesAt,
  turnaroundMinutes:Number.isFinite(minutes)?minutes:empty.turnaroundMinutes};
}

export default function AdminLocations(){
 const confirm=useConfirm();
 const toast=useToast();
 const [places,setPlaces]=useState<Location[]>([]);
 const [form,setForm]=useState<Location>(empty);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 // Affectations véhicule <-> lieu (chargées pour le lieu édité).
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [assigned,setAssigned]=useState<string[]>([]);
 const [loadedFor,setLoadedFor]=useState('');
 const [vehicleFilter,setVehicleFilter]=useState('');
 const [assigning,setAssigning]=useState(false);
 const [assignError,setAssignError]=useState('');
 const [assignMessage,setAssignMessage]=useState('');

 const load=useCallback(async()=>{
  try{const r=await fetch('/api/admin/premium/locations',{cache:'no-store'});
   if(!r.ok)throw new Error('Unable to load locations');
   setPlaces(await r.json());setError('');}
  catch(e){setError(e instanceof Error?e.message:'Locations unavailable');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{const initialize=async()=>{await load();};void initialize();},[load]);

 // Toutes les mises à jour d'état sont confinées dans les callbacks
 // asynchrones, pour ne pas déclencher de rendu en cascade.
 useEffect(()=>{
  if(!form.id)return;
  const controller=new AbortController();
  Promise.all([
   fetch('/api/admin/locations/vehicles',{cache:'no-store',signal:controller.signal})
    .then(r=>{if(!r.ok)throw new Error('Vehicles unavailable');return r.json();}),
   fetch(`/api/admin/locations/${form.id}/vehicles`,{cache:'no-store',signal:controller.signal})
    .then(r=>{if(!r.ok)throw new Error('Assignments unavailable');return r.json();}),
  ])
   .then(([list,data])=>{
    if(controller.signal.aborted)return;
    setVehicles(Array.isArray(list)?list as Vehicle[]:[]);
    setAssigned(Array.isArray((data as {vehicleIds?:string[]}).vehicleIds)?(data as {vehicleIds:string[]}).vehicleIds:[]);
    setLoadedFor(form.id??'');
    setAssignError('');
   })
   .catch(e=>{
    if(controller.signal.aborted)return;
    setAssignError(e instanceof Error?e.message:'Assignments unavailable');
    setLoadedFor(form.id??'');
   });
  return ()=>controller.abort();
 },[form.id]);

 const set=<K extends keyof Location>(key:K,value:Location[K])=>setForm(previous=>({...previous,[key]:value}));
 async function save(e:FormEvent){
  e.preventDefault();setSaving(true);setError('');setMessage('');
  try{const data={...form,code:form.code.trim().toUpperCase()};
   // Le backend refuse les champs inconnus ; l'id ne fait pas partie du DTO.
   delete data.id;
   const response=await fetch('/api/admin/premium/locations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   if(!response.ok){const result=await response.json();throw new Error(Array.isArray(result.message)?result.message.join(' '):result.message||'Save failed');}
   setMessage('Location saved. Booking locations and service fees have been updated.');toast.success('Location saved. Booking locations and service fees have been updated.','Locations');setForm(empty);await load();}
  catch(e){const detail=e instanceof Error?e.message:'Unable to save';setError(detail);toast.error(detail,'Locations');}
  finally{setSaving(false);}
 }

 function toggleVehicle(id:string){
  setAssigned(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 }

 // Supprimer un lieu (poubelle). Refusé par le backend s'il est encore
 // référencé par une réservation : dans ce cas, désactiver le lieu plutôt.
 async function deleteLocation(id:string){
  const target=places.find(p=>p.id===id);
  const label=target?target.name:'this location';
  const confirmed=await confirm({title:'Delete location',message:`Delete ${label}? This cannot be undone.`,confirmLabel:'Delete',tone:'danger'});
  if(!confirmed)return;
  setError('');setMessage('');
  try{
   const response=await fetch(`/api/admin/premium/locations?id=${encodeURIComponent(id)}`,{method:'DELETE'});
   if(!response.ok){const result=await response.json().catch(()=>({}) as {message?:string});throw new Error(result.message||'Delete failed');}
   const note=`${label} deleted.`;
   setMessage(note);toast.success(note,'Locations');
   if(form.id===id)setForm(empty);
   await load();
  }catch(e){const detail=e instanceof Error?e.message:'Unable to delete';setError(detail);toast.error(detail,'Locations');}
 }

 async function saveAssignments(){
  if(!form.id)return;
  const confirmed=await confirm({title:'Save vehicle assignments',message:`Replace the vehicles served at ${form.name} with the ${assigned.length} selected vehicle${assigned.length===1?'':'s'}?`,confirmLabel:'Save assignments'});
  if(!confirmed)return;
  setAssigning(true);setAssignError('');setAssignMessage('');
  try{
   const response=await fetch(`/api/admin/locations/${form.id}/vehicles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vehicleIds:assigned})});
   if(!response.ok){const result=await response.json();throw new Error(Array.isArray(result.message)?result.message.join(' '):result.message||'Save failed');}
   const saved=`${assigned.length} vehicle assignment${assigned.length===1?'':'s'} saved for this location.`;
   setAssignMessage(saved);toast.success(saved,'Locations');
  }catch(e){const detail=e instanceof Error?e.message:'Unable to save assignments';setAssignError(detail);toast.error(detail,'Locations');}
  finally{setAssigning(false);}
 }

 const needle=vehicleFilter.trim().toLowerCase();
 const shownVehicles=needle
  ? vehicles.filter(v=>`${v.brandName} ${v.modelName} ${v.licensePlate}`.toLowerCase().includes(needle))
  : vehicles;

 return <main className={styles.page}>
  <header className={styles.hero}>
   <p className={styles.eyebrow}>ADMINISTRATION · LOCATIONS</p><h1 className={styles.title}>Pick-up &amp; drop-off</h1>
   <p className={styles.intro}>Configure the actual locations served by your rental company. New locations must have a real address; fees, opening hours and time zones are enforced by the booking calendar.</p>
  </header>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.success}>{message}</p>}
  <div className={styles.layout}>
   <section className={styles.panel}><h2>{form.id?'Edit location':'Add location'}</h2>
    <form className={styles.form} onSubmit={save}>
     <label>Unique code<input required maxLength={50} pattern="[A-Z0-9_-]{3,50}" value={form.code} disabled={Boolean(form.id)} onChange={e=>set('code',e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,''))}/></label>
     <label>Name<input required maxLength={120} value={form.name} onChange={e=>set('name',e.target.value)}/></label>
     <label>Type<select value={form.category} onChange={e=>set('category',e.target.value as Category)}>{categories.map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></label>
     <div className={styles.two}><label>City<input required maxLength={100} value={form.city} onChange={e=>set('city',e.target.value)}/></label>
      <label>Country<input required maxLength={100} value={form.country} onChange={e=>set('country',e.target.value)}/></label></div>
     <label>Full address / service area<input required maxLength={250} value={form.address} onChange={e=>set('address',e.target.value)}/></label>
     <div className={styles.three}>{([['pickupFee','Pick-up (€)'],['dropoffFee','Drop-off (€)'],['oneWayFee','Different location (€)']] as const).map(([key,title])=><label key={key}>{title}
       <input required type="number" min="0" max="1000000" step="0.01" value={form[key]} onChange={e=>set(key,e.target.value)}/></label>)}</div>
     <div className={styles.three}>
      <label>Time zone (IANA)<input list="timezone-options" required maxLength={40} pattern="[A-Za-z]+/[A-Za-z_]+" value={form.timezone} onChange={e=>set('timezone',e.target.value)}/></label>
      <label>Opens at<input required type="time" value={form.opensAt} onChange={e=>set('opensAt',e.target.value)}/></label>
      <label>Closes at<input required type="time" value={form.closesAt} onChange={e=>set('closesAt',e.target.value)}/></label>
     </div>
     <datalist id="timezone-options">{timezones.map(zone=><option key={zone} value={zone}/>)}</datalist>
     <div className={styles.two}>
      <label>Turnaround buffer between rentals (minutes)<input type="number" min={0} max={720} value={form.turnaroundMinutes} onChange={e=>set('turnaroundMinutes',Number(e.target.value||0))}/></label>
      <div className={styles.toggles}><label><input type="checkbox" checked={form.canPickup} onChange={e=>set('canPickup',e.target.checked)}/> Pickup available</label>
       <label><input type="checkbox" checked={form.canDropoff} onChange={e=>set('canDropoff',e.target.checked)}/> Drop-off available</label>
       <label><input type="checkbox" checked={form.enabled} onChange={e=>set('enabled',e.target.checked)}/> Active</label></div>
     </div>
     <button className={styles.submit} disabled={saving}>{saving?'Saving…':'Save location →'}</button>
     <button type="button" className={styles.reset} onClick={()=>setForm(empty)}>New location</button>
    </form></section>
   <section className={styles.panel}><h2>Service locations <small>{places.length}</small></h2>
    {loading?<p>Loading…</p>:places.length===0?<p>No locations yet. Create your first real showroom, airport or hotel service point.</p>:
     <div className={styles.items}>{places.map(item=><article key={item.id}>
      <div><strong>{item.name}</strong><span>{item.category.replace('_',' ')} · {item.city}, {item.country}</span><small>{item.address}</small>
       <small>Pickup €{item.pickupFee} · Drop-off €{item.dropoffFee} · One-way €{item.oneWayFee}</small>
       <small>{item.timezone||empty.timezone} · {item.opensAt||empty.opensAt}–{item.closesAt||empty.closesAt}{Number(item.turnaroundMinutes)?` · ${item.turnaroundMinutes} min buffer`:''}</small>
       <small><span className={`${styles.badge} ${item.enabled?styles.badgeActive:styles.badgeMuted}`}>{item.enabled?'Active':'Inactive'}</span> · {item.code}</small></div>
      <div className={styles.rowActions}>
       <button onClick={()=>{setForm(toForm(item));setVehicleFilter('');setAssignMessage('');setAssignError('');window.scrollTo({top:0,behavior:'smooth'});}}>Edit</button>
       <button type="button" className={styles.deleteButton} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={()=>void deleteLocation(item.id!)}>🗑</button>
      </div>
     </article>)}</div>}
   </section>
   {form.id&&<section className={styles.panel}>
    <h2>Vehicles served here <small>{assigned.length}</small></h2>
    <p className={styles.hint}>A vehicle is served only at the locations where it appears below. A vehicle with no assignment anywhere remains available at every active location.</p>
    {assignError&&<p role="alert" className={styles.error}>{assignError}</p>}
    {assignMessage&&<p role="status" className={styles.success}>{assignMessage}</p>}
    {loadedFor!==form.id?<p>Loading vehicles…</p>:<>
     <input className={styles.vehicleFilter} type="search" placeholder="Filter by model or plate…" aria-label="Filter vehicles" value={vehicleFilter} onChange={e=>setVehicleFilter(e.target.value)}/>
     <div className={styles.vehicleList}>
      {shownVehicles.length===0&&<p className={styles.hint}>No vehicle matches this filter.</p>}
      {shownVehicles.map(v=><label key={v.id}>
        <input type="checkbox" checked={assigned.includes(v.id)} onChange={()=>toggleVehicle(v.id)}/>
        <span>{v.brandName} {v.modelName}</span>
        <small>{v.licensePlate} · {v.status}</small>
      </label>)}
     </div>
     <div className={styles.assignActions}>
      <button className={styles.submit} onClick={saveAssignments} disabled={assigning}>{assigning?'Saving…':'Save vehicle assignments →'}</button>
      <button type="button" className={styles.reset} onClick={()=>setVehicleFilter('')}>Clear filter</button>
     </div>
    </>}
   </section>}
  </div>
 </main>;
}
