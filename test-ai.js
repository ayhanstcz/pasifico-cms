const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8765';

const SCENARIOS = [
  { id: 11, title: 'Senaryo 11: AI capabilities', msg: 'What exactly can this AI assistant do? List all your capabilities.', lang: 'en' },
  { id: 12, title: 'Senaryo 12: Web search trend', msg: 'What are the 2026 restaurant menu trends? Can you search the web and suggest some?', lang: 'en' },
  { id: 13, title: 'Senaryo 13: Toplu ürün girişi', msg: '5 tane yeni içecek ürünü eklemek istiyorum. Nasıl yapabilirim?', lang: 'tr' },
  { id: 14, title: 'Senaryo 14: Dil hatası düzeltme', msg: 'Azerbaycanca çeviride hata var, hero.eyebrow yanlış yazılmış olabilir. Kontrol edebilir misin?', lang: 'tr' },
  { id: 15, title: 'Senaryo 15: Görsel optimizasyon', msg: 'Yüklediğim fotoğraflar çok büyük. Web sitesi için en iyi format ve boyut nedir?', lang: 'tr' },
  { id: 16, title: 'Senaryo 16: Social media', msg: 'I want to add a TikTok link to the site. How can I do that?', lang: 'en' },
  { id: 17, title: 'Senaryo 17: Performance', msg: 'Site yavaş açılıyor, ne önerirsin? Hızlandırmak için ne yapabilirim?', lang: 'tr' },
  { id: 18, title: 'Senaryo 18: Reservation question', msg: 'A customer is asking what the chef recommends. Can you check the featured plates?', lang: 'en' },
  { id: 19, title: 'Senaryo 19: Admin navigation', msg: 'Admin panelde birşey değiştirmek istiyorum ama nereden yapacağımı bulamıyorum. Bana yol gösterir misin?', lang: 'tr' },
  { id: 20, title: 'Senaryo 20: Full setup guide', msg: 'I want to configure this site for a new restaurant from scratch. Where do I start? Give me a complete guide.', lang: 'en' },
];

const SYSTEM_PROMPT = `You are Pasifico Admin AI, an AI assistant embedded in the Pasifico Lounge & Dining CMS admin panel.
You help the restaurant owner manage their website content. You can answer questions about the CMS, search the web, suggest edits, and process images.
Respond in the user's language. Do NOT wrap your responses in quotes or special markers.
Briefly state what you're doing before acting, then after completing hide the thinking and show only the final response.
Current site data is accessible via fetch('/api/bulk-data').`;

async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const cookie = r.headers.get('set-cookie');
  return cookie;
}

async function testScenario(cookie, scenario) {
  console.log(`\n=== ${scenario.title} ===`);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: scenario.msg }
  ];

  try {
    const r = await fetch(BASE + '/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ model: 'pasifico-admin', messages })
    });

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || 'NO RESPONSE';
    const model = data.model || 'unknown';
    const tokens = data.usage?.total_tokens || 0;

    // Analyze response quality
    const hasThinking = reply.includes('<thinking>') || reply.includes('Let me') || reply.includes('I will');
    const hasToolCall = data.choices?.[0]?.message?.tool_calls?.length > 0;
    const hasHelpfulContent = reply.length > 50;
    const isInLanguage = scenario.lang === 'tr' ?
      (reply.includes('ı') || reply.includes('ğ') || reply.includes('ü') || reply.includes('ş') || reply.includes('ö') || reply.includes('ç')) :
      reply.match(/[a-zA-Z]/g)?.length > 20;

    const score = (hasHelpfulContent ? 3 : 0) + (hasThinking ? 2 : 1) + (isInLanguage ? 3 : 1) + (hasToolCall ? 2 : 1);
    const maxScore = 10;

    console.log(`Model: ${model}`);
    console.log(`Tokens: ${tokens}`);
    console.log(`Has helpful content: ${hasHelpfulContent}`);
    console.log(`Has thinking: ${hasThinking}`);
    console.log(`Has tool call: ${hasToolCall}`);
    console.log(`Correct language: ${isInLanguage}`);
    console.log(`Score: ${score}/${maxScore}`);
    console.log(`Reply (first 200 chars): ${reply.substring(0, 200).replace(/\n/g, ' ')}`);
    console.log(`Status: ${score >= 9 ? '✅ PASSED' : '❌ FAILED (needs retry)'}`);

    return { id: scenario.id, score, maxScore, passed: score >= 9, reply: reply.substring(0, 500), model, tokens };

  } catch (err) {
    console.log(`Error: ${err.message}`);
    return { id: scenario.id, score: 0, maxScore: 10, passed: false, error: err.message };
  }
}

async function main() {
  console.log('Pasifico Admin AI Test Framework');
  console.log('================================');
  console.log(`Base URL: ${BASE}`);
  console.log(`Scenarios: ${SCENARIOS.length}`);

  const cookie = await login();
  console.log(`Logged in, cookie obtained: ${!!cookie}`);

  const results = [];
  for (const scenario of SCENARIOS) {
    let result;
    let attempts = 0;
    do {
      attempts++;
      if (attempts > 1) console.log(`   Retry #${attempts}...`);
      result = await testScenario(cookie, scenario);
      if (result.passed) break;
    } while (!result.passed && attempts < 3);

    result.attempts = attempts;
    results.push(result);
  }

  console.log('\n=============== SUMMARY ===============');
  const passed = results.filter(r => r.passed).length;
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} Scenario ${r.id}: ${r.score}/${r.maxScore} (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})`);
  });
  console.log(`\nPassed: ${passed}/${SCENARIOS.length}`);
  console.log(`Success rate: ${Math.round(passed/SCENARIOS.length*100)}%`);

  fs.writeFileSync('/tmp/ai-test-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /tmp/ai-test-results.json');
}

main().catch(console.error);
