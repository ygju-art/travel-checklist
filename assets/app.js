const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

const state = {
  trips: load('trips', []), // [{id, name, date, items:[{id,text,done}]}]
};

const templates = {
   basic: ['여권','지갑/신용카드','현지 화폐','충전기','보조배터리','마스크','물티슈','속옷/양말','상의/하의','세면도구','우산/우비'],
   europe: ['여권','국제운전면허증','현지 화폐','플러그 어댑터(Type C/E/F)','보온 자켓','목도리/장갑','로션/립밤','비상약(감기/소화)','트래블 카드','현지 유심/eSIM','휴대용 손세정제'],
   beach: ['여권','수영복','현지 화폐','선크림','선글라스','비치타월','모자','방수팩','슬리퍼','얇은 겉옷','모기기피제'],
   business: ['여권','현지 화폐','노트북/충전기','프레젠테이션 파일','명함','정장/구두','면도도구','가벼운 간식','멀티탭','여분 케이블']
};

// --- utils ---
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const uid = () => Math.random().toString(36).slice(2,9);
const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${uid()}-${uid()}`);
const daysLeft = (dateStr) => {
  const one = new Date(new Date(dateStr).toDateString());
  const now = new Date(new Date().toDateString());
  return Math.round((one - now) / (1000*60*60*24));
};

// --- elements ---
const tripName = $('#tripName');
const tripDate = $('#tripDate');
const templateSelect = $('#templateSelect');
const addTripBtn = $('#addTripBtn');
const tripList = $('#tripList');
const dialog = $('#tripDialog');
const dialogTitle = $('#dialogTitle');
const dialogContent = $('#dialogContent');
const closeDialogBtn = $('#closeDialogBtn');
const exportBtn = $('#exportBtn');
const importInput = $('#importInput');
const installBtn = $('#installBtn');

// online sync UI
const shareIdInput = $('#shareIdInput');
const loadOnlineBtn = $('#loadOnlineBtn');
const saveOnlineBtn = $('#saveOnlineBtn');
const shareLinkEl = $('#shareLink');

// API base
const API_BASE = '/api/trips/';

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn?.classList.remove('hidden');
});
installBtn?.addEventListener('click', async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn?.classList.add('hidden');
});

// add trip
addTripBtn.addEventListener('click', () => {
  const name = tripName.value.trim();
  const date = tripDate.value;
  if(!name || !date) return alert('여행 이름과 출발일을 입력하세요.');
  const items = (templates[templateSelect.value]||[]).map(t=>({id:uid(), text:t, done:false}));
  state.trips.push({ id: uid(), name, date, items });
  persistAndRender();
  tripName.value = '';
  tripDate.value = '';
});

// export/import
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.trips, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'travel-data.json';
  a.click();
});
importInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    if(!Array.isArray(data)) throw new Error('형식 오류');
    state.trips = data; persistAndRender();
    alert('복원 완료!');
  } catch(err){
    alert('복원 실패: ' + err.message);
  } finally { e.target.value = ''; }
});

// online sync
loadOnlineBtn?.addEventListener('click', async () => {
  const id = shareIdInput.value.trim();
  if(!id) return alert('공유코드를 입력하세요.');
  try{
    const data = await loadOnline(id);
    if(!Array.isArray(data)) throw new Error('데이터 형식 오류');
    state.trips = data; persistAndRender();
    setShareId(id);
    alert('온라인에서 불러왔습니다.');
  }catch(err){
    alert('불러오기 실패: ' + (err.message || '네트워크 오류'));
  }
});

saveOnlineBtn?.addEventListener('click', async () => {
  let id = shareIdInput.value.trim();
  if(!id) id = genId();
  try{
    await saveOnline(id, state.trips);
    setShareId(id);
    alert('온라인에 저장되었습니다.');
  }catch(err){
    alert('저장 실패: ' + (err.message || '네트워크 오류'));
  }
});

async function saveOnline(id, data){
  const res = await fetch(API_BASE + encodeURIComponent(id), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
  if(!res.ok) throw new Error('서버 응답: ' + res.status);
}

async function loadOnline(id){
  const res = await fetch(API_BASE + encodeURIComponent(id));
  if(!res.ok) throw new Error(res.status === 404 ? '데이터가 없습니다.' : ('서버 응답: ' + res.status));
  return res.json();
}

function setShareId(id){
  shareIdInput.value = id;
  const url = new URL(location.href);
  url.searchParams.set('share', id);
  history.replaceState(null, '', url);
  if(shareLinkEl){
    shareLinkEl.textContent = url.toString();
  }
}

// auto-load if ?share=...
(function initShareFromURL(){
  const params = new URLSearchParams(location.search);
  const id = params.get('share');
  if(id){
    shareIdInput && (shareIdInput.value = id);
    setShareId(id);
    // 자동 불러오기 (조용히 시도)
    loadOnline(id).then(data=>{
      if(Array.isArray(data)){ state.trips = data; persistAndRender(); }
    }).catch(()=>{ /* 무시 */ });
  }else if(shareLinkEl){
    shareLinkEl.textContent = '';
  }
})();

// render & helpers
function persistAndRender(){
  save('trips', state.trips);
  render();
}

function render(){
  state.trips.sort((a,b)=> new Date(a.date) - new Date(b.date));
  tripList.innerHTML = '';
  state.trips.forEach(trip => {
    const d = daysLeft(trip.date);
    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(trip.name)}</h3>
          <p class="text-sm text-slate-500">출발일: ${trip.date}</p>
        </div>
        <span class="chip ${d<0?'bg-rose-100 text-rose-700':''}">${d===0?'D-DAY': d>0?`D-${d}`:`+${Math.abs(d)}`}</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-secondary" data-open>체크리스트</button>
        <button class="btn-secondary" data-dup>복제</button>
        <button class="btn-secondary" data-edit>이름/날짜</button>
        <button class="btn-secondary" data-del>삭제</button>
      </div>
    `;
    li.querySelector('[data-open]').addEventListener('click', () => openTrip(trip.id));
    li.querySelector('[data-dup]').addEventListener('click', () => duplicateTrip(trip.id));
    li.querySelector('[data-edit]').addEventListener('click', () => editTrip(trip.id));
    li.querySelector('[data-del]').addEventListener('click', () => deleteTrip(trip.id));
    tripList.appendChild(li);
  });
}

function openTrip(id){
  const trip = state.trips.find(t=>t.id===id); if(!trip) return;
  dialogTitle.textContent = `${trip.name} — 체크리스트`;
  dialogContent.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'flex flex-wrap items-center gap-2 justify-between';
  top.innerHTML = `
    <div class="text-sm text-slate-500">출발일: ${trip.date} · ${daysLeft(trip.date)===0?'D-DAY':daysLeft(trip.date)>0?`D-${daysLeft(trip.date)}`:`+${Math.abs(daysLeft(trip.date))}`}</div>
    <div class="flex items-center gap-2">
      <input class="input" id="newItemInput" placeholder="아이템 추가 (엔터)" />
      <button class="btn-secondary" id="clearDoneBtn">완료 삭제</button>
    </div>`;
  dialogContent.appendChild(top);

  const list = document.createElement('ul');
  list.className = 'divide-y';
  trip.items.forEach(item => list.appendChild(renderItem(trip, item)));
  dialogContent.appendChild(list);

  const stats = document.createElement('div');
  stats.className = 'text-xs text-slate-500 pt-2';
  stats.id = 'stats';
  dialogContent.appendChild(stats);
  updateStats(trip, stats);

  // handlers
  top.querySelector('#newItemInput').addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      const text = e.target.value.trim();
      if(text){ trip.items.push({id:uid(), text, done:false}); persistAndRenderDialog(trip, list, stats); e.target.value=''; }
    }
  });
  top.querySelector('#clearDoneBtn').addEventListener('click', ()=>{
    trip.items = trip.items.filter(i=>!i.done); persistAndRenderDialog(trip, list, stats);
  });

  function persistAndRenderDialog(trip, list, stats){
    save('trips', state.trips);
    list.innerHTML='';
    trip.items.forEach(item => list.appendChild(renderItem(trip, item)));
    updateStats(trip, stats);
  }

  dialog.showModal();
  closeDialogBtn.onclick = () => dialog.close();
  dialog.addEventListener('click', (e)=>{ if(e.target===dialog) dialog.close(); });
}

function renderItem(trip, item){
  const li = document.createElement('li');
  li.className = 'py-2 flex items-center gap-2';
  li.innerHTML = `
    <input type="checkbox" ${item.done?'checked':''} class="h-5 w-5" />
    <span class="grow ${item.done?'line-through text-slate-400':''}">${escapeHtml(item.text)}</span>
    <button class="btn-icon" title="삭제">🗑️</button>
  `;
  const [chk, , delBtn] = li.children;
  chk.addEventListener('change', ()=>{ item.done = chk.checked; save('trips', state.trips); });
  delBtn.addEventListener('click', ()=>{
    trip.items = trip.items.filter(i=>i.id!==item.id); save('trips', state.trips); li.remove();
  });
  return li;
}

function updateStats(trip, el){
  const done = trip.items.filter(i=>i.done).length;
  el.textContent = `완료 ${done} / 전체 ${trip.items.length}`;
}

function duplicateTrip(id){
  const t = state.trips.find(x=>x.id===id); if(!t) return;
  const copy = JSON.parse(JSON.stringify(t));
  copy.id = uid();
  copy.name = t.name + ' (복사본)';
  copy.items.forEach(i=> i.id = uid());
  state.trips.push(copy); persistAndRender();
}

function editTrip(id){
  const t = state.trips.find(x=>x.id===id); if(!t) return;
  const name = prompt('여행 이름', t.name) ?? t.name;
  const date = prompt('출발일 (YYYY-MM-DD)', t.date) ?? t.date;
  if(name && date){ t.name = name; t.date = date; persistAndRender(); }
}

function deleteTrip(id){
  if(!confirm('삭제하시겠어요?')) return;
  state.trips = state.trips.filter(t=>t.id!==id); persistAndRender();
}

function escapeHtml(s){ return s.replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// first render
render();
