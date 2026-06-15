// --- VERSION & DEBUGGER ---
(function() {
    const version = "v3.0-SUPABASE-JSONB";
    const time = new Date().toLocaleTimeString();
    console.log(`%c🚀 [Quest Roulette] ${version} loaded at ${time}`, "color: #6c5ce7; font-weight: bold;");
})();

const spinBtn = document.getElementById('spinBtn');
const resultCard = document.getElementById('result-card');
const spinner = document.getElementById('spinner');
const contentArea = document.getElementById('content-area');
let globalActivities = []; // Cache for activities


// Initialization
async function init() {
    if(resultCard) resultCard.classList.add('hidden');
    if(spinner) spinner.classList.add('hidden');
    if(contentArea) contentArea.classList.add('hidden');

    // Check if Supabase client is ready
    if (!window.supabaseClient) {
        console.error("❌ Supabase client not found on window. Waiting...");
        // Retry once after a short delay
        setTimeout(init, 500);
        return;
    }

    // Fetch Data from Supabase
    console.log('🔄 Fetching activities from Supabase...');
    try {
        const { data, error } = await window.supabaseClient
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching activities:', error);
            alert('Failed to load activities. Check console.');
            return;
        }

        // Map Supabase JSONB 'data' column back to standard objects
        globalActivities = data.map(row => ({
            id: row.id,
            ...row.data // Spreads the JSONB content into the object
        }));

        console.log(`✅ Loaded ${globalActivities.length} activities from cloud.`);
        
        // Validation
        if (globalActivities.length === 0) {
            alert('⚠️ No activities found in database. Please add some via Supabase Console.');
        }

    } catch (err) {
        console.error('❌ Critical Fetch Error:', err);
    }
}

// Ensure DOM is ready before starting
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}


function startSpin() {
    if (!spinBtn) return;
    if (globalActivities.length === 0) {
        alert('No data loaded yet. Please wait...');
        return;
    }

    // Reset UI
    if(contentArea) contentArea.classList.add('hidden');
    if(resultCard) resultCard.classList.remove('hidden');
    
    if(spinner) {
        spinner.classList.remove('hidden');
        spinner.classList.add('flex');
        const wheelContainer = document.getElementById('wheel-svg-container');
        if(wheelContainer) {
            wheelContainer.style.transition = 'none';
            wheelContainer.style.transform = 'rotate(0deg)';
            void wheelContainer.offsetWidth; 
        }
    }
    const statusText = document.getElementById('spin-status');
    if(statusText) statusText.innerText = "Spinning...";

    if(spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerText = 'Spinning...';
    }

    // Get Filters
    const userFilters = {
        price: document.getElementById('price')?.value || 'all',
        distance: document.getElementById('distance')?.value || 'all',
        kids: document.getElementById('kids')?.value || 'all',
        romance: document.getElementById('romance')?.value || 'all',
        weather: document.getElementById('weather')?.value || 'all',
        duration: document.getElementById('duration')?.value || 'all',
        level: document.getElementById('level')?.value || 'all',
        locType: document.getElementById('locationType')?.value || 'all'
    };

    console.log('📊 Current Filters:', userFilters);

    const relaxOrder = [
        { key: 'weather', label: 'Weather Suitability' },
        { key: 'locType', label: 'Location Type' },
        { key: 'activityLevel', label: 'Activity Level' },
        { key: 'duration', label: 'Duration' },
        { key: 'romantic', label: 'Romantic Setting' },
        { key: 'kids', label: 'Kid Friendly Requirement' },
        { key: 'distance', label: 'Distance Preference' },
        { key: 'price', label: 'Budget Range' }
    ];

    let matchedActivities = [];
    let relaxedFilters = [];

    function tryMatch(attempt = 1) {
        let currentFilters = { ...userFilters };
        
        relaxedFilters.forEach(relaxedKey => {
            if (relaxedKey === 'weather') currentFilters.weather = 'all';
            else if (relaxedKey === 'locType') currentFilters.locType = 'either';
            else if (relaxedKey === 'activityLevel') currentFilters.level = 'all';
            else if (relaxedKey === 'duration') currentFilters.duration = 'all';
            else if (relaxedKey === 'romantic') currentFilters.romance = 'all';
            else if (relaxedKey === 'kids') currentFilters.kids = 'all';
            else if (relaxedKey === 'distance') currentFilters.distance = 'all';
            else if (relaxedKey === 'price') currentFilters.price = 'all';
        });

        console.log(`🔍 Attempt ${attempt}: Matching...`);

        // Filter Activities
        matchedActivities = globalActivities.filter((act) => {
            if (!act.title) return false;

            let passes = true;

            if (currentFilters.price !== 'all' && act.price !== currentFilters.price) passes = false;
            if (currentFilters.distance !== 'all' && act.distance !== currentFilters.distance) passes = false;
            if (currentFilters.kids === 'true' && !act.kidsFriendly) passes = false;
            if (currentFilters.kids === 'false' && act.kidsFriendly) passes = false;
            if (currentFilters.romance === 'true' && !act.romantic) passes = false;
            if (currentFilters.romance === 'false' && act.romantic) passes = false;
            if (currentFilters.weather !== 'all' && !act.weatherSuitable.includes(currentFilters.weather)) passes = false;
            if (currentFilters.duration !== 'all' && act.duration !== currentFilters.duration) passes = false;
            if (currentFilters.level !== 'all' && act.activityLevel !== currentFilters.level) passes = false;
            
            if (currentFilters.locType !== 'all' && currentFilters.locType !== 'either') {
                if (act.locationType !== currentFilters.locType) passes = false;
            }

            return passes;
        });

        console.log(`📊 Matched ${matchedActivities.length} activities`);

        if (matchedActivities.length > 0 || relaxedFilters.length >= relaxOrder.length) {
            finishSpin(matchedActivities, relaxedFilters, relaxOrder);
        } else {
            const nextRelax = relaxOrder[relaxedFilters.length];
            relaxedFilters.push(nextRelax.key);
            console.log(`🔻 Relaxed: ${nextRelax.label}`);
            setTimeout(() => tryMatch(attempt + 1), 600);
        }
    }

    setTimeout(() => {
        const wheelContainer = document.getElementById('wheel-svg-container');
        if(wheelContainer) {
            wheelContainer.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
            const randomDeg = Math.floor(1800 + Math.random() * 360);
            wheelContainer.style.transform = `rotate(${randomDeg}deg)`;
        }

        setTimeout(() => {
            if(statusText) statusText.classList.add('hidden');
            tryMatch(1);
        }, 3000);

    }, 100);
}

function finishSpin(matches, relaxedKeys, orderList) {
    if(spinner) {
        spinner.classList.add('hidden');
        spinner.classList.remove('flex');
    }
    
    if(!matches || matches.length === 0) {
        renderNoMatch();
    } else {
        const selected = matches[Math.floor(Math.random() * matches.length)];
        const labels = relaxedKeys.map(k => {
            const r = orderList.find(x => x.key === k); 
            return r ? r.label : k;
        });
        renderResult(selected, labels);
    }

    if(spinBtn) {
        spinBtn.disabled = false;
        spinBtn.innerText = '🎲 SPIN AGAIN!';
    }
}

function renderResult(data, relaxedLabels) {
    if(!contentArea) return;

    let noteHtml = '';
    if(relaxedLabels.length > 0) {
        noteHtml = `
            <div class="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-6 rounded-r-md shadow-sm">
                <div class="flex items-center">
                    <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <strong class="font-bold">✨ Smart Match!</strong>
                        <p class="text-sm">We relaxed: ${relaxedLabels.join(', ')}</p>
                    </div>
                </div>
            </div>
        `;
    }

    const detailsHtml = data.details && data.details.length > 0 
        ? data.details.map(d => `<li class="ml-2 list-disc">${d}</li>`).join('') 
        : '<li>No specific details available.</li>';

    contentArea.innerHTML = `
        ${noteHtml}
        
        <div class="relative w-full h-64 md:h-80 rounded-xl overflow-hidden shadow-2xl mb-6 group bg-slate-200">
            <img src="${data.image}" alt="${data.title}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 text-white">
                <h2 class="text-3xl font-bold drop-shadow-md">${data.title}</h2>
            </div>
        </div>

        <div class="space-y-4">
            <p class="text-lg text-slate-700 leading-relaxed bg-white/60 p-4 rounded-lg border border-slate-100">${data.description}</p>
            
            <div class="flex flex-wrap gap-2 justify-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">💰 ${data.price}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">📍 ${data.distance === 'near' ? '<25m' : data.distance}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">⏱️ ${data.duration}</span>
                ${data.kidsFriendly ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800">👨‍👩‍👧‍👦 Kid Friendly</span>' : ''}
                ${data.romantic ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">❤️ Romantic</span>' : ''}
            </div>

            <div class="bg-white p-6 rounded-xl shadow-inner border border-slate-100 mt-4">
                <h3 class="font-bold text-slate-800 mb-3 text-lg flex items-center">
                    <svg class="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    Key Details
                </h3>
                <ul class="space-y-2 text-slate-600">${detailsHtml}</ul>
            </div>
        </div>
    `;

    contentArea.classList.remove('hidden');
    contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderNoMatch() {
    if(!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-2xl font-bold text-slate-800 mb-2">No Matches Found</h3>
            <p class="text-slate-600 mb-4">Even after relaxing all filters, no activities match your criteria.</p>
            <p class="text-sm text-slate-500 mb-6">Try selecting "Any" for more results.</p>
            <button onclick="location.reload()" class="bg-brand hover:bg-brand-dark text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md">Refresh Page</button>
        </div>
    `;
    
    contentArea.classList.remove('hidden');
}

window.startSpin = startSpin;