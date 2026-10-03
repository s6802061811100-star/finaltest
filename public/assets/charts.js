import {esc,money,num} from './model.js';
export function bars(rows,keys=['total_fund'],labels=['เงินทุนรวม']){
 if(!rows.length)return '<div class="empty">ไม่มีข้อมูลในตัวกรองนี้</div>';
 const max=Math.max(...rows.flatMap(r=>keys.map(k=>Number(r[k])||0)),1);
 return `<div class="legend">${labels.map((l,i)=>`<span><i class="dot c${i}"></i>${esc(l)}</span>`).join('')}<small>หน่วย: บาท</small></div><div class="bars">${rows.map(r=>`<div class="bar-row"><span class="bar-label" title="${esc(r.faculty_name)}">${esc(r.faculty_name)}</span><div class="bar-series">${keys.map((k,i)=>`<div class="bar-track"><div class="bar-fill c${i}" style="width:${Math.max(0,Number(r[k])/max*100)}%"></div><span>${money(r[k])}</span></div>`).join('')}</div></div>`).join('')}</div>`;
}
export function donut(internal,external){
 if(internal==null||external==null)return '<div class="empty">ไม่มีข้อมูลแหล่งทุน</div>';
 const total=internal+external,share=total?external/total:0,c=2*Math.PI*64;
 return `<div class="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label="สัดส่วนทุนภายนอก ${num(share*100)} เปอร์เซ็นต์"><defs><linearGradient id="donutGradient"><stop stop-color="#2097fb"/><stop offset="1" stop-color="#4a2aff"/></linearGradient></defs><circle cx="90" cy="90" r="64" fill="none" stroke="#d1d8e1" stroke-width="17"/><circle cx="90" cy="90" r="64" fill="none" stroke="url(#donutGradient)" stroke-width="17" stroke-linecap="round" stroke-dasharray="${share*c} ${c}" transform="rotate(-90 90 90)"/><text x="90" y="89" text-anchor="middle" class="donut-value">${num(share*100)}%</text><text x="90" y="111" text-anchor="middle" class="donut-label">ทุนภายนอก</text></svg></div><div class="source-row"><span><i class="dot c0"></i>ภายใน</span><b>${money(internal)}</b></div><div class="source-row"><span><i class="dot c1"></i>ภายนอก</span><b>${money(external)}</b></div>`;
}
export function trend(points){
 if(!points.length)return '<div class="empty">ไม่มีข้อมูลแนวโน้ม</div>';
 const w=620,h=180,pad=35,max=Math.max(...points.map(p=>p.value),1),coord=points.map((p,i)=>[points.length===1?w/2:pad+i*(w-pad*2)/(points.length-1),h-pad-(p.value/max)*(h-pad*2)]);
 const line=coord.map(([x,y])=>`${x},${y}`).join(' ');
 return `<svg class="trend-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="เงินทุนรวมแยกตามปี"><defs><linearGradient id="lineGradient"><stop stop-color="#2097fb"/><stop offset="1" stop-color="#4a2aff"/></linearGradient></defs>${[0,1,2].map(i=>`<line x1="${pad}" x2="${w-pad}" y1="${pad+i*(h-pad*2)/2}" y2="${pad+i*(h-pad*2)/2}" stroke="#d4dce5" stroke-dasharray="4 6"/>`).join('')}<polyline points="${line}" fill="none" stroke="url(#lineGradient)" stroke-width="5" stroke-linejoin="round"/>${coord.map(([x,y],i)=>`<g><title>${points[i].year}: ${money(points[i].value)} บาท</title><circle cx="${x}" cy="${y}" r="7" fill="#4539fa"/><text x="${x}" y="${Math.max(16,y-15)}" text-anchor="middle">${num(points[i].value/1e6)} ลบ.</text><text x="${x}" y="${h-6}" text-anchor="middle">${points[i].year}</text></g>`).join('')}</svg>`;
}
