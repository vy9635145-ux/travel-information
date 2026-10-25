const $ = s => document.querySelector(s);
const money = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageFallback='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80';
const states=[...new Set(DESTINATIONS.map(d=>d.state))].sort();
states.forEach(s=>$('#stateFilter').add(new Option(s,s)));
const IMG_EXTS=['jpg','jpeg','png','webp'];
const stripExt=f=>String(f||'').replace(/\.[^.\/]+$/,'');
/* Image loading order: images/<name>.jpg -> .jpeg -> .png -> .webp -> (for -2/-3 slides) main image -> online fallback */
function imgChain(filename,mainFilename=''){const base=stripExt(filename),main=stripExt(mainFilename);const chain=IMG_EXTS.map(e=>`images/${base}.${e}`);if(main&&main!==base)IMG_EXTS.forEach(e=>chain.push(`images/${main}.${e}`));chain.push(imageFallback);return chain;}
function imgNext(img){try{const c=JSON.parse(img.dataset.chain),i=Number(img.dataset.i||0)+1;if(i<c.length){img.dataset.i=i;img.src=c[i];}else img.onerror=null;}catch(e){img.onerror=null;}}
function imgTag(filename,alt,extra='',mainFilename=''){const chain=imgChain(filename,mainFilename);return `<img ${extra} loading="lazy" data-chain="${esc(JSON.stringify(chain))}" data-i="0" src="${chain[0]}" alt="${esc(alt)}" onerror="imgNext(this)">`;}
function ratingFor(d){let saved=JSON.parse(localStorage.getItem('tg-ratings')||'{}');let values=saved[d.id]||[];return values.length?values.reduce((a,b)=>a+b,0)/values.length:d.rating;}
function cardHTML(d){return `<article class="destination-card" tabindex="0" role="button" aria-label="Open ${esc(d.name)} details" data-open="${d.id}"><div class="card-image">${imgTag(d.image,d.name)}<span class="category-pill">${esc(d.category[0])}</span><button class="heart" data-fav="${d.id}" aria-label="Save ${esc(d.name)}">♡</button></div><div class="card-body"><div class="card-title-row"><div><h3>${esc(d.name)}</h3><span class="location">⌖ ${esc(d.state)}</span></div><span class="rating">★ ${ratingFor(d).toFixed(1)}</span></div><p class="card-summary">${esc(d.summary)}</p><div class="card-meta"><span>From ${money(d.budget)}</span><span>${esc(d.days)}</span></div><div class="card-weather" data-wx="${d.id}">Live weather: loading…</div><span class="card-open">Explore destination →</span></div></article>`;}

document.addEventListener('click', function (e) {
  // Favourite button ka existing behavior disturb na ho
  if (e.target.closest('[data-fav]')) return;  const card = e.target.closest('[data-open]');if (!card) return;  openDestination(card.dataset.open);});


function googlePlaceCardHTML(place) {
  const image = place.photoUrl || imageFallback;

  const attribution = (place.attributions || [])
    .map(item => {
      const name = esc(item.displayName || 'Photo contributor');
      return item.uri
        ? `<a href="${esc(item.uri)}" target="_blank" rel="noopener noreferrer">${name}</a>`
        : name;
    })
    .join(', ');

  const rating = place.rating != null
    ? `★ ${Number(place.rating).toFixed(1)}`
    : '';

  return `
    <article class="api-place-card">
      <a class="api-place-image"
         href="${esc(place.mapsUrl || '#')}"
         ${place.mapsUrl ? 'target="_blank" rel="noopener noreferrer"' : ''}
         aria-label="View ${esc(place.name)} on Google Maps">
        <img src="${esc(image)}"
             alt="${esc(place.name)}"
             loading="lazy"
             onerror="this.onerror=null;this.src=window.yatraImageFallback">
      </a>
      <div class="api-place-body">
        <h3>${esc(place.name)}</h3>
        <p>${esc(place.address)}</p>
        <p class="api-place-rating">${rating}</p>
        ${attribution
          ? `<small class="api-photo-attribution">Photo: ${attribution}</small>`
          : ''}
        ${place.mapsUrl
          ? `<a class="card-open" href="${esc(place.mapsUrl)}" target="_blank" rel="noopener noreferrer">View on Google Maps ↗</a>`
          : ''}
      </div>
    </article>
  `;
}

window.yatraImageFallback = imageFallback;

async function searchPlaces() {
  const query = $('#searchInput').value.trim();
  const resultsBox = $('#searchResults');

  if (!query) {
    resultsBox.innerHTML = '<p>Please enter a place or city name.</p>';
    return;
  }

  resultsBox.innerHTML = '<p>Searching places and photos…</p>';

  try {
    const response = await fetch(
      `/api/places/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Search failed. Please try again.');
    }

    const results = data.results || [];
    const attractions = data.attractions || [];

    if (!results.length && !attractions.length) {
      resultsBox.innerHTML = '<p>No places found. Try another search.</p>';
      return;
    }

    let html = '';

    if (results.length) {
      html += `
        <h3 class="api-search-heading">Search results for "${esc(query)}"</h3>
        <div class="api-place-grid">
          ${results.map(googlePlaceCardHTML).join('')}
        </div>
      `;
    }

    if (attractions.length) {
      html += `
        <h3 class="api-search-heading">Places to visit in ${esc(query)}</h3>
        <div class="api-place-grid">
          ${attractions.map(googlePlaceCardHTML).join('')}
        </div>
      `;
    }

    resultsBox.innerHTML = html;
  } catch (error) {
    console.error('Place search error:', error);
    resultsBox.innerHTML =
      `<p>${esc(error.message || 'Unable to search right now. Please try again.')}</p>`;
  }
}




const PAGE_SIZE = 12;
let visibleCount = 8;

function renderDestinations() {
  visibleCount = PAGE_SIZE;
  drawDestinations();
}

// Do not display destination cards on initial page load.
document.querySelector("#destinationGrid").innerHTML = "";
document.querySelector("#loadMoreWrap").classList.add("hidden");
document.querySelector("#resultCount").textContent =
  "Search for a destination to get started.";
document.querySelector("#emptyState").classList.add("hidden");

function drawDestinations() {
  const category = $('#categoryFilter').value;
  const state = $('#stateFilter').value;
  const budget = $('#budgetFilter').value;
  const list = DESTINATIONS.filter(d =>(category === 'all' || d.category.includes(category)) &&(state === 'all' || d.state === state) &&(budget === 'all' || d.budget <= Number(budget)));
  const shown = list.slice(0, visibleCount);
  $('#destinationGrid').innerHTML = shown.map(cardHTML).join('');$('#loadMoreWrap').classList.toggle('hidden',list.length <= shown.length);$('#loadMore').textContent =`Load more places (${list.length - shown.length} remaining)`;
  $('#emptyState').classList.toggle('hidden', list.length > 0);$('#resultCount').textContent = `Showing ${shown.length} of ${list.length} destination${list.length === 1 ? '' : 's'}`; loadCardWeather(shown);renderVlogs();
}
$('#applyFilters').addEventListener('click', () => {
  if ($('#searchInput').value.trim()) {
    searchPlaces();
  }
});

$('#loadMore').addEventListener('click', () => {
  if ($('#searchInput').value.trim()) {
    visibleCount += PAGE_SIZE;
    drawDestinations();
  }
});

['categoryFilter', 'stateFilter', 'budgetFilter'].forEach(id => {
  $('#' + id).addEventListener('change', () => {
    if ($('#searchInput').value.trim()) {
      searchPlaces();
    }
  });
});

$('#clearFilters').addEventListener('click', () => {
  $('#categoryFilter').value = 'all';
  $('#stateFilter').value = 'all';
  $('#budgetFilter').value = 'all';

  if ($('#searchInput').value.trim()) {
    searchPlaces();
  }
});
$('#clearFilters').addEventListener('click', () => {
  $('#categoryFilter').value = 'all'; $('#stateFilter').value = 'all'; $('#budgetFilter').value = 'all'; renderDestinations();
});
$('#placeSearch').addEventListener('submit', e => {
  e.preventDefault(); searchPlaces(); $('#searchResults').scrollIntoView({ behavior: 'smooth', block: 'start'});
});


let activeDestination=null,slideIndex=0;
function openDestination(id){activeDestination=DESTINATIONS.find(d=>d.id===id);if(!activeDestination)return;slideIndex=0;renderDetail();$('#destinationModal').classList.remove('hidden');document.body.style.overflow='hidden';}
function renderDetail(){let d=activeDestination;let saved=JSON.parse(localStorage.getItem('tg-ratings')||'{}');let values=saved[d.id]||[];let images=[d.image,d.image.replace(/\.([^.]+)$/,'-2.$1'),d.image.replace(/\.([^.]+)$/,'-3.$1')];$('#modalContent').innerHTML=`<div class="detail-gallery">${imgTag(images[slideIndex],d.name+' gallery image','',d.image)}<button class="slide-control prev" data-slide="-1" aria-label="Previous image">‹</button><button class="slide-control next" data-slide="1" aria-label="Next image">›</button><div class="slide-dots">${images.map((_,i)=>`<button data-dot="${i}" class="${i===slideIndex?'active':''}" aria-label="Show image ${i+1}"></button>`).join('')}</div></div><div class="detail-content"><div class="detail-top"><div><p class="eyebrow">${esc(d.category.join(' · '))}</p><h2 id="modalTitle">${esc(d.name)}</h2><p>⌖ ${esc(d.state)}, India · ★ ${ratingFor(d).toFixed(1)} (${values.length?values.length+' local rating(s)':'editor rating'})</p></div><div class="detail-budget">From ${money(d.budget)}<div style="font-size:10px;color:#7c8b98;text-align:right;font-weight:500">per person · estimate</div></div></div><p class="detail-summary">${esc(d.details)}</p><div class="detail-facts"><div class="fact"><span>Best time to visit</span><b>${esc(d.best)}</b></div><div class="fact"><span>Suggested duration</span><b>${esc(d.days)}</b></div><div class="fact"><span>Destination type</span><b>${esc(d.type)}</b></div><div class="fact"><span>Live weather</span><b id="modalWxNow">Loading…</b></div></div><div class="live-weather" id="modalWeather">Fetching live weather…</div><h3 class="detail-subtitle">A few helpful tips</h3><p class="detail-summary">${esc(d.tips)}</p><h3 class="detail-subtitle">Rate this destination</h3><div class="detail-rating"><label for="userRating">Your rating</label><select id="userRating"><option value="5">★★★★★ — Loved it</option><option value="4">★★★★ — Great</option><option value="3">★★★ — Good</option><option value="2">★★ — Okay</option><option value="1">★ — Needs improvement</option></select><button id="submitRating">Submit rating</button><span class="muted">${values.length} browser-saved rating(s)</span></div><p class="fine-print">Budget figures are planning estimates, not guaranteed live quotes. Confirm current entry fees, permits, weather, transport and stay prices before travel.</p></div>`;loadModalWeather(d);}
$('#destinationGrid').addEventListener('click',e=>{let fav=e.target.closest('[data-fav]');if(fav){e.stopPropagation();let f=JSON.parse(localStorage.getItem('tg-favs')||'[]');f=f.includes(fav.dataset.fav)?f.filter(x=>x!==fav.dataset.fav):[...f,fav.dataset.fav];localStorage.setItem('tg-favs',JSON.stringify(f));fav.classList.toggle('active',f.includes(fav.dataset.fav));fav.textContent=f.includes(fav.dataset.fav)?'♥':'♡';return;}let card=e.target.closest('[data-open]');if(card)openDestination(card.dataset.open);});$('#destinationGrid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open]')){e.preventDefault();openDestination(e.target.dataset.open);}});
$('#modalContent').addEventListener('click',e=>{let slide=e.target.closest('[data-slide]');if(slide){slideIndex=(slideIndex+Number(slide.dataset.slide)+3)%3;renderDetail();}let dot=e.target.closest('[data-dot]');if(dot){slideIndex=Number(dot.dataset.dot);renderDetail();}if(e.target.closest('#submitRating')){let r=Number($('#userRating').value),all=JSON.parse(localStorage.getItem('tg-ratings')||'{}');all[activeDestination.id]=[...(all[activeDestination.id]||[]),r];localStorage.setItem('tg-ratings',JSON.stringify(all));renderDetail();toast('Thanks! Your rating is saved in this browser.');}let weather=e.target.closest('[data-weather]');if(weather){$('#weatherPlace').value=weather.dataset.weather;$('#destinationModal').classList.add('hidden');document.body.style.overflow='';checkWeather(weather.dataset.weather);$('#weather').scrollIntoView({behavior:'smooth'});}});
function closeModal(){$('#destinationModal').classList.add('hidden');document.body.style.overflow='';}$('#closeModal').addEventListener('click',closeModal);$('#destinationModal').addEventListener('click',e=>{if(e.target.dataset.close)closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('#budgetForm').addEventListener('submit',e=>{e.preventDefault();let origin=$('#origin').value.trim(),dest=$('#destinationInput').value.trim(),people=Math.max(1,Number($('#people').value)),days=Math.max(1,Number($('#days').value)),transport=$('#transport').value,stay=$('#stay').value,style=$('#tripStyle').value;let multipliers={train:[700,2200],bus:[500,1800],flight:[2500,7500],car:[1800,5000],bike:[500,1700]},stays={budget:[500,1000],hotel:[1200,2500],comfort:[2800,6000],hostel:[350,800],camp:[700,1800]},styleFactor=style==='budget'?.82:style==='comfort'?1.35:1;let [tl,th]=multipliers[transport],[sl,sh]=stays[stay];let transportLow=tl*people,transportHigh=th*people,stayLow=sl*days*people,stayHigh=sh*days*people,foodLow=350*days*people,foodHigh=800*days*people,activitiesLow=250*days*people,activitiesHigh=900*days*people;let low=Math.round((transportLow+stayLow+foodLow+activitiesLow)*styleFactor),high=Math.round((transportHigh+stayHigh+foodHigh+activitiesHigh)*styleFactor);$('#budgetResult').innerHTML=`<div class="result-top"><span class="result-icon">✓</span><div><b>Your trip estimate</b><p>${esc(origin)} → ${esc(dest)} · ${people} traveller(s) · ${days} day(s)</p></div></div><div class="cost-row"><span>Transport · ${esc(transport)}</span><b>${money(transportLow)} – ${money(transportHigh)}</b></div><div class="cost-row"><span>Stay · ${esc(stay.replace(/^./,s=>s.toUpperCase()))}</span><b>${money(stayLow)} – ${money(stayHigh)}</b></div><div class="cost-row"><span>Food</span><b>${money(foodLow)} – ${money(foodHigh)}</b></div><div class="cost-row"><span>Activities & local travel</span><b>${money(activitiesLow)} – ${money(activitiesHigh)}</b></div><div class="budget-total"><span>Estimated total for ${people} traveller(s)</span><strong>${money(low)} – ${money(high)}</strong><span>Approx. ${money(Math.round(low/people))} – ${money(Math.round(high/people))} per person</span></div><p class="fine-print">Indicative nationwide planning model, not route-specific live fares. Actual fares depend on distance, availability, season and booking date. Keep an extra 10–15% buffer.</p>`;});
async function checkWeather(place){$('#weatherResult').innerHTML='<span class="weather-symbol">⌛</span><div><b>Checking forecast…</b><p>Looking up the location and available forecast.</p></div>';try{let g=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`);if(!g.ok)throw Error();let gd=await g.json();if(!gd.results?.length)throw Error('No matching location was found.');let loc=gd.results[0];let w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`);if(!w.ok)throw Error();let wd=await w.json(),c=wd.current,d=wd.daily;$('#weatherResult').innerHTML=`<span class="weather-symbol">${weatherIcon(c.weather_code)}</span><div><b>${esc(loc.name)}${loc.admin1?', '+esc(loc.admin1):''}: ${weatherText(c.weather_code)}, ${Math.round(c.temperature_2m)}°C</b><p>Feels like ${Math.round(c.apparent_temperature)}°C · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h<br>3-day outlook: ${d.time.map((day,i)=>`${day.slice(5)} ${Math.round(d.temperature_2m_min[i])}°–${Math.round(d.temperature_2m_max[i])}°C, rain chance ${d.precipitation_probability_max?.[i]??'—'}%`).join(' · ')}</p><p class="fine-print">Source: Open-Meteo. Forecast availability and accuracy vary; check official local alerts before travel.</p></div>`;}catch(err){$('#weatherResult').innerHTML=`<span class="weather-symbol">☁</span><div><b>Weather unavailable for ${esc(place)}</b><p>${esc(err.message||'Please try again later or check your network connection.')}</p><p class="fine-print">TripGuide does not invent weather readings. This service needs an internet connection.</p></div>`;}}
const wxCache={},WX_TTL=15*60*1000;
function paintCardWeather(){document.querySelectorAll('[data-wx]').forEach(el=>{const w=wxCache[el.dataset.wx];el.textContent=!w?'Live weather: loading…':w.fail?'Live weather unavailable':`${weatherIcon(w.code)} ${Math.round(w.temp)}°C · ${weatherText(w.code)} · live`;});}
async function loadCardWeather(list){const need=list.filter(d=>!wxCache[d.id]||wxCache[d.id].fail||Date.now()-wxCache[d.id].t>WX_TTL);paintCardWeather();for(let i=0;i<need.length;i+=100){const chunk=need.slice(i,i+100);try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${chunk.map(d=>d.lat).join(',')}&longitude=${chunk.map(d=>d.lon).join(',')}&current=temperature_2m,weather_code&timezone=auto`);if(!r.ok)throw Error();let j=await r.json();if(!Array.isArray(j))j=[j];chunk.forEach((d,k)=>{const c=j[k]&&j[k].current;wxCache[d.id]=c?{t:Date.now(),temp:c.temperature_2m,code:c.weather_code}:{fail:true};});}catch(e){chunk.forEach(d=>{wxCache[d.id]={fail:true};});}paintCardWeather();}}
async function loadModalWeather(d){const box=$('#modalWeather'),now=$('#modalWxNow');if(!box)return;try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`);if(!r.ok)throw Error();const w=await r.json(),c=w.current,dy=w.daily;if(!activeDestination||activeDestination.id!==d.id||!$('#modalWeather'))return;now.textContent=`${weatherIcon(c.weather_code)} ${Math.round(c.temperature_2m)}°C · ${weatherText(c.weather_code)}`;box.innerHTML=`<b>Live weather at ${esc(d.name)}</b><p>Feels like ${Math.round(c.apparent_temperature)}°C · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h · Rain now ${c.precipitation} mm</p><p>3-day outlook: ${dy.time.map((day,i)=>`${day.slice(5)} ${Math.round(dy.temperature_2m_min[i])}°–${Math.round(dy.temperature_2m_max[i])}°C, rain chance ${dy.precipitation_probability_max?.[i]??'—'}%`).join(' · ')}</p><small>Source: Open-Meteo (live). Check official local alerts before travel.</small>`;}catch(e){if($('#modalWeather')){now.textContent='Unavailable';box.innerHTML='<b>Live weather unavailable</b><p>Please check your internet connection and try again. TripGuide does not invent weather readings.</p>';}}}
function weatherText(code){if(code===0)return'Clear';if([1,2,3].includes(code))return'Partly cloudy';if([45,48].includes(code))return'Fog';if([51,53,55,56,57].includes(code))return'Drizzle';if([61,63,65,66,67,80,81,82].includes(code))return'Rain';if([71,73,75,77,85,86].includes(code))return'Snow';if([95,96,99].includes(code))return'Thunderstorm';return'Variable conditions';}function weatherIcon(code){return code===0?'☀':[1,2,3].includes(code)?'⛅':[45,48].includes(code)?'🌫':[71,73,75,77,85,86].includes(code)?'❄':[95,96,99].includes(code)?'⛈':'🌧';}

const weatherForm = $('#weatherForm');

if (weatherForm) {
  weatherForm.addEventListener('submit', e => {
    e.preventDefault();
    checkWeather($('#weatherPlace').value.trim());
  });
}


function findDest(name){const n=String(name||'').trim().toLowerCase();return n?DESTINATIONS.find(d=>d.name.toLowerCase()===n):null;}
function vlogMatchesFilters(v){const d=findDest(v.place),category=$('#categoryFilter').value,state=$('#stateFilter').value,budget=$('#budgetFilter').value;if(!d)return category==='all'&&state==='all'&&budget==='all';return (category==='all'||d.category.includes(category))&&(state==='all'||d.state===state)&&(budget==='all'||d.budget<=Number(budget));}

function vlogMatchesFilters(v) {
  const place = v.location || v.place || '';
  const d = findDest(place);
  const category = $('#categoryFilter').value;
  const state = $('#stateFilter').value;
  const budget = $('#budgetFilter').value;

  if (!d) {
    return category === 'all' &&
      state === 'all' &&
      budget === 'all';
  }

  return (
    (category === 'all' || d.category.includes(category)) &&
    (state === 'all' || d.state === state) &&
    (budget === 'all' || d.budget <= Number(budget))
  );
}

function renderVlogs(vlogs = []) {
  const grid = $('#vlogGrid');

  const filtered = vlogs.filter(vlogMatchesFilters);

  if (!filtered.length) {
    grid.innerHTML = '<p>No vlogs yet. Be the first to share one!</p>';
    return;
  }

  grid.innerHTML = filtered.map(v => {
    const place = v.location || v.place || '';
    const url = v.videoUrl || v.url || '';
    const d = findDest(place);

    const thumb = d
      ? imgTag(d.image, v.title)
      : `<img src="${imageFallback}" alt="${esc(v.title)}">`;

    const videoUrl = url.startsWith('http')
      ? url
      : url.startsWith('/')
        ? url
        : '';

    return `
      <article class="vlog-card">
        <div class="vlog-thumb">
          ${
            videoUrl
              ? `<a href="${esc(videoUrl)}"
                    target="_blank"
                    rel="noopener noreferrer">
                   ${thumb}
                   <span class="play-badge">▶</span>
                 </a>`
              : thumb
          }
        </div>

        <div class="vlog-info">
          <b>${esc(v.title)}</b>
          <span>⌖ ${esc(place)}${d ? ', ' + esc(d.state) : ''}</span>
          ${v.description ? `<p>${esc(v.description)}</p>` : ''}
          ${
            videoUrl
              ? `<a class="card-open"
                    href="${esc(videoUrl)}"
                    target="_blank"
                    rel="noopener noreferrer">Watch vlog ↗</a>`
              : ''
          }
        </div>
      </article>
    `;
  }).join('');
}

let savedVlogs = [];

async function loadVlogs() {
  const grid = $('#vlogGrid');
  grid.innerHTML = '<p>Loading vlogs...</p>';

  try {
    const response = await fetch('/api/vlogs');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not load vlogs.');
    }

    savedVlogs = data.vlogs || [];
    renderVlogs(savedVlogs);
  } catch (error) {
    console.error('Load vlogs error:', error);
    grid.innerHTML = '<p>Could not load vlogs. Please try again.</p>';
  }
}

$('#showVlogForm').addEventListener('click', () => {
  $('#vlogForm').classList.toggle('hidden');
});

$('#vlogForm').addEventListener('submit', async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const file = $('#vlogVideo').files[0];

  if (!file) {
    toast('Please select a video first.');
    return;
  }

  const formData = new FormData();
  formData.append('title', $('#vlogTitle').value.trim());
  formData.append('location', $('#vlogPlace').value.trim());
  formData.append('description', $('#vlogDescription').value.trim());
  formData.append('video', file);

  button.disabled = true;
  button.textContent = 'Uploading...';

  try {
    const response = await fetch('/api/vlogs', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Vlog upload failed.');
    }

    form.reset();
    form.classList.add('hidden');

    await loadVlogs();
    toast('Vlog uploaded successfully!');
  } catch (error) {
    console.error('Vlog upload error:', error);
    toast(error.message || 'Could not upload vlog.');
  } finally {
    button.disabled = false;
    button.textContent = 'Upload vlog';
  }
});

// Load saved vlogs when the page opens.
loadVlogs();

function answerFor(q){let s=q.toLowerCase();if(s.includes('budget')||s.includes('cost')||s.includes('cheap'))return'For a budget-friendly trip, compare train and bus options, travel outside peak dates, choose a hostel or dharamshala where suitable, and keep a 10–15% emergency buffer. Use the Budget Planner above for an indicative range.';if(s.includes('pack')||s.includes('monsoon')||s.includes('rain'))return'For a monsoon trip, pack a light waterproof jacket, quick-dry layers, shoes with good grip, a waterproof phone pouch, basic medicines you normally use, and a small dry bag. Check local weather alerts and road conditions before leaving.';if(s.includes('3-day')||s.includes('nature')||s.includes('mountain'))return'For a 3-day nature escape, consider Munnar, Manali, or Darjeeling depending on your starting city and season. Travel time can take a large part of a short trip, so check route duration first and avoid overpacking the itinerary.';if(s.includes('weather'))return'Use the Weather section for a current forecast from Open-Meteo. Mountain weather can change quickly, so also check official local alerts before departure.';if(s.includes('taj')||s.includes('history'))return'Taj Mahal in Agra is a great heritage option, especially from October to March. Check current ticketing and visiting rules before you go, and consider adding other Agra heritage sites if you have time.';return'I can help with basic destination ideas, seasons, packing, and planning. Tell me your starting city, preferred experience (nature, history, beach, spiritual, or adventure), number of days, and approximate budget for a more useful suggestion. This is a demo assistant, not a connected live AI.';}
function addChat(text,isUser){let el=document.createElement('div');el.className=isUser?'user-message':'bot-message';el.textContent=text;$('#chatMessages').appendChild(el);$('#chatMessages').scrollTop=$('#chatMessages').scrollHeight;}
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();let q=$('#chatInput').value.trim();if(!q)return;addChat(q,true);$('#chatInput').value='';setTimeout(()=>addChat(answerFor(q),false),250);});document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>{addChat(b.dataset.question,true);setTimeout(()=>addChat(answerFor(b.dataset.question),false),250);}));
$('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();$('#newsletterMessage').textContent='Thanks! Demo form only — connect an email service to collect subscriptions.';e.target.reset();});$('#menuToggle').addEventListener('click',()=>$('#mainNav').classList.toggle('open'));$('#mainNav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>$('#mainNav').classList.remove('open')));
let toastTimer;function toast(msg){let t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);}
$('#placeList').innerHTML=DESTINATIONS.map(d=>`<option value="${esc(d.name)}">`).join('');$('#year').textContent=new Date().getFullYear();renderDestinations();renderVlogs();
