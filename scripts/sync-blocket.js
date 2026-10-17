/**
 * AM Auto - Automated Blocket Sync Script
 * Safely fetches dealer inventory from Blocket and updates lager.html and bil-detaljer.html.
 * Zero external dependencies - uses native Node.js 18+ fetch and fs.
 */

const fs = require('fs');
const path = require('path');

const ORG_ID = '3124922';
const SEARCH_URL = `https://www.blocket.se/mobility/search/car?orgId=${ORG_ID}`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ROOT_DIR = path.resolve(__dirname, '..');
const LAGER_PATH = path.join(ROOT_DIR, 'lager.html');
const BIL_DETALJER_PATH = path.join(ROOT_DIR, 'bil-detaljer.html');

// Fallback / stable IDs for known recurring cars
const KNOWN_ID_MAP = {
    '27485505': 'vw-golf-gti-2018',
    '27444050': 'audi-a8-2014',
    '27443909': 'bmw-535d-2014',
    '27443736': 'vw-polo-2012',
    '26775280': 'volvo-xc60-2016',
    '26012081': 'audi-a5-2012',
    '26857167': 'mercedes-benz-a220-2015',
    '26012026': 'volvo-v40-cross-country-2014',
    '27370472': 'peugeot-508-2011',
    '27370371': 'citroen-c1-2014',
    '27370278': 'toyota-rav4-hybrid-2020',
    '27247099': 'renault-clio-2015',
    '27246977': 'nissan-pulsar-2015',
    '27232748': 'mercedes-benz-c63-amg-2016',
    '27232590': 'porsche-cayenne-2014',
    '27232495': 'bmw-330d-2013',
    '27076813': 'ford-transit-connect-2014',
    '27076569': 'mercedes-benz-citan-2015',
    '27054970': 'nissan-micra-2016',
    '26989256': 'vw-tiguan-2011',
    '26915050': 'bmw-520d-2020',
    '26812365': 'audi-q5-2012',
    '26775407': 'mercedes-benz-e220-2014',
    '26775107': 'ford-transit-2012',
    '24818981': 'range-rover-sport-2020',
    '25552420': 'toyota-rav4-2015',
    '26256800': 'mercedes-benz-a220-2020',
    '25828346': 'bmw-m3-2024'
};

const LOCAL_CAR_IMAGES = {
    'volvo-xc60-2016': 'images/XC 1.avif',
    'audi-a5-2012': 'images/AA 1.avif',
    'mercedes-benz-a220-2015': 'images/A1.avif',
    'volvo-v40-cross-country-2014': 'images/V40 1.avif',
    'nissan-micra-2016': 'images/NM 1.jpg',
    'vw-tiguan-2011': 'images/vt 1.jpg',
    'bmw-520d-2020': 'images/B1.avif',
    'audi-q5-2012': 'images/Q5 1.avif',
    'ford-transit-2012': 'images/FT 1.avif',
    'range-rover-sport-2020': 'images/RRR 1.avif',
    'toyota-rav4-2015': 'images/T4 1.avif',
    'mercedes-benz-a220-2020': 'images/MB 1.avif',
    'bmw-m3-2024': 'images/M3 1.avif'
};

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function cleanDescription(desc) {
    if (!desc) {
        return 'Välkommen till oss på A&M Auto Katrineholm!<br><br>Kontakta oss för mer information om detta fordon.<br><br>Vi levererar självklart bilen hem till dig!';
    }
    let d = desc.replace(/&amp;/g, '&');
    d = d.replace(/Följande Utrustning\s*-?/gi, '<strong>Följande Utrustning -</strong>');
    if (/Övrigt\s*-?/i.test(d)) {
        d = d.replace(/Övrigt\s*-?/gi, '<strong>Övrigt -</strong>');
    } else if (/<br><br>(Skatt:.*)/i.test(d)) {
        d = d.replace(/<br><br>(Skatt:.*)/i, '<br><br><strong>Övrigt -</strong><br>$1');
    }
    return d.replace(/'/g, "\\'");
}

async function fetchSearchPage() {
    console.log(`Fetching dealer inventory from: ${SEARCH_URL}`);
    const res = await fetch(SEARCH_URL, {
        headers: { 'User-Agent': USER_AGENT }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching search page`);
    }
    const html = await res.text();
    return html;
}

function parseCarsFromHtml(html) {
    // 1. Try React Query dehydrated state
    const matchDehydrated = html.match(/<script[^>]*>(eyJtdXR.*?)<\/script>/);
    if (matchDehydrated) {
        try {
            const jsonText = Buffer.from(matchDehydrated[1], 'base64').toString('utf8');
            const state = JSON.parse(jsonText);
            for (const q of state.queries || []) {
                if (q?.state?.data?.docs && Array.isArray(q.state.data.docs)) {
                    console.log(`Found ${q.state.data.docs.length} cars in dehydrated query state.`);
                    return q.state.data.docs;
                }
            }
        } catch (e) {
            console.warn('Could not parse dehydrated state:', e.message);
        }
    }

    // 2. Try seoStructuredData
    const matchSeo = html.match(/<script id="seoStructuredData"[^>]*>(.*?)<\/script>/s);
    if (matchSeo) {
        try {
            const seo = JSON.parse(matchSeo[1]);
            const list = seo.mainEntity?.itemListElement || [];
            console.log(`Found ${list.length} cars in seoStructuredData.`);
            return list.map(item => {
                const p = item.item;
                const idMatch = p.url?.match(/\/item\/(\d+)/);
                return {
                    id: idMatch ? idMatch[1] : String(Math.random()),
                    make: p.brand?.name || '',
                    model: p.model || '',
                    model_specification: p.description || '',
                    heading: p.name || '',
                    year: new Date().getFullYear(),
                    mileage: 0,
                    price: { amount: parseInt(p.offers?.price || '0', 10) },
                    transmission: 'Automatisk',
                    fuel: 'Bensin',
                    canonical_url: p.url,
                    image_urls: p.image ? [p.image] : []
                };
            });
        } catch (e) {
            console.warn('Could not parse seoStructuredData:', e.message);
        }
    }

    throw new Error('Could not extract car listing data from Blocket page.');
}

async function fetchItemDescription(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return '';
        const html = await res.text();
        const match = html.match(/<div[^>]*whitespace-pre-wrap[^>]*>(.*?)<\/div>/s);
        if (match) {
            return match[1].trim();
        }
    } catch (e) {
        console.warn(`Failed to fetch description for ${url}:`, e.message);
    }
    return '';
}

async function main() {
    const html = await fetchSearchPage();
    const rawDocs = parseCarsFromHtml(html);

    // CRITICAL SAFETY GUARD:
    // If fewer than 5 cars found, abort immediately to protect the website from bad scrapes!
    if (!rawDocs || rawDocs.length < 5) {
        console.error(`Safety Guard Triggered: only ${rawDocs?.length || 0} cars detected. Aborting without modifying files.`);
        process.exit(1);
    }

    console.log(`Total cars detected on Blocket: ${rawDocs.length}`);

    // Load existing files
    const existingLager = fs.readFileSync(LAGER_PATH, 'utf8');
    const existingDetails = fs.readFileSync(BIL_DETALJER_PATH, 'utf8');

    // Extract existing descriptions / entries to avoid refetching if already known
    const existingCarsMatch = existingDetails.match(/const cars = \{([\s\S]*?)\n        \};/);
    const existingEntriesMap = {};
    if (existingCarsMatch) {
        const regex = /'([a-z0-9\-]+)':\s*\{([\s\S]*?)\n            \}(,|$)/g;
        let m;
        while ((m = regex.exec(existingCarsMatch[1])) !== null) {
            existingEntriesMap[m[1]] = m[2];
        }
    }

    const cardsHtml = [];
    const jsEntries = [];

    for (const doc of rawDocs) {
        const blocketId = String(doc.id || doc.ad_id);
        let carId = KNOWN_ID_MAP[blocketId];
        if (!carId) {
            const makeSlug = slugify(doc.make || 'bil');
            const modelSlug = slugify(doc.model || '');
            carId = `${makeSlug}-${modelSlug}-${doc.year || '2020'}`;
        }

        const make = doc.make === 'Citroen' ? 'Citroën' : (doc.make || '');
        const brandAttr = doc.make || '';
        const priceNum = doc.price?.amount || 0;
        const priceFormatted = `${formatNumber(priceNum)} kr`;
        const milNum = doc.mileage || 0;
        const milFormatted = `${formatNumber(milNum)} mil`;
        const gear = doc.transmission || 'Automatisk';
        let fuel = doc.fuel || 'Bensin';
        if (fuel === 'Hybrid bensin') fuel = 'Hybrid';

        let cardTitle = `${make} ${doc.model || ''}`.trim();
        let cardSubtitle = doc.model_specification || '';
        let fullTitle = `${cardTitle} ${cardSubtitle}`.trim();

        // Local image if preserved, otherwise Blocket CDN image
        const cardImg = LOCAL_CAR_IMAGES[carId] || doc.image_urls?.[0] || doc.image?.url || '';

        // Card HTML
        cardsHtml.push(`            <!-- ${cardTitle} ${doc.year} -->
            <div class="car-card bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-white/5"
                data-aos="fade-up" data-aos-delay="25" data-brand="${brandAttr}" data-price="${priceNum}">
                <div class="h-80 overflow-hidden bg-zinc-800 flex items-center justify-center">
                    <img src="${cardImg}" alt="${cardTitle}" loading="lazy" class="w-full h-full object-contain">
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-bold text-white mb-2">${cardTitle} <span
                            class="text-base font-normal text-gray-400">${cardSubtitle}</span></h3>
                    <div class="flex flex-wrap gap-2 mb-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <span class="bg-zinc-800/50 border border-white/5 px-2.5 py-1.5 rounded-md text-red-500">Nyhet</span>
                        <span class="bg-zinc-800/50 border border-white/5 px-2.5 py-1.5 rounded-md">${doc.year}</span>
                        <span class="bg-zinc-800/50 border border-white/5 px-2.5 py-1.5 rounded-md">${milFormatted}</span>
                        <span class="bg-zinc-800/50 border border-white/5 px-2.5 py-1.5 rounded-md">${gear}</span>
                        <span class="bg-zinc-800/50 border border-white/5 px-2.5 py-1.5 rounded-md">${fuel}</span>
                    </div>
                    <div class="flex justify-between items-end">
                        <div>
                            <div class="text-2xl font-bold text-red-500">${priceFormatted}</div>
                        </div>
                    </div>
                    <hr class="my-4 border-zinc-700">
                    <a href="bil-detaljer.html?id=${carId}"
                        class="block text-center w-full py-3 bg-zinc-800 text-white font-bold rounded-lg hover:bg-zinc-700 transition">L&#228;s
                        mer</a>
                </div>
            </div>`);

        // JS Entry in bil-detaljer.html
        if (existingEntriesMap[carId]) {
            let entryContent = existingEntriesMap[carId];
            entryContent = entryContent.replace(/price:\s*'[^']+'/, `price: '${priceFormatted}'`);
            jsEntries.push(`            '${carId}': {${entryContent}\n            }`);
        } else {
            console.log(`New car detected: ${cardTitle} (${carId}). Fetching description...`);
            const descRaw = await fetchItemDescription(doc.canonical_url || `https://www.blocket.se/mobility/item/${blocketId}`);
            const descFormatted = cleanDescription(descRaw);
            const imagesJs = (doc.image_urls || [cardImg]).map(u => `                    '${u}'`).join(',\n');

            jsEntries.push(`            '${carId}': {
                title: '${fullTitle.replace(/'/g, "\\'")}',
                price: '${priceFormatted}',
                fuel: '${fuel}',
                gearbox: '${gear}',
                year: '${doc.year}',
                mileage: '${milFormatted}',
                images: [
${imagesJs}
                ],
                description: '${descFormatted}'
            }`);
        }
    }

    // Replace only grid in lager.html
    const newGridHtml = `<div id="car-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">\n${cardsHtml.join('\n\n')}\n        </div>`;
    const updatedLager = existingLager.replace(/<div id="car-grid"[^>]*>[\s\S]*?<\/div>\s*(?=\s*<\/div>\s*<\/section>)/, newGridHtml);

    // Replace only cars object in bil-detaljer.html
    const newCarsJs = `        const cars = {\n${jsEntries.join(',\n\n')}\n        };`;
    const updatedDetails = existingDetails.replace(/        const cars = \{[\s\S]*?\n        \};/, newCarsJs);

    let changed = false;
    if (updatedLager !== existingLager) {
        fs.writeFileSync(LAGER_PATH, updatedLager, 'utf8');
        console.log('✅ lager.html updated.');
        changed = true;
    }

    if (updatedDetails !== existingDetails) {
        fs.writeFileSync(BIL_DETALJER_PATH, updatedDetails, 'utf8');
        console.log('✅ bil-detaljer.html updated.');
        changed = true;
    }

    if (!changed) {
        console.log('✨ Inventory is already fully up-to-date. No files changed.');
    } else {
        console.log('🎉 Inventory sync completed successfully.');
    }
}

main().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});
