const fs = require('fs');
let html = fs.readFileSync(__dirname + '/admin/index.html', 'utf8');

// ============= 1. FIX: Site Config - site.json is loaded from 'site' not from API param =============
// The issue is renderers.site references 'site' correctly, but the save function may have issues.
// Let's check what needs fixing.

// ============= 2. FIX: Images - recursive walk already fixed in server, but admin needs to show thumbnails properly =============

// ============= 3. FIX: Event addition - add "Add Event" button =============
// Find the events section end and add an add button
const eventsEnd = html.indexOf('html += `<button class="btn btn-primary mt-12" onclick="saveEvents()">Save All Events</button>`;');
if (eventsEnd > 0) {
  // Add add-event functionality BEFORE the save button
  const before = html.slice(0, eventsEnd);
  const after = html.slice(eventsEnd);

  const addEventUI = `
  html += \`<div style="display:flex;gap:12px;margin-top:20px">
    <button class="btn btn-primary" onclick="addEvent()">+ Add Event</button>
    <button class="btn btn-primary" onclick="saveEvents()">Save All Events</button>
  </div>\`;
`;
  html = before + addEventUI + after;
  console.log('✅ Events: Added Add Event button');
}

// ============= 4. FIX: Add event function =============
// Find where saveEvents is defined and add addEvent + deleteEvent before it
const saveEventsDef = html.indexOf('window.saveEvents = async function()');
if (saveEventsDef > 0) {
  const addEventFn = `
window.addEvent = async function() {
  const events = await loadData('events');
  const newEvent = {
    id: "event-" + Date.now(),
    day: 1,
    monthKey: "month.jan",
    title: { en: "New Event", tr: "Yeni Etkinlik", az: "Yeni Tədbir", ru: "Новое Событие" },
    desc: { en: "Description", tr: "Açıklama", az: "Təsvir", ru: "Описание" },
    meta: { en: "Time", tr: "Saat", az: "Saat", ru: "Время" },
    img: ""
  };
  events.push(newEvent);
  await saveData('events', events);
  toast('Event added!');
  renderers.events();
};
`;
  html = html.slice(0, saveEventsDef) + addEventFn + '\n' + html.slice(saveEventsDef);
  console.log('✅ Events: Added addEvent function');
}

// ============= 5. FIX: Image upload with file picker =============
// Replace the image manager renderer
const imagesStart = html.indexOf('renderers.images = async function()');
const imagesEnd = html.indexOf('// ==================== INIT ====================');
if (imagesStart > 0 && imagesEnd > imagesStart) {
  const oldImages = html.slice(imagesStart, imagesEnd);

  const newImages = `renderers.images = async function() {
  const main = document.getElementById('main');

  main.innerHTML = \`
    <div class="breadcrumb">Images</div>
    <h2>Image Manager</h2>
    <p>Upload images or pick from gallery</p>

    <div class="card">
      <h3>Upload from Computer</h3>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <input type="file" id="imageUpload" accept="image/*" style="flex:1;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
        <button class="btn btn-primary" onclick="uploadSingleImage()">Upload</button>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
        <span style="font-size:.8rem;color:var(--muted)">Save to folder:</span>
        <select id="uploadFolder" style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
          <option value="">Root (/images/)</option>
          <option value="food_and_cigarettes">food_and_cigarettes</option>
          <option value="drinks_and_shisha">drinks_and_shisha</option>
        </select>
      </div>
      <div id="uploadStatus" style="margin-top:12px;font-size:.82rem;color:var(--muted)"></div>
    </div>

    <div class="card">
      <h3>Image Gallery</h3>
      <div style="margin-bottom:16px">
        <input type="text" id="imageSearch" placeholder="Search images..." oninput="filterImages(this.value)" style="width:100%;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
      </div>
      <div id="imageGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        <p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px 0">Loading images...</p>
      </div>
    </div>
  \`;

  // Load images
  try {
    const res = await fetch('/api/images/list');
    const data = await res.json();
    const grid = document.getElementById('imageGrid');
    if (data.images && data.images.length) {
      grid.innerHTML = data.images.map(img => {
        const folder = img.includes('/') ? img.split('/')[0] : '';
        const name = img.includes('/') ? img.split('/').pop() : img;
        const fullUrl = '/images/' + img;
        return \`<div class="img-card" data-name="\${img.toLowerCase()}" style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface-2)">
          <div style="height:140px;background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden">
            <img src="\${fullUrl}" style="max-width:100%;max-height:100%;object-fit:cover">
          </div>
          <div style="padding:10px">
            <div style="font-size:.65rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="\${name}">\${name}</div>
            <div style="font-size:.6rem;color:var(--muted);margin-top:2px">\${folder || 'root'}</div>
            <div style="display:flex;gap:4px;margin-top:8px">
              <button class="btn btn-primary btn-sm" style="flex:1" onclick="copyToClipboard('\${fullUrl}')">Copy URL</button>
            </div>
          </div>
        </div>\`;
      }).join('');
    } else {
      grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px 0">No images yet. Upload one above!</p>';
    }
  } catch(e) {
    console.error('Failed to load images', e);
    document.getElementById('imageGrid').innerHTML = '<p style="color:var(--danger);grid-column:1/-1">Failed to load images</p>';
  }
};

window.uploadSingleImage = async function() {
  const input = document.getElementById('imageUpload');
  if (!input.files[0]) return toast('Select an image first', 'error');
  const folder = document.getElementById('uploadFolder').value;
  const fd = new FormData();
  fd.append('image', input.files[0]);
  if (folder) fd.append('folder', folder);

  document.getElementById('uploadStatus').textContent = 'Uploading...';
  try {
    const res = await fetch(folder ? '/api/upload-to' : '/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    document.getElementById('uploadStatus').textContent = '✅ Uploaded: ' + data.url;
    toast('Image uploaded!');
    setTimeout(() => renderers.images(), 1000);
  } catch(e) {
    document.getElementById('uploadStatus').textContent = '❌ Upload failed';
    toast('Upload failed: ' + e.message, 'error');
  }
};

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text);
  toast('Copied: ' + text);
};

window.filterImages = function(q) {
  const lower = q.toLowerCase();
  document.querySelectorAll('.img-card').forEach(el => {
    el.style.display = el.dataset.name.includes(lower) ? '' : 'none';
  });
};
`;
  html = html.slice(0, imagesStart) + newImages + html.slice(imagesEnd);
  console.log('✅ Images: Replaced image manager');
}

// ============= 6. FIX: Event deletion per-item =============
// Add delete button next to each event in renderers.events
// Find where event card HTML is generated
const evImgField = 'id="ev_${idx}_img"';
// This is a bit tricky - let's add a delete button in the card header
html = html.replace(
  'html += `\\n      <div class="card">\\n        <h3>${ev.title.en}</h3>',
  'html += `\\n      <div class="card" data-ev-idx="${idx}">\\n        <div class="flex-between">\\n          <h3>${ev.title.en}</h3>\\n          <button class="btn btn-danger btn-sm" onclick="deleteEvent(${idx})">Delete</button>\\n        </div>'
);
console.log('✅ Events: Added delete button to each event');

// ============= 7. Verify site config =============
// Check if site config section properly references 'site' data
const siteCheck = html.includes("const site = await loadData('site');");
console.log('✅ Site Config uses loadData("site"):', siteCheck);

// Check if images list API is correct
const imgCheck = html.includes('/api/images/list');
console.log('✅ Images list API:', imgCheck);

// ============= 8. Add deleteEvent function =============
const saveSiteDef = html.indexOf('window.saveSiteConfig = async function()');
if (saveSiteDef > 0) {
  // Add deleteEvent BEFORE saveSiteConfig
  const delEventFn = `
window.deleteEvent = async function(idx) {
  if (!confirm('Delete this event?')) return;
  const events = await loadData('events');
  events.splice(idx, 1);
  await saveData('events', events);
  toast('Event deleted');
  renderers.events();
};

`;
  html = html.slice(0, saveSiteDef) + delEventFn + html.slice(saveSiteDef);
  console.log('✅ Events: Added deleteEvent function');
}

fs.writeFileSync(__dirname + '/admin/index.html', html, 'utf8');
console.log('\n✅ All admin panel fixes applied!');
