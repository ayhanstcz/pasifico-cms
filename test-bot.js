const BASE = process.argv[2] || 'http://localhost:8766';

const SCENARIOS = [
  { id: 1, msg: 'What are your opening hours?', lang: 'en' },
  { id: 2, msg: 'Menyuda ne var?', lang: 'tr' },
  { id: 3, msg: 'Do you have any sushi recommendations?', lang: 'en' },
  { id: 4, msg: 'Sizin menüde sushi kategorisinde neler var?', lang: 'tr' },
  { id: 5, msg: 'Size bir masa ayırmak istiyorum. Nasıl yapabilirim?', lang: 'tr' },
  { id: 6, msg: 'Hangi etkinlikler yakında?', lang: 'tr' },
  { id: 7, msg: 'What events are coming up this month?', lang: 'en' },
  { id: 8, msg: 'Telefon numaranız nedir?', lang: 'tr' },
  { id: 9, msg: 'Bir restorana gitmek için hangi saatler uygun?', lang: 'tr' },
  { id: 10, msg: 'En iyi tabağınız hangisi?', lang: 'tr' },
  { id: 11, msg: 'Neredesiniz? Adresiniz nedir?', lang: 'tr' },
  { id: 12, msg: 'Do you have vegan options?', lang: 'en' },
  { id: 13, msg: 'Ваше меню на русском?', lang: 'ru' },
  { id: 14, msg: 'Menyuda ən bahalı yemək hansıdır?', lang: 'az' },
  { id: 15, msg: 'Do you have a private dining area?', lang: 'en' },
  { id: 16, msg: 'Rezervasyon nasıl yapabilirim?', lang: 'tr' },
  { id: 17, msg: 'Sizin imza tabağınız hangisi?', lang: 'tr' },
  { id: 18, msg: 'Group booking for 10 people, is that possible?', lang: 'en' },
  { id: 19, msg: 'WhatsApp numaranızdan yazabilir miyim?', lang: 'tr' },
  { id: 20, msg: 'What is the dress code?', lang: 'en' },
];

const SYSTEM = 'You are Pasifico Bot, a helpful assistant for Pasifico Lounge & Dining website visitors. You help guests with questions about the menu, events, reservations, hours, and location. Respond in whatever language the user writes in. NEVER wrap responses in quotes. Keep responses concise.';

async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  return r.headers.get('set-cookie');
}

async function testScenario(cookie, s) {
  console.log(`\n=== Bot Test ${s.id}: ${s.msg.substring(0, 60)}... ===`);
  const msgs = [
    { role: 'system', content: SYSTEM + '\n\nCurrent context: This is Pasifico Lounge & Dining in Baku, a Pan-Asian restaurant.' },
    { role: 'user', content: s.msg }
  ];

  try {
    const r = await fetch(BASE + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ model: 'pasifico-bot', messages: msgs })
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || 'NO RESPONSE';

    const isHelpful = reply.length > 40 && !reply.includes('NO RESPONSE');
    const noQuotes = !reply.includes('"') || reply.indexOf('"') === reply.lastIndexOf('"');
    const isCorrectLang = s.lang === 'tr' ? /[ığüşöç]/i.test(reply) :
                          s.lang === 'ru' ? /[а-яё]/i.test(reply) :
                          s.lang === 'az' ? /[əğıüöçş]/i.test(reply) :
                          /[a-zA-Z]{4,}/.test(reply);
    const noThinking = !reply.includes('<thinking>') && !reply.includes('Let me') && !reply.includes('I need to');
    const isConcise = reply.length < 1000;

    let score = 0;
    score += isHelpful ? 3 : 0;
    score += noQuotes ? 2 : 0;
    score += isCorrectLang ? 3 : 1;
    score += noThinking ? 2 : 1;
    const maxScore = 10;

    console.log(`Helpful: ${isHelpful}, NoQuotes: ${noQuotes}, Lang: ${isCorrectLang}, NoThinking: ${noThinking}, Concise: ${isConcise}`);
    console.log(`Score: ${score}/${maxScore}`);
    console.log(`Reply: ${reply.substring(0, 200).replace(/\n/g, ' ')}`);
    console.log(`Status: ${score >= 9 ? '✅' : '❌'}`);
    return { id: s.id, score, maxScore, passed: score >= 9 };
  } catch (err) {
    console.log(`Error: ${err.message}`);
    return { id: s.id, score: 0, maxScore: 10, passed: false, error: err.message };
  }
}

async function main() {
  console.log('=== Pasifico Bot Test Framework ===');
  const cookie = await login();
  console.log(`Logged in: ${!!cookie}`);

  const results = [];
  for (const s of SCENARIOS) {
    let result;
    for (let a = 1; a <= 3; a++) {
      result = await testScenario(cookie, s);
      if (result.passed) break;
      console.log(`  Retry ${a}...`);
    }
    results.push(result);
  }

  console.log('\n========== SUMMARY ==========');
  const passed = results.filter(r => r.passed).length;
  results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} Bot ${r.id}: ${r.score}/${r.maxScore}`));
  console.log(`\nPassed: ${passed}/${SCENARIOS.length} (${Math.round(passed/SCENARIOS.length*100)}%)`);
  require('fs').writeFileSync('/tmp/bot-test-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
