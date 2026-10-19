'use client';
import Link from 'next/link';
import {createElement,useEffect,useMemo,useState} from 'react';
import {useParams} from 'next/navigation';
import {Price} from '@/components/currency-provider';
import type {VehicleItem} from '@/lib/catalog-types';
import styles from './vehicle-detail.module.css';

type Review={id:string;rating:number;title:string;comment:string;serviceRating:number|null;serviceComment:string|null;reviewer:string;createdAt:string};
type EditorialReview={id:string;headline:string;body:string;verdict:string|null;source:string;createdAt:string};
type Media={photos:{id:string;url:string;alt:string}[];videos:{id:string;url:string;poster:string|null}[];modelUrl:string|null};
const emptyMedia:Media={photos:[],videos:[],modelUrl:null};
type Tab='photos'|'videos'|'3d';

export default function VehicleDetail(){
  const {id}=useParams<{id:string}>();
  const [vehicle,setVehicle]=useState<VehicleItem|null>(null);
  const [reviews,setReviews]=useState<Review[]>([]);
  const [editorial,setEditorial]=useState<EditorialReview[]>([]);
  const [media,setMedia]=useState<Media>(emptyMedia);
  const [activePhoto,setActivePhoto]=useState(0);
  const [tab,setTab]=useState<Tab>('photos');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    const controller=new AbortController();
    async function load(){try{
      const [catalogResponse,mediaResponse,reviewsResponse,editorialResponse]=await Promise.all([
        fetch('/api/vehicles/catalog',{cache:'no-store',signal:controller.signal}),
        fetch(`/api/vehicles/media/${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal}),
        fetch(`/api/premium/reviews/${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal}),
        fetch(`/api/premium/editorial-reviews/${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal}),
      ]);
      if(!catalogResponse.ok)throw new Error('Vehicle catalogue unavailable');
      const catalog:VehicleItem[]=await catalogResponse.json();
      const found=catalog.find(c=>c.id===id);
      if(!found)throw new Error('This vehicle is no longer in the catalogue.');
      const assets:Media=mediaResponse.ok?await mediaResponse.json():emptyMedia;
      const feedback:Review[]=reviewsResponse.ok?await reviewsResponse.json():[];
      const editorials:EditorialReview[]=editorialResponse.ok?await editorialResponse.json():[];
      if(!controller.signal.aborted){setVehicle(found);setMedia(assets);setReviews(feedback);setEditorial(editorials);}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load vehicle');}
    finally{if(!controller.signal.aborted)setLoading(false);}}
    void load();return ()=>controller.abort();
  },[id]);

  // Titre d'onglet propre à la voiture : le layout « /vehicles » impose
  // « Our Fleet », ce qui laissait croire qu'on ouvrait la flotte.
  useEffect(()=>{
    if(vehicle) document.title=`${vehicle.brandName} ${vehicle.modelName} | Luxury Cars`;
  },[vehicle]);

  // Chargement différé du lecteur GLB : le script tiers n'est pas nécessaire au catalogue.
  useEffect(()=>{
    if(tab!=='3d'||!media.modelUrl||document.querySelector('script[data-vehicle-model-viewer]'))return;
    const script=document.createElement('script');
    script.type='module';script.dataset.vehicleModelViewer='true';
    script.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
    document.head.appendChild(script);
  },[tab,media.modelUrl]);

  const photos=useMemo(()=>{
    const all=[...media.photos];
    // Les nouveaux médias ne doivent pas faire disparaître la photo historique.
    if(vehicle?.imageUrl&&!all.some(p=>p.url===vehicle.imageUrl))
      all.unshift({id:'primary',url:vehicle.imageUrl,alt:`${vehicle.brandName} ${vehicle.modelName}`});
    return all;
  },[media.photos,vehicle]);

  // Diaporama automatique de la galerie photo : les images défilent
  // en boucle (fondu enchaîné) sans jamais s'agrandir ni s'ouvrir en
  // plein écran. Désactivé si l'utilisateur limite les animations.
  useEffect(()=>{
    if(tab!=='photos'||photos.length<2)return;
    if(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setInterval(()=>setActivePhoto(x=>(x+1)%photos.length),4500);
    return ()=>window.clearInterval(timer);
  },[tab,photos.length]);

  const photo=photos[Math.min(activePhoto,Math.max(0,photos.length-1))];
  const tabNames: {key:Tab;name:string;number:number|null}[]=[
    {key:'photos',name:'Photo gallery',number:photos.length},
    {key:'videos',name:'Test drive films',number:media.videos.length},
    {key:'3d',name:'Interactive 3D',number:media.modelUrl?1:0},
  ];
  return <main className={styles.page}><div className={styles.wrap}>
    <Link href="/vehicles" className={styles.back}>← The collection</Link>
    {loading?<p className={styles.message}>Preparing your private viewing…</p>:error?<p role="alert" className={styles.message}>{error}</p>:vehicle&&<>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>THE COLLECTION · {vehicle.categoryName}</p>
          <h1>{vehicle.brandName} <em>{vehicle.modelName}</em></h1>
          <p className={styles.summary}>{vehicle.description||'An exceptional driving experience, tailored to your journey.'}</p></div>
        <div className={styles.dailyPrice}><span>DAILY RATE FROM</span><strong><Price value={vehicle.dailyPrice}/></strong></div>
      </div>
      <section className={styles.gallery} aria-label="Vehicle media experience">
        <div className={styles.tabs} role="tablist" aria-label="Media type">
          {tabNames.map(x=><button key={x.key} type="button" role="tab" aria-selected={tab===x.key}
            className={tab===x.key?styles.tabActive:styles.tab} onClick={()=>setTab(x.key)}>{x.name}<small>{x.number}</small></button>)}
        </div>
        {tab==='photos'&&<div>
          {photo?<div className={styles.heroStage}>
              {/* Diaporama en boucle : toutes les photos sont empilées et
                  apparaissent en fondu. Aucun agrandissement, aucun zoom. */}
              {/* URL des médias fournie par le backend, sans réécriture. */}
              {photos.map((item,index)=><img key={item.id} src={item.url} alt={item.alt}
                className={index===activePhoto?styles.heroSlideActive:styles.heroSlide}
                loading={index===0?'eager':'lazy'} />)}
            </div>:<div className={styles.mediaEmpty}>Photos are being prepared for this vehicle.</div>}
          {photos.length>1&&<div className={styles.thumbs}>{photos.map((item,index)=><button key={item.id}
            type="button" onClick={()=>setActivePhoto(index)} className={activePhoto===index?styles.thumbActive:styles.thumb} aria-label={`View photo ${index+1}`} aria-pressed={activePhoto===index}>
              <img src={item.url} alt={item.alt} loading="lazy"/></button>)}</div>}
        </div>}
        {tab==='videos'&&<div className={styles.videoGrid}>
          {media.videos.length?media.videos.map((video,index)=><div key={video.id} className={styles.videoCard}>
            <video src={video.url} poster={video.poster??vehicle.imageUrl??undefined}
              autoPlay muted loop playsInline preload="metadata"
              disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback"
              aria-label={`Test drive film ${index+1}`}/>
            <p>DRIVING FILM {String(index+1).padStart(2,'0')}</p>
          </div>):<div className={styles.mediaEmpty}>The test drive film for this car has not been added yet.</div>}
        </div>}
        {tab==='3d'&&<div className={styles.modelFrame}>
          {media.modelUrl?<>
            {createElement('model-viewer',{
              src:media.modelUrl,alt:`Interactive 3D model of ${vehicle.brandName} ${vehicle.modelName}`,
              'camera-controls':'','auto-rotate':'','shadow-intensity':'1','touch-action':'pan-y',
              style:{width:'100%',height:'min(65vh,560px)',background:'transparent'},
            })}
            <div className={styles.modelTools}><span>Drag to rotate · Pinch or scroll to zoom</span>
              <a href={media.modelUrl} download>Download GLB ↗</a></div>
          </>:<div className={styles.mediaEmpty}>3D showroom coming soon for this vehicle. A real GLB model must be uploaded by the fleet manager.</div>}
        </div>}
      </section>
      <div className={styles.grid}>
        <section className={styles.panel}><span className={styles.eyebrow}>PERFORMANCE & CRAFT</span>
          <h2>The finer details</h2>
          <dl className={styles.specs}>
            {([['Model year',vehicle.manufactureYear],['Power',vehicle.powerHp?`${vehicle.powerHp} HP`:'—'],
              ['Transmission',vehicle.transmission],['Seats',vehicle.seats],['Fuel',vehicle.fuelType],
              ['Engine',vehicle.engine||'—'],['0–100 km/h',vehicle.acceleration0To100?`${vehicle.acceleration0To100} s`:'—'],
              ['Top speed',vehicle.topSpeedKmh?`${vehicle.topSpeedKmh} km/h`:'—']] as [string,string|number][])
              .map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <section className={styles.panel}><span className={styles.eyebrow}>PRIVATE RESERVATION</span>
          <h2>Your driving experience</h2><p>Choose your dates and collection location before submitting your request.</p>
          <dl className={styles.specs}><div><dt>Daily rental</dt><dd><Price value={vehicle.dailyPrice}/></dd></div>
          <div><dt>Security deposit</dt><dd><Price value={vehicle.securityDeposit}/></dd></div>
          <div><dt>Vehicle value</dt><dd><Price value={vehicle.vehicleValue}/></dd></div></dl>
          <Link href={`/vehicles/${encodeURIComponent(vehicle.id)}/reserve`} className={styles.cta}>RESERVE THIS VEHICLE <span>→</span></Link>
          <Link href="/contact" className={styles.ctaSecondary}>CONTACT US <span>→</span></Link>
          <p className={styles.finePrint}>Your vehicle and exact dates are checked before booking. Airport, hotel and custom delivery requests are subject to staff confirmation.</p>
        </section>
      </div>
      {editorial.length>0&&<section className={styles.panel}><span className={styles.eyebrow}>THE MAISON REVIEW</span>
        <h2>Our editorial take</h2>
        <div className={styles.editorial}>{editorial.map(er=><article key={er.id}>
          <h3>{er.headline}</h3>
          <p className={styles.editorialBody}>{er.body}</p>
          {er.verdict&&<p className={styles.editorialVerdict}>{er.verdict}</p>}
          <small>{er.source} · Editorial review</small></article>)}</div>
      </section>}
      <section className={styles.panel}><span className={styles.eyebrow}>CLIENT EXPERIENCE</span><h2>Verified guest experiences</h2>
        {reviews.length===0?<p>No customer reviews yet.</p>:<div className={styles.reviews}>{reviews.map(r=><article key={r.id}>
          <p aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</p>
          <h3>{r.title}</h3><p>{r.comment}</p>
          {r.serviceRating!=null&&<div className={styles.serviceReview}>
            <p className={styles.serviceReviewLabel}>Service{typeof r.serviceRating==='number'?<> · <span aria-label={`${r.serviceRating} out of 5 stars`}>{'★'.repeat(r.serviceRating)}{'☆'.repeat(5-r.serviceRating)}</span></>:null}</p>
            {r.serviceComment&&<p>{r.serviceComment}</p>}
          </div>}
          <small>{r.reviewer} · Verified guest</small></article>)}</div>}
      </section>
    </>}
  </div></main>;
}
