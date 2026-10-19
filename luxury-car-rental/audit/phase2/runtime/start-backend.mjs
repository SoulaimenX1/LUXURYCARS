import {readFile} from 'node:fs/promises';
Object.assign(process.env,JSON.parse(await readFile(new URL('./backend-env.json',import.meta.url),'utf8')));
await import("file:///C:/Users/soulaimen%20pc/Desktop/LUXURYCARS/luxury-car-rental/backend/dist/main.js");
