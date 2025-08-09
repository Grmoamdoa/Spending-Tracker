// Spending & Shopping Tracker — App Logic (V1.1)
// Local-only, mobile-first. Uses localStorage + DataURL images. No dependencies.

// ======= Config =======
const STORAGE_KEY = 'shoppingTracker_v1';
const DEFAULT_CURRENCY = 'CAD';

function detectCurrency() {
  try {
    const loc = (Intl.NumberFormat().resolvedOptions().locale || navigator.language || 'en-CA');
    const m = loc.match(/-([A-Z]{2})/i);
    const region = (m ? m[1] : 'CA').toUpperCase();
    // Map common regions to currencies; default to CAD if unknown
    const EUR = new Set(['AT','BE','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES']);
    if (EUR.has(region)) return 'EUR';
    const map = {
      CA:'CAD', US:'USD', GB:'GBP', AU:'AUD', NZ:'NZD', JP:'JPY', CN:'CNY', IN:'INR',
      HK:'HKD', SG:'SGD', KR:'KRW', TW:'TWD', TH:'THB', VN:'VND', MY:'MYR', ID:'IDR',
      CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK', PL:'PLN', CZ:'CZK', HU:'HUF', RO:'RON', BG:'BGN',
      RU:'RUB', UA:'UAH', TR:'TRY', IL:'ILS', SA:'SAR', AE:'AED', ZA:'ZAR', EG:'EGP',
      MX:'MXN', BR:'BRL', AR:'ARS', CL:'CLP', CO:'COP', PE:'PEN'
    };
    return map[region] || DEFAULT_CURRENCY;
  } catch (e) { return DEFAULT_CURRENCY; }
}

const CURRENCY = detectCurrency();
let chartType = 'bar'; // 'bar' | 'line'

// ======= State =======
let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const data = JSON.parse(raw);
      if(!data.lists) data.lists = {};
      if(!data.groups) data.groups = {};
      return data;
    }
  }catch(e){console.warn('Failed to load state', e)}
  // seed with an example list
  const id = makeId();
  const initial = {lists:{},groups:{},currentListId:id};
  initial.lists[id] = {id,name:'My First List',budget:null,groupIds:[],items:[]};
  saveState(initial);
  return initial;
}
function saveState(s=state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
function makeId(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}

// ======= DOM Refs =======
const listSelect = document.getElementById('listSelect');
const totalItemsEl = document.getElementById('totalItems');
const totalSpentEl = document.getElementById('totalSpent');
const photoRatioEl = document.getElementById('photoRatio');
const budgetStatusEl = document.getElementById('budgetStatus');
const itemsGrid = document.getElementById('itemsGrid');

const itemName = document.getElementById('itemName');
const itemPrice = document.getElementById('itemPrice');
const itemQty   = document.getElementById('itemQty'); // optional (falls back to 1 if absent)
const addItemBtn = document.getElementById('addItemBtn');
const photoTrigger = document.getElementById('photoTrigger');
const photoInput = document.getElementById('photoInput');
const photoPreviewWrap = document.getElementById('photoPreviewWrap');
const photoPreview = document.getElementById('photoPreview');
const clearPreview = document.getElementById('clearPreview');

// Create Qty field in UI if it's missing (runtime patch)
(function ensureQtyField(){
  const has = document.getElementById('itemQty');
  const price = document.getElementById('itemPrice');
  if(!has && price){
    const wrap = document.createElement('label'); wrap.className='field';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent='Qty';
    const input = document.createElement('input');
    input.id='itemQty'; input.type='number'; input.min='1'; input.step='1'; input.value='1'; input.inputMode='numeric';
    wrap.append(lab, input);

    const field = price.closest('.field') || price.parentElement;
    if(field && field.parentNode){ field.parentNode.insertBefore(wrap, field.nextSibling); }
  }
})();

// Modals
const listsModal = document.getElementById('listsModal');
const photosModal = document.getElementById('photosModal');
const analyticsModal = document.getElementById('analyticsModal');
const filtersModal = document.getElementById('filtersModal');
const exportModal = document.getElementById('exportModal');
const photoView = document.getElementById('photoView');
const photoViewImg = document.getElementById('photoViewImg');
const photoViewTitle = document.getElementById('photoViewTitle');

// Lists modal elements
const manageListsBtn = document.getElementById('manageListsBtn');
const listsContainer = document.getElementById('listsContainer');
const groupsContainer = document.getElementById('groupsContainer');
const newListName = document.getElementById('newListName');
const newListBudget = document.getElementById('newListBudget');
const addListBtn = document.getElementById('addList');
const newGroupName = document.getElementById('newGroupName');
const addGroupBtn = document.getElementById('addGroup');

// Photos modal elements
const photosBtn = document.getElementById('photosBtn');
const gallery = document.getElementById('gallery');

// Analytics elements
const analyticsBtn = document.getElementById('analyticsBtn');
const statListSpent = document.getElementById('statListSpent');
const statListItems = document.getElementById('statListItems');
const statWithPhotos = document.getElementById('statWithPhotos');
const statNoPhotos = document.getElementById('statNoPhotos');
const statMost = document.getElementById('statMost');
const statLeast = document.getElementById('statLeast');
const filtersBtn = document.getElementById('filtersBtn');
const chartCanvas = document.getElementById('chart');
const filtersLists = document.getElementById('filtersLists');
const filtersGroups = document.getElementById('filtersGroups');
const applyFiltersBtn = document.getElementById('applyFilters');
const chartTypeBtn = document.getElementById('chartTypeBtn'); // optional

// Export elements
const exportBtn = document.getElementById('exportBtn');
const exportCurrentJSON = document.getElementById('exportCurrentJSON');
const exportAllJSON = document.getElementById('exportAllJSON');
const exportCSVBtn = document.getElementById('exportCSV');
const csvListPicker = document.getElementById('csvListPicker');
const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');

const clearListBtn = document.getElementById('clearListBtn');

// ======= Event Wiring =======
document.querySelectorAll('dialog [data-close]').forEach(b=>b.addEventListener('click',e=>e.target.closest('dialog').close()));
manageListsBtn.addEventListener('click',()=>{renderListsModal(); listsModal.showModal()});
photosBtn.addEventListener('click',()=>{renderGallery(); photosModal.showModal()});
analyticsBtn.addEventListener('click',()=>{ renderAnalytics(); analyticsModal.showModal(); setTimeout(drawChart, 50); });
exportBtn.addEventListener('click',()=>{renderExportModal(); exportModal.showModal()});

addListBtn.addEventListener('click', addListFromModal);
addGroupBtn.addEventListener('click', addGroupFromModal);

listSelect.addEventListener('change',()=>{state.currentListId=listSelect.value; saveState(); renderAll()});

addItemBtn.addEventListener('click', handleAddItem);
photoTrigger.addEventListener('click',()=> photoInput.click());
photoInput.addEventListener('change', handlePhotoSelected);
clearPreview.addEventListener('click',()=>{photoInput.value=''; photoPreviewWrap.style.display='none'; photoPreview.src=''});

// Quick-set budget via pill tap
budgetStatusEl.addEventListener('click', setBudgetQuick);

filtersBtn.addEventListener('click',()=>{renderFilters(); filtersModal.showModal()});
applyFiltersBtn.addEventListener('click',()=>{filtersModal.close(); drawChart()});

// Chart type toggle: button if present + double-tap on chart
if(chartTypeBtn){ chartTypeBtn.addEventListener('click', toggleChartType) }
if(chartCanvas){ chartCanvas.addEventListener('dblclick', toggleChartType) }

exportCurrentJSON.addEventListener('click',()=>exportJSON({scope:'current'}));
exportAllJSON.addEventListener('click',()=>exportJSON({scope:'all'}));
exportCSVBtn.addEventListener('click', exportCSV);
importBtn.addEventListener('click', importJSON);

clearListBtn.addEventListener('click', ()=>{
  const cur = currentList();
  if(!cur) return;
  if(confirm(`Clear all ${cur.items.length} items in \"${cur.name}\"?`)){
    cur.items = [];
    saveState();
    renderAll();
  }
});

// ======= Core Logic =======
function currentList(){ return state.lists[state.currentListId] }

function renderAll(){
  renderListSelect();
  renderHeaderStats();
  renderItems();
}

function renderListSelect(){
  listSelect.innerHTML='';
  const ids = Object.keys(state.lists);
  ids.forEach(id=>{
    const o = document.createElement('option');
    o.value=id; o.textContent=state.lists[id].name; listSelect.appendChild(o);
  });
  if(!state.lists[state.currentListId] && ids.length){ state.currentListId = ids[0] }
  listSelect.value = state.currentListId;
}

function renderHeaderStats(){
  const list = currentList();
  if(!list) return;
  const total = list.items.reduce((a,b)=>a + itemTotal(b), 0);
  const withP = list.items.filter(i=>!!i.photo).length;
  const withoutP = list.items.length - withP;

  totalItemsEl.textContent = `${list.items.length} items`;
  totalSpentEl.textContent = formatMoney(total);
  photoRatioEl.textContent = `${withP} / ${withoutP}`;

  // Budget status
  if(list.budget && list.budget>0){
    const pct = total / list.budget;
    let cls='ok', label='On Track';
    if(pct>=0.8 && pct<1){cls='watch'; label='Watch Spending'}
    else if(pct>=1){cls='over'; label='Over Budget'}
    budgetStatusEl.className = `pill ${cls}`;
    budgetStatusEl.textContent = label;
    budgetStatusEl.title = `Budget ${formatMoney(list.budget)} – ${Math.round(pct*100)}% used`;
    budgetStatusEl.style.display='inline-block';
  }else{
    budgetStatusEl.className='pill ok';
    budgetStatusEl.textContent='No Budget';
    budgetStatusEl.title='No budget set on this list';
    budgetStatusEl.style.display='inline-block';
  }
}

function renderItems(){
  const list = currentList();
  itemsGrid.innerHTML='';
  if(!list) return;
  list.items
    .slice()
    .sort((a,b)=>b.ts-a.ts)
    .forEach(item=>{
      const card = document.createElement('div');
      card.className='item';
      const thumb = document.createElement('div');
      thumb.className='thumb';
      if(item.photo) thumb.style.backgroundImage = `url(${item.photo})`;
      const content = document.createElement('div'); content.className='content';
      const name = document.createElement('div'); name.textContent=item.name;
      const price = document.createElement('div'); price.className='price'; price.textContent = formatMoney(itemTotal(item));
      const meta = document.createElement('div'); meta.className='meta';
      meta.textContent = (item.qty && item.qty>1 ? `Qty ${item.qty} @ ${formatMoney(item.price)} • ` : '') + new Date(item.ts).toLocaleString();
      content.append(name, price, meta);
      const actions = document.createElement('div'); actions.className='actions';
      const viewBtn = document.createElement('button'); viewBtn.className='ghost'; viewBtn.textContent = 'View'; viewBtn.disabled = !item.photo;
      viewBtn.addEventListener('click',()=>{ if(item.photo){ photoViewImg.src=item.photo; photoViewTitle.textContent=`${item.name} – ${formatMoney(itemTotal(item))}`; photoView.showModal(); }});
      const editBtn = document.createElement('button'); editBtn.className='ghost'; editBtn.textContent='Edit';
      editBtn.addEventListener('click',()=> editItem(item.id));
      const delBtn = document.createElement('button'); delBtn.className='danger'; delBtn.textContent='Delete';
      delBtn.addEventListener('click',()=>{
        const cur = currentList();
        cur.items = cur.items.filter(i=>i.id!==item.id);
        saveState(); renderAll();
      });
      actions.append(viewBtn, editBtn, delBtn);
      card.append(thumb, content, actions);
      itemsGrid.appendChild(card);
    });
}

async function handleAddItem(){
  const name = (itemName.value||'').trim();
  const price = parseFloat(itemPrice.value);
  const qtyInput = document.getElementById('itemQty'); let qty = 1; if(qtyInput){ qty = parseInt(qtyInput.value||'1',10); if(isNaN(qty)||qty<1) qty=1; }
  if(!name){ alert('Please enter an item name.'); return; }
  if(isNaN(price) || price<0){ alert('Please enter a valid price.'); return; }

  let photoData = null;
  if(photoInput.files && photoInput.files[0]){
    try{ photoData = await compressImageToDataURL(photoInput.files[0], 1280, 0.7); }
    catch(e){ console.warn('Photo compression failed, falling back to original', e); photoData = await fileToDataURL(photoInput.files[0]); }
  }

  const item = { id: makeId(), name, price: round2(price), qty, photo: photoData, ts: Date.now() };
  const list = currentList();
  list.items.push(item);
  saveState();
  itemName.value=''; itemPrice.value=''; if(qtyInput) qtyInput.value='1'; photoInput.value=''; photoPreviewWrap.style.display='none'; photoPreview.src='';
  renderAll();
}

function handlePhotoSelected(){
  const f = photoInput.files && photoInput.files[0];
  if(!f){ photoPreviewWrap.style.display='none'; return }
  const url = URL.createObjectURL(f);
  photoPreview.src = url; photoPreviewWrap.style.display='flex';
}

// ======= Lists & Groups =======
function renderListsModal(){
  // lists
  listsContainer.innerHTML='';
  Object.values(state.lists).forEach(list=>{
    const row = document.createElement('div'); row.className='list-row';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:700">${escapeHtml(list.name)}</div>`+
      `<div class="hint">${list.items.length} items • ${formatMoney(list.items.reduce((a,b)=>a+itemTotal(b),0))}`+
      `${list.budget?` • Budget ${formatMoney(list.budget)}`:''}</div>`;
    const right = document.createElement('div'); right.className='row'; right.style.gap='6px';
    const edit = document.createElement('button'); edit.className='ghost'; edit.textContent='Edit';
    edit.addEventListener('click',()=> editList(list.id));
    const setBtn = document.createElement('button'); setBtn.className='ghost'; setBtn.textContent='Open';
    setBtn.addEventListener('click',()=>{state.currentListId=list.id; saveState(); renderAll(); listsModal.close();});
    const del = document.createElement('button'); del.className='danger'; del.textContent='Delete';
    del.addEventListener('click',()=>{
      if(confirm(`Delete list \"${list.name}\"? This cannot be undone.`)){
        delete state.lists[list.id];
        // remove from any groups
        Object.values(state.groups).forEach(g=>{ g.listIds = (g.listIds||[]).filter(id=>id!==list.id) });
        const ids = Object.keys(state.lists);
        if(!ids.includes(state.currentListId)) state.currentListId = ids[0] || null;
        saveState(); renderAll(); renderListsModal();
      }
    });
    right.append(edit,setBtn,del);
    row.append(left,right);
    listsContainer.appendChild(row);
  });

  // groups
  groupsContainer.innerHTML='';
  Object.values(state.groups).forEach(g=>{
    const row = document.createElement('div'); row.className='list-row';
    const left = document.createElement('div');
    const count = (g.listIds||[]).length;
    left.innerHTML = `<div style="font-weight:700">${escapeHtml(g.name)}</div>`+
      `<div class="hint">${count} list${count===1?'':'s'} in group</div>`;
    const right = document.createElement('div'); right.className='row'; right.style.gap='6px';
    const edit = document.createElement('button'); edit.className='ghost'; edit.textContent='Edit';
    edit.addEventListener('click',()=> editGroup(g.id));
    const del = document.createElement('button'); del.className='danger'; del.textContent='Delete';
    del.addEventListener('click',()=>{
      if(confirm(`Delete group \"${g.name}\"?`)){
        delete state.groups[g.id]; saveState(); renderListsModal();
      }
    });
    right.append(edit,del); row.append(left,right); groupsContainer.appendChild(row);
  });
}

function addListFromModal(){
  const name = (newListName.value||'').trim();
  const budget = newListBudget.value? parseFloat(newListBudget.value): null;
  if(!name){ alert('Enter a list name'); return }
  if(budget!==null && (isNaN(budget)||budget<0)){ alert('Invalid budget'); return }
  const id = makeId();
  state.lists[id] = {id,name,budget: budget!==null? round2(budget): null, groupIds:[], items:[]};
  state.currentListId = id; saveState(); renderAll(); renderListsModal();
  newListName.value=''; newListBudget.value='';
}

async function editList(id){
  const list = state.lists[id];
  const name = prompt('Rename list', list.name);
  if(name===null) return; // cancelled
  const budgetStr = prompt('Set budget (blank to clear)', list.budget??'');
  if(name.trim()===''){ alert('Name cannot be empty'); return }
  list.name = name.trim();
  if(budgetStr===null){ /* unchanged */ }
  else if(budgetStr.trim()===''){ list.budget=null }
  else{
    const b = parseFloat(budgetStr); if(isNaN(b)||b<0){ alert('Invalid budget'); return } list.budget=round2(b);
  }
  // Assign to groups via checkbox picker
  const allGroups = Object.values(state.groups);
  if(allGroups.length){
    const current = new Set(list.groupIds||[]);
    const selected = await promptCheckboxes('Assign to Groups', allGroups.map(g=>({id:g.id,label:g.name,checked: current.has(g.id)})));
    if(selected){ list.groupIds = selected; // ensure groups also reflect membership
      allGroups.forEach(g=>{ g.listIds = g.listIds||[]; if(selected.includes(g.id)){ if(!g.listIds.includes(list.id)) g.listIds.push(list.id) } else { g.listIds = g.listIds.filter(x=>x!==list.id) } });
    }
  }

  saveState(); renderAll(); renderListsModal();
}

async function addGroupFromModal(){
  const name = (newGroupName.value||'').trim();
  if(!name){ alert('Enter a group name'); return }
  const id = makeId(); state.groups[id]={id,name,listIds:[]};
  newGroupName.value='';
  saveState();
  // Immediately choose lists for new group
  const lists = Object.values(state.lists);
  if(lists.length){
    const selected = await promptCheckboxes('Pick lists for group', lists.map(l=>({id:l.id,label:l.name,checked:false})));
    if(selected){
      state.groups[id].listIds = selected;
      lists.forEach(l=>{
        l.groupIds = l.groupIds||[];
        if(selected.includes(l.id)){ if(!l.groupIds.includes(id)) l.groupIds.push(id) }
      });
    }
  }
  saveState(); renderListsModal();
}

async function editGroup(id){
  const g = state.groups[id];
  const name = prompt('Rename group', g.name);
  if(name===null) return;
  if(name.trim()===''){ alert('Name cannot be empty'); return }
  g.name = name.trim();
  const lists = Object.values(state.lists);
  const selected = await promptCheckboxes('Pick lists for group', lists.map(l=>({id:l.id,label:l.name,checked:(g.listIds||[]).includes(l.id)})));
  if(selected){ g.listIds = selected;
    // ensure lists have back-reference
    lists.forEach(l=>{
      l.groupIds = l.groupIds||[];
      if(selected.includes(l.id)){ if(!l.groupIds.includes(g.id)) l.groupIds.push(g.id) }
      else{ l.groupIds = l.groupIds.filter(x=>x!==g.id) }
    })
  }
  saveState(); renderListsModal();
}

function promptCheckboxes(title, options){
  // simple synchronous-style checkbox prompt using a temporary dialog; returns Promise<string[]>
  const dlg = document.createElement('dialog');
  dlg.style.padding='0'; dlg.style.border='none'; dlg.style.borderRadius='18px'; dlg.style.background='var(--card)'; dlg.innerHTML = `
    <div class=\"modal-head\"><div class=\"title\">${escapeHtml(title)}</div></div>
    <div class=\"modal-body\">${options.map((opt)=>`<label class=\"row\" style=\"gap:8px;margin:6px 0\">
      <input type=\"checkbox\" ${opt.checked?'checked':''} data-id=\"${opt.id}\">
      <span>${escapeHtml(opt.label)}</span>
    </label>`).join('')}</div>
    <div class=\"modal-foot\"><button id=\"ok\" class=\"primary\">OK</button> <button id=\"cancel\" class=\"ghost\">Cancel</button></div>`;
  document.body.appendChild(dlg); dlg.showModal();
  return new Promise(resolve=>{
    dlg.querySelector('#cancel').addEventListener('click',()=>{dlg.close(); dlg.remove(); resolve(null)});
    dlg.querySelector('#ok').addEventListener('click',()=>{
      const ids = Array.from(dlg.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.getAttribute('data-id'));
      dlg.close(); dlg.remove(); resolve(ids);
    });
  });
}

// ======= Gallery =======
function renderGallery(){
  const list = currentList();
  gallery.innerHTML=''; if(!list) return;
  const withPhotos = list.items.filter(i=>!!i.photo).sort((a,b)=>b.ts-a.ts);
  withPhotos.forEach(i=>{
    const card = document.createElement('div'); card.className='gcard';
    const ph = document.createElement('div'); ph.className='ph'; ph.style.backgroundImage=`url(${i.photo})`;
    ph.addEventListener('click',()=>{ photoViewImg.src=i.photo; photoViewTitle.textContent=`${i.name} – ${formatMoney(itemTotal(i))}`; photoView.showModal() });
    const gc = document.createElement('div'); gc.className='gc';
    gc.innerHTML = `<div style=\"font-weight:700\">${escapeHtml(i.name)} • ${formatMoney(itemTotal(i))}</div>`+
      `<div class=\"hint\">${new Date(i.ts).toLocaleString()}</div>`;
    card.append(ph,gc); gallery.appendChild(card);
  });
}

// ======= Analytics =======
function renderAnalytics(){
  const list = currentList(); if(!list) return;
  const total = list.items.reduce((a,b)=>a + itemTotal(b), 0);
  const withP = list.items.filter(i=>!!i.photo).length;
  const withoutP = list.items.length - withP;
  statListSpent.textContent = formatMoney(total);
  statListItems.textContent = `${list.items.length}`;
  statWithPhotos.textContent = `${withP}`;
  statNoPhotos.textContent = `${withoutP}`;

  // Most/Least expensive (current list)
  if(list.items.length){
    const sorted = list.items.slice().sort((a,b)=>itemTotal(a)-itemTotal(b));
    const least = sorted[0];
    const most = sorted[sorted.length-1];
    statLeast.textContent = `${least.name} (${formatMoney(itemTotal(least))})`;
    statMost.textContent = `${most.name} (${formatMoney(itemTotal(most))})`;
  }else{
    statLeast.textContent = '—'; statMost.textContent='—';
  }

  // Filters UI
  renderFilters();
  // Draw chart
  drawChart();
}

function renderFilters(){
  filtersLists.innerHTML='';
  Object.values(state.lists).forEach(l=>{
    const id = `fl_${l.id}`; const row = document.createElement('label'); row.className='row'; row.style.gap='8px'; row.style.margin='6px 0';
    row.innerHTML = `<input type=\"checkbox\" id=\"${id}\" data-id=\"${l.id}\" checked> <span>${escapeHtml(l.name)}</span>`;
    filtersLists.appendChild(row);
  });
  filtersGroups.innerHTML='';
  Object.values(state.groups).forEach(g=>{
    const id = `fg_${g.id}`; const row = document.createElement('label'); row.className='row'; row.style.gap='8px'; row.style.margin='6px 0';
    row.innerHTML = `<input type=\"radio\" name=\"groupPick\" id=\"${id}\" data-id=\"${g.id}\"> <span>${escapeHtml(g.name)} (${(g.listIds||[]).length})</span>`;
    filtersGroups.appendChild(row);
  });
}

function getFilterSelection(){
  const groupRadio = filtersGroups.querySelector('input[type=radio]:checked');
  if(groupRadio){
    const gid = groupRadio.getAttribute('data-id');
    const g = state.groups[gid]; return (g && g.listIds) ? g.listIds.slice() : [];
  }
  // else lists
  return Array.from(filtersLists.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.getAttribute('data-id'));
}

function drawChart(){
  const ctx = chartCanvas.getContext('2d');
  ctx.clearRect(0,0,chartCanvas.width, chartCanvas.height);

  const W = chartCanvas.clientWidth; const H = chartCanvas.height;
  if(chartCanvas.width!==W) { chartCanvas.width=W }

  const listIds = getFilterSelection();
  // Aggregate items across chosen lists by YYYY-MM
  const map = new Map();
  listIds.forEach(id=>{
    const l = state.lists[id]; if(!l) return;
    l.items.forEach(it=>{
      const d = new Date(it.ts); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      map.set(key, (map.get(key)||0) + itemTotal(it));
    })
  });
  const entries = Array.from(map.entries()).sort((a,b)=>a[0]>b[0]?1:-1);
  const labels = entries.map(e=>e[0]);
  const values = entries.map(e=>e[1]);

  const pad = 36; const innerW = W - pad*2; const innerH = H - pad*2;
  const maxVal = Math.max(10, Math.ceil(Math.max(...values, 0)));

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();

  // Y ticks (0..max)
  ctx.fillStyle='rgba(255,255,255,.8)'; ctx.font='12px system-ui'; ctx.textAlign='right';
  const ticks = 4;
  for(let t=0;t<=ticks;t++){
    const val = maxVal * (t/ticks);
    const y = H - pad - (val/maxVal)*innerH;
    ctx.strokeStyle='rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
    ctx.fillText(formatMoney(val), pad-6, y-2);
  }

  // X labels
  ctx.textAlign='center';
  labels.forEach((lab,i)=>{ const x = pad + (i+0.5)*(innerW/Math.max(labels.length,1)); ctx.fillText(lab, x, H-8) });

  if(chartType==='bar'){
    const n = Math.max(values.length,1);
    const barGap = 10; const barW = Math.max(10, (innerW - (n-1)*barGap) / n);
    ctx.fillStyle = '#6ee7ff';
    values.forEach((v,i)=>{
      const x = pad + i*(barW+barGap);
      const h = (v/maxVal)*innerH;
      const y = H - pad - h;
      ctx.fillRect(x, y, barW, h);
    });
  } else {
    // line
    ctx.strokeStyle = '#6ee7ff'; ctx.lineWidth=2; ctx.beginPath();
    values.forEach((v,i)=>{
      const x = pad + (i+0.5)*(innerW/Math.max(values.length,1));
      const y = H - pad - (v/maxVal)*innerH;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // points
    values.forEach((v,i)=>{
      const x = pad + (i+0.5)*(innerW/Math.max(values.length,1));
      const y = H - pad - (v/maxVal)*innerH;
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
  }
}

function toggleChartType(){ chartType = (chartType==='bar')?'line':'bar'; if(chartTypeBtn){ chartTypeBtn.textContent = chartType==='bar' ? 'Bar' : 'Line'; } drawChart(); }

// ======= Export / Import =======
function renderExportModal(){
  csvListPicker.innerHTML='';
  Object.values(state.lists).forEach(l=>{
    const row = document.createElement('label'); row.className='row'; row.style.gap='8px'; row.style.margin='6px 0';
    row.innerHTML = `<input type=\"checkbox\" data-id=\"${l.id}\"> <span>${escapeHtml(l.name)}</span>`;
    csvListPicker.appendChild(row);
  });
}

function exportJSON({scope}){
  let payload;
  if(scope==='current'){
    const l = currentList();
    payload = {version:1, type:'list', list:l};
    downloadBlob(JSON.stringify(payload,null,2), `${sanitize(l.name)}.list.json`, 'application/json');
  } else {
    payload = {version:1, type:'all', lists:state.lists, groups:state.groups};
    downloadBlob(JSON.stringify(payload,null,2), `shopping-tracker.backup.json`, 'application/json');
  }
}

function exportCSV(){
  const ids = Array.from(csvListPicker.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.getAttribute('data-id'));
  if(!ids.length){ alert('Select at least one list'); return }
  const rows = [['List','Item','Qty','UnitPrice','Total','Timestamp','HasPhoto']];
  ids.forEach(id=>{
    const l = state.lists[id]; if(!l) return;
    l.items.forEach(it=> rows.push([l.name, it.name, it.qty||1, round2(it.price).toFixed(2), itemTotal(it).toFixed(2), new Date(it.ts).toISOString(), it.photo? 'yes':'no']));
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('
');
  downloadBlob(csv, 'shopping-tracker.csv', 'text/csv');
}

function importJSON(){
  const file = importFile.files && importFile.files[0];
  if(!file){ alert('Pick a JSON file to import'); return }
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(data.type==='list' && data.list){
        const nl = data.list; // create a new id to avoid collision
        const newId = makeId(); nl.id=newId; nl.name = ensureUniqueListName(nl.name);
        nl.items = (nl.items||[]).map(it=>({...it, id: makeId()}));
        state.lists[newId]=nl; state.currentListId=newId; saveState(); renderAll();
        alert('List imported');
      } else if(data.type==='all' && data.lists){
        const idMap = {};
        // merge lists and remember new ids
        Object.entries(data.lists).forEach(([oldId,l])=>{
          const newId = makeId();
          const name = ensureUniqueListName(l.name);
          state.lists[newId] = {id:newId,name, budget:l.budget??null, groupIds:[], items:(l.items||[]).map(it=>({...it,id:makeId()}))};
          idMap[oldId] = newId;
        });
        // merge groups and remap listIds
        if(data.groups){
          Object.entries(data.groups).forEach(([oldGid,g])=>{
            const gid = makeId();
            const mapped = (g.listIds||[]).map(oid=>idMap[oid]).filter(Boolean);
            state.groups[gid] = {id:gid, name: ensureUniqueGroupName(g.name), listIds: mapped};
            // back-references
            mapped.forEach(lid=>{ const l = state.lists[lid]; if(l){ l.groupIds = l.groupIds||[]; if(!l.groupIds.includes(gid)) l.groupIds.push(gid); } });
          });
        }
        saveState(); renderAll();
        alert('Backup imported');
      } else { alert('Unsupported JSON format') }
    }catch(e){ console.error(e); alert('Failed to parse JSON') }
  };
  reader.readAsText(file);
}

function ensureUniqueListName(name){
  const existing = new Set(Object.values(state.lists).map(l=>l.name));
  if(!existing.has(name)) return name;
  let i=2; while(existing.has(`${name} (${i})`)) i++; return `${name} (${i})`;
}
function ensureUniqueGroupName(name){
  const existing = new Set(Object.values(state.groups).map(g=>g.name));
  if(!existing.has(name)) return name;
  let i=2; while(existing.has(`${name} (${i})`)) i++; return `${name} (${i})`;
}

// ======= Item & Budget Editing =======
async function setBudgetQuick(){
  const list = currentList(); if(!list) return;
  const cur = list.budget ?? '';
  const v = prompt('Set budget for this list (blank to clear):', cur);
  if(v===null) return; // cancel
  if(v.trim()===''){ list.budget = null; }
  else{
    const b = parseFloat(v); if(isNaN(b)||b<0){ alert('Invalid budget'); return } list.budget = round2(b);
  }
  saveState(); renderAll();
}

async function editItem(itemId){
  const list = currentList(); if(!list) return;
  const item = list.items.find(i=>i.id===itemId); if(!item) return;
  const data = await promptEditItem(item);
  if(!data) return;
  item.name = data.name.trim();
  item.price = round2(data.price);
  item.qty = Math.max(1, parseInt(data.qty||1,10));
  if(data.clearPhoto){ item.photo = null; }
  if(data.file){ try{ item.photo = await compressImageToDataURL(data.file, 1280, 0.7) } catch(e){ console.warn('compress failed', e); item.photo = await fileToDataURL(data.file) } }
  saveState(); renderAll();
}

function promptEditItem(item){
  return new Promise(resolve=>{
    const dlg = document.createElement('dialog');
    dlg.style.padding='0'; dlg.style.border='none'; dlg.style.borderRadius='18px'; dlg.style.background='var(--card)';
    dlg.innerHTML = `
      <div class=\"modal-head\"><div class=\"title\">Edit Item</div></div>
      <div class=\"modal-body\">
        <label class=\"row\" style=\"gap:8px\"><span style=\"width:80px\">Name</span><input id=\"eiName\" type=\"text\" value=\"${escapeHtml(item.name)}\"></label>
        <label class=\"row\" style=\"gap:8px\"><span style=\"width:80px\">Price</span><input id=\"eiPrice\" type=\"number\" step=\"0.01\" min=\"0\" value=\"${item.price}\"></label>
        <label class=\"row\" style=\"gap:8px\"><span style=\"width:80px\">Qty</span><input id=\"eiQty\" type=\"number\" step=\"1\" min=\"1\" value=\"${item.qty||1}\"></label>
        <label class=\"row\" style=\"gap:8px\"><span style=\"width:80px\">Photo</span><input id=\"eiPhoto\" type=\"file\" accept=\"image/*\"></label>
        <label class=\"row\" style=\"gap:8px\"><input id=\"eiClear\" type=\"checkbox\"> <span>Clear existing photo</span></label>
      </div>
      <div class=\"modal-foot\"><button id=\"ok\" class=\"primary\">Save</button> <button id=\"cancel\" class=\"ghost\">Cancel</button></div>`;
    document.body.appendChild(dlg); dlg.showModal();
    dlg.querySelector('#cancel').addEventListener('click',()=>{dlg.close(); dlg.remove(); resolve(null)});
    dlg.querySelector('#ok').addEventListener('click',()=>{
      const name = dlg.querySelector('#eiName').value||'';
      const price = parseFloat(dlg.querySelector('#eiPrice').value||'0');
      const qty = parseInt(dlg.querySelector('#eiQty').value||'1',10);
      const file = (dlg.querySelector('#eiPhoto').files||[])[0]||null;
      const clearPhoto = dlg.querySelector('#eiClear').checked;
      dlg.close(); dlg.remove();
      if(!name.trim()){ alert('Name required'); resolve(null); return }
      if(isNaN(price)||price<0){ alert('Invalid price'); resolve(null); return }
      resolve({name, price, qty, file, clearPhoto});
    });
  });
}

// ======= Utils =======
function itemTotal(it){ return round2(Number(it.price||0) * Number(it.qty||1)); }
function round2(n){ return Math.round((Number(n)||0)*100)/100 }
function formatMoney(n){ return new Intl.NumberFormat(undefined,{style:'currency',currency:CURRENCY}).format(round2(n)) }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) }
function sanitize(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') }

function fileToDataURL(file){
  return new Promise((res,rej)=>{ const r = new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

async function compressImageToDataURL(file, maxDim=1280, quality=0.8){
  try{
    const img = await createImageBitmap(file);
    const scale = Math.min(1, maxDim/Math.max(img.width, img.height));
    const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
    const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0,0, w,h);
    return canvas.toDataURL('image/jpeg', quality);
  }catch(e){
    // Fallback route if createImageBitmap not supported
    const tmpURL = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((ok,err)=>{ img.onload=ok; img.onerror=err; img.src=tmpURL; });
    const scale = Math.min(1, maxDim/Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth*scale), h = Math.round(img.naturalHeight*scale);
    const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0,0, w,h);
    URL.revokeObjectURL(tmpURL);
    return canvas.toDataURL('image/jpeg', quality);
  }
}

function downloadBlob(content, filename, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

// ======= Init =======
renderAll();
