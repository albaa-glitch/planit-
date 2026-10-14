/* Planit - datos almacenados exclusivamente en este navegador */
(() => {
  'use strict';
  const KEY = 'planit_v1';
  const $ = id => document.getElementById(id);
  const money = amount => new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'}).format(Number(amount) || 0);
  const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const todayYear = new Date().getFullYear();
  const initial = {years:[todayYear], selectedYear:todayYear, activeTripId:null, trips:[]};
  let state;
  try {
    const restored = JSON.parse(localStorage.getItem(KEY));
    state = restored && Array.isArray(restored.trips) && Array.isArray(restored.years) ? restored : structuredClone(initial);
  } catch { state = structuredClone(initial); }
  let selectedDayIndex = 0;
  let showingActivityForm = false;

  function save() {
    try {localStorage.setItem(KEY, JSON.stringify(state));}
    catch {status('No se pudo guardar. Revisa el almacenamiento del navegador.', true);}
  }
  function status(message, error=false) {const el=$('statusMessage'); el.textContent=message; el.style.color=error?'#ae433a':'#276d51';}
  function node(tag, cls='', text='') { const el=document.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=text; return el; }
  function button(text, cls, action) {const b=node('button',`button ${cls}`,text);b.type='button';b.addEventListener('click',action);return b;}
  function field(labelText, value, action, type='text', placeholder='') {
    const wrap=node('div'); const l=node('label','',labelText); const control=type==='textarea'?node('textarea'):node('input');
    if(type!=='textarea')control.type=type;
    control.value=value ?? ''; control.placeholder=placeholder; control.addEventListener('input',e=>action(e.target.value));
    wrap.append(l,control); return wrap;
  }
  function activeTrip() {return state.trips.find(t=>t.id===state.activeTripId) || null;}
  function ensureShape(trip) {
    if(!Array.isArray(trip.days))trip.days=[];
    if(!Array.isArray(trip.itineraries))trip.itineraries=Array.from({length:3},(_,i)=>({name:`Propuesta ${i+1}`,notes:''}));
    while(trip.itineraries.length<3)trip.itineraries.push({name:`Propuesta ${trip.itineraries.length+1}`,notes:''});
    if(!Number.isInteger(trip.selectedItinerary))trip.selectedItinerary=-1;
    for(const day of trip.days){if(!Array.isArray(day.activities))day.activities=[];}
  }
  function render() {renderYears();renderTrips();renderWorkspace();}
  function renderYears() {
    const select=$('yearSelect'); select.replaceChildren();
    [...new Set([...state.years,...state.trips.map(t=>t.year),todayYear])].filter(Number.isInteger).sort((a,b)=>b-a).forEach(year=>{
      const option=node('option','',String(year));option.value=year;select.append(option);
    });
    if(![...select.options].some(o=>Number(o.value)===Number(state.selectedYear)))state.selectedYear=todayYear;
    select.value=String(state.selectedYear);
  }
  function renderTrips() {
    const list=$('tripList');list.replaceChildren();
    const trips=state.trips.filter(t=>Number(t.year)===Number(state.selectedYear));
    if(!trips.length){list.append(node('div','empty-state','Todavía no tienes viajes en este año. Crea el primero.'));return;}
    for(const trip of trips){
      const row=node('div',`trip-item ${trip.id===state.activeTripId?'is-active':''}`);
      const text=node('div');text.append(node('strong','',trip.name || 'Viaje sin nombre'));
      const dateText=[trip.start,trip.end].filter(Boolean).join(' → ') || 'Fechas por definir';
      text.append(node('small','',dateText));
      row.append(text,button(trip.id===state.activeTripId?'Abierto':'Abrir','button-small button-secondary',()=>{state.activeTripId=trip.id;selectedDayIndex=0;save();render();}));
      list.append(row);
    }
  }
  function renderWorkspace() {
    const trip=activeTrip();$('tripWorkspace').hidden=!trip;
    if(!trip)return;
    ensureShape(trip);
    $('workspaceTitle').textContent=trip.name||'Viaje sin nombre';
    $('tripName').value=trip.name || '';
    $('tripStart').value=trip.start||'';
    $('tripEnd').value=trip.end||'';
    $('tripNotes').value=trip.notes||'';
    renderItineraries(trip);renderBudget(trip);renderDay(trip);
  }
  function renderItineraries(trip) {
    const host=$('tripItineraries');host.replaceChildren();
    const grid=node('div','itinerary-list');
    trip.itineraries.slice(0,3).forEach((proposal,i)=>{
      const card=node('div',`itinerary-card ${trip.selectedItinerary===i?'selected':''}`);
      card.append(node('h3','',`Itinerario ${String.fromCharCode(65+i)}`));
      card.append(field('Nombre de la propuesta',proposal.name,value=>{proposal.name=value;save();}));
      card.append(field('Ruta, ideas y diferencias',proposal.notes,value=>{proposal.notes=value;save();},'textarea','Ej. Ruta por ciudades, transportes, hoteles y ventajas...'));
      card.append(button(trip.selectedItinerary===i?'✓ Mi favorito':'Elegir itinerario',trip.selectedItinerary===i?'':'button-secondary',()=>{trip.selectedItinerary=i;save();renderItineraries(trip);}));
      grid.append(card);
    });host.append(grid);
    host.append(node('p','muted','Estas son tres alternativas editables para comparar rutas completas. El itinerario diario se organiza por separado.'));
  }
  function costs(trip) {
    return trip.days.flatMap(d=>d.activities||[]).reduce((sum,a)=>({estimate:sum.estimate+(Number(a.estimate)||0),actual:sum.actual+(Number(a.actual)||0)}),{estimate:0,actual:0});
  }
  function renderBudget(trip) {
    const {estimate,actual}=costs(trip);
    $('totalEstimate').textContent=money(estimate);$('totalActual').textContent=money(actual);
    const diff=estimate-actual;const el=$('totalDifference');el.textContent=money(diff);el.classList.toggle('negative',diff<0);el.classList.toggle('positive',diff>0);
  }
  function validDates(trip) {
    if(!trip.start || !trip.end) return null;
    const start=new Date(`${trip.start}T12:00:00Z`), end=new Date(`${trip.end}T12:00:00Z`);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)return null;
    const count=Math.round((end-start)/86400000)+1;
    if(count>180)return null;
    return Array.from({length:count},(_,index)=>new Date(start.getTime()+index*86400000).toISOString().slice(0,10));
  }
  function generateDays() {
    const trip=activeTrip();if(!trip)return;
    const dates=validDates(trip);
    if(!dates){alert('Introduce fechas válidas. La fecha final debe ser igual o posterior a la inicial (máximo 180 días).');return;}
    const prior=new Map(trip.days.filter(d=>d.date).map(d=>[d.date,d]));
    const oldUndated=trip.days.filter(d=>!d.date);
    if(trip.days.some(d=>!dates.includes(d.date))&&!confirm('Se conservarán los días que coincidan con las nuevas fechas, pero se eliminarán los demás días y sus gastos. ¿Continuar?'))return;
    trip.days=dates.map((date,i)=>prior.get(date)||oldUndated[i]&&{...oldUndated[i],date}||{id:id(),date,title:'',notes:'',activities:[]});
    selectedDayIndex=0;save();render();status(`Generados ${dates.length} días del viaje.`);
  }
  function renderDay(trip) {
    const host=$('daysContainer');host.replaceChildren();
    const count=trip.days.length;
    selectedDayIndex=Math.max(0,Math.min(selectedDayIndex,count-1));
    $('dayPosition').textContent=count?`Día ${selectedDayIndex+1} de ${count}`:'Sin días';
    $('previousDayBtn').disabled=!count||selectedDayIndex===0;
    $('nextDayBtn').disabled=!count||selectedDayIndex===count-1;
    if(!count){host.append(node('div','empty-state','Añade las fechas y pulsa «Generar días del viaje», o añade un día manualmente.'));return;}
    const day=trip.days[selectedDayIndex], card=node('div','day-card');
    const head=node('div','day-title');head.append(node('h3','',`Día ${selectedDayIndex+1}${day.date?' · '+formatDate(day.date):''}`));
    head.append(button('Eliminar día','button-small button-danger',()=>{
      if(!confirm('¿Eliminar este día y todas sus actividades y gastos?'))return;
      trip.days.splice(selectedDayIndex,1);showingActivityForm=false;save();renderDay(trip);renderBudget(trip);
    }));card.append(head);
    const fields=node('div','form-grid');
    fields.append(field('Título del día',day.title||'',v=>{day.title=v;save();},'text','Ej. Tokio: Shinjuku y Shibuya'));
    fields.append(field('Fecha (opcional)',day.date||'',v=>{day.date=v;save();renderDay(trip);},'date'));
    card.append(fields);
    card.append(field('Notas del día',day.notes||'',v=>{day.notes=v;save();},'textarea','Reservas, transportes, lugares imprescindibles...'));
    card.append(node('h3','', 'Actividades y gastos'));
    if(!day.activities.length)card.append(node('div','empty-state activity-empty','No has añadido actividades a este día.'));
    day.activities.forEach((activity,i)=>{
      const a=node('div','activity'), top=node('div','activity-top');
      const left=node('div');left.append(node('strong','',activity.name||'Actividad'));
      left.append(node('div','activity-meta',[activity.time,activity.category].filter(Boolean).join(' · ')));
      if(activity.notes)left.append(node('p','',activity.notes));
      top.append(left);
      const actions=node('div','item-actions');
      actions.append(button('Editar','button-small button-secondary',()=>showActivityForm(card,trip,day,activity,i)));
      actions.append(button('Borrar','button-small button-danger',()=>{if(!confirm('¿Borrar esta actividad?'))return;day.activities.splice(i,1);save();renderDay(trip);renderBudget(trip);}));
      top.append(actions);a.append(top);
      const fees=node('div','activity-costs');fees.append(node('span','',`Previsto: ${money(activity.estimate)}`),node('span','',`Final: ${money(activity.actual)}`));a.append(fees);card.append(a);
    });
    const totals=day.activities.reduce((s,a)=>({estimate:s.estimate+(Number(a.estimate)||0),actual:s.actual+(Number(a.actual)||0)}),{estimate:0,actual:0});
    card.append(node('div','day-activity-total',`Total del día: ${money(totals.estimate)} previsto · ${money(totals.actual)} final`));
    const add=button('+ Añadir actividad / gasto','',()=>showActivityForm(card,trip,day));add.style.marginTop='13px';card.append(add);
    host.append(card);
    if(showingActivityForm){showingActivityForm=false;showActivityForm(card,trip,day);}
  }
  function formatDate(value) {
    const parts=value.split('-');return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:value;
  }
  function showActivityForm(card,trip,day,activity=null,index=-1) {
    card.querySelector('.inline-form')?.remove();
    const form=node('div','inline-form');form.append(node('h3','',activity?'Editar actividad':'Nueva actividad'));
    const data={name:activity?.name||'',time:activity?.time||'',category:activity?.category||'',notes:activity?.notes||'',estimate:activity?.estimate??'',actual:activity?.actual??''};
    const first=node('div','form-grid');
    first.append(field('Actividad / gasto',data.name,v=>data.name=v,'text','Ej. Hotel, vuelo, visita...'));
    first.append(field('Hora',data.time,v=>data.time=v,'time'));
    form.append(first);
    const second=node('div','form-grid');
    second.append(field('Categoría',data.category,v=>data.category=v,'text','Transporte, alojamiento, comida...'));
    second.append(field('Notas',data.notes,v=>data.notes=v,'text','Dirección, reserva...'));
    form.append(second);
    const third=node('div','form-grid');
    third.append(field('Previsión (€)',data.estimate,v=>data.estimate=v,'number','0'));
    third.append(field('Precio final (€)',data.actual,v=>data.actual=v,'number','0'));
    form.append(third);
    const controls=node('div','day-actions');controls.style.marginTop='12px';
    controls.append(button('Guardar actividad','',()=>{
      if(!data.name.trim()){alert('Escribe un nombre para la actividad.');return;}
      for(const key of ['estimate','actual']){
        if(data[key]!==''&&(!Number.isFinite(Number(data[key]))||Number(data[key])<0)){alert('Los importes deben ser números positivos.');return;}
        data[key]=data[key]===''?0:Number(data[key]);
      }
      if(index>=0)day.activities[index]={...day.activities[index],...data};
      else day.activities.push({id:id(),...data});
      showingActivityForm=false;save();renderDay(trip);renderBudget(trip);
    }));
    controls.append(button('Cancelar','button-secondary',()=>form.remove()));form.append(controls);
    card.append(form);form.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  $('yearSelect').addEventListener('change',e=>{state.selectedYear=Number(e.target.value);state.activeTripId=null;save();render();});
  $('addYearBtn').addEventListener('click',()=>{
    const response=prompt('¿Qué año quieres añadir?',String(todayYear+1));if(response===null)return;
    const year=Number(response.trim());if(!Number.isInteger(year)||year<1900||year>2200){alert('Introduce un año válido (1900–2200).');return;}
    if(!state.years.includes(year))state.years.push(year);
    state.selectedYear=year;state.activeTripId=null;save();render();
  });
  function addTrip() {
    const name=$('newTripName').value.trim();if(!name){alert('Escribe el nombre del viaje.');return;}
    const trip={id:id(),year:state.selectedYear,name,start:'',end:'',notes:'',days:[],selectedItinerary:-1,itineraries:Array.from({length:3},(_,i)=>({name:`Propuesta ${i+1}`,notes:''}))};
    state.trips.push(trip);state.activeTripId=trip.id;selectedDayIndex=0;$('newTripName').value='';save();render();
    $('tripWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('addTripBtn').addEventListener('click',addTrip);
  $('newTripName').addEventListener('keydown',e=>{if(e.key==='Enter')addTrip();});
  $('tripName').addEventListener('input',e=>{const trip=activeTrip();if(!trip)return;trip.name=e.target.value;$('workspaceTitle').textContent=trip.name||'Viaje sin nombre';save();renderTrips();});
  for(const [element,key] of [['tripStart','start'],['tripEnd','end'],['tripNotes','notes']]){
    $(element).addEventListener('input',e=>{const trip=activeTrip();if(trip){trip[key]=e.target.value;save();}});
  }
  $('deleteTripBtn').addEventListener('click',()=>{
    const trip=activeTrip();if(!trip||!confirm(`¿Eliminar definitivamente «${trip.name}» y todos sus datos?`))return;
    state.trips=state.trips.filter(t=>t.id!==trip.id);state.activeTripId=null;save();render();status('Viaje eliminado.');
  });
  $('generateDaysBtn').addEventListener('click',generateDays);
  $('addDayBtn').addEventListener('click',()=>{
    const trip=activeTrip();if(!trip)return;
    trip.days.push({id:id(),date:'',title:'',notes:'',activities:[]});selectedDayIndex=trip.days.length-1;save();renderDay(trip);
  });
  $('previousDayBtn').addEventListener('click',()=>{selectedDayIndex--;renderDay(activeTrip());});
  $('nextDayBtn').addEventListener('click',()=>{selectedDayIndex++;renderDay(activeTrip());});
  $('exportBtn').addEventListener('click',()=>{
    const json=JSON.stringify({app:'Planit',version:1,exportedAt:new Date().toISOString(),data:state},null,2);
    const link=document.createElement('a');const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    link.href=url;link.download=`planit-copia-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('Copia exportada correctamente.');
  });
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>10_000_000)throw Error('El archivo supera el límite de 10 MB.');
      const content=JSON.parse(await file.text());const data=content?.app==='Planit'?content.data:content;
      if(!data||!Array.isArray(data.trips)||!Array.isArray(data.years)||!data.trips.every(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&Array.isArray(t.days)))throw Error('El archivo no contiene una copia válida de Planit.');
      if(!confirm('Importar sustituirá todos los viajes guardados en este navegador. ¿Continuar?'))return;
      state={years:data.years.filter(Number.isInteger),selectedYear:Number(data.selectedYear)||todayYear,activeTripId:null,trips:data.trips};
      save();render();status('Copia importada correctamente.');
    }catch(err){status(`Error al importar: ${err.message}`,true);}finally{e.target.value='';}
  });
  render();
})();
