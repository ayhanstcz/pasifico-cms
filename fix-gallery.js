const fs = require('fs');
let h = fs.readFileSync(__dirname + '/admin-panel/index.html', 'utf8');

// Remove gallery CSS
h = h.replace(/\/\* Image gallery \*\/[\s\S]*?\n\t\}\s*/g, '');
// Remove orphaned gallery classes
h = h.replace(/\.gallery[\s\S]*?\.[a-z-]+[^}]*\}\s*/g, '');

// Remove the entire IMAGES renderer section
h = h.replace(/\/\/ ─── IMAGES ───[\s\S]*?};[\s\S]*?\n\s*/g, '');

// Replace pickImage with a simple gallery browser
const newPickImage = `
window.pickImage = async function(fieldId){
  try {
    const r = await fetch('/api/images/list');
    const d = await r.json();
    if(!d.images || !d.images.length) return toast('No images', true);
    let html = '<h3>Select Image</h3><div style="max-height:60vh;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;padding:4px">';
    d.images.forEach(img => {
      html += '<div style="cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent" onclick="pickImg(\\'' + fieldId + '\\',\\'/images/' + img + '\\',this)">';
      html += '<img src="/images/' + img + '" style="width:100%;height:70px;object-fit:cover;display:block">';
      html += '<div style="font-size:.5rem;color:#777;padding:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + img.split('/').pop() + '</div></div>';
    });
    html += '</div><div class="gap-8 mt-16"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>';
    openModal(html);
  } catch(e) { toast('Failed', true); }
};
window.pickImg = function(fieldId, url, el) {
  document.querySelectorAll('.modal-box > div > div').forEach(e => e.style.borderColor='transparent');
  el.style.borderColor = '#b8860b';
  document.getElementById(fieldId).value = url;
  const prev = document.getElementById('imgPreview');
  if(prev) prev.src = url;
};
`;

h = h.replace(/window\.pickImage[\s\S]*?\};\s*/g, newPickImage);

// Also remove the standalone copyImg and loadGallery functions
h = h.replace(/window\.copyImg[\s\S]*?\};\s*/g, '');
h = h.replace(/window\.filterGallery[\s\S]*?\};\s*/g, '');

// Remove any remaining gallery references
h = h.replace(/loadGallery\(\);\s*/g, '');
h = h.replace(/filterGallery\(\);\s*/g, '');

fs.writeFileSync(__dirname + '/admin-panel/index.html', h);
console.log('✅ Cleaned up Images tab, gallery, and pickImage now works inline');
