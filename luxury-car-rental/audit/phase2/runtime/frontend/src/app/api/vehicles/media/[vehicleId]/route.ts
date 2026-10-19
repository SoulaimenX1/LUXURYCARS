import {NextResponse} from 'next/server';
import {buildApiUrl} from '@/lib/api';

type Context={params:Promise<{vehicleId:string}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Proxy public de la galerie d'un véhicule actif.
export async function GET(_req:Request,ctx:Context){
 const {vehicleId}=await ctx.params;
 if(!UUID.test(vehicleId)) return NextResponse.json({message:'Invalid vehicle ID'},{status:400});
 try{
  const response=await fetch(buildApiUrl(`/vehicles/media/${vehicleId}`),{cache:'no-store'});
  const json=await response.json();
  return NextResponse.json(json,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({message:'Vehicle media unavailable'},{status:502});}
}
