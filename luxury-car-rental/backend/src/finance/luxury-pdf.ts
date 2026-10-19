// Générateur PDF minimal sans dépendance externe : fichier PDF 1.4 lisible
// dans les lecteurs classiques. Texte limité à ASCII pour Helvetica de base.
import {Buffer} from 'node:buffer';

export function createLuxuryPdf(title:string,subtitle:string,lines:string[]):Buffer{
 const esc=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\x20-\x7E]/g,'?').replace(/[()\\]/g,'\\$&');
 const commands:string[]=[
  '0.060 0.068 0.080 rg 0 745 595 97 re f',
  '0.82 0.68 0.45 rg 44 728 505 2 re f',
  `BT /F2 24 Tf 0.93 0.86 0.68 rg 44 784 Td (${esc(title)}) Tj ET`,
  `BT /F1 10 Tf 0.88 0.85 0.78 rg 44 763 Td (${esc(subtitle)}) Tj ET`,
  '0.15 0.15 0.16 rg',
 ];
 let y=695;
 for(const line of lines.slice(0,32)){
  const segments=line.match(/.{1,95}(?:\s|$)/g)??[line];
  for(const segment of segments){
   if(y<70) break;
   commands.push(`BT /F1 11 Tf 44 ${y} Td (${esc(segment.trim())}) Tj ET`);
   y-=22;
  }
 }
 commands.push('0.73 0.60 0.41 rg 44 54 507 1 re f');
 commands.push('BT /F1 9 Tf 0.39 0.39 0.39 rg 44 36 Td (LUXURY CARS - DEMONSTRATION DOCUMENT) Tj ET');
 const content=commands.join('\n')+'\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  `<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}endstream`,
 ];
 const chunks:Buffer[]=[Buffer.from('%PDF-1.4\n','ascii')];
 const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(chunks.reduce((sum,c)=>sum+c.length,0));
  chunks.push(Buffer.from(`${i+1} 0 obj\n${objects[i]}\nendobj\n`,'latin1'));
 }
 const xref=chunks.reduce((sum,c)=>sum+c.length,0);
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`,'ascii'));
 for(const offset of offsets.slice(1)) chunks.push(Buffer.from(`${String(offset).padStart(10,'0')} 00000 n \n`,'ascii'));
 chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,'ascii'));
 return Buffer.concat(chunks);
}
