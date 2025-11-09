console.log('[app] loaded');

const $  = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

const state = {
  trips: load('trips', []), // [{id, name, date, items:[{id,text,done}]}]
};

const templates = {
  basic: ['여권','지갑/신용카드','현지 화폐','충전기','보조배터리','마스크','물티슈','속옷/양말','상의/하의','세면도구','우산/우비'],
  europe: ['여권','국제운전면허증','현지 화폐','플러그 어댑터(Type C/E/F)','보온 자켓','목도리/장갑','로션/립밤','비상약(감기/소화)','트래블카드','현지 유심/eSIM','휴대용 손세정제'],
  beach: ['여권','현지 화폐','수영복','선크림','선글라스','비치타월','모자','방수팩','슬리퍼','얇은 겉옷','모기기피제'],
  business: ['여권','현지 화폐','노트북/충전기','프레젠테이션 파일','명함','정장/구두','면도도구','가벼운 간식','멀티탭','여분 케이블']
};

// ---------- utils ----------
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const uid = () => Math.random().toString(36).slice(2,9);
const daysLeft = (dateStr) => {
  const one = new Date(new Date(dateStr).toDateString());
  const now = new Date(new Date().toDateString());
  return Math.round((one - now) / (1000*60*60*24));
};
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- elements ----------
const tripName   = $('#tripName');
const tripDate   = $('#tripDate');
const templateSelect = $('#templateSelect');
const addTripBtn = $('#addTripBtn');
const formHelp   = $('#formHelp');

const tripList   = $('#tripList');
const dialog     = $('#tripDialog');
const dialogTitle   = $('#dialogTitle');
const dialogContent = $('#dialogContent');
const closeDialogBtn = $('#closeDialogBtn');

const exportBtn  = $('#exportBtn');
const importInput= $('#importInput');
const installBtn = $('#installBtn');

if(!addTripBtn || !tripList){
  console.error('[app] essential elements not found. Check IDs and script path.');
}

// ---------- PWA install ----------
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

// ---------- Add Trip (버튼/Enter) ----------
function tryAddTrip(){
  const name = (tripName?.value || '').trim();
  const date = tripDate?.value || '';
  if(!name || !date){
    formHelp?.classList.remove('hidden');
    return;
  }
  formHelp?.classList.add('hidden');

  const items = (templates[templateSelect?.value] || []).map(t=>({id:uid(), text:t, done:false}));
  state.trips.push({ id: uid(), name, date, items });
  persistAndRender();

  if(tripName) tripName.value = '';
  if(tripDate) tripDate.value = '';
}
addTripBtn?.addEventListener('click', tryAddTrip);
tripName?.addEventListener('keydown', e => { if(e.key==='Enter') tryAddTrip(); });
tripDate?.addEventListener('keydown', e => { if(e.key==='Enter') tryAddTrip(); });

// ---------- Backup / Restore ----------
exportBtn?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.trips, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'travel-data.json';
  a.click();
});

// 복원: 다양한 JSON 형태 지원 + 정규화
importInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const trips = normalizeTripsFromJSON(text);

    if (!Array.isArray(trips) || trips.length === 0) {
      throw new Error('복원할 여행 데이터가 없습니다.');
    }
    state.trips = trips;
    persistAndRender();
    alert(`복원 완료! 총 ${trips.length}개의 여행이 로드되었습니다.`);
  } catch (err) {
    console.error('[import] failed:', err);
    alert('복원 실패: ' + (err.message || '파일 형식 오류'));
  } finally {
    e.target.value = '';
  }
});

function normalizeTripsFromJSON(text) {
  let data;
  try {
    const clean = text.replace(/^\uFEFF/, ''); // BOM 제거
    data = JSON.parse(clean);
  } catch {
    throw new Error('JSON 파싱 실패');
  }
  if (Array.isArray(data)) return data.map(normalizeTripObject);
  if (data && Array.isArray(data.trips)) return data.trips.map(normalizeTripObject);
  if (data && typeof data === 'object' && data.name && Array.isArray(data.items)) {
    return [normalizeTripObject(data)];
  }
  throw new Error('지원하지 않는 JSON 형식입니다.');
}

function normalizeTripObject(t) {
  const id = t.id || uid();
  const name = String(t.name ?? '').trim();
  const date = String(t.date ?? '').trim();
  if (!name || !date) throw new Error('여행 이름/출발일이 없습니다.');

  const items = Array.isArray(t.items) ? t.items : [];
  const normItems = items.map((it) => {
    const text = String(it?.text ?? '').trim();
    const done = !!it?.done;
    const id = it?.id || uid();
    return { id, text, done };
  }).filter(it => it.text);

  return { id, name, date, items: normItems };
}

// ---------- Core render ----------
function persistAndRender(){
  save('trips', state.trips);
  render();
}

// 카드 목록 + 진행도바
function render(){
  state.trips.sort((a,b)=> new Date(a.date) - new Date(b.date));
  tripList.innerHTML = '';
  state.trips.forEach(trip => {
    const d = daysLeft(trip.date);
    const done = trip.items.filter(i=>i.done).length;
    const total = trip.items.length || 1;
    const pct = Math.round((done / total) * 100);

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

      <div class="space-y-1">
        <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div class="h-2 bg-sky-500 rounded-full" style="width:${pct}%"></div>
        </div>
        <div class="text-xs text-slate-500">진행도: ${done} / ${total} (${pct}%)</div>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-secondary" data-open>체크리스트</button>
        <button class="btn-secondary" data-dup>복제</button>
        <button class="btn-secondary" data-edit>이름/날짜</button>
        <button class="btn-secondary" data-del>삭제</button>
      </div>
    `;
    li.querySelector('[data-open]')?.addEventListener('click', () => openTrip(trip.id));
    li.querySelector('[data-dup]')?.addEventListener('click', () => duplicateTrip(trip.id));
    li.querySelector('[data-edit]')?.addEventListener('click', () => editTrip(trip.id));
    li.querySelector('[data-del]')?.addEventListener('click', () => deleteTrip(trip.id));
    tripList.appendChild(li);
  });
}

// 상세 다이얼로그 (드래그 정렬, CSV, 진행도바, 닫힘 방지)
function openTrip(id){
  const trip = state.trips.find(t=>t.id===id); if(!trip) return;
  dialogTitle.textContent = `${trip.name} — 체크리스트`;
  dialogContent.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'flex flex-wrap items-center gap-2 justify-between';
  top.innerHTML = `
    <div class="text-sm text-slate-500">
      출발일: ${trip.date} · ${daysLeft(trip.date)===0?'D-DAY':daysLeft(trip.date)>0?`D-${daysLeft(trip.date)}`:`+${Math.abs(daysLeft(trip.date))}`}
    </div>
    <div class="flex items-center gap-2">
      <input class="input" id="newItemInput" placeholder="아이템 추가 (예: 칫솔)" />
      <button class="btn-secondary" id="addItemBtn">추가</button>
      <button class="btn-secondary" id="clearDoneBtn">완료 삭제</button>
      <button class="btn-secondary" id="exportCsvBtn">CSV 내보내기</button>
    </div>`;
  dialogContent.appendChild(top);

  // 진행도바(상세)
  const progressWrap = document.createElement('div');
  progressWrap.className = 'space-y-1';
  progressWrap.innerHTML = `
    <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div id="progressBar" class="h-2 bg-sky-500 rounded-full" style="width:0%"></div>
    </div>
    <div id="progressText" class="text-xs text-slate-500">진행도: 0 / 0 (0%)</div>
  `;
  dialogContent.appendChild(progressWrap);

  // 리스트
  const list = document.createElement('ul');
  list.className = 'divide-y';
  trip.items.forEach(item => list.appendChild(renderItem(trip, item)));
  dialogContent.appendChild(list);

  // 통계
  const stats = document.createElement('div');
  stats.className = 'text-xs text-slate-500 pt-2';
  stats.id = 'stats';
  dialogContent.appendChild(stats);
  updateStats(trip, stats, progressWrap);

  // 입력핸들러(닫힘 방지)
  const newItemInput = top.querySelector('#newItemInput');
  const addItemBtn = top.querySelector('#addItemBtn');
  const addItem = (e) => {
    if (e) e.preventDefault();
    const text = newItemInput.value.trim();
    if(!text) return;
    trip.items.push({ id: uid(), text, done: false });
    persistDialog();
    newItemInput.value = '';
  };
  newItemInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addItem(); }});
  addItemBtn.addEventListener('click', addItem);

  // 완료 항목 일괄 삭제
  top.querySelector('#clearDoneBtn').addEventListener('click', ()=>{
    trip.items = trip.items.filter(i=>!i.done);
    persistDialog();
  });

  // CSV 내보내기(현재 여행만)
  top.querySelector('#exportCsvBtn').addEventListener('click', ()=>{
    const csv = toCSV(trip);
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.name.replace(/\s+/g,'_')}.csv`;
    a.click();
  });

  // 드래그 정렬
  list.addEventListener('dragover', (e)=> e.preventDefault());

  function renderItem(trip, item){
    const li = document.createElement('li');
    li.className = 'py-2 px-1 flex items-center gap-2';
    li.draggable = true;
    li.dataset.id = item.id;
    li.innerHTML = `
      <span class="cursor-grab select-none" title="끌어서 순서 변경">↕</span>
      <input type="checkbox" ${item.done?'checked':''} class="h-5 w-5" />
      <span class="grow ${item.done?'line-through text-slate-400':''}">${escapeHtml(item.text)}</span>
      <button class="btn-icon" title="삭제">🗑️</button>
    `;
    const [dragHandle, chk, , delBtn] = li.children;

    chk.addEventListener('change', ()=>{
      item.done = chk.checked;
      persistDialog(true);
    });

    delBtn.addEventListener('click', ()=>{
      trip.items = trip.items.filter(i=>i.id!==item.id);
      persistDialog();
    });

    li.addEventListener('dragstart', (e)=>{
      e.dataTransfer.setData('text/plain', item.id);
      li.classList.add('opacity-50');
    });
    li.addEventListener('dragend', ()=> li.classList.remove('opacity-50'));
    li.addEventListener('dragover', (e)=>{
      e.preventDefault();
      li.classList.add('bg-slate-50');
    });
    li.addEventListener('dragleave', ()=> li.classList.remove('bg-slate-50'));
    li.addEventListener('drop', (e)=>{
      e.preventDefault();
      li.classList.remove('bg-slate-50');
      const fromId = e.dataTransfer.getData('text/plain');
      if(!fromId || fromId===item.id) return;
      const fromIdx = trip.items.findIndex(i=>i.id===fromId);
      const toIdx   = trip.items.findIndex(i=>i.id===item.id);
      if(fromIdx<0 || toIdx<0) return;
      const [moved] = trip.items.splice(fromIdx,1);
      trip.items.splice(toIdx,0,moved);
      persistDialog();
    });

    return li;
  }

  function persistDialog(keepFocus){
    save('trips', state.trips);
    // 상세 리렌더 + 진행도 갱신
    list.innerHTML = '';
    trip.items.forEach(item => list.appendChild(renderItem(trip, item)));
    updateStats(trip, stats, progressWrap);
    // 카드 진행도 갱신
    render();
    if(keepFocus) newItemInput.focus();
  }

  dialog.showModal();
  closeDialogBtn.onclick = () => dialog.close();
  dialog.addEventListener('click', (e)=>{ if(e.target===dialog) dialog.close(); });
}

// 진행도/통계 갱신
function updateStats(trip, el, progressWrap){
  const done = trip.items.filter(i=>i.done).length;
  const total = trip.items.length || 1;
  const pct = Math.round((done/total)*100);
  el.textContent = `완료 ${done} / 전체 ${total}`;
  if(progressWrap){
    const bar = $('#progressBar', progressWrap);
    const txt = $('#progressText', progressWrap);
    if(bar) bar.style.width = `${pct}%`;
    if(txt) txt.textContent = `진행도: ${done} / ${total} (${pct}%)`;
  }
}

// 기타 도우미
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
function toCSV(trip){
  const header = ['text','done'];
  const rows = trip.items.map(i => [
    `"${String(i.text).replace(/"/g,'""')}"`,
    i.done ? 'TRUE' : 'FALSE'
  ]);
  return '\uFEFF' + [header.join(','), ...rows.map(r=>r.join(','))].join('\r\n');
}

// 첫 렌더
render();
