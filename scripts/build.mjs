import {mkdir,rm,cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true,filter:source=>!source.endsWith('demo-data.json')});
console.log('Built dist/ — demonstration dataset excluded from production.');
