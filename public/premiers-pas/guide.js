(() => {
'use strict';
const q=(id)=>document.getElementById(id), main=q('main'), story=q('story');
const key='travelbudget-first-steps-demo-v1';
if(new URLSearchParams(location.search).get('theme')==='dark')document.documentElement.dataset.theme='dark';
const today=new Date().toISOString().slice(0,10);
const seed=()=>({step:0,paused:false,journey:null,wallet:null,personal:null,group:null,share:null,setup:null,demoBase:'EUR'});
let s=seed(), analysisCurrency='NZD', resumeDraft=null;
try { const stored=JSON.parse(localStorage.getItem(key)); if(stored?.v===1&&Number.isInteger(stored.s?.step)&&stored.s.step>=0&&stored.s.step<=9) s=stored.s; } catch {}
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,c='NZD')=>Number(v).toLocaleString('fr-FR',{maximumFractionDigits:2})+' '+c;
const date=(str)=>str?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(str+'T12:00:00Z')):'';
const fxDate=(str)=>str?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(str+'T12:00:00Z')):'';
const ds=(v)=>new Date(v+'T00:00:00Z').getTime();
const shift=(v,n)=>new Date(ds(v)+n*86400000).toISOString().slice(0,10);
const count=(a,b)=>Math.round((ds(b)-ds(a))/86400000)+1;
const positive=(v)=>Number.isFinite(v)&&v>0;
const inDates=(day,a,b)=>a<=day&&day<=b;
const demoDay=j=>j?(j.start===j.end?j.start:shift(j.start,1)):today;
const clamp=(v,j)=>v<j.start?j.start:v>j.end?j.end:v;
function moveExample(entry,oldJourney,newJourney){
 if(!entry||!oldJourney||oldJourney.start===newJourney.start&&oldJourney.end===newJourney.end)return entry;
 const days=Math.round((ds(demoDay(newJourney))-ds(demoDay(oldJourney)))/86400000);
 const move=v=>clamp(shift(v,days),newJourney);
 return {...entry,date:move(entry.date),start:move(entry.start),end:move(entry.end)};
}
const save=()=>{try{localStorage.setItem(key,JSON.stringify({v:1,s}));}catch{}};
const switchTo=(n)=>{resumeDraft=s.draft?.step===n?s.draft:null;delete s.draft;s.step=n;s.paused=false;save();render();q('title')?.focus();};
const labels=['Voyage','Compte','Opération','Trip','Partage'];
const field=(label,name,val,attrs='')=>{
 const input='<input id="input-'+name+'" name="'+name+'" value="'+esc(val)+'" '+attrs+'>';
 if(!attrs.includes('type="date"'))return '<label class="field"><span>'+label+'</span>'+input+'</label>';
 return '<div class="field"><label for="input-'+name+'">'+label+'</label><span class="date-wrap">'+input+
  '<button type="button" data-calendar="'+name+'" aria-label="Calendrier : '+esc(label)+'" aria-haspopup="dialog">▦</button></span></div>';
};
const select=(label,name,options,active)=>'<label class="field">'+label+'<select name="'+name+'">'+options.map(([id,l])=>'<option value="'+esc(id)+'" '+(id===active?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
const check=(name,label,is)=>'<label class="check"><input type="checkbox" name="'+name+'" '+(is?'checked':'')+'><span>'+label+'</span></label>';
// Choice of example destinations, not an exhaustive production catalogue.
const countries={NZ:['Nouvelle-Zélande','NZD'],AU:['Australie','AUD'],FR:['France','EUR'],PF:['Polynésie française','XPF'],GB:['Royaume-Uni','GBP'],US:['États-Unis','USD'],CA:['Canada','CAD'],JP:['Japon','JPY'],TH:['Thaïlande','THB'],VN:['Vietnam','VND'],ID:['Indonésie','IDR'],CH:['Suisse','CHF'],OTHER:['Autre pays','']};
const countryChoices=Object.entries(countries).map(([code,[label]])=>[code,label]);
const names=new Intl.DisplayNames(['fr'],{type:'currency'});
const curChoices=(Intl.supportedValuesOf?.('currency')||[...new Set(Object.values(countries).map(x=>x[1]).filter(Boolean))]).map(code=>[code,code+' · '+names.of(code)]);
const countryName=code=>countries[code]?.[0]||'';
const sampleProfile=Object.freeze({email:'voyageur@example.test'}); // Supplied by a simulated signed-in account.
// Official read-only TravelBudget fx-latest snapshot. File makes no network calls.
const snapshot=Object.freeze({"date":"2026-11-27","rates":{"EUR":1,"ADA":7.3992,"AED":4.0282,"AFN":73.16,"ALL":89.68,"AMD":394.48,"ANG":1.9634,"AOA":1007.04,"APT":2.8644,"ARB":9.7134,"ARS":1753.59,"AUD":1.6519,"AWG":1.9617,"AXS":1.6961,"AZN":1.8637,"BAM":1.9558,"BBD":2.2322,"BCH":0.0052701,"BDT":137.08,"BHD":0.41242,"BIF":3300.16,"BMD":1.0969,"BND":1.415,"BOB":12.9795,"BRL":6.2492,"BSD":1.1049,"BTC":1.8122e-05,"BTN":101.52,"BWP":15.3186,"BYN":3.2927,"BZD":2.2202,"CAD":1.5617,"CDF":2507.67,"CHF":0.91544,"CHZ":121.35,"CLP":1138.11,"CMD":1.0969,"CNH":7.3012,"CNY":7.3017,"COP":3891.07,"CRC":486.24,"CRV":6.3156,"CUP":26.324,"CVE":110.26,"CZK":24.45,"DJF":194.72,"DKK":7.4776,"DOP":66.509,"DOT":1.6356,"DZD":150.54,"EGP":59.99,"ENA":10.9786,"ERN":16.619,"ETB":177.79,"ETC":0.18592,"ETH":0.00064859,"FIL":2.0411,"FJD":2.5213,"FKP":0.83575,"GBP":0.83575,"GEL":2.8378,"GGP":0.83575,"GHS":12.9557,"GIP":0.84501,"GMD":80.69,"GNF":9717,"GTQ":8.3726,"GYD":231.2,"HKD":8.5998,"HNL":29.457,"HTG":143.57,"HUF":371.3,"ICP":0.54568,"IDR":20115,"ILS":3.6434,"IMP":0.83575,"INR":101.52,"IQD":1659.7,"IRR":2141910,"ISK":137.11,"JEP":0.83575,"JMD":172.6,"JOD":0.77767,"JPY":174.83,"KES":142.64,"KGS":95.9,"KHR":4463.61,"KMF":492.43,"KPW":142.59,"KRW":1471.29,"KWD":0.34063,"KYD":0.91829,"KZT":502.34,"LAK":24600,"LBP":98858,"LKR":364.4,"LRD":179.92,"LSL":19.1157,"LTC":0.025151,"LYD":7.1002,"MAD":10.997,"MDL":20.128,"MGA":5008,"MKD":61.565,"MMK":2300.67,"MNT":3954.26,"MOP":8.8578,"MRU":44.602,"MUR":51.429,"MVR":16.8828,"MWK":1900.62,"MXN":21.512,"MYR":4.5163,"MZN":69.841,"NAD":19.1802,"NGN":1516.09,"NIO":40.171,"NOK":10.7183,"NPR":162.29,"NZD":2.0013,"OMR":0.42174,"PAB":1.0951,"PEN":3.8038,"PGK":4.9519,"PHP":69.893,"PKR":303.88,"PLN":4.4765,"POL":14.1953,"PYG":7048,"QAR":3.9925,"RON":5.3432,"RSD":117.65,"RUB":90.16,"RWF":1618.61,"SAR":4.1132,"SBD":8.8739,"SCR":15.808,"SDG":657.27,"SEK":11.213,"SGD":1.415,"SHP":0.83575,"SLE":25.303,"SNX":7.6257,"SOL":0.015474,"SOS":625.58,"SRD":40.908,"SSP":6416,"STN":24.226,"SUI":1.6463,"SVC":9.5858,"SYP":133.68,"SZL":19.113,"THB":37.296,"TJS":10.1411,"TMT":3.839,"TND":3.3592,"TOP":2.6579,"TRY":55.618,"TTD":7.3956,"TWD":36.167,"TZS":2938.46,"UAH":49.455,"UGX":4707.75,"UNI":0.23622,"USD":1.0969,"UYU":44.562,"UZS":13141,"VES":1011.19,"VND":28354,"VUV":133.13,"WST":3.0642,"XAF":655.96,"XAG":0.026427,"XAU":0.00030589,"XCD":2.9872,"XCG":1.9728,"XDR":0.81673,"XLM":8.664,"XOF":655.96,"XPD":0.001253,"XPF":119.3,"XPT":0.00084733,"XRP":1.1577,"XTZ":4.9849,"YER":259.16,"ZAR":19.1162,"ZEC":0.001609,"ZMW":22.834,"ZWG":29.24},"dates":{"ADA":"2026-11-26","AED":"2026-11-27","AFN":"2026-11-27","ALL":"2026-11-27","AMD":"2026-11-27","ANG":"2026-11-27","AOA":"2026-11-27","APT":"2026-11-26","ARB":"2026-11-26","ARS":"2026-11-27","AUD":"2026-11-27","AWG":"2026-11-27","AXS":"2026-11-26","AZN":"2026-11-27","BAM":"2026-11-27","BBD":"2026-11-27","BCH":"2026-11-26","BDT":"2026-11-27","BHD":"2026-11-27","BIF":"2026-11-27","BMD":"2026-11-27","BND":"2026-11-27","BOB":"2026-11-27","BRL":"2026-11-27","BSD":"2026-11-27","BTC":"2026-11-26","BTN":"2026-11-27","BWP":"2026-11-27","BYN":"2026-11-27","BZD":"2026-11-27","CAD":"2026-11-27","CDF":"2026-11-27","CHF":"2026-11-27","CHZ":"2026-11-26","CLP":"2026-11-27","CMD":"2026-11-27","CNH":"2026-11-27","CNY":"2026-11-27","COP":"2026-11-27","CRC":"2026-11-27","CRV":"2026-11-26","CUP":"2026-11-27","CVE":"2026-11-27","CZK":"2026-11-27","DJF":"2026-11-27","DKK":"2026-11-27","DOP":"2026-11-27","DOT":"2026-11-26","DZD":"2026-11-27","EGP":"2026-11-27","ENA":"2026-11-26","ERN":"2026-11-27","ETB":"2026-11-27","ETC":"2026-11-26","ETH":"2026-11-26","EUR":"2026-11-27","FIL":"2026-11-26","FJD":"2026-11-27","FKP":"2026-11-27","GBP":"2026-11-27","GEL":"2026-11-27","GGP":"2026-11-27","GHS":"2026-11-27","GIP":"2026-11-27","GMD":"2026-11-27","GNF":"2026-11-27","GTQ":"2026-11-27","GYD":"2026-11-27","HKD":"2026-11-27","HNL":"2026-11-27","HTG":"2026-11-27","HUF":"2026-11-27","ICP":"2026-11-26","IDR":"2026-11-27","ILS":"2026-11-27","IMP":"2026-11-27","INR":"2026-11-27","IQD":"2026-11-27","IRR":"2026-11-27","ISK":"2026-11-27","JEP":"2026-11-27","JMD":"2026-11-27","JOD":"2026-11-27","JPY":"2026-11-27","KES":"2026-11-27","KGS":"2026-11-27","KHR":"2026-11-27","KMF":"2026-11-27","KPW":"2026-11-26","KRW":"2026-11-27","KWD":"2026-11-27","KYD":"2026-11-27","KZT":"2026-11-27","LAK":"2026-11-27","LBP":"2026-11-27","LKR":"2026-11-27","LRD":"2026-11-27","LSL":"2026-11-27","LTC":"2026-11-26","LYD":"2026-11-27","MAD":"2026-11-27","MDL":"2026-11-27","MGA":"2026-11-27","MKD":"2026-11-27","MMK":"2026-11-27","MNT":"2026-11-27","MOP":"2026-11-27","MRU":"2026-11-27","MUR":"2026-11-27","MVR":"2026-11-27","MWK":"2026-11-27","MXN":"2026-11-27","MYR":"2026-11-27","MZN":"2026-11-27","NAD":"2026-11-27","NGN":"2026-11-27","NIO":"2026-11-27","NOK":"2026-11-27","NPR":"2026-11-27","NZD":"2026-11-27","OMR":"2026-11-27","PAB":"2026-11-27","PEN":"2026-11-27","PGK":"2026-11-27","PHP":"2026-11-27","PKR":"2026-11-27","PLN":"2026-11-27","POL":"2026-11-26","PYG":"2026-11-27","QAR":"2026-11-27","RON":"2026-11-27","RSD":"2026-11-27","RUB":"2026-11-27","RWF":"2026-11-27","SAR":"2026-11-27","SBD":"2026-11-27","SCR":"2026-11-27","SDG":"2026-11-27","SEK":"2026-11-27","SGD":"2026-11-27","SHP":"2026-11-27","SLE":"2026-11-27","SNX":"2026-11-26","SOL":"2026-11-26","SOS":"2026-11-27","SRD":"2026-11-27","SSP":"2026-11-27","STN":"2026-11-27","SUI":"2026-11-26","SVC":"2026-11-27","SYP":"2026-11-27","SZL":"2026-11-27","THB":"2026-11-27","TJS":"2026-11-27","TMT":"2026-11-27","TND":"2026-11-27","TOP":"2026-11-27","TRY":"2026-11-27","TTD":"2026-11-27","TWD":"2026-11-27","TZS":"2026-11-27","UAH":"2026-11-27","UGX":"2026-11-27","UNI":"2026-11-26","USD":"2026-11-27","UYU":"2026-11-27","UZS":"2026-11-27","VES":"2026-11-27","VND":"2026-11-27","VUV":"2026-11-27","WST":"2026-11-27","XAF":"2026-11-27","XAG":"2026-11-27","XAU":"2026-11-27","XCD":"2026-11-27","XCG":"2026-11-27","XDR":"2026-11-27","XLM":"2026-11-26","XOF":"2026-11-27","XPD":"2026-11-27","XPF":"2026-11-27","XPT":"2026-11-27","XRP":"2026-11-26","XTZ":"2026-11-26","YER":"2026-11-27","ZAR":"2026-11-27","ZEC":"2026-11-26","ZMW":"2026-11-27","ZWG":"2026-11-27"}});
const fallbackEuro=1.2; // Chosen for demonstration, never a market quote.
function fx(from,to){
 if(!from||!to)return null;
 if(from===to)return {rate:1,fake:false,same:true,dates:[]};
 const dated=[from,to].filter(c=>c!=='EUR'&&snapshot.dates[c]).map(c=>snapshot.dates[c]);
 const fake=!snapshot.rates[from]||!snapshot.rates[to];
 return {rate:(snapshot.rates[to]||fallbackEuro)/(snapshot.rates[from]||fallbackEuro),
  fake,same:false,dates:[...new Set(dated)].sort()};
}
const fxRate=(from,to)=>fx(from,to)?.rate??null;
const amountFx=(amount,from,to)=>{const r=fxRate(from,to);return r===null?null:amount*r;};
const baseCurrency=()=>s.demoBase||'EUR';
const rateLabel=(from,to)=>{
 const q=fx(from,to);
 if(!q)return 'Choisis deux devises';
 if(q.same)return 'Même devise · pas de conversion';
 const amount=q.rate.toLocaleString('fr-FR',{maximumSignificantDigits:7});
 return '1 '+from+' = '+amount+' '+to+(q.fake?' · taux fictif (démo)':' · TravelBudget / Frankfurter · '+(q.dates.length?q.dates.map(fxDate).join(' et '):fxDate(snapshot.date)));
};
function equivalent(amount,from,to){
 const v=amountFx(amount,from,to);
 return v===null?'Conversion '+from+' → '+to+' indisponible':fmt(amount,from)+' → '+fmt(v,to)+' · '+rateLabel(from,to);
}
function journeyLegs(j){
 return [
   [countryName(j.country),j.start,j.hasLeg?shift(j.legStart,-1):j.end,j.goal,j.currency],
   ...(j.hasLeg?[[j.legName+' · '+countryName(j.legCountry),j.legStart,j.legEnd||j.end,j.legGoal,j.legCurrency]]:[]),
   ...(j.hasLeg&&j.legEnd&&j.legEnd<j.end?[[countryName(j.country)+' · retour au budget de départ',shift(j.legEnd,1),j.end,j.goal,j.currency]]:[]),
 ];
}
const currencyAt=(j,day)=>journeyLegs(j).find(([,a,b])=>inDates(day,a,b))?.[4]||j.currency;

const categories={
 expense:[['meal','Repas'],['lodging','Logement'],['transport','Transport'],['activity','Activités'],['other','Autre dépense']],
 income:[['refund','Remboursement de dépense'],['ordinary','Autre entrée']],
};
const subcategories={
 meal:[['restaurant','Restaurant / café'],['groceries','Courses']], lodging:[['hotel','Hôtel / auberge'],['camping','Camping']],
 transport:[['fuel','Carburant'],['ticket','Billet / trajet']], activity:[['visit','Visite'],['hike','Randonnée']],
 other:[['other','Autre']], refund:[['refund-meal','Repas'],['refund-lodging','Logement'],['refund-transport','Transport']],
 ordinary:[['salary','Revenu'],['other-income','Autre entrée']],
};
const subChoices=cat=>[['','Aucune (facultatif)'],...(subcategories[cat]||[])];
const btn=(label,action,type='button',cls='')=>'<button class="btn '+cls+'" type="'+type+'" '+(action?'data-action="'+action+'"':'')+'>'+label+'</button>';
const money=(n)=>'type="number" step=".01" min="'+n+'" required';
function pairedMoney(label,name,value,attributes,targetLabel,targetId){
 return '<div class="fx-pair full">'+field(label,name,value,attributes)+'<div class="field"><span class="fx-label" id="'+targetId+'-label">'+targetLabel+'</span><output class="fx-inline" id="'+targetId+'" for="input-'+name+'" aria-live="polite"></output></div></div>';
}
function paintConversion(id,amount,from,to,label=''){
 const host=q(id);
 if(!host)return;
 const v=amountFx(amount,from,to);
 const amountLabel=Number.isFinite(amount)&&v!==null?(fx(from,to)?.fake?'≈ ':'')+fmt(v,to):v===null?'Taux indisponible':'Montant à saisir';
 const line=rateLabel(from,to);
 host.innerHTML='<strong>'+amountLabel+'</strong><small>'+line+(label?' · '+esc(label):'')+'</small>';
}
const hd=(k,t,p)=>'<p class="kicker">'+k+'</p><h1 id="title" tabindex="-1">'+t+'</h1><p class="muted">'+p+'</p>';
const err='<p class="error" id="error" role="alert"></p>';
const act=(label,back=true)=>'<div class="actions">'+btn(label,'','submit','primary')+(back?btn('Retour','back'):'')+btn('Plus tard','pause','button','subtle')+'</div>';
function ids(kind) {return kind==='personal'?s.personal:s.share;}
function sharedWallet(id){
 const alternate=s.wallet.currency==='NZD'?'EUR':'NZD';
 return id==='local'?{name:'Espèces · exemple',currency:alternate,balance:300}:s.wallet;
}
function operationWallet(kind,d){
 return kind==='share'?sharedWallet(d?.walletId):s.wallet;
}
function draftForm(kind){
 const anchor=demoDay(s.journey);
 const d=ids(kind)||{kind:'expense',amount:kind==='personal'?18:120,paid:true,out:false,date:anchor,start:anchor,end:anchor,custom:false,category:kind==='share'?'lodging':'meal',subcategory:kind==='share'?'hotel':'restaurant'};
 const c=operationWallet(kind,d).currency;
 return '<form id="'+kind+'"><div class="fields">'+select('Type','kind',[['expense','Dépense'],['income','Entrée / remboursement']],d.kind)+
 (kind==='share'?select('Wallet du paiement','walletId',[['main',s.wallet.name+' · '+s.wallet.currency],['local','Espèces (exemple) · '+sharedWallet('local').currency]],d.walletId||'main')+
 '<label class="field">Devise du wallet<input id="share-currency" value="'+esc(c)+'" readonly aria-describedby="share-currency-help"></label><p class="currency-note full" id="share-currency-help">La devise suit le wallet choisi. Pour en changer, choisis un autre wallet. Vérifie le montant après le changement.</p>':'')+
 pairedMoney('Montant · <span id="operation-unit">'+esc(c)+'</span>','amount',d.amount,money('.01'),'Équivalent pour le budget','fx-amount')+
 field(kind==='share'?'Date d’opération Trip':'Date de paiement ou d’encaissement','date',d.date,'type="date" required')+
 select('Catégorie','category',categories[d.kind],d.category)+select('Sous-catégorie','subcategory',subChoices(d.category),d.subcategory??'')+
 (kind==='share'?'<div class="field">Répartition<span id="split-label">Moitié toi, moitié '+esc(s.group?.participant||'Alex')+'</span></div>':'')+'</div>'+
 (kind==='personal'?check('paid','Déjà payé / encaissé',d.paid)+'<small class="muted">Le règlement change le solde du compte, pas l’impact sur le budget du jour.</small>':'<p class="hint">Dans cet exemple, c’est toi qui paies ou encaisses sur le wallet choisi. Chacun a la moitié. Ta part se combine aux autres opérations déjà comptées sur les mêmes dates.</p>')+
 check('out','Hors budget quotidien',d.out)+
 '<section class="teach" aria-label="Pourquoi modifier les dates de budget ?"><strong>Quand modifier les dates de budget ?</strong><p>Garde la date du paiement pour le solde de ton compte. Change les dates du budget quand la dépense concerne plusieurs jours, ou un autre jour que le paiement.</p>'+
 '<ol class="teach-list"><li>Paiement : tu paies <span id="teach-payment">'+fmt(90,c)+'</span> en une fois.</li><li>Budget : tu choisis les 3 jours du logement.</li><li>Résultat : le compte bouge une fois ; cela représente <span id="teach-daily">'+fmt(30,c)+'</span>/jour avant conversion.</li></ol>'+(kind==='share'?'<p>Dans Trip, tu répartis seulement ta part personnelle sur ces dates.</p>':'')+
 (kind==='personal'?'<div class="actions">'+btn('Essayer un logement sur 3 jours','lodging-example')+'</div>':'')+'</section>'+
 check('custom','Modifier les dates de budget',d.custom)+'<small id="date-help" class="muted">Si tu laisses cette option décochée, le budget suit la date de l’opération.</small>'+
 '<div id="dates" class="fields" '+(d.custom?'':'hidden')+'>'+field('Budget : début','start',d.start,'type="date"')+field('Budget : fin','end',d.end,'type="date"')+'</div>'+
 '<div id="fx-operation" class="fx-box" aria-live="polite"></div><p id="sim" class="hint" aria-live="polite"></p>'+err+
 (kind==='personal'?act('Enregistrer et voir le résultat'):act('Voir le résultat du partage'))+'</form>';
}
function journeyFields(d,own=false){
 return '<form id="journey"><div class="fields">'+field('Nom du voyage','name',d.name,'maxlength="70" required')+select('Pays de départ','country',(own?[['','Choisir un pays'],...countryChoices]:countryChoices),d.country)+field('Départ','start',d.start,'type="date" required')+field('Fin du voyage','end',d.end,'type="date" required')+select('Devise du budget','currency',curChoices,d.currency)+pairedMoney('Budget par jour · <span id="goal-unit">'+esc(d.currency)+'</span>','goal',d.goal,money('.01'),'En devise de base, par jour','fx-goal')+'</div><p class="currency-note">La devise du pays est proposée automatiquement. Tu peux en choisir une autre.</p>'+
   '<section class="teach" aria-label="Pourquoi ajouter une période ?"><strong>Pourquoi ajouter une période ?</strong><p>Une période sert à donner un budget différent à une partie du voyage, même si tu restes dans le même pays.</p><p><b>Exemple :</b> tu prévois 60 NZD/j en ville, puis 45 NZD/j pendant 3 jours de randonnée. Tu peux aussi changer de pays ou de devise. Si rien ne change, un seul budget suffit.</p></section>'+
   '<details '+(d.hasLeg?'open':'')+'><summary>Ajouter une période (facultatif)</summary>'+check('hasLeg','Ajouter un autre budget ou pays',d.hasLeg)+
   '<div id="leg-fields" class="fields" '+(d.hasLeg?'':'hidden')+'>'+field('Nom de la période','legName',d.legName,'maxlength="55"')+select('Pays de cette période','legCountry',countryChoices,d.legCountry)+field('À partir du','legStart',d.legStart,'type="date"')+field('Jusqu’au (facultatif)','legEnd',d.legEnd,'type="date"')+select('Devise de cette période','legCurrency',curChoices,d.legCurrency)+pairedMoney('Budget par jour · <span id="leg-goal-unit">'+esc(d.legCurrency)+'</span>','legGoal',d.legGoal,'type="number" min=".01" step=".01"','En devise de base, par jour','fx-leg-goal')+
   '<small class="currency-note full">Le budget de la période s’applique aux jours compris entre les deux dates, fin incluse. Par exemple, 45 par jour sur 3 jours donne un objectif de 135. Sans date de fin, la période va jusqu’à la fin du voyage ; sinon, le budget de départ reprend après.</small></div></details>'+err+act(own?'Vérifier mon premier voyage':'Créer le voyage dans la démo')+'</form>';
}
function setupProfile(){
 const base=s.setup?.baseCurrency||baseCurrency();
 return '<form id="profile" autocomplete="off"><p class="hint">Essaie avec des valeurs fictives. Rien ne sera envoyé ; ces coordonnées ne sont pas conservées.</p><div class="fields">'+
 select('Devise de base du compte', 'baseCurrency',curChoices,base)+
 field('E-mail de connexion (déjà connu)','email',sampleProfile.email,'type="email" readonly autocomplete="off" maxlength="120"')+
 field('WhatsApp (facultatif)','whatsapp','','type="tel" placeholder="Indicatif + numéro" autocomplete="off" maxlength="24"')+
 field('Date de naissance (facultative)','birth','','type="date" max="'+today+'"')+'</div>'+
 '<p class="currency-note">La devise de base sert à lire la vue globale du compte. Chaque voyage garde sa propre devise de budget, et chaque moyen de paiement sa devise.</p>'+err+act('Continuer vers mon premier voyage')+'</form>';
}
function setupJourneyDefaults(){
 const base=s.setup?.baseCurrency||baseCurrency();
 return {name:'',start:'',end:'',country:'',currency:base,goal:'',hasLeg:false,legName:'',legStart:'',legEnd:'',legGoal:'',legCountry:'NZ',legCurrency:base};
}
function render(){
 const stage=s.paused?0:s.step;
 const progressSteps=stage>=7?['Réglages du compte','Premier voyage','Récapitulatif']:labels;
 const current=stage>=7?stage-6:stage;
 q('tape').innerHTML=progressSteps.map((l,i)=>'<li '+(current===i+1?'aria-current="step"':i+1<current?'class="done"':'')+'>'+(i+1<current?'✓':i+1)+' '+l+'</li>').join('');
 let html='';
 if(stage===0){
   html=hd('Premiers pas','Ton voyage, ton budget','Apprends à suivre ce que tu dépenses avant de partager les frais de route.');
   html+='<p class="hint">Un voyage, un compte, une première dépense. Le Trip partagé vient ensuite, si tu en as besoin.</p>'+
   (s.paused?'':'<div class="fields">'+select('Devise de base du compte','demoBase',curChoices,baseCurrency())+'</div><p class="currency-note">Elle sert de repère pour les conversions. Par exemple, choisis EUR pour commencer avec une carte en euros et un voyage en NZD.</p>')+
   '<div class="actions">'+btn(s.paused?'Reprendre là où j’en étais':'Démarrer la démo','start','button','primary')+(s.paused?btn('Tout recommencer','reset'):btn('Plus tard','pause','button','subtle'))+'</div>';
 }else if(stage===1){
   const d=s.journey||{name:'Road trip en Nouvelle-Zélande',start:'2026-11-24',end:'2026-12-07',country:'NZ',currency:'NZD',goal:60,hasLeg:false,legName:'Randonnée',legStart:'2026-11-29',legEnd:'',legGoal:45,legCountry:'NZ',legCurrency:'NZD'};
   html=hd('1 · Voyage','Donne un cadre à ton budget','Crée le séjour. Si ton budget change en cours de route, découpe le voyage en périodes.');
   html+=journeyFields(d);
 }else if(stage===2){
   const d=s.wallet||{name:'Carte voyage',kind:'bank',balance:300,currency:baseCurrency()};
   html=hd('2 · Compte','Ajoute ton moyen de paiement','Un compte représente une carte ou tes espèces. Son solde n’est pas ton objectif de dépenses.');
   html+='<form id="wallet"><div class="fields">'+field('Nom du compte','name',d.name,'maxlength="55" required')+select('Type','kind',[['bank','Carte / compte'],['cash','Espèces']],d.kind)+select('Devise du moyen de paiement','walletCurrency',curChoices,d.currency)+pairedMoney('Solde de départ · <span id="wallet-unit">'+esc(d.currency)+'</span>','balance',d.balance,'type="number" step=".01" required','Équivalent en devise de base','fx-wallet')+'</div><p class="hint">Ici, le solde est fictif. Dans l’app, tu choisis celui de ton compte.</p>'+err+act('Créer mon compte dans la démo')+'</form>';
 }else if(stage===3){
   html=hd('3 · Opération','Saisis une première dépense','Depuis '+esc(s.wallet.name)+', essaie un déjeuner ou une entrée. Observe les effets avant de valider.')+draftForm('personal');
 }else if(stage===4){
   const d=s.group||{name:'Road trip à deux',participant:'Alex'};
   html=hd('4 · Trip partagé','Fais les comptes à plusieurs','Ton voyage suit ton budget. Un Trip sépare les parts et calcule qui doit quoi.');
   html+=s.personal?'<p class="hint result">'+resultText('personal',s.personal)+'</p><div class="fx-box">'+operationFx(s.personal,'personal',s.journey,s.wallet.currency,clamp(s.personal.start,s.journey))+'</div>':'';
   html+='<form id="group"><div class="fields">'+field('Nom du Trip','name',d.name,'maxlength="55" required')+field('Autre participant (fictif)','participant',d.participant,'maxlength="35" required')+'</div>'+err+act('Créer le Trip fictif')+
   '<div class="actions">'+btn('Terminer sans Trip','finish','button','subtle')+'</div></form>';
 }else if(stage===5){
   html=hd('5 · Partage','Partage une dépense ou une entrée','Saisis le paiement ou remboursement du groupe. Regarde le montant encaissé ou débité, ta part et ce qui reste à régler.')+draftForm('share');
 }else if(stage===6){
   html=hd('C’est prêt','Tu connais l’essentiel','Regarde où retrouver tes comptes et ton budget. Dans l’app, tes opérations restent consultables depuis Transactions et ton partage depuis Trip.');
   if(s.share) html+='<p class="hint result">'+resultText('share',s.share)+'</p><div class="fx-box">'+operationFx(s.share,'share',s.journey,operationWallet('share',s.share).currency,clamp(s.share.start,s.journey))+'</div>';
   html+='<p class="hint">Et maintenant ? Simule la configuration de tes réglages et de ton propre voyage, sans reprendre les écritures de la démo.</p><div class="actions">'+btn('Simuler mes réglages et mon premier voyage','setup','button','primary')+(s.share?btn(s.share.kind==='income'?'Essayer une dépense partagée':'Essayer une entrée partagée','switch-example'):'')+btn('Revoir une étape','back')+btn('Tout recommencer','reset','button','subtle')+'</div>';
 }else if(stage===7){
   html=hd('Configuration · 1 sur 2','Règle ton compte','Commence par la devise dans laquelle tu veux lire la vue globale de ton compte. L’e-mail fictif est prérempli, comme dans les vrais Réglages. Complète uniquement les autres informations si tu le souhaites.')+setupProfile();
 }else if(stage===8){
   html=hd('Configuration · 2 sur 2','Prépare ton premier voyage','Choisis ton pays, tes dates et le budget qui te convient. Tu pars d’un nouveau formulaire, sans les opérations d’exemple.')+
    journeyFields(s.setup?.journey||setupJourneyDefaults(),true);
 }else{
   html=hd('Récapitulatif','Ton espace est prêt à simuler','Voici ce que tu as configuré. Tu peux maintenant retourner dans TravelBudget et ouvrir Réglages pour appliquer tes vrais choix. Rien n’a été modifié pendant l’exercice.');
   html+='<p class="hint">Devise de base du compte : <strong>'+esc(s.setup.baseCurrency)+'</strong>. Devise du premier budget : <strong>'+esc(s.setup.journey.currency)+'</strong>.</p>'+
   '<div class="actions">'+'<a class="btn primary" href="../index.html?premiers-pas=reglages">Ouvrir les vrais réglages</a>'+btn('Revoir le voyage','back')+btn('Revenir à la démo','finish-demo')+btn('Tout recommencer','reset','button','subtle')+'</div>';
 }
 main.innerHTML=html;
 analysisCurrency=s.wallet?.currency||s.journey?.currency||'NZD';
 if(stage===1||stage===8){
   const f=q('journey');
   f.addEventListener('input',e=>{
     const {country,currency,legCountry,legCurrency,hasLeg}=f.elements;
     if(e.target===country) {
       currency.value=countries[country.value]?.[1]||currency.value;
       if(!hasLeg.checked){legCountry.value=country.value;legCurrency.value=currency.value;}
     }
     if(e.target===legCountry)legCurrency.value=countries[legCountry.value]?.[1]||legCurrency.value;
     q('leg-fields').hidden=!hasLeg.checked; updatePreview();
   });
 } else if(stage>=2&&stage<=5||stage===7){
   const f=main.querySelector('form');
   f?.addEventListener('input',()=>updatePreview());
   if(stage===3||stage===5){
     f.elements.kind.addEventListener('change',()=>{const inc=f.elements.kind.value==='income';
       f.elements.amount.value=stage===3?(inc?10:18):(inc?40:120);
       syncCategories(f,inc?'refund':stage===3?'meal':'lodging',inc?(stage===3?'refund-meal':'refund-lodging'):stage===3?'restaurant':'hotel');
       updatePreview();
     });
     f.elements.category.addEventListener('change',()=>syncCategories(f,f.elements.category.value,''));
   }
 }
 const form=main.querySelector('form');
 if(form&&resumeDraft){
   if(form.id==='personal'||form.id==='share'){
     form.elements.kind.value=resumeDraft.fields.kind;
     syncCategories(form,resumeDraft.fields.category,resumeDraft.fields.subcategory);
   }
   for(const el of form.elements){
     if(el.name&&Object.hasOwn(resumeDraft.fields,el.name)){
       if(el.type==='checkbox')el.checked=resumeDraft.fields[el.name];
       else el.value=resumeDraft.fields[el.name];
     }
   }
   if(form.id==='journey'){q('leg-fields').hidden=!form.elements.hasLeg.checked;if(resumeDraft.details)form.querySelector('details').open=true;}
 }
 resumeDraft=null;
 form?.addEventListener('submit',submit);
 updatePreview();
}
function syncCategories(f,cat,sub) {
 f.elements.category.replaceChildren(...categories[f.elements.kind.value].map(([k,l])=>new Option(l,k)));
 if(cat)f.elements.category.value=cat;
 f.elements.subcategory.replaceChildren(...subChoices(f.elements.category.value).map(([k,l])=>new Option(l,k)));
 f.elements.subcategory.value=sub||'';
}
const round=(v)=>Math.round(v*100)/100;
function inputs(f){
 const a=Object.fromEntries(new FormData(f)), moneyValue=Number(a.amount);
 return {walletId:a.walletId||'main',kind:a.kind,amount:moneyValue,date:a.date,custom:!!a.custom,start:a.custom?a.start:a.date,
 end:a.custom?a.end:a.date,paid:f.id==='share'||!!a.paid,out:!!a.out,category:a.category,subcategory:a.subcategory};
}
function draftValid(d){return positive(d.amount)&&!!d.date&&!!d.start&&!!d.end&&d.start<=d.end;}
function impact(kind,d){
 const sign=d.kind==='income'?1:-1;
 const share=round(d.amount-(kind==='share'?round(d.amount/2):0));
 const other=round(d.amount-share);
 const included=!d.out&&(d.kind==='expense'||kind==='share'||d.category==='refund');
 const per=included?share/count(d.start,d.end):0;
 return {cash:d.paid?sign*d.amount:0, allocation:per, share, balance:kind==='share'?(d.kind==='income'?-other:other):0,
 consumed:d.kind==='income'?-per:per, included};
}
function resultText(kind,d){
 const i=impact(kind,d),c=operationWallet(kind,d)?.currency||analysisCurrency;
 const sign=(n)=>n>0?'+'+fmt(n,c):n<0?'−'+fmt(-n,c):fmt(0,c);
 const dayCount=count(d.start,d.end);
 const who=esc(s.group?.participant||'Alex');
 const activeLegs=s.journey?journeyLegs(s.journey).filter(([,a,b])=>a<=d.end&&d.start<=b):[];
 const currencies=[...new Set(activeLegs.map(([,a,b,value,code])=>code))];
 const budgetCurrency=currencies[0]||c;
 const converted=amountFx(i.allocation,c,budgetCurrency);
 let budget='aucun impact';
 if(i.included){
   if(!activeLegs.length)budget='aucun jour du voyage concerné';
   else if(currencies.length>1)budget='réparti dans plusieurs devises, voir le détail des périodes';
   else if(converted===null)budget='montant indisponible sans taux d’exemple';
   else budget=(fx(c,budgetCurrency)?.fake?'≈ ':'')+fmt(converted,budgetCurrency)+(dayCount>1?' / jour sur '+dayCount+' jours':' le '+date(d.start))+(d.kind==='income'?' déduits des dépenses':' comptés');
 }
 return 'Compte : '+sign(i.cash)+(d.paid?' le '+date(d.date):' maintenant')+
 '. Budget : '+budget+
 (kind==='share'?'. Ta part : '+fmt(i.share,c)+'. '+(i.balance>=0?who+' te doit '+fmt(i.balance,c):'Tu dois '+fmt(-i.balance,c)+' à '+who):'')+'.';
}
function journeyForm(f){
 const a=Object.fromEntries(new FormData(f));
 return {...a,name:a.name.trim(),goal:Number(a.goal),hasLeg:!!a.hasLeg,legGoal:Number(a.legGoal)};
}
function verifyJourney(d) {
 return !!d.name&&!!d.country&&!!d.start&&!!d.end&&d.start<=d.end&&positive(d.goal)&&(!d.hasLeg||(d.legCountry&&d.legName.trim()&&d.start<d.legStart&&d.legStart<=d.end&&(!d.legEnd||(d.legStart<=d.legEnd&&d.legEnd<=d.end))&&positive(d.legGoal)));
}
function timeline(j,base=baseCurrency()){
 return '<div class="timeline">'+journeyLegs(j).map(([name,a,b,value,currency])=>{
   const days=count(a,b), total=days*value;
   return '<div class="leg"><strong>'+esc(name)+'</strong><br>'+date(a)+' au '+date(b)+' · '+fmt(value,currency)+'/j'+
    '<div class="money-unit">'+days+(days>1?' jours':' jour')+' × '+fmt(value,currency)+' = <strong>'+fmt(total,currency)+'</strong></div>'+
    (currency!==base?'<div class="money-unit">'+equivalent(total,currency,base)+'</div>':'')+'</div>';
 }).join('')+'</div><p class="muted unit-note money-unit">Taux TravelBudget / Frankfurter du '+fxDate(snapshot.date)+'. Les devises absentes utilisent un taux fictif signalé, uniquement pour la démo.</p>';
}
function operationFx(d,kind,j,c,day,detailsOnly=false){
 const i=impact(kind,d), budget=currencyAt(j,day), base=baseCurrency();
 const rows=[];
 if(!detailsOnly){
   rows.push('<p><strong>Convertisseur</strong> · référence TravelBudget et repli signalé</p>');
   rows.push('<p>Montant de l’opération : '+(budget===c?fmt(d.amount,c)+' · même devise que le budget':equivalent(d.amount,c,budget))+'</p>');
 }
 if(kind==='share'&&i.included)rows.push('<small>Le montant total est affiché ci-dessus ; seule ta part entre dans ton budget.</small>');
 if(base!==c&&base!==budget)rows.push('<small>Vue globale du compte : '+equivalent(d.amount,c,base)+'</small>');
 else if(budget===c&&base!==c)rows.push('<small>Vue globale du compte : '+equivalent(d.amount,c,base)+'</small>');
 if(i.included){
   for(const [label,a,b,,to] of journeyLegs(j)){
     const low=a>d.start?a:d.start, high=b<d.end?b:d.end;
     if(low>high)continue;
     const net=amountFx(i.allocation,c,to), days=count(low,high);
     const range=days===1?date(low):date(low)+' au '+date(high);
     rows.push('<small>'+esc(label)+' · '+range+' : '+(net===null?'conversion indisponible':(fx(c,to)?.fake?'≈ ':'')+fmt(net,to)+'/jour'+(days>1?' · '+fmt(net*days,to)+' pour '+days+' jours':''))+(to!==c&&(to!==budget||fx(c,to)?.fake)?' ('+rateLabel(c,to)+')':'')+'</small>');
   }
 }
 return rows.join('');
}
function showEditableBudgetFx(f,base=baseCurrency()){
 const e=f.elements;
 paintConversion('fx-goal',e.goal.value===''?NaN:Number(e.goal.value),e.currency.value,base);
 paintConversion('fx-leg-goal',e.legGoal.value===''?NaN:Number(e.legGoal.value),e.legCurrency.value,base);
}
function setupPreview(f){
 let j=s.setup?.journey;
 const base=f?.id==='profile'?f.elements.baseCurrency.value:s.setup?.baseCurrency||baseCurrency();
 if(f?.id==='journey'){
   const t=journeyForm(f);
   q('goal-unit').textContent=t.currency;
   q('leg-goal-unit').textContent=t.legCurrency;
   showEditableBudgetFx(f,base);
   if(verifyJourney(t)){j=t;q('error').textContent='';}
 }
 story.innerHTML='<p class="kicker">Ton espace · aperçu local</p><h2>'+esc(j?.name||'Compte et premier voyage')+'</h2>'+
 (j?timeline(j,base):'<p class="muted">Ton premier voyage sera distinct du parcours d’exemple.</p>')+
 '<div class="tile-grid" aria-live="polite"><div class="tile"><small>Devise de base du compte</small><strong>'+esc(base||'À choisir')+'</strong><small>Vue globale du compte</small></div><div class="tile"><small>Budget du premier voyage</small><strong>'+
 (j?fmt(j.goal,j.currency)+'/jour':'À définir')+'</strong><small>Devise et objectif du voyage</small></div></div>'+
 '<p class="story-note muted">Les coordonnées de test ne sont ni conservées, ni affichées ici.</p>';
}
function updatePreview(){
 const f=main.querySelector('form'), stage=s.paused?0:s.step;
 const summary=q('mobile-summary');summary.hidden=true;
 if(stage>=7){setupPreview(f);return;}
 let j=s.journey, w=s.wallet, p=stage>=3?s.personal:null, h=stage>=5?s.share:null, view=demoDay(j);
 if(f?.id==='journey'){
   const t=journeyForm(f);
   q('goal-unit').textContent=t.currency;
   q('leg-goal-unit').textContent=t.legCurrency;
   showEditableBudgetFx(f);
   if(verifyJourney(t)){j=t;view=demoDay(j);q('error').textContent='';}
 }
 if(f?.id==='wallet'){
   const cur=f.elements.walletCurrency.value;
   q('wallet-unit').textContent=cur;
   paintConversion('fx-wallet',f.elements.balance.value===''?NaN:Number(f.elements.balance.value),cur,baseCurrency());
   if(f.elements.balance.value!=='')w={name:f.elements.name.value||'Compte',currency:cur,balance:Number(f.elements.balance.value)};
 }
 if(f?.id==='personal'||f?.id==='share'){
   const d=inputs(f);q('dates').hidden=!d.custom;
   const payCurrency=operationWallet(f.id,d).currency;
   q('operation-unit').textContent=payCurrency;
   q('teach-payment').textContent=fmt(90,payCurrency);
   q('teach-daily').textContent=fmt(30,payCurrency);
   if(q('share-currency'))q('share-currency').value=payCurrency;
   if(draftValid(d)){
     q('error').textContent='';
     q('sim').innerHTML=resultText(f.id,d);
     view=clamp(d.start,j);
     const target=currencyAt(j,view);
     const amountLabel=q('fx-amount-label');
     if(amountLabel)amountLabel.textContent='Équivalent budget · '+target;
     paintConversion('fx-amount',d.amount,payCurrency,target,f.id==='share'?'Montant total du groupe':'');
     const details=operationFx(d,f.id,j,payCurrency,view,true);
     q('fx-operation').innerHTML=details;
     q('fx-operation').hidden=!details;
     if(d.end<j.start||d.start>j.end)q('sim').innerHTML+=' Les dates budgétaires sont hors du séjour.';
     if(f.id==='personal'){p=d;if(d.kind==='income'&&d.category==='refund')q('sim').innerHTML+=' La démo suppose un remboursement dans une catégorie comportant une dépense.';}
     else h=d;
   }else {q('sim').textContent='Choisis un montant positif et des dates de budget valides.';paintConversion('fx-amount',NaN,payCurrency,currencyAt(j,view));q('fx-operation').hidden=true;}
 }
 if((stage===4||!f)&&j&&(h||p))view=clamp((h||p).start,j);

 const viewingWallet=h?operationWallet('share',h):w;
 const c=viewingWallet?.currency||j?.currency||'NZD';
 const viewingWalletId=h?.walletId||'main';
 const second=j?.hasLeg&&inDates(view,j.legStart,j.legEnd||j.end);
 const goal=second?j.legGoal:j?.goal;
 const dayCurrency=second?j.legCurrency:j?.currency;
 let cash=viewingWallet?.balance??0, spent=0, pending=0, due=0, missingBudgetFx=false, fictionalBudget=false;
 for(const [kind,d] of [['personal',p],['share',h]]) if(d){
   const entryCurrency=operationWallet(kind,d).currency;
   const i=impact(kind,d);
   if((kind==='share'?(d.walletId||'main'):'main')===viewingWalletId)cash+=i.cash;
   due+=i.balance;
   if(inDates(view,d.start,d.end)&&i.consumed!==0){
     const amount=amountFx(i.consumed,entryCurrency,dayCurrency);
     if(fx(entryCurrency,dayCurrency)?.fake)fictionalBudget=true;
     if(amount===null)missingBudgetFx=true;
     else {spent+=amount;if(!d.paid)pending+=amount;}
   }
 }
 const cards=[
   ['Mon compte',viewingWallet?fmt(cash,c):'À créer',viewingWallet?esc(viewingWallet.name)+(c!==baseCurrency()?' · '+equivalent(cash,c,baseCurrency()):''):'Un compte ou des espèces'],
   ['Budget du jour · '+(j?date(view):'exemple'),!j?'À définir':missingBudgetFx?'Calcul indisponible':(fictionalBudget?'≈ ':'')+(goal-spent<-0.000001?fmt(spent-goal,dayCurrency)+' de dépassement':fmt(Math.max(0,goal-spent),dayCurrency)+' restants'),
     j?('Objectif : '+fmt(goal,dayCurrency)+(missingBudgetFx?' · taux indisponible':(fictionalBudget?' · taux fictif':'')+(Math.abs(spent)>0.000001?' · '+fmt(spent,dayCurrency)+' comptés':''))+(pending&&!missingBudgetFx?' · '+fmt(Math.abs(pending),dayCurrency)+(pending>0?' à payer':' à encaisser')+' inclus dans le calcul':'')):'Un objectif par jour'],
   ['Qui doit quoi',!s.group?'Trip facultatif':due===0?fmt(0,c):fmt(Math.abs(due),c),
     !s.group?'Partage et remboursements':due===0?'Rien à régler':due>0?esc(s.group.participant)+' te doit':'Tu dois à '+esc(s.group.participant)]
 ];
 if(j&&stage>=2&&stage<=6){
   summary.innerHTML='<div><small>Compte</small><strong>'+cards[0][1]+'</strong></div><div><small>Budget du jour'+(fictionalBudget?' · taux fictif':'')+'</small><strong>'+cards[1][1]+'</strong></div>';
   summary.hidden=false;
 }
 story.innerHTML='<p class="kicker">Tableau de bord de la démo</p><h2>'+esc(j?.name||'Ton voyage prend forme')+'</h2>'+
 (j?timeline(j):'<p class="muted">Tes choix apparaissent ici, sans rien modifier dans TravelBudget.</p>')+
 '<div class="tile-grid" aria-live="polite">'+cards.map(([l,v,n])=>'<div class="tile"><small>'+l+'</small><strong>'+v+'</strong><small>'+n+'</small></div>').join('')+'</div>'+
 '<p class="story-note muted">'+(f?.id==='personal'||f?.id==='share'?'Aperçu avant validation. Tu peux revenir en arrière et essayer un autre scénario.':'Les montants d’exemple sont indépendants des données de ton compte.')+'</p>';
}
function submit(e){
 e.preventDefault();
 const f=e.currentTarget,a=Object.fromEntries(new FormData(f));
 const reject=(text)=>{q('error').textContent=text;};
 if(f.id==='journey'){
   const d=journeyForm(f);if(!verifyJourney(d))return reject('Choisis un pays et vérifie les dates et les budgets. La période doit rester à l’intérieur du voyage et sa fin ne doit pas précéder son début.');
   if(s.step===8){s.setup={...s.setup,journey:d};switchTo(9);return;}
   const old=s.journey;
   const changed=old?.currency&&old.currency!==d.currency;
   s.journey=d;
   if(changed){s.wallet=null;s.personal=null;s.share=null;}
   else {s.personal=moveExample(s.personal,old,d);s.share=moveExample(s.share,old,d);}
 }else if(f.id==='profile'){
   if(a.whatsapp&&!/^\+[\d ()-]{7,21}$/.test(a.whatsapp.trim()))return reject('Utilise le format international, avec + puis l’indicatif pays.');
   if(a.birth&&a.birth>today)return reject('La date de naissance doit être aujourd’hui ou avant.');
   // Do not store the email, phone number or date of birth, even in local storage.
   s.setup={...(s.setup||{}),baseCurrency:a.baseCurrency};
 }else if(f.id==='wallet'){
   if(!a.name.trim()||a.balance===''||!Number.isFinite(Number(a.balance)))return reject('Ajoute un nom et un solde.');
      if(s.wallet&&s.wallet.currency!==a.walletCurrency){s.personal=null;s.share=null;}
   s.wallet={name:a.name.trim(),kind:a.kind,balance:Number(a.balance),currency:a.walletCurrency};
 }else if(f.id==='personal'||f.id==='share'){
   const d=inputs(f);if(!draftValid(d))return reject('Vérifie le montant et les dates.');
   s[f.id]=d;
 }else if(f.id==='group'){
   if(!a.name.trim()||!a.participant.trim())return reject('Ajoute un nom et un participant fictif.');
   s.group={name:a.name.trim(),participant:a.participant.trim()};
 }
 switchTo(s.step+1);
}
const dialog=q('calendar');
let dateField=null, calendarButton=null, monthCursor=null;
function drawCalendar(preferSelected=false){
 const y=monthCursor.getUTCFullYear(),m=monthCursor.getUTCMonth();
 const iso=(d)=>new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);
 const length=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const lead=(monthCursor.getUTCDay()+6)%7;
 const year=q('cal-year');
 if(!q('cal-year-wrap').hidden&&![...year.options].some(o=>+o.value===y)){
   const now=new Date().getUTCFullYear();
   year.replaceChildren(...Array.from({length:121},(_,i)=>new Option(String(now-i),String(now-i))));
 }
 year.value=String(y);
 q('cal-month').textContent=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthCursor);
 const days=q('cal-days');
 days.replaceChildren(...['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(name=>Object.assign(document.createElement('span'),{textContent:name})));
 for(let i=0;i<lead;i++)days.append(document.createElement('span'));
 for(let d=1;d<=length;d++){
   const b=Object.assign(document.createElement('button'),{type:'button',textContent:String(d),className:'cal-day'});
   b.dataset.day=iso(d);
   b.setAttribute('aria-label',date(iso(d)));
   b.setAttribute('aria-pressed',String(dateField.value===iso(d)));
   b.disabled=!!dateField.max&&iso(d)>dateField.max;
   days.append(b);
 }
 if(preferSelected)(days.querySelector('[aria-pressed="true"]')||days.querySelector('button:enabled'))?.focus();
}
function setDate(value){
 if(!dateField)return;
 dateField.value=value;
 dateField.dispatchEvent(new Event('input',{bubbles:true}));
 dateField.dispatchEvent(new Event('change',{bubbles:true}));
 dialog.close();
}
q('cal-year').addEventListener('change',e=>{monthCursor.setUTCFullYear(+e.target.value);drawCalendar();});
q('cal-prev').addEventListener('click',()=>{monthCursor.setUTCMonth(monthCursor.getUTCMonth()-1);drawCalendar();});
q('cal-next').addEventListener('click',()=>{monthCursor.setUTCMonth(monthCursor.getUTCMonth()+1);drawCalendar();});
q('cal-clear').addEventListener('click',()=>setDate(''));
q('cal-close').addEventListener('click',()=>dialog.close());
q('cal-days').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b)setDate(b.dataset.day);});
q('cal-days').addEventListener('keydown',e=>{
 const d=e.target.closest('[data-day]');
 const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
 if(!d||!offsets[e.key])return;
 e.preventDefault(); const target=shift(d.dataset.day,offsets[e.key]);
 if(target.slice(0,7)!==d.dataset.day.slice(0,7)){monthCursor=new Date(target.slice(0,7)+'-01T00:00:00Z');drawCalendar();}
 q('cal-days').querySelector('[data-day="'+target+'"]')?.focus();
});
dialog.addEventListener('close',()=>{calendarButton?.focus();dateField=null;calendarButton=null;});
main.addEventListener('click',e=>{
 const cal=e.target.closest('[data-calendar]');
 if(cal){
   calendarButton=cal;dateField=q('input-'+cal.dataset.calendar);
   const related=cal.dataset.calendar==='legEnd'?q('input-legStart')?.value:'';
   q('cal-year-wrap').hidden=dateField.name!=='birth';
   const initial=dateField.value||related||(s.step>=7?today:demoDay(s.journey));
   monthCursor=new Date(initial.slice(0,7)+'-01T00:00:00Z');
   q('calendar-label').textContent=cal.getAttribute('aria-label');
   q('cal-clear').hidden=dateField.required;
   drawCalendar();dialog.showModal();drawCalendar(true);return;
 }
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='start'){if(!s.paused)s.demoBase=main.querySelector('[name=demoBase]')?.value||baseCurrency();switchTo(s.step||1);}
 if(action==='setup')switchTo(7);
 if(action==='finish-demo')switchTo(6);
 if(action==='lodging-example'){
   const f=q('personal'),j=s.journey;
   if(count(j.start,j.end)<3){q('error').textContent='Choisis un voyage d’au moins trois jours pour essayer cet exemple.';return;}
   const begin=demoDay(j)<=shift(j.end,-2)?demoDay(j):shift(j.end,-2);
   f.elements.kind.value='expense';syncCategories(f,'lodging','hotel');
   f.elements.amount.value='90';f.elements.date.value=begin;
   f.elements.start.value=begin;f.elements.end.value=shift(begin,2);
   f.elements.custom.checked=true;f.elements.paid.checked=true;f.elements.out.checked=false;
   updatePreview();
 }
 if(action==='pause'){
   if(s.paused)return;
   if(s.step===0){main.querySelector('.hint').textContent='Tu peux fermer cette page et rouvrir la démo plus tard.';return;}
   const f=main.querySelector('form');
   if(f) s.draft={step:s.step,details:!!f.querySelector('details')?.open,fields:Object.fromEntries([...f.elements].filter(el=>el.name&&(f.id!=='profile'||el.name==='baseCurrency')).map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]))};
   s.paused=true;save();render();q('title')?.focus();
 }
 if(action==='back')switchTo(Math.max(0,s.step===6&&!s.share?4:s.step-1));
 if(action==='reset'){s=seed();save();render();q('title')?.focus();}
 if(action==='finish'){s.share=null;switchTo(6);}
 if(action==='switch-example'){
   const original=s.share;
   switchTo(5);
   const f=q('share');f.elements.kind.value=original.kind==='income'?'expense':'income';
   f.elements.kind.dispatchEvent(new Event('change'));
 }
});
render();
})();
