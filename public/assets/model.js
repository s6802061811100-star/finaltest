export const money=n=>n==null?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export const num=n=>n==null?'—':Number(n).toLocaleString('th-TH',{maximumFractionDigits:2});
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function summary(rows){
 if(!rows.length)return {count:0,internal:null,external:null,total:null,fte:null,average:null,score:null};
 const internal=rows.reduce((s,r)=>s+Number(r.internal_fund),0),external=rows.reduce((s,r)=>s+Number(r.external_fund),0),fte=rows.reduce((s,r)=>s+Number(r.teacher_count),0);
 const scores=rows.filter(r=>r.score!=='' && r.score!=null).map(r=>Number(r.score));
 return {count:rows.length,internal,external,total:internal+external,fte,average:fte>0?(internal+external)/fte:null,score:scores.length?scores.reduce((s,v)=>s+v,0)/scores.length:null};
}
export function change(current,baseline){return current==null||baseline==null||baseline===0?null:(current-baseline)/baseline*100;}
export function comparisons(rows,a,b){
 const ids=[...new Set(rows.filter(r=>[Number(a),Number(b)].includes(Number(r.academic_year))).map(r=>r.faculty_id))];
 return ids.map(id=>{const before=rows.find(r=>r.faculty_id===id && Number(r.academic_year)===Number(a)),after=rows.find(r=>r.faculty_id===id && Number(r.academic_year)===Number(b));
 return {id,name:(after||before).faculty_name,before:before?Number(before.total_fund):null,after:after?Number(after.total_fund):null,delta:before&&after?Number(after.total_fund)-Number(before.total_fund):null,percent:change(after?Number(after.total_fund):null,before?Number(before.total_fund):null)};});
}
export function filtered(rows,{year,faculty,search}={}){const q=(search||'').toLocaleLowerCase();return rows.filter(r=>(!year||Number(r.academic_year)===Number(year))&&(!faculty||r.faculty_id===faculty)&&(!q||`${r.faculty_name} ${r.academic_year} ${r.note||''}`.toLocaleLowerCase().includes(q)));}
export const percent=n=>n==null?'—':`${n>0?'+':''}${num(n)}%`;
export const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>`"${String(typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');}
