"use strict";
const app = document.querySelector("#app");
const icons = {
 brand:'<path d="M4 6h12l4 4v7h-5l-4 3v-3H4z"/><path d="M8 13l2-3 3 3 2-2h2"/>', grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 equal:'<path d="M4 19V5m0 14h16M8 15l4-4 3 2 5-7M16 6h4v4"/>', msg:'<path d="M21 11a8 8 0 0 1-8 8H6l-3 2v-7a8 8 0 1 1 18-3Z"/><path d="M8 11h8m-8 3h4"/>', flag:'<path d="M5 22V3m0 1c5-4 8 4 14 0v11c-6 4-9-4-14 0"/>', file:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/>',
 down:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>', plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M9 18l6-6-6-6"/>', right:'<path d="M4 12h15m-6-6 6 6-6 6"/>', back:'<path d="M20 12H5m6-6-6 6 6 6"/>', dots:'<path d="M6 12h.01m6 0h.01m6 0h.01" stroke-width="3"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check:'<path d="M5 12l4 4L19 6"/>', flask:'<path d="M9 3h6m-5 0v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 14h8"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 spark:'<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>', list:'<path d="M8 6h12M8 12h12m-12 6h12M4 6h.01M4 12h.01M4 18h.01"/>', trash:'<path d="M4 7h16m-14 0 1 13h10l1-13M9 7V4h6v3"/>', edit:'<path d="m13 6 5 5m-13 8 4-.8L20 7l-4-4L5 14.2z"/>', calendar:'<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3v6m8-6v6M4 11h16"/>'
};
const I=(i,c="")=>'<svg class="ico '+c+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[i]||icons.info)+'</svg>';
const e=(v)=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const attr=e;
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=()=>Math.random().toString(36).slice(2,10);
const base = [
 ["speed","Tiempo de respuesta","Minutos entre la consulta y la primera respuesta humana.","all","auto"],
 ["need","Comprensión de la necesidad","Pregunta por el objetivo o contexto antes de recomendar.","all","auto"],
 ["clarity","Claridad de la respuesta","Explica requisitos, costos o condiciones sin ambigüedades.","all","auto"],
 ["objection","Manejo de objeciones","Reconoce la preocupación y ofrece una alternativa concreta.","all","prompt"],
 ["next","Siguiente paso","Propone un paso concreto dentro de la conversación.","all","auto"]
].map(([id,name,desc,scope,mode])=>({id,name,desc,scope,mode,weight:1,type:"base"}));
const international={id:"intl",name:"Internacionalidad",desc:"Explica un beneficio internacional con un ejemplo concreto.",weight:1,scope:"all",mode:"prompt",type:"custom"};
const scenarios=[
 {id:"price",name:"Consulta de producto y precio",ask:"Hola, estoy buscando un programa de software en modalidad virtual. ¿Cuánto cuesta y qué incluye el precio?"},
 {id:"recommend",name:"Pedido de recomendación",ask:"Trabajo por las tardes y recién estoy empezando en tecnología. ¿Qué programa me recomendarías y por qué?"},
 {id:"object",name:"Objeción de precio",ask:"Me cotizaron menos en otro instituto. Con mi presupuesto, ¿qué alternativa me recomendarías?"},
 {id:"compare",name:"Pregunta por una alternativa",ask:"Estoy comparando opciones. ¿Qué diferencia a este programa de otros similares?"}
];
const scenario = id => scenarios.find(x=>x.id===id);
const blank=()=>({id:uid(),name:"",sector:"",offer:"",sample:2,status:"draft",date:new Date().toLocaleDateString("es-PE",{month:"short",year:"numeric"}),own:{id:"own",name:"Mi empresa",phones:[phone()]},competitors:[],criteria:clone(base),scenarios:["price","recommend","object"]});
function phone(){return {id:uid(),label:"",number:"",kind:"Sin especificar"}}
let db={selected:null,campaigns:[]},page="campaigns",tab="summary",edit=null,step=0,formError="",rubricText="",suggestions=[],template="general",mobile=false,launching=false,toastTimer=0;
async function api(path, options={}) {
 const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 if(response.status===401){location.href='/login';throw new Error('Acceso requerido');}
 if(!response.ok){let info;try{info=await response.json();}catch{}throw new Error(typeof info?.detail==='string'?info.detail:'No se pudo completar la operación. Intenta de nuevo.');}
 return response.json();
}
async function boot(){
 app.innerHTML='<p role="status">Cargando campañas…</p>';
 try{db.campaigns=await api('/campaigns');const selected=new URL(location.href).searchParams.get('campaign');db.selected=db.campaigns.some(c=>c.id===selected)?selected:db.campaigns[0]?.id;if(selected&&current()?.status==='complete')page='benchmark';render();}
 catch(err){app.innerHTML='<p role="alert">'+e(err.message)+'</p><button onclick="location.reload()">Reintentar</button>';}
}
let filter={scenario:"all",competitor:"all",status:"all"};
const current=()=>db.campaigns.find(x=>x.id===db.selected)||db.campaigns[0];
const companies=c=>[c.own,...c.competitors];
const nameOf=(c,id)=>companies(c).find(x=>x.id===id)?.name||"Canal";
const observed=(crit,co)=>crit.scope==="all"||crit.scope===(co.id==="own"?"own":"competitor");
function save(){const url=new URL(location.href);if(db.selected)url.searchParams.set('campaign',db.selected);history.replaceState(null,'',url);}
const sNum=(v,n=1)=>v==null?"—":new Intl.NumberFormat("es-PE",{minimumFractionDigits:n,maximumFractionDigits:n}).format(v);
const sol=v=>v==null?"—":"S/ "+sNum(v,0);
const titleCase=x=>(x||"").trim().replace(/^./,a=>a.toUpperCase());
const types={human:["Respuesta humana","green"],bot:["Solo respondió el bot","amber"],silent:["No respondió","red"]};
function resultRows(c){return c?.results||[];}
function evidenceText(row,crit){
 const ids=crit?row.evidence?.[crit.id]:row.quote?.message_ids;
 const messages=(row.messages||[]).filter(m=>ids?ids.includes(m.id):m.sender!=="buyer");
 return messages.map(m=>m.text).join("\n")||row.criterion_status?.[crit?.id]||(row.type==="silent"?"No llegó ningún mensaje durante la ventana simulada de 24 horas.":"Sin evidencia");
}
function stats(list,crit){
 const usable=list.filter(r=>typeof r.scores[crit.id]==="number");const n=usable.length;
 return {n,avg:n?usable.reduce((a,b)=>a+b.scores[crit.id],0)/n:null,time:n&&crit.id==="speed"?usable.map(r=>r.minutes).sort((a,b)=>a-b).reduce((a,_,i,v)=>i===Math.floor((v.length-1)/2)?(v[i]+v[Math.ceil((v.length-1)/2)])/2:a,0):null};
}
function comparableCriteria(c,rows,cos){return c.criteria.filter(cr=>cr.scope==="all"&&cos.every(co=>rows.some(r=>r.co===co.id&&r.scores[cr.id]!=null)));}
function aggregate(c,list,eligible=c.criteria.filter(x=>x.scope==="all")){const pairs=eligible.map(crit=>({value:stats(list,crit).avg,weight:Number(crit.weight)||1})).filter(x=>x.value!==null);return pairs.length?pairs.reduce((a,x)=>a+x.value*x.weight,0)/pairs.reduce((a,x)=>a+x.weight,0):null;}
const P=(label,kind="")=>'<span class="pill '+kind+'">'+e(label)+'</span>';
const button=(label,act,icon="",klass="",extra="")=>'<button type="button" class="btn '+klass+'" data-act="'+act+'" '+extra+'>'+(icon?I(icon,"small"):"")+e(label)+'</button>';
const trash=(act,extra,label)=>'<button class="iconbtn" type="button" data-act="'+act+'" '+extra+' aria-label="'+attr(label)+'">'+I("trash","small")+'</button>';
const th=label=>'<th scope="col">'+e(label)+'</th>';
const statusP=type=>P(types[type][0],types[type][1]);
const isComplete=c=>c.status==="complete";
const pageInfo={benchmark:["Comparativa","equal"],own:["Mi canal","msg"],competitors:["Competencia","flag"],campaigns:["Campañas","grid"],builder:["Configurar campaña","edit"]};
function navItem(key){return '<button class="nav" data-act="nav" data-page="'+key+'" '+(page===key?'aria-current="page"':"")+'>'+I(pageInfo[key][1])+e(pageInfo[key][0])+'</button>';}
function render(){
 if(!db.campaigns.length && page!=="builder" && page!=="campaigns")page="campaigns";
 const c=current();
 app.innerHTML='<div class="shell"><aside class="sidebar '+(mobile?"open":"")+'" id="sidebar" aria-label="Menú principal"><button class="brand" data-act="nav" data-page="benchmark"><span class="logo">'+I("brand")+'</span><span>Mystery<b>AI</b></span></button><div class="workspace"><span class="mini">MA</span><div><strong>Espacio comercial</strong><small>Inteligencia por WhatsApp</small></div></div><nav aria-label="Navegación"><div class="navlabel">Resultados</div><div class="navgroup">'+["benchmark","own","competitors"].map(navItem).join("")+'</div><div class="navlabel">Gestión</div><div class="navgroup">'+navItem("campaigns")+'</div></nav><div class="sidefoot"><div class="demo-side">'+I("flask","small")+' Entorno de demostración</div><div class="user"><span class="avatar">JC</span><div><strong>Jefe comercial</strong><small>Espacio de prueba</small></div></div></div></aside><div class="right"><header class="topbar"><div class="breadcrumb"><button class="iconbtn mobile-menu" data-act="menu" aria-controls="sidebar" aria-expanded="'+mobile+'" aria-label="Abrir menú">'+I("menu")+'</button><button class="crumb" data-act="nav" data-page="campaigns">Campañas</button>'+I("arrow","small")+'<strong>'+e(page==="builder"?(edit.name||"Nueva campaña"):pageInfo[page][0])+'</strong></div><button class="method" data-act="method" aria-label="Cómo se mide">'+I("info","small")+' Cómo se mide</button></header><main class="main" id="main" tabindex="-1">'+(page==="builder"?builder():page==="campaigns"?campaigns():page==="benchmark"?benchmark(c):detail(c,page))+'</main></div></div><dialog class="drawer" id="drawer" aria-labelledby="drawer-title"></dialog>';
}
function hero(title,desc,actions=""){return '<div class="hero"><div><h1>'+e(title)+'</h1><p class="sub">'+e(desc)+'</p></div><div class="actions">'+actions+'</div></div>'}
function campaignStrip(c,rs){const humans=rs.filter(x=>x.type==="human").length;return '<div class="campaign-strip"><div class="strip-left">'+P("Datos simulados","demo")+'<strong>'+e(c.name)+'</strong><span class="strip-meta">'+I("calendar","small")+e(c.sector||"Sin sector")+'</span></div><div class="strip-right"><span class="strip-meta">'+I("msg","small")+' WhatsApp</span><span class="strip-meta"><b>'+humans+'</b> / '+rs.length+' pruebas con respuesta humana</span></div></div>'}
function scoreFormat(stat,crit){if(stat.avg===null)return '<span class="score none">—</span>';return (crit.id==="speed"?'<span class="timeval">'+sNum(stat.time,stat.time%1?1:0)+' min</span>':'<span class="score '+(stat.avg>=4.15?"strong":stat.avg>=3.65?"medium":"low")+'">'+sNum(stat.avg)+'</span>')+I("arrow","cell-arrow");}
function scoreMatrix(c,cos,rows,showFilter=true){
 const applicable=c.criteria.filter(x=>x.scope==="all"), eligible=comparableCriteria(c,rows,cos);
 const by={};cos.forEach(x=>by[x.id]=rows.filter(r=>r.co===x.id));
 const h=cos.map(x=>'<th scope="col" class="'+(x.id==="own"?"owncol":"")+'">'+e(x.name)+'<small>'+(x.id==="own"?"Tu canal":"Competencia")+' · '+by[x.id].length+' pruebas</small></th>').join("");
 const cells=applicable.map(cr=>'<tr><th scope="row">'+e(cr.name)+'<small>'+e(cr.id==="speed"?"Primera respuesta humana · mediana":cr.type==="custom"?(cr.mode==="prompt"?"Personalizado · si se pregunta":"Personalizado · mención espontánea"):"Escala de 1 a 5")+'</small></th>'+cos.map(co=>{const st=stats(by[co.id],cr);return '<td class="'+(co.id==="own"?"owncol":"")+'"><button class="score-button" data-act="evidence" data-co="'+attr(co.id)+'" data-crit="'+attr(cr.id)+'" aria-label="'+attr(cr.name+" · "+co.name+" · "+(st.avg===null?"sin dato":(cr.id==="speed"?sNum(st.time)+" minutos":sNum(st.avg)+" de 5")))+" · "+st.n+' pruebas">'+scoreFormat(st,cr)+'</button></td>';}).join("")+'</tr>').join("");
 return '<section class="panel"><header class="panel-heading"><div><h2>Calidad de atención</h2><p>Selecciona un resultado para revisar la evidencia del chat.</p></div>'+(showFilter?scenarioSelect():"")+'</header><div class="table-scroll" tabindex="0" role="region" aria-label="Matriz de calidad de atención"><table class="matrix"><thead><tr><th scope="col">Criterio de evaluación<small>La misma rúbrica para todos los canales</small></th>'+h+'</tr></thead><tbody>'+cells+'</tbody><tfoot><tr><th scope="row">Nota global <small class="muted">/ 5</small></th>'+cos.map(co=>'<td class="'+(co.id==="own"?"owncol":"")+'">'+sNum(aggregate(c,by[co.id],eligible))+'</td>').join("")+'</tr></tfoot></table></div><div class="legend"><span class="key"><span class="dot g"></span> Desempeño alto</span><span class="key"><span class="dot"></span> Intermedio</span><span class="key"><span class="dot a"></span> Oportunidad</span><span>— Sin evidencia suficiente</span></div></section>';
}
function scenarioSelect(){return '<div class="toolbar"><label>Escenario <select id="scenario-filter" data-filter="scenario" aria-label="Filtrar escenario"><option value="all">Todos los escenarios</option>'+current().scenarios.map(id=>'<option value="'+id+'" '+(id===filter.scenario?"selected":"")+'>'+e(scenario(id)?.name||id)+'</option>').join("")+'</select></label></div>';}
function filterRows(rs){return filter.scenario==="all"?rs:rs.filter(x=>x.scenario===filter.scenario)}
function benchmark(c){
 const rows=resultRows(c), cos=companies(c), own=rows.filter(x=>x.co==="own");
 const actions=(isComplete(c)?button("Descargar Excel","export","down"):"")+button("Nueva campaña","new","plus","primary");
 if(!isComplete(c))return hero("Comparativa comercial","Compara atención y cotizaciones de WhatsApp en un mismo lugar.",actions)+draftEmpty(c);
 const ownSpeed=stats(own,base[0]).time;
 const relevant=cos.filter(x=>x.id!=="own").flatMap(co=>[stats(rows.filter(r=>r.co===co.id),base[0]).time]).filter(x=>x!=null);
 const ownObj=stats(own,base[3]).avg, compObj=cos.filter(x=>x.id!=="own").map(co=>stats(rows.filter(r=>r.co===co.id),base[3]).avg).filter(x=>x!=null);
 const finding=ownSpeed!=null&&relevant.length&&ownSpeed<Math.min(...relevant)?"Tu canal da la primera respuesta humana más rápido"+(ownObj!=null&&compObj.some(x=>x>ownObj)?", pero queda por detrás de al menos un competidor en manejo de objeciones.":"."):"Compara la calidad de atención por criterio y revisa la evidencia antes de interpretar la nota global.";
 return hero("Comparativa comercial","Cómo atiende tu WhatsApp y qué oferta comunica frente a la competencia.",actions)+campaignStrip(c,rows)+
 '<div class="tabs" role="tablist" aria-label="Resultados comparativos">'+[["summary","Resumen"],["quality","Atención"],["offers","Cotizaciones"]].map(([id,label])=>'<button id="tab-'+id+'" aria-controls="benchmark-panel" class="tab" role="tab" aria-selected="'+(tab===id)+'" data-act="tab" data-tab="'+id+'">'+label+'</button>').join("")+'</div><div id="benchmark-panel" role="tabpanel" aria-labelledby="tab-'+tab+'">'+
 (tab!=="offers"?'<div class="summary-line">'+I("spark")+'<span><strong>Lectura del benchmark</strong> · '+e(finding)+'</span></div>'+scoreMatrix(c,cos,filterRows(rows)):"")+
 (tab!=="quality"?offerPanel(c,rows,cos):"")+"</div>";
}
function representativeOffers(rows,cos){return cos.map(co=>({co,offer:rows.find(r=>r.co===co.id&&r.quote)||null,count:rows.filter(r=>r.co===co.id&&r.quote).length}));}
function offerPanel(c,rows,cos){
 const lines=representativeOffers(rows,cos).map(({co,offer,count})=>{const q=offer?.quote;return '<tr class="'+(co.id==="own"?"own-row":"")+'"><td><div class="company"><span class="symbol">'+e(co.name.charAt(0).toUpperCase())+'</span><div><strong>'+e(co.name)+'</strong>'+(co.id==="own"?'<small>Tu canal</small>':"")+'</div></div></td><td>'+(q?'<button class="textbtn" data-act="chat" data-id="'+attr(offer.id)+'">'+sol(q.amount)+'</button><small>'+count+' cotizaciones</small>':'<span class="muted">Sin cotización</span>')+'</td><td>'+e(q?.promo||"—")+'</td><td>'+e(q?.terms||"—")+'</td><td>'+(q?(q.equivalent?P("Equivalente","green"):P("No comparable directamente","amber")+'<small>Otra modalidad y duración</small>'):"—")+'</td></tr>';}).join("");
 return '<section class="panel"><header class="panel-heading"><div><h2>Precio cotizado por WhatsApp</h2><p>Lo que cada canal ofreció, no el precio oficial de catálogo.</p></div>'+(tab==="summary"&&page==="benchmark"?button("Ver cotizaciones","tab","right","",'data-tab="offers"'):"")+'</header><div class="table-scroll" tabindex="0" role="region" aria-label="Cotizaciones por WhatsApp"><table class="data-table"><thead><tr>'+["Empresa","Cuota comunicada","Promoción","Condiciones de pago","Comparabilidad"].map(th).join("")+'</tr></thead><tbody>'+lines+'</tbody></table></div><div class="legend">Referencia de la prueba · '+e(c.offer||"Oferta configurada")+'. Las ofertas no equivalentes se muestran por separado del benchmark de precios.</div></section>';
}
function draftEmpty(c){return '<section class="panel"><div class="empty"><h2>'+e(c.name||"Nueva campaña")+'</h2><p>Esta campaña aún no tiene resultados simulados.</p><div style="margin-top:10px">'+button("Configurar campaña","edit","edit","primary",'data-id="'+attr(c.id)+'"')+'</div></div></section>'}
function detail(c,kind){
 const own=kind==="own", cos=own?[c.own]:c.competitors, rows=resultRows(c), title=own?"Mi canal":"Competencia";
 const desc=own?"Revisa tus números de WhatsApp y lo que pasó en cada prueba.":"Explora los resultados por empresa, número y conversación.";
 const actions=isComplete(c)?button("Descargar Excel","export","down"):"";
 if(!isComplete(c))return hero(title,desc,actions)+draftEmpty(c);
 const selected=cos.filter(x=>own||filter.competitor==="all"||filter.competitor===x.id);
 const ids=new Set(selected.map(x=>x.id));
 const groupRows=rows.filter(r=>ids.has(r.co)), shown=filterRows(groupRows).filter(r=>filter.status==="all"||r.type===filter.status);
 const cs='<label>Empresa <select data-filter="competitor" aria-label="Filtrar empresa"><option value="all">Todas</option>'+cos.map(x=>'<option value="'+attr(x.id)+'" '+(filter.competitor===x.id?"selected":"")+'>'+e(x.name)+'</option>').join("")+'</select></label>';
 const statusSelect='<label>Respuesta <select data-filter="status" aria-label="Filtrar respuesta"><option value="all">Todas</option>'+Object.entries(types).map(([k,val])=>'<option value="'+k+'" '+(filter.status===k?"selected":"")+'>'+e(val[0])+'</option>').join("")+'</select></label>';
 const phoneLines=selected.flatMap(co=>co.phones.map(p=>{const rs=groupRows.filter(r=>r.co===co.id&&r.number===p.number), num=rs.filter(r=>r.type==="human").length;return '<tr><td><strong>'+e(p.label||"WhatsApp")+'</strong><small>'+e(p.number)+'</small></td><td>'+e(co.name)+'</td><td>'+e(p.kind)+'</td><td>'+num+' / '+rs.length+'</td><td>'+sNum(stats(rs,base[0]).time,0)+(num?" min":"")+'</td></tr>';})).join("");
 const custom=c.criteria.filter(x=>x.type==="custom"&&selected.some(co=>observed(x,co)));
 return hero(title,desc,actions)+campaignStrip(c,rows)+(selected.length?'<section class="panel"><header class="panel-heading"><div><h2>Números evaluados</h2><p>Las pruebas observan el canal, no identifican al asesor.</p></div>'+(own?"":'<div class="toolbar">'+cs+'</div>')+'</header><div class="table-scroll"><table class="data-table"><thead><tr>'+["Número","Empresa","Atención","Respuesta humana","Mediana de respuesta"].map(th).join("")+'</tr></thead><tbody>'+phoneLines+'</tbody></table></div></section>': '<div class="panel empty">No hay empresas para mostrar en esta campaña.</div>')+
 (custom.length?'<section class="panel"><header class="panel-heading"><div><h2>Criterios personalizados</h2><p>Incluye criterios exclusivos de este lado de la evaluación.</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr>'+["Criterio","Empresa","Observación","Calificación"].map(th).join("")+'</tr></thead><tbody>'+custom.flatMap(cr=>selected.filter(co=>observed(cr,co)).map(co=>{const st=stats(groupRows.filter(r=>r.co===co.id),cr);return '<tr><td><strong>'+e(cr.name)+'</strong></td><td>'+e(co.name)+'</td><td>'+e(cr.mode==="prompt"?"Si se pregunta":"Mención espontánea")+'</td><td><button class="textbtn" data-act="evidence" data-co="'+attr(co.id)+'" data-crit="'+attr(cr.id)+'">'+sNum(st.avg)+' / 5 · '+st.n+' pruebas</button></td></tr>'})).join("")+'</tbody></table></div></section>':"")+
 offerPanel(c,groupRows,selected)+
 '<section class="panel"><header class="panel-heading"><div><h2>Conversaciones de prueba</h2><p>'+shown.length+' de '+groupRows.length+' pruebas · Datos simulados</p></div><div class="actions">'+scenarioSelect()+'<div class="toolbar">'+statusSelect+'</div></div></header>'+(shown.length?'<div class="table-scroll"><table class="data-table"><thead><tr>'+["Escenario","Empresa y número","Estado","Primera respuesta humana","Chat"].map(th).join("")+'</tr></thead><tbody>'+shown.map(r=>'<tr><td><strong>'+e(scenario(r.scenario).name)+'</strong></td><td>'+e(nameOf(c,r.co))+'<small>'+e(r.phone)+' · '+e(r.number)+'</small></td><td>'+statusP(r.type)+(r.scenario==="price"&&r.type==="human"&&!r.quote?'<small>No cotizó</small>':"")+'</td><td>'+(r.minutes===null?"—":r.minutes+" min")+'</td><td><button class="textbtn" data-act="chat" data-id="'+attr(r.id)+'">Ver chat</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">No hay conversaciones con estos filtros.</div>')+'</section>';
}
function campaigns(){
 return hero("Campañas","Configura una nueva evaluación o vuelve a los resultados de una campaña.",button("Nueva campaña","new","plus","primary"))+
 '<section class="panel"><header class="panel-heading"><div><h2>Tus campañas</h2><p>Las campañas y sus resultados se guardan en el servidor.</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr>'+["Campaña","Sector","Estado","Acciones"].map(th).join("")+'</tr></thead><tbody>'+db.campaigns.map(c=>'<tr><td><strong>'+e(c.name||"Borrador sin nombre")+'</strong><small>'+e(c.date)+'</small></td><td>'+e(c.sector||"—")+'</td><td>'+(isComplete(c)?P("Simulada","lav"):P("Borrador"))+'</td><td><div class="actions">'+(isComplete(c)?button("Ver resultados","select","equal","",'data-id="'+attr(c.id)+'"'):"")+button(isComplete(c)?"Duplicar y editar":"Editar","edit","edit","",'data-id="'+attr(c.id)+'"')+'</div></td></tr>').join("")+'</tbody></table></div></section>';
}
const field=(label,input,hint="")=>'<label class="field"><span>'+e(label)+'</span>'+input+(hint?'<small>'+e(hint)+'</small>':"")+'</label>';
const inp=(path,value,placeholder="",opt="")=>'<input data-path="'+attr(path)+'" value="'+attr(value)+'" placeholder="'+attr(placeholder)+'" '+opt+'>';
const select=(path,value,opts)=>'<select data-path="'+attr(path)+'">'+opts.map(o=>{const [k,l]=Array.isArray(o)?o:[o,o];return '<option value="'+attr(k)+'" '+(k===value?"selected":"")+'>'+e(l)+'</option>';}).join("")+'</select>';
function criterionRow(cr,i){const path="criteria."+i;return '<div class="form-row">'+field("Criterio",inp(path+".name",cr.name,"Ej. Internacionalidad"))+field("Qué observar",inp(path+".desc",cr.desc,"Conducta observable"))+field("Peso",inp(path+".weight",cr.weight,"1",'type="number" min="1" max="10"'))+field("Aplicar a",select(path+".scope",cr.scope,[["all","Ambos"],["own","Mi canal"],["competitor","Competencia"]]))+field("Observación",select(path+".mode",cr.mode,[["auto","Espontánea"],["prompt","Si se pregunta"]]))+trash("remove-criterion",'data-index="'+i+'"',"Eliminar criterio "+cr.name)+'</div>';}
function phoneRows(group,path){
 return group.phones.map((p,i)=>'<div class="phone-row">'+field("Nombre del número",inp(path+".phones."+i+".label",p.label,"Ej. Admisiones central"))+field("WhatsApp",inp(path+".phones."+i+".number",p.number,"+51 900 000 000",'type="tel"'))+field("Atención",select(path+".phones."+i+".kind",p.kind,["Sin especificar","Interno","Tercerizado"]))+trash("remove-phone",'data-path-index="'+attr(path)+'" data-index="'+i+'"',"Eliminar número")+'</div>').join("")+button("Agregar número","add-phone","plus","",'data-path-index="'+attr(path)+'"');
}
function editablePanel(title,hint,inside){return '<section class="panel"><header class="panel-heading"><div><h2>'+e(title)+'</h2><p>'+e(hint)+'</p></div></header><div class="form-content">'+inside+'</div></section>'}
function builder(){
 const titles=["Campaña","Rúbrica","WhatsApp","Escenarios","Revisar"];
 let inside="";
 if(step===0)inside=editablePanel("Datos de la campaña","Define el contexto que compartirán tu canal y la competencia.",
 '<div class="form-inline">'+field("Nombre de campaña",inp("name",edit.name,"Ej. Benchmark de admisiones"))+field("Sector",inp("sector",edit.sector,"Ej. Educación"))+'</div>'+
 field("Producto u oferta de referencia",inp("offer",edit.offer,"Ej. Programa de software · virtual · 24 meses"),"Sirve para identificar cotizaciones directamente comparables."));
 if(step===1)inside=editablePanel("Construye tu rúbrica","Los criterios comparables se aplican igual en los dos lados. La escala es del 1 al 5.",
  '<div class="actions">'+button("Plantilla de atención","template","file","",'data-template="general"')+button("Plantilla de educación","template","file","",'data-template="education"')+'</div>'+
  field("Describe en tus palabras qué quieres evaluar",'<textarea id="rubric-text" placeholder="Ej. Internacionalidad, empleabilidad y claridad para explicar las becas.">'+e(rubricText)+'</textarea>',"La propuesta simulada se genera localmente. Revísala antes de añadirla.")+
  '<div class="actions">'+button("Proponer criterios","suggest","spark","")+'</div>'+
  (suggestions.length?'<div class="group-line"><h3>Criterios propuestos</h3>'+suggestions.map((s,i)=>'<div class="choice"><div><strong>'+e(s.name)+'</strong><small>'+e(s.desc)+'</small></div><div class="actions" style="margin-left:auto">'+button("Agregar","accept-suggestion","plus","",'data-index="'+i+'"')+'</div></div>').join("")+'<div>'+button("Añadir todos","accept-all","check")+'</div></div>':"")+
  '<h3>Criterios de la campaña</h3>'+edit.criteria.map(criterionRow).join("")+'<div>'+button("Agregar criterio","add-criterion","plus")+'</div>');
 if(step===2)inside=editablePanel("Mi canal","Registra el WhatsApp compartido o varios números de un mismo canal.",
  field("Nombre de mi empresa",inp("own.name",edit.own.name,"Ej. Instituto Horizonte"))+phoneRows(edit.own,"own"))+
  editablePanel("Competencia","Asocia uno o varios WhatsApp a cada empresa.",
   edit.competitors.map((co,i)=>'<div class="group-line"><div class="group-head">'+field("Nombre del competidor",inp("competitors."+i+".name",co.name,"Ej. Nova Técnica"))+trash("remove-competitor",'data-index="'+i+'"',"Eliminar competidor")+'</div>'+phoneRows(co,"competitors."+i)+'</div>').join("")+
   '<div>'+button("Agregar competidor","add-competitor","plus")+'</div>');
 if(step===3)inside=editablePanel("Elige situaciones de prueba","Los mismos casos se aplican a los canales registrados. Esta demo no hace seguimiento posterior.",
 scenarios.map(s=>'<label class="choice"><input type="checkbox" data-scenario="'+s.id+'" '+(edit.scenarios.includes(s.id)?"checked":"")+'><span><strong>'+e(s.name)+'</strong><small>'+e(s.ask)+'</small></span></label>').join("")+
 field("Pruebas simuladas por escenario y número",inp("sample",edit.sample,"2",'type="number" min="1" max="10"'),"Puedes usar entre 1 y 10. Los resultados se identifican como simulados."));
 if(step===4){const count=companies(edit).reduce((a,c)=>a+c.phones.length,0);
 inside=editablePanel("Revisa la campaña","No se enviará ningún mensaje a WhatsApp.",
 '<div class="form-inline three"><div><strong>'+e(edit.name||"Sin nombre")+'</strong><p class="muted">'+e(edit.sector||"Sin sector")+'</p></div><div><strong>'+count+' números</strong><p class="muted">'+edit.competitors.length+' competidores · '+edit.criteria.length+' criterios</p></div><div><strong>'+count*edit.scenarios.length*(Number(edit.sample)||0)+' pruebas</strong><p class="muted">'+edit.scenarios.length+' escenarios · Simulación</p></div></div><div class="summary-line">'+I("flask")+'<span>Verás la comparativa, el detalle por canal, el chat de evidencia y la descarga a Excel con resultados de ejemplo.</span></div>');
 }
 return hero(edit.status==="draft"&&edit.name?"Configurar campaña":"Nueva campaña","Configura una prueba comercial de principio a fin.",button("Guardar borrador","save","file"))+
 '<nav class="wizard-steps" aria-label="Pasos de la campaña">'+titles.map((v,i)=>'<button class="step" data-act="step" data-index="'+i+'" '+(step===i?'aria-current="step"':"")+'><span class="n">'+(i+1)+'</span>'+e(v)+'</button>').join("")+'</nav>'+
 (formError?'<p class="error" role="alert">'+e(formError)+'</p>':"")+inside+
 '<div class="wiz-footer">'+(step>0?button("Atrás","back","back"):button("Volver a campañas","nav","back","",'data-page="campaigns"'))+
 (step<4?button("Continuar","forward","right","primary"):button(launching?"Simulando campaña…":"Simular campaña","run","flask","primary",launching?"disabled":""))+'</div>';
}
function setPath(path,val){const parts=path.split(".");let at=edit;for(const part of parts.slice(0,-1))at=at[part];at[parts.at(-1)]=val;}
function getPath(path){return path.split(".").reduce((a,k)=>a[k],edit);}
function validate(i){
 if(i===0&&(!edit.name.trim()||!edit.sector.trim()||!edit.offer.trim()))return "Completa el nombre, el sector y el producto de referencia.";
 if(i===1&&(!edit.criteria.length||edit.criteria.some(cr=>!cr.name.trim()||!cr.desc.trim()||!Number.isInteger(Number(cr.weight))||+cr.weight<1||+cr.weight>10)))return "Incluye al menos un criterio y completa su nombre, lo que se observará y su peso (de 1 a 10).";
 if(i===2){if(!edit.own.name.trim()||!edit.own.phones.length)return "Indica tu empresa y registra al menos un WhatsApp propio.";if(companies(edit).some(co=>!co.name.trim()||!co.phones.length||co.phones.some(p=>!/^\+?[\d .()-]+$/.test(p.number.trim())||p.number.replace(/\D/g,"").length<7||p.number.replace(/\D/g,"").length>15)))return "Cada empresa necesita un nombre y al menos un WhatsApp válido con 7 a 15 dígitos.";if(companies(edit).some(co=>new Set(co.phones.map(p=>p.number.replace(/\D/g,""))).size!==co.phones.length))return "Quita los números repetidos dentro de una misma empresa.";}
 if(i===3&&(!edit.scenarios.length||!Number.isInteger(+edit.sample)||+edit.sample<1||+edit.sample>10))return "Selecciona al menos un escenario e indica de 1 a 10 pruebas por número.";
 return "";
}
function suggestText(raw){
 const parts=raw.trim().split(/[\n,;.]+/).flatMap(s=>s.split(/\s+y\s+(?=(internacionalidad|empleabilidad|becas|convenios|certificaci|claridad|promociones|financiamiento))/i)).filter(s=>s?.trim());
 const catalog=[[/internacion/i,"Internacionalidad","Explica un beneficio internacional con un ejemplo concreto."],[/empleab|laboral/i,"Empleabilidad","Describe un apoyo concreto para la inserción laboral o una evidencia de resultados."],[/beca/i,"Becas","Explica qué becas existen y qué requisitos aplican."],[/convenio/i,"Convenios","Menciona un convenio relevante y aclara quién puede acceder."],[/certificaci/i,"Certificaciones","Identifica la certificación, quién la emite y en qué condiciones se obtiene."],[/claridad/i,"Claridad de condiciones","Explica condiciones de forma concreta y sin ambigüedades."],[/promoci/i,"Promociones","Indica monto, vigencia y condiciones de la promoción."],[/financiam|cuota/i,"Financiamiento","Explica opciones de pago y sus condiciones."]];
 const list=[];
 for(const line of parts){const matches=catalog.filter(([re])=>re.test(line));if(matches.length)matches.forEach(m=>list.push({name:m[1],desc:m[2]}));else if(line.trim().length>5){const name=titleCase(line.trim().replace(/^(quiero|deseo|evaluar|observar|medir)\s+/i,"").slice(0,65));list.push({name,desc:"Revisa si el asesor explica lo siguiente con datos o ejemplos: "+line.trim().slice(0,220)});}}
 return [...new Map(list.map(x=>[x.name.toLowerCase(),x])).values()].slice(0,8).map(x=>({...x,id:uid(),mode:"prompt",scope:"all",type:"custom",weight:1}));
}
function resetFilters(){filter={scenario:"all",competitor:"all",status:"all"};}
function go(p){page=p;mobile=false;tab="summary";resetFilters();render();window.scrollTo(0,0);document.querySelector("#main")?.focus({preventScroll:true});}
function openEdit(id){const c=db.campaigns.find(x=>x.id===id);edit=c?clone(c):blank();if(c?.status==="complete"){edit.id=uid();edit.name=c.name+" · copia";edit.status="draft";edit.date=blank().date;}step=0;formError="";suggestions=[];rubricText="";launching=false;go("builder");}
async function saveCampaign(c){
 const stored=await api('/campaigns/'+encodeURIComponent(c.id),{method:'PUT',body:JSON.stringify(c)});
 replaceCampaign(stored);return stored;
}
function replaceCampaign(c){const i=db.campaigns.findIndex(x=>x.id===c.id);if(i>=0)db.campaigns[i]=c;else db.campaigns.push(c);db.selected=c.id;save();}
function toast(txt){const n=document.querySelector("#notifications");n.innerHTML='<div class="toast">'+e(txt)+'</div>';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{n.innerHTML="";},3200);}
function rerenderFilter(key){render();document.querySelector('[data-filter="'+key+'"]')?.focus();}
function transition(to){if(to>step){for(let i=step;i<to;i++){const err=validate(i);if(err){step=i;formError=err;render();return;}}}step=to;formError="";render();window.scrollTo(0,0);document.querySelector(".step[aria-current]")?.focus();}
function drawer(title,sub,body){
 const d=document.querySelector("#drawer");
 d.innerHTML='<div class="drawer-inner"><header class="drawer-head"><div><h2 id="drawer-title">'+e(title)+'</h2><p>'+e(sub)+'</p></div><form method="dialog"><button type="submit" class="iconbtn" aria-label="Cerrar">'+I("close")+'</button></form></header>'+body+'</div>';
 if(!d.open)d.showModal();
 d.querySelector('[aria-label="Cerrar"]').focus();
}
function chatDrawer(id,critId=""){
 const c=current(),r=resultRows(c).find(x=>x.id===id);if(!r)return;
 const cr=c.criteria.find(x=>x.id===critId),ids=r.evidence?.[critId]||[];
 drawer(cr?"Evidencia de "+cr.name:"Chat de prueba",nameOf(c,r.co)+" · "+r.phone+" · "+r.number,
 '<div class="actions">'+statusP(r.type)+P("Datos simulados","demo")+'</div><p class="muted">Rúbrica '+e(r.rubric_version.slice(0,12))+' · Cierre: '+e(r.closed_at)+' · '+e(r.close_reason==='response_window_expired'?'Ventana de respuesta agotada':'Completado')+'</p>'+
 (r.messages||[]).map(m=>'<div class="bubble '+(m.sender==='buyer'?'in':'')+'" id="msg-'+attr(m.id)+'"><small>'+e(m.sender==='buyer'?'Comprador':m.sender==='bot'?'Bot':'Respuesta humana')+' · '+e(m.timestamp)+(ids.includes(m.id)?' · Evidencia del criterio':'')+'</small><p>'+e(m.text)+'</p><small>'+e(m.id)+'</small></div>').join('')+
 '<div class="evidence"><h3>Evaluación por criterio</h3>'+c.criteria.map(criterion=>'<p>'+e(criterion.name)+': '+e(r.scores[criterion.id]!=null?r.scores[criterion.id]+' / 5':r.criterion_status[criterion.id])+'</p>').join('')+'</div>'+
 (r.scenario==='price'&&r.type==='human'&&!r.quote?P('No cotizó','amber'):'')+
 (r.quote?'<div class="evidence"><h3>Oferta cotizada</h3><p>'+sol(r.quote.amount)+' · '+e(r.quote.config)+'</p><p>'+e(r.quote.promo)+' · '+e(r.quote.terms)+'</p>'+(!r.quote.equivalent?P('No comparable directamente','amber'):'')+'</div>':'')
 );
 if(ids.length)document.getElementById('msg-'+ids[0])?.scrollIntoView({block:'center'});
}
function evidenceDrawer(co,critId){
 const c=current(),cr=c.criteria.find(x=>x.id===critId);if(!cr)return;
 const rs=(page==="benchmark"?filterRows(resultRows(c)):resultRows(c)).filter(r=>r.co===co&&r.scores[critId]!=null),st=stats(rs,cr);
 drawer(cr.name,nameOf(c,co),'<div class="actions">'+P("Datos simulados","demo")+(st.n?P((cr.id==="speed"?sNum(st.time,st.time%1?1:0)+" min · mediana":sNum(st.avg)+" / 5")+" · "+st.n+" pruebas","lav"):"")+'</div><p class="footer-note">'+e(cr.desc)+'</p>'+
 (rs.length?rs.map(r=>'<div class="evidence"><div class="top"><div><strong>'+e(scenario(r.scenario).name)+'</strong><p class="muted">'+e(r.phone)+'</p></div>'+P(cr.id==="speed"?r.minutes+" min":r.scores[cr.id]+" / 5","lav")+'</div><div class="bubble"><small>'+(cr.id==="speed"?"Medición":"Fragmento del chat")+'</small><p>'+e(evidenceText(r,cr))+'</p></div>'+button("Ver chat","chat","msg","",'data-id="'+attr(r.id)+'" data-crit="'+attr(cr.id)+'"')+'</div>').join(""):'<div class="empty">No hay evidencia del criterio para esta selección.</div>'));
}
function methodDrawer(){drawer("Cómo se mide","Metodología de la simulación",'<div class="evidence"><h3>Atención</h3><p>Se compara la misma rúbrica entre canales. Cada criterio tiene una nota del 1 al 5. La nota global es secundaria y pondera solo los criterios compartidos evaluados. La primera respuesta humana se muestra en minutos y como mediana del conjunto.</p></div><div class="evidence"><h3>Cotizaciones</h3><p>Se muestra lo cotizado en WhatsApp, no el precio oficial. Una modalidad o duración distinta impide la comparación directa, pero no oculta el dato.</p></div><div class="evidence"><h3>Sin evidencia</h3><p>Un canal sin respuesta humana no recibe una nota inventada. No respondió, solo respondió el bot y no cotizó son resultados diferentes.</p></div><div class="evidence"><h3>Esta versión</h3><p>Las conversaciones, los números y las notas son ficticios. La aplicación no conecta con WhatsApp ni envía mensajes.</p></div>');}
function exportExcel(){const c=current();if(isComplete(c))window.location.href='/api/campaigns/'+encodeURIComponent(c.id)+'/excel';}
app.addEventListener("input",ev=>{const t=ev.target;if(!edit)return;if(t.matches("input[data-path]"))setPath(t.dataset.path,t.type==="number"?t.valueAsNumber:t.value);if(t.id==="rubric-text")rubricText=t.value;});
app.addEventListener("change",ev=>{const t=ev.target;if(t.dataset.filter){filter[t.dataset.filter]=t.value;rerenderFilter(t.dataset.filter);return;}if(!edit)return;if(t.matches("select[data-path]"))setPath(t.dataset.path,t.value);if(t.dataset.scenario)edit.scenarios=t.checked?[...new Set([...edit.scenarios,t.dataset.scenario])]:edit.scenarios.filter(id=>id!==t.dataset.scenario);});
app.addEventListener("click",async ev=>{
 const b=ev.target.closest("button[data-act]");if(!b)return;const d=b.dataset,n=Number(d.index);
 try { switch(d.act){
 case "nav":go(d.page);break;
 case "menu":mobile=!mobile;render();if(mobile)document.querySelector(".sidebar .brand")?.focus();break;
 case "tab":tab=d.tab;render();document.querySelector('.tab[data-tab="'+tab+'"]')?.focus();break;
 case "new":openEdit();break;
 case "edit":openEdit(d.id);break;
 case "select":db.selected=d.id;save();go("benchmark");break;
 case "method":methodDrawer();break;
 case "chat":chatDrawer(d.id,d.crit);break;
 case "evidence":evidenceDrawer(d.co,d.crit);break;
 case "export":exportExcel();break;
 case "step":transition(n);break;
 case "back":transition(step-1);break;
 case "forward":transition(step+1);break;
 case "save":b.disabled=true;edit.status="draft";await saveCampaign(edit);toast("Borrador guardado en el servidor.");break;
 case "template":template=d.template;edit.criteria=[...clone(base),...(template==="education"?[clone(international)]:[]),...edit.criteria.filter(cr=>cr.type==="custom"&&(cr.id!=="intl"||template!=="education"))];render();toast("Plantilla aplicada. Tus criterios propios se mantienen.");break;
 case "suggest":suggestions=suggestText(rubricText).filter(s=>!edit.criteria.some(x=>x.name.toLowerCase()===s.name.toLowerCase()));render();if(!suggestions.length)toast("Escribe qué quieres evaluar o prueba con criterios que todavía no estén en la rúbrica.");break;
 case "accept-suggestion":edit.criteria.push(suggestions.splice(n,1)[0]);render();break;
 case "accept-all":edit.criteria.push(...suggestions);suggestions=[];render();break;
 case "add-criterion":edit.criteria.push({id:uid(),name:"",desc:"",weight:1,scope:"all",mode:"prompt",type:"custom"});render();document.querySelector('[data-path="criteria.'+(edit.criteria.length-1)+'.name"]')?.focus();break;
 case "remove-criterion":edit.criteria.splice(n,1);render();break;
 case "add-phone":{const g=getPath(d.pathIndex);g.phones.push(phone());render();document.querySelector('[data-path="'+d.pathIndex+'.phones.'+(g.phones.length-1)+'.label"]')?.focus();break;}
 case "remove-phone":getPath(d.pathIndex).phones.splice(n,1);render();break;
 case "add-competitor":edit.competitors.push({id:uid(),name:"",phones:[phone()]});render();document.querySelector('[data-path="competitors.'+(edit.competitors.length-1)+'.name"]')?.focus();break;
 case "remove-competitor":edit.competitors.splice(n,1);render();break;
 case "run":{if(launching)return;for(let i=0;i<4;i++){const err=validate(i);if(err){step=i;formError=err;render();return;}}const cfg=clone(edit);launching=true;render();await saveCampaign(cfg);const result=await api('/campaigns/'+encodeURIComponent(cfg.id)+'/simulate',{method:'POST'});replaceCampaign(result);launching=false;go("benchmark");toast("Campaña simulada y guardada. No se enviaron mensajes.");break;}
 }
 }catch(err){launching=false;formError=err.message;if(page==='builder')render();toast(err.message);}finally{b.disabled=false;}
});
app.addEventListener("keydown",ev=>{
 const t=ev.target;
 if(ev.key==="Escape"&&mobile){mobile=false;render();document.querySelector(".mobile-menu")?.focus();}
 if(t.matches(".tab")&&["ArrowLeft","ArrowRight","Home","End"].includes(ev.key)){
  ev.preventDefault();const arr=["summary","quality","offers"],at=arr.indexOf(tab);tab=arr[ev.key==="Home"?0:ev.key==="End"?2:(at+(ev.key==="ArrowLeft"?2:1))%3];render();document.querySelector('.tab[data-tab="'+tab+'"]')?.focus();
 }
});
boot();
