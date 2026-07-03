const CITIES = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار",
  "البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر العاصمة",
  "الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة",
  "قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض",
  "إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان",
  "تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت",
  "المغير","المنيعة","آفلو","بريكة","القنطرة","بئر العاتر","العريشة","قصر الشلالة",
  "عين وسارة","مسعد","قصر البخاري","بوسعادة","الأبيض سيدي الشيخ"
];

let currentCity = "الجزائر العاصمة";
let timings = null;
let nextPrayerTime = null;
let countdownInterval = null; // will hold requestAnimationFrame id

const PRAYER_LABELS = {
  Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر",
  Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء"
};
const ORDER = ["Fajr","Sunrise","Dhuhr","Asr","Maghrib","Isha"];

function initStars(){
  const box = document.getElementById('stars');
  for(let i=0;i<22;i++){
    const s = document.createElement('div');
    s.className='star';
    s.style.left = Math.random()*100+'%';
    s.style.top = Math.random()*55+'%';
    s.style.animationDelay = (Math.random()*3)+'s';
    box.appendChild(s);
  }
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1600);
}

function toMinutes(hhmm){
  const [h,m] = hhmm.split(':').map(Number);
  return h*60+m;
}

async function fetchTimings(city){
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  try{
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const url = `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=Algeria&method=3`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.code !== 200) throw new Error('bad response');
    timings = data.data.timings;
    updateDates(data.data.date);
    renderTimes();
    updateCurrentPrayer();
  }catch(e){
    showToast("تعذر جلب المواقيت، حاول من جديد");
  }finally{
    overlay.classList.remove('show');
  }
}

function updateDates(dateObj){
  const h = dateObj.hijri;
  const g = dateObj.gregorian;
  document.getElementById('hijriDate').textContent = `${h.day} ${h.month.ar} ${h.year} هـ`;
  document.getElementById('gregDate').textContent = `${g.day} ${g.month.en} ${g.year}`;
}

function renderTimes(){
  const row = document.getElementById('timesRow');
  row.innerHTML = '';
  ORDER.forEach(key=>{
    const raw = timings[key];
    const clean = raw.split(' ')[0];
    const pill = document.createElement('div');
    pill.className = 'time-pill';
    pill.id = 'pill-'+key;
    pill.innerHTML = `<div class="pname">${PRAYER_LABELS[key]}</div><div class="ptime">${to12h(clean)}</div>`;
    row.appendChild(pill);
  });
}

function to12h(hhmm){
  let [h,m] = hhmm.split(':').map(Number);
  const ampm = h>=12 ? 'م' : 'ص';
  h = h%12; if(h===0) h=12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function updateCurrentPrayer(){
  if(!timings) return;
  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();

  const list = ORDER.filter(k=>k!=='Sunrise').map(k=>({key:k, min:toMinutes(timings[k].split(' ')[0])}));
  let currentIdx = -1;
  for(let i=0;i<list.length;i++){
    if(nowMin >= list[i].min) currentIdx = i;
  }
  let currentKey, nextKey, nextMin;
  if(currentIdx === -1){
    currentKey = list[list.length-1].key;
    nextKey = list[0];
    nextMin = list[0].min + 24*60;
  } else if(currentIdx === list.length-1){
    currentKey = list[currentIdx].key;
    nextKey = list[0];
    nextMin = list[0].min + 24*60;
  } else {
    currentKey = list[currentIdx].key;
    nextKey = list[currentIdx+1];
    nextMin = list[currentIdx+1].min;
  }

  document.getElementById('currentPrayerName').textContent = PRAYER_LABELS[currentKey];
  document.getElementById('currentPrayerSub').textContent = `بدأت الساعة ${to12h(timings[currentKey].split(' ')[0])}`;

  document.querySelectorAll('.time-pill').forEach(p=>p.classList.remove('active'));
  const activePill = document.getElementById('pill-'+currentKey);
  if(activePill) activePill.classList.add('active');

  startCountdown(nowMin, nextMin, nextKey.key || nextKey);
}

function startCountdown(nowMin, nextMin, nextKeyName){
  // cancel previous animation frame if any
  if(countdownInterval) cancelAnimationFrame(countdownInterval);
  const totalWindow = 24*60;
  let lastTimestamp = 0;

  function tick(timestamp){
    if(!lastTimestamp) lastTimestamp = timestamp;
    const now = new Date();
    const curMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
    let remain = nextMin - curMin;
    if(remain < 0) remain += 24*60;
    const h = Math.floor(remain/60);
    const m = Math.floor(remain%60);
    document.getElementById('countdownText').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

    const circumference = 326.7;
    const frac = Math.max(0, Math.min(1, 1 - remain/ (totalWindow/6) ));
    document.getElementById('ringFg').style.strokeDashoffset = circumference * (1-frac);

    if(remain <= 0){
      updateCurrentPrayer();
      return;
    }
    countdownInterval = requestAnimationFrame(tick);
  }
  countdownInterval = requestAnimationFrame(tick);
}

function renderCityList(filter=''){
  const listEl = document.getElementById('cityList');
  listEl.innerHTML = '';
  CITIES.filter(c=>c.includes(filter)).forEach(c=>{
    const row = document.createElement('div');
    row.className = 'city-row' + (c===currentCity ? ' sel':'');
    row.innerHTML = `<span>${c}</span>` + (c===currentCity ? '<span>✓</span>' : '');
    row.onclick = ()=>{
      currentCity = c;
      document.getElementById('cityLabel').textContent = c;
      const scl = document.getElementById('settingsCityLabel');
      if(scl) scl.textContent = c;
      document.getElementById('modalOverlay').classList.remove('open');
      try{ localStorage.setItem('prayerapp_city', c); }catch(e){}
      fetchTimings(c);
    };
    listEl.appendChild(row);
  });
}

document.getElementById('cityBtn').onclick = ()=>{
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('citySearch').value='';
  renderCityList();
};
document.getElementById('modalOverlay').onclick = (e)=>{
  if(e.target.id === 'modalOverlay') e.currentTarget.classList.remove('open');
};
document.getElementById('citySearch').oninput = (e)=>renderCityList(e.target.value);

try{
  const savedCity = localStorage.getItem('prayerapp_city');
  if(savedCity) currentCity = savedCity;
}catch(e){}

document.getElementById('cityLabel').textContent = currentCity;
const settingsCityInit = document.getElementById('settingsCityLabel');
if(settingsCityInit) settingsCityInit.textContent = currentCity;
initStars();
fetchTimings(currentCity);

/* ============ navigation ============ */
const PAGES = ['home','quran','hadith','dua','adhkar','qibla','settings'];
function navigateTo(page){
  PAGES.forEach(p=>{
    const el = document.getElementById(p+'View');
    if(el) el.classList.toggle('hidden', p!==page);
  });
  if(page==='quran' && !quranLoaded) loadSurahList();
  if(page==='adhkar' && !dhikrRendered) renderAdhkar();
  if(page==='hadith') renderHadith();
  if(page==='dua' && !duaRendered) renderDua();
}

/* ============ quran ============ */
let quranLoaded = false;
let surahListCache = null;

async function loadSurahList(){
  const body = document.getElementById('quranBody');
  try{
    const res = await fetch('https://api.alquran.cloud/v1/surah');
    const data = await res.json();
    surahListCache = data.data;
    quranLoaded = true;
    renderSurahList();
  }catch(e){
    body.innerHTML = '<div style="text-align:center; color:var(--muted); font-size:13px; padding:30px 0;">تعذر تحميل قائمة السور، تأكد من الاتصال بالإنترنت.</div>';
  }
}

function renderSurahList(){
  const body = document.getElementById('quranBody');
  document.getElementById('quranTitle').textContent = 'القرآن الكريم';
  body.innerHTML = '';
  surahListCache.forEach(s=>{
    const row = document.createElement('div');
    row.className = 'surah-row';
    row.innerHTML = `
      <div class="surah-num">${s.number}</div>
      <div class="surah-info">
        <div class="surah-ar">${s.name}</div>
        <div class="surah-meta">${s.englishName} · ${s.numberOfAyahs} آية · ${s.revelationType==='Meccan'?'مكية':'مدنية'}</div>
      </div>
    `;
    row.onclick = ()=>loadSurah(s.number, s.name);
    body.appendChild(row);
  });
}

async function loadSurah(number, name){
  const body = document.getElementById('quranBody');
  document.getElementById('quranTitle').textContent = name;
  body.innerHTML = '<div style="text-align:center; color:var(--muted); font-size:13px; padding:30px 0;">جارِ التحميل...</div>';
  try{
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
    const data = await res.json();
    const ayahs = data.data.ayahs;
    let html = `<div class="surah-header-name">${name}</div><div class="ayah">`;
    ayahs.forEach(a=>{
      html += `${a.text}<span class="ayah-num">${a.numberInSurah}</span> `;
    });
    html += '</div>';
    body.innerHTML = html;
    body.scrollTop = 0;
  }catch(e){
    body.innerHTML = '<div style="text-align:center; color:var(--muted); font-size:13px; padding:30px 0;">تعذر تحميل السورة.</div>';
  }
}

function quranBack(){
  if(surahListCache && document.getElementById('quranTitle').textContent !== 'القرآن الكريم'){
    renderSurahList();
  } else {
    navigateTo('home');
  }
}

/* ============ adhkar & tasbih ============ */
let dhikrRendered = false;
const ADHKAR = {
  morning: { label:'أذكار الصباح', items:[
    'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',
    'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور',
    'اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت'
  ]},
  evening: { label:'أذكار المساء', items:[
    'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',
    'اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير',
    'اللهم إني أمسيت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت'
  ]},
  afterPrayer: { label:'بعد الصلاة', items:[
    'أستغفر الله، أستغفر الله، أستغفر الله',
    'اللهم أنت السلام ومنك السلام، تباركت يا ذا الجلال والإكرام',
    'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير'
  ]}
};
let currentDhikrTab = 'morning';

function renderAdhkar(){
  dhikrRendered = true;
  const tabs = document.getElementById('dhikrTabs');
  tabs.innerHTML = '';
  Object.keys(ADHKAR).forEach(key=>{
    const tab = document.createElement('div');
    tab.className = 'dhikr-tab' + (key===currentDhikrTab ? ' active':'');
    tab.textContent = ADHKAR[key].label;
    tab.onclick = ()=>{ currentDhikrTab = key; renderDhikrList(); tabs.querySelectorAll('.dhikr-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); };
    tabs.appendChild(tab);
  });
  renderDhikrList();
  renderTasbihTargets();
}

function renderDhikrList(){
  const list = document.getElementById('dhikrList');
  list.innerHTML = '';
  ADHKAR[currentDhikrTab].items.forEach(text=>{
    const card = document.createElement('div');
    card.className = 'dhikr-card';
    card.innerHTML = `<div class="dhikr-text">${text}</div>`;
    list.appendChild(card);
  });
}

let tasbihCount = 0;
let tasbihTarget = 33;
function tasbihTap(){
  tasbihCount++;
  document.getElementById('tasbihCount').textContent = tasbihCount;
  if(tasbihCount === tasbihTarget){
    showToast('بلغت العدد المستهدف: ' + tasbihTarget);
    if(navigator.vibrate) navigator.vibrate(40);
  }
}
function tasbihReset(){
  tasbihCount = 0;
  document.getElementById('tasbihCount').textContent = '0';
}
function renderTasbihTargets(){
  const box = document.getElementById('tasbihTargets');
  box.innerHTML = '';
  [33,99,100].forEach(n=>{
    const b = document.createElement('div');
    b.className = 'tasbih-target' + (n===tasbihTarget ? ' active':'');
    b.textContent = n;
    b.onclick = ()=>{
      tasbihTarget = n;
      box.querySelectorAll('.tasbih-target').forEach(t=>t.classList.remove('active'));
      b.classList.add('active');
    };
    box.appendChild(b);
  });
}

/* ============ qibla ============ */
const KAABA = { lat: 21.4225, lon: 39.8262 };
let qiblaBearing = null;
let deviceHeadingSupported = false;

function toRad(d){ return d*Math.PI/180; }
function toDeg(r){ return r*180/Math.PI; }

function computeQibla(lat, lon){
  const phiK = toRad(KAABA.lat), lambdaK = toRad(KAABA.lon);
  const phi = toRad(lat), lambda = toRad(lon);
  const dLambda = lambdaK - lambda;
  const y = Math.sin(dLambda);
  const x = Math.cos(phi)*Math.tan(phiK) - Math.sin(phi)*Math.cos(dLambda);
  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  return bearing;
}

function startQibla(){
  const btn = document.getElementById('qiblaBtn');
  const sub = document.getElementById('qiblaSub');
  if(!navigator.geolocation){
    sub.textContent = 'المتصفح لا يدعم تحديد الموقع';
    return;
  }
  sub.textContent = 'جارِ تحديد موقعك...';
  navigator.geolocation.getCurrentPosition(pos=>{
    qiblaBearing = computeQibla(pos.coords.latitude, pos.coords.longitude);
    document.getElementById('qiblaDeg').textContent = Math.round(qiblaBearing) + '°';
    sub.textContent = 'اتجاه القبلة من الشمال، وجّه هاتفك';
    btn.textContent = 'إعادة التفعيل';
    enableCompass();
  }, err=>{
    sub.textContent = 'تعذر الوصول لموقعك، فعّل خدمة الموقع';
  }, { enableHighAccuracy:true });
}

function enableCompass(){
  if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
    DeviceOrientationEvent.requestPermission().then(state=>{
      if(state === 'granted'){
        window.addEventListener('deviceorientation', onOrientation);
      } else {
        applyStaticNeedle();
      }
    }).catch(()=>applyStaticNeedle());
  } else if('ondeviceorientationabsolute' in window){
    window.addEventListener('deviceorientationabsolute', onOrientation);
  } else if('ondeviceorientation' in window){
    window.addEventListener('deviceorientation', onOrientation);
  } else {
    applyStaticNeedle();
  }
}

function onOrientation(e){
  let heading;
  if(typeof e.webkitCompassHeading === 'number'){
    heading = e.webkitCompassHeading;
  } else if(e.alpha !== null){
    heading = 360 - e.alpha;
  } else {
    return;
  }
  deviceHeadingSupported = true;
  const rotation = qiblaBearing - heading;
  document.getElementById('qiblaNeedle').style.transform = `rotate(${rotation}deg)`;
  document.getElementById('compassDial').style.transform = `rotate(${-heading}deg)`;
}

function applyStaticNeedle(){
  document.getElementById('qiblaNeedle').style.transform = `rotate(${qiblaBearing}deg)`;
  document.getElementById('qiblaSub').textContent = 'اتجاه القبلة من الشمال (بوصلة الجهاز غير متاحة)';
}

/* ============ settings ============ */
let darkOn = false;
function toggleDark(){
  darkOn = !darkOn;
  document.getElementById('darkSwitch').classList.toggle('on', darkOn);
  document.getElementById('phone').setAttribute('data-theme', darkOn ? 'dark' : 'light');
  try{ localStorage.setItem('prayerapp_dark', darkOn ? '1' : '0'); }catch(e){}
}

let notifOn = false;
function toggleNotif(){
  if(!notifOn){
    if(!('Notification' in window)){
      showToast('المتصفح لا يدعم الإشعارات');
      return;
    }
    Notification.requestPermission().then(perm=>{
      if(perm === 'granted'){
        notifOn = true;
        document.getElementById('notifSwitch').classList.add('on');
        scheduleNotifications();
        showToast('تفعّلت تنبيهات الصلاة');
        try{ localStorage.setItem('prayerapp_notif', '1'); }catch(e){}
      } else {
        showToast('تم رفض إذن الإشعارات');
      }
    });
  } else {
    notifOn = false;
    document.getElementById('notifSwitch').classList.remove('on');
    if(notifTimers) notifTimers.forEach(t=>clearTimeout(t));
    notifTimers = [];
    try{ localStorage.setItem('prayerapp_notif', '0'); }catch(e){}
  }
}

let notifTimers = [];
function scheduleNotifications(){
  if(!timings) return;
  notifTimers.forEach(t=>clearTimeout(t));
  notifTimers = [];
  const now = new Date();
  ORDER.filter(k=>k!=='Sunrise').forEach(key=>{
    const [h,m] = timings[key].split(' ')[0].split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    let delay = target - now;
    if(delay < 0) return;
    const timer = setTimeout(()=>{
      new Notification('حان وقت ' + PRAYER_LABELS[key], { body: 'حي على الصلاة' });
    }, delay);
    notifTimers.push(timer);
  });
}

/* restore persisted dark mode + notif (runs after all declarations above have executed) */
try{
  if(localStorage.getItem('prayerapp_dark') === '1'){
    darkOn = true;
    const phoneEl = document.getElementById('phone');
    if(phoneEl) phoneEl.setAttribute('data-theme','dark');
    const ds = document.getElementById('darkSwitch');
    if(ds) ds.classList.add('on');
  }
}catch(e){}

try{
  if(localStorage.getItem('prayerapp_notif') === '1' && Notification.permission === 'granted'){
    notifOn = true;
    const ns = document.getElementById('notifSwitch');
    if(ns) ns.classList.add('on');
  }
}catch(e){}

/* ============ hadith (الأربعون النووية) ============ */
const HADITH = [
  {
    title: "الحديث الأول",
    text: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله، ومن كانت هجرته لدنيا يصيبها أو امرأة ينكحها فهجرته إلى ما هاجر إليه.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث الثاني",
    text: "بينما نحن جلوس عند رسول الله ﷺ ذات يوم، إذ طلع علينا رجل شديد بياض الثياب، شديد سواد الشعر، لا يُرى عليه أثر السفر، ولا يعرفه منا أحد، حتى جلس إلى النبي ﷺ فأسنَد ركبتيه إلى ركبتيه، ووضع كفيه على فخذيه، وقال: يا محمد أخبرني عن الإسلام. فسأله عن الإسلام والإيمان والإحسان، ثم قال: أخبرني عن الساعة؟ قال: ما المسؤول عنها بأعلم من السائل. ثم انطلق، فقال النبي ﷺ: هذا جبريل أتاكم يعلمكم دينكم.",
    rawi: "رواه مسلم"
  },
  {
    title: "الحديث الثالث",
    text: "بُني الإسلام على خمس: شهادة أن لا إله إلا الله وأن محمداً رسول الله، وإقام الصلاة، وإيتاء الزكاة، وحج البيت، وصوم رمضان.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث الرابع",
    text: "إن أحدكم يُجمع خلقه في بطن أمه أربعين يوماً نطفة، ثم يكون علقة مثل ذلك، ثم يكون مضغة مثل ذلك، ثم يُرسل إليه الملَك فينفخ فيه الروح، ويُؤمر بأربع كلمات: بكتب رزقه وأجله وعمله وشقي أو سعيد.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث الخامس",
    text: "من أحدث في أمرنا هذا ما ليس منه فهو رد.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث السادس",
    text: "إن الحلال بيّن، وإن الحرام بيّن، وبينهما أمور مشتبهات لا يعلمهن كثير من الناس، فمن اتقى الشبهات استبرأ لدينه وعرضه، ومن وقع في الشبهات وقع في الحرام.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث السابع",
    text: "الدين النصيحة. قلنا: لمن؟ قال: لله، ولكتابه، ولرسوله، ولأئمة المسلمين وعامتهم.",
    rawi: "رواه مسلم"
  },
  {
    title: "الحديث الثامن",
    text: "أُمرت أن أقاتل الناس حتى يشهدوا أن لا إله إلا الله وأن محمداً رسول الله، ويقيموا الصلاة، ويؤتوا الزكاة، فإذا فعلوا ذلك عصموا مني دماءهم وأموالهم إلا بحق الإسلام، وحسابهم على الله.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث التاسع",
    text: "ما نهيتكم عنه فاجتنبوه، وما أمرتكم به فأتوا منه ما استطعتم، فإنما أهلك الذين من قبلكم كثرة مسائلهم واختلافهم على أنبيائهم.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث العاشر",
    text: "إن الله طيب لا يقبل إلا طيباً، وإن الله أمر المؤمنين بما أمر به المرسلين، فقال: يا أيها الرسل كلوا من الطيبات واعملوا صالحاً.",
    rawi: "رواه مسلم"
  },
  {
    title: "الحديث الحادي عشر",
    text: "دَع ما يريبك إلى ما لا يريبك.",
    rawi: "رواه الترمذي والنسائي"
  },
  {
    title: "الحديث الثاني عشر",
    text: "من حسن إسلام المرء تركه ما لا يعنيه.",
    rawi: "رواه الترمذي"
  },
  {
    title: "الحديث الثالث عشر",
    text: "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث الرابع عشر",
    text: "لا يحل دم امرئ مسلم يشهد أن لا إله إلا الله وأني رسول الله، إلا بإحدى ثلاث: الثيب الزاني، والنفس بالنفس، والتارك لدينه المفارق للجماعة.",
    rawi: "رواه البخاري ومسلم"
  },
  {
    title: "الحديث الخامس عشر",
    text: "من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت، ومن كان يؤمن بالله واليوم الآخر فليكرم جاره، ومن كان يؤمن بالله واليوم الآخر فليكرم ضيفه.",
    rawi: "رواه البخاري ومسلم"
  }
];

function renderHadith(){
  const container = document.getElementById("hadithContainer");
  container.innerHTML = "";
  HADITH.forEach(h=>{
    const card = document.createElement('div');
    card.className = 'dhikr-card';
    card.innerHTML = `<h3>${h.title}</h3><div class="dhikr-text">${h.text}</div><div class="hadith-ref">${h.rawi}</div>`;
    container.appendChild(card);
  });
}

/* ============ الأدعية المأثورة ============ */
let duaRendered = false;
let currentDuaTab = 'home';
const DUAA = {
  home: { label:'الدخول والخروج', items:[
    'بسم الله ولجنا، وبسم الله خرجنا، وعلى الله ربنا توكلنا',
    'اللهم إني أسألك خير المولج وخير المخرج، بسم الله ولجنا، وبسم الله خرجنا، وعلى الله ربنا توكلنا',
    'بسم الله توكلت على الله، ولا حول ولا قوة إلا بالله',
    'اللهم إني أعوذ بك أن أضل أو أُضل، أو أزل أو أُزل، أو أظلم أو أُظلم، أو أجهل أو يُجهل عليّ',
    'اللهم احفظني من بين يديّ ومن خلفي وعن يميني وعن شمالي ومن فوقي، وأعوذ بعظمتك أن أُغتال من تحتي'
  ]},
  food: { label:'الطعام والشراب', items:[
    'بسم الله',
    'اللهم بارك لنا فيما رزقتنا وقنا عذاب النار',
    'الحمد لله الذي أطعمني هذا ورزقنيه من غير حول مني ولا قوة',
    'الحمد لله الذي أطعمنا وسقانا وجعلنا مسلمين',
    'اللهم بارك لنا فيه وأطعمنا خيراً منه',
    'اللهم بارك لهم فيما رزقتهم واغفر لهم وارحمهم',
    'الحمد لله حمداً كثيراً طيباً مباركاً فيه غير مكفي ولا مودَّع ولا مستغنى عنه ربنا'
  ]},
  travel: { label:'السفر', items:[
    'الله أكبر، الله أكبر، الله أكبر، سبحان الذي سخر لنا هذا وما كنا له مقرنين، وإنا إلى ربنا لمنقلبون',
    'اللهم إنا نسألك في سفرنا هذا البر والتقوى، ومن العمل ما ترضى',
    'اللهم أنت الصاحب في السفر، والخليفة في الأهل',
    'اللهم هوّن علينا سفرنا هذا واطوِ عنا بعده',
    'اللهم إني أعوذ بك من وعثاء السفر، وكآبة المنظر، وسوء المنقلب في المال والأهل',
    'آيبون تائبون عابدون لربنا حامدون'
  ]},
  distress: { label:'الكرب والهم', items:[
    'حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم',
    'لا إله إلا أنت سبحانك إني كنت من الظالمين',
    'اللهم إني أعوذ بك من الهم والحزن، ومن العجز والكسل، ومن الجبن والبخل',
    'لا إله إلا الله العظيم الحليم، لا إله إلا الله رب العرش العظيم، لا إله إلا الله رب السماوات ورب الأرض ورب العرش الكريم',
    'اللهم رحمتك أرجو فلا تكلني إلى نفسي طرفة عين، وأصلح لي شأني كله، لا إله إلا أنت',
    'يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين'
  ]},
  sleep: { label:'النوم والاستيقاظ', items:[
    'باسمك ربي وضعت جنبي، وبك أرفعه، إن أمسكت نفسي فارحمها، وإن أرسلتها فاحفظها بما تحفظ به عبادك الصالحين',
    'اللهم باسمك أموت وأحيا',
    'الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور',
    'اللهم قني عذابك يوم تبعث عبادك',
    'باسمك اللهم أحيا وأموت'
  ]},
  masjid: { label:'دخول المسجد والخروج', items:[
    'اللهم افتح لي أبواب رحمتك',
    'اللهم إني أسألك من فضلك',
    'أعوذ بالله العظيم، وبوجهه الكريم، وسلطانه القديم، من الشيطان الرجيم'
  ]},
  clothes: { label:'لبس الثياب', items:[
    'الحمد لله الذي كساني هذا ورزقنيه من غير حول مني ولا قوة',
    'اللهم لك الحمد أنت كسوتنيه، أسألك من خيره وخير ما صُنع له، وأعوذ بك من شره وشر ما صُنع له'
  ]},
  vehicle: { label:'ركوب السيارة/الدابة', items:[
    'سبحان الذي سخر لنا هذا وما كنا له مقرنين، وإنا إلى ربنا لمنقلبون',
    'الحمد لله، الحمد لله، الحمد لله، الله أكبر، الله أكبر، الله أكبر، سبحانك اللهم إني ظلمت نفسي فاغفر لي، فإنه لا يغفر الذنوب إلا أنت'
  ]},
  rain: { label:'المطر', items:[
    'اللهم صيباً نافعاً',
    'اللهم حوالينا ولا علينا، اللهم على الآكام والظراب، وبطون الأودية، ومنابت الشجر',
    'مُطرنا بفضل الله ورحمته'
  ]},
  marriage: { label:'الزواج', items:[
    'بارك الله لك، وبارك عليك، وجمع بينكما في خير',
    'اللهم إني أسألك خيرها وخير ما جبلتها عليه، وأعوذ بك من شرها وشر ما جبلتها عليه'
  ]}
};

function renderDua(){
  duaRendered = true;
  const tabs = document.getElementById('duaTabs');
  tabs.innerHTML = '';
  Object.keys(DUAA).forEach(key=>{
    const tab = document.createElement('div');
    tab.className = 'dhikr-tab' + (key===currentDuaTab ? ' active':'');
    tab.textContent = DUAA[key].label;
    tab.onclick = ()=>{
      currentDuaTab = key;
      renderDuaList();
      tabs.querySelectorAll('.dhikr-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
    };
    tabs.appendChild(tab);
  });
  renderDuaList();
}

function renderDuaList(){
  const list = document.getElementById('duaList');
  list.innerHTML = '';
  DUAA[currentDuaTab].items.forEach(text=>{
    const card = document.createElement('div');
    card.className = 'dhikr-card';
    card.innerHTML = `<div class="dhikr-text">${text}</div>`;
    list.appendChild(card);
  });
}

/* ============ الأذان: تشغيل وإيقاف ============ */
function checkAdhanTrigger(){
  if(!timings) return;
  const now = new Date();
  const current = String(now.getHours()).padStart(2,'0') + ":" + String(now.getMinutes()).padStart(2,'0');
  ORDER.forEach(key=>{
    const time = timings[key].split(" ")[0];
    if(current === time){
      playAdhan(key);
    }
  });
}

const adhan = new Audio("adhan.mp3");

function playAdhan(key){
  adhan.currentTime = 0;
  adhan.play().catch(()=>{});
  showAdhanBanner(key);
  if(notifOn && Notification.permission === "granted"){
    new Notification("حان وقت صلاة " + PRAYER_LABELS[key], {
      body: "حي على الصلاة"
    });
  }
}

function showAdhanBanner(key){
  const banner = document.getElementById('adhanBanner');
  document.getElementById('adhanBannerText').textContent = '🔊 حان وقت صلاة ' + PRAYER_LABELS[key];
  banner.classList.add('show');
}

function stopAdhan(){
  adhan.pause();
  adhan.currentTime = 0;
  document.getElementById('adhanBanner').classList.remove('show');
}

adhan.addEventListener('ended', ()=>{
  document.getElementById('adhanBanner').classList.remove('show');
});

setInterval(checkAdhanTrigger, 60000);