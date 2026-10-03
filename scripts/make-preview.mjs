import {readFile,writeFile} from 'node:fs/promises';
const data=await readFile('public/assets/demo-data.json','utf8'),rawCss=await readFile('public/assets/style.css','utf8'),logo=await readFile('public/assets/logo.svg','utf8');
const font=await readFile('public/assets/fonts/NotoSansThai.ttf');
const css=rawCss.replaceAll('/assets/fonts/NotoSansThai.ttf','data:font/ttf;base64,'+font.toString('base64'));
const sources=[];for(const file of ['model.js','export.js','charts.js','app.js']){
 let js=await readFile('public/assets/'+file,'utf8');js=js.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 if(file==='app.js')js=js.replace(/start\(\);\s*$/,'').replaceAll('/assets/logo.svg','data:image/svg+xml;base64,'+Buffer.from(logo).toString('base64')).replaceAll('href="/"','href="#"');
 sources.push(js);
}
const seed=data.replaceAll('<','\\u003c');
const init=`const previewData=${seed};state.demo=true;state.user={display_name:'ผู้บริหาร',role:'OWNER'};state.data={...previewData,settings:[],criteria:[],synced_at:new Date().toISOString()};state.year='2568';state.compareA='2567';state.compareB='2568';render();`;
const html=`<!doctype html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R-FUND Insight — UI Preview</title><style>${css}</style></head><body><div id="app"></div><dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" role="status" aria-live="polite"></div><script type="module">${sources.join('\n')}\n${init}</script></body></html>`;
await writeFile('docs/R-FUND-Insight-Preview.html',html);console.log('Created standalone read-only UI preview.');
