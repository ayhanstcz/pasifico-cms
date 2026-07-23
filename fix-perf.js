const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

// Add loading shimmer for menu figures right before closing style tag
const shimmer = `.menu-figure{background:var(--ink-3);position:relative;overflow:hidden}.menu-figure:empty:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent);animation:shimmer 1.5s infinite}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
`;
h = h.replace('</style>', shimmer + '</style>');

// Add picture preload for first batch of sushi images
// This makes the browser start loading them immediately
const preloadBlock = `
<link rel="preload" href="/images/food_and_cigarettes/004_MANGO_SENSEI_ROLL.jpeg" as="image" fetchpriority="high">
<link rel="preload" href="/images/food_and_cigarettes/005_SAKE_BLAZE_ROLL.jpeg" as="image" fetchpriority="high">
<link rel="preload" href="/images/food_and_cigarettes/006_SINGAPORE_ROLL.jpeg" as="image">
<link rel="preload" href="/images/food_and_cigarettes/007_ELEGANCE_ROLL.jpeg" as="image">
<link rel="preload" href="/images/food_and_cigarettes/008_YUZU_HARMONY_ROLL.jpeg" as="image">
`;
// Add preload of bulk data too
const bulkPreload = `<link rel="preload" href="/api/bulk-data" as="fetch" crossorigin="anonymous" fetchpriority="high">`;

// Insert after preconnect links
h = h.replace('</head>', preloadBlock + bulkPreload + '</head>');

// Remove loading="lazy" from first 6 menu items in renderMenu
// to make above-the-fold images load instantly
h = h.replace(
  '<img class="menu-photo" src="${x.img}" alt="${x.name[lang]||x.name.en}" loading="lazy">',
  '<img class="menu-photo" src="${x.img}" alt="${x.name[lang]||x.name.en}" loading="${i<6?"eager":"lazy"}">'
);

// Also ensure featured plate images load eagerly (they're above fold on desktop)
h = h.replace(
  '<img class="plate-img" src="${x.img}" alt="${x.name[lang]||x.name.en}">',
  '<img class="plate-img" src="${x.img}" alt="${x.name[lang]||x.name.en}" fetchpriority="high">'
);

fs.writeFileSync('index.html', h);
console.log('✅ Added shimmer animation, image preloads, eager loading for first items');
