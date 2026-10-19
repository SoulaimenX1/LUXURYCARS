import {randomUUID} from 'node:crypto';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {BadRequestException,NotFoundException} from '@nestjs/common';

// Les images d'inspection sont privées : jamais dans frontend/public.
const storageDir=()=>resolve(process.env.INSPECTION_IMAGES_DIR || join(process.cwd(),'private-inspection-media'));
export interface PrivateUpload {size:number;mimetype:string;buffer:Buffer;originalname:string}
function typeOf(file:PrivateUpload):{extension:string;mime:string}{
 const b=file.buffer;
 if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff) return {extension:'.jpg',mime:'image/jpeg'};
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {extension:'.png',mime:'image/png'};
 if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return {extension:'.webp',mime:'image/webp'};
 throw new BadRequestException('Only JPEG, PNG and WebP images are accepted');
}
export async function savePrivatePhoto(file:PrivateUpload){
 if(!file||file.size>5*1024*1024||file.size<=0||file.size!==file.buffer.length)throw new BadRequestException('Invalid photo size (5 MB maximum)');
 const format=typeOf(file);
 await mkdir(storageDir(),{recursive:true,mode:0o700});
 const filename=`${randomUUID()}${format.extension}`;
 await writeFile(join(storageDir(),filename),file.buffer,{flag:'wx',mode:0o600});
 return filename;
}
export async function deletePrivatePhoto(name:string){
 try{await unlink(join(storageDir(),basename(name)));}catch{/* meilleur effort */}
}
export async function readPrivatePhoto(name:string){
 if(!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)||basename(name)!==name)throw new NotFoundException('Photo not found');
 let content:Buffer;
 try{content=await readFile(join(storageDir(),name));}catch{throw new NotFoundException('Photo not found');}
 const mime=name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';
 return {content,mime};
}
