// --- VERSION & DEBUGGER ---
(function() {
    const version = "v5.2-FINAL";
    const time = new Date().toLocaleTimeString();
    console.log(`%c🚀 [Quest Roulette] ${version} loaded at ${time}`, "color: #0f766e; font-weight: bold;");
})();

const spinBtn = document.getElementById('spinBtn');
const resultArea = document.getElementById('result-area');
const spinner = document.getElementById('spinner');
const contentArea = document.getElementById('content-area');
const feedbackModal = document.getElementById('feedbackModal');
const toast = document.getElementById('toast');

let globalActivities = []; 
let currentResultData = null; 
let startTime = Date.now();

// --- DARK MODE LOGIC ---
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

function applyTheme(isDark) {
    if (isDark) {
        htmlElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        htmlElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    applyTheme(true);
} else {
    applyTheme(false);
}

if(themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isDark = htmlElement.classList.contains('dark');
        applyTheme(!isDark);
    });
}

// --- INITIALIZATION ---
async function init() {
    if (!window.supabaseClient && Date.now() - startTime > 10000) {
        showToast("Connection failed. Refresh.", "error");
        return;
    }

    if (!window.supabaseClient) {
        setTimeout(init, 500);
        return;
    }

    if(resultArea) resultArea.classList.add('hidden');
    if(spinner) spinner.classList.add('hidden');
    if(contentArea) contentArea.classList.add('hidden');

    console.log('🔄 Fetching activities...');
    try {
        const { data, error } = await window.supabaseClient
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching:', error);
            alert('Failed to load activities.');
            return;
        }

        // User feedback
globalActivities = data.map(row => {
    const jsonb = row.data || {};
    return {
        // Keep the table's BIGINT ID under a different name
        dbId: row.id,
        // Add all other fields from JSONB (including its own string 'id')
        ...jsonb,
        // Explicitly restore metadata fields
        presentation_count: row.presentation_count || 0,
        happy_count: row.happy_count || 0,
        unhappy_count: row.unhappy_count || 0,
        sponsored: row.sponsored || false,
        season: row.season || {}
    };
});

        console.log(`✅ Loaded ${globalActivities.length} activities.`);
        if (globalActivities.length === 0) {
            alert('⚠️ No activities found.');
        }

    } catch (err) {
        console.error('❌ Critical Error:', err);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}

// --- FILTER LOGIC ---
function startSpin() {
    if (!spinBtn || globalActivities.length === 0) {
        alert('No data loaded.');
        return;
    }

    if(contentArea) contentArea.classList.add('hidden');
    if(resultArea) resultArea.classList.remove('hidden');
    
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
        spinBtn.innerHTML = '<span class="animate-pulse">🧭 Exploring...</span>';
    }

    // Get Filters
    const priceVal = document.getElementById('price')?.value || 'all';
    const hideSeasonal = document.getElementById('hideSeasonal')?.checked || false;
    
    const userFilters = {
        price: priceVal,
        distance: document.getElementById('distance')?.value || 'all',
        style: document.getElementById('style')?.value || 'all',
        weather: document.getElementById('weather')?.value || 'all',
        duration: document.getElementById('duration')?.value || 'all',
        level: document.getElementById('level')?.value || 'all',
        locType: document.getElementById('locationType')?.value || 'all',
        hideSeasonal: hideSeasonal
    };

    // Smart Match Relax Order
    const relaxOrder = [
        { key: 'weather', label: 'Weather' },
        { key: 'locType', label: 'Setting' },
        { key: 'level', label: 'Intensity' },
        { key: 'duration', label: 'Duration' },
        { key: 'style', label: 'Style' },
        { key: 'distance', label: 'Distance' },
        { key: 'price', label: 'Price' }
    ];

    let matchedActivities = [];
    let relaxedFilters = [];

    function tryMatch(attempt = 1) {
        let currentFilters = { ...userFilters };
        
        // Apply relaxed filters
        relaxedFilters.forEach(relaxedKey => {
            if (relaxedKey === 'weather') currentFilters.weather = 'all';
            else if (relaxedKey === 'locType') currentFilters.locType = 'all';
            else if (relaxedKey === 'level') currentFilters.level = 'all';
            else if (relaxedKey === 'duration') currentFilters.duration = 'all';
            else if (relaxedKey === 'style') currentFilters.style = 'all';
            else if (relaxedKey === 'distance') currentFilters.distance = 'all';
            else if (relaxedKey === 'price') currentFilters.price = 'all';
        });

        // Filter Activities
        matchedActivities = globalActivities.filter((act) => {
            if (!act.title) return false;

            // 1. Seasonal Check
            if (currentFilters.hideSeasonal && act.season) {
                const currentMonthKey = getShortMonthName(new Date().getMonth()); 
                if (act.season[currentMonthKey] !== 'Y') return false;
            }

            let passes = true;

            // 2. Price Logic ($ includes Free)
            if (currentFilters.price !== 'all') {
                if (currentFilters.price === '$') {
                    if (act.price !== '$' && act.price !== 'Free' && act.price !== 'free') passes = false;
                } else {
                    if (act.price !== currentFilters.price) passes = false;
                }
            }

            // 3. Distance (Direct match now that DB is updated)
            if (currentFilters.distance !== 'all' && act.distance !== currentFilters.distance) passes = false;

            // 4. Style
            if (currentFilters.style !== 'all') {
                if (currentFilters.style === 'kidFriendly' && !act.kidsFriendly) passes = false;
                if (currentFilters.style === 'romantic' && !act.romantic) passes = false;
            }

            // 5. Weather
            if (currentFilters.weather !== 'all') {
                if (!act.weatherSuitable || !act.weatherSuitable.includes(currentFilters.weather)) passes = false;
            }

            // 6. Duration (Direct match now that DB is updated)
            if (currentFilters.duration !== 'all' && act.duration !== currentFilters.duration) passes = false;

            // 7. Level
            if (currentFilters.level !== 'all' && act.activityLevel !== currentFilters.level) passes = false;
            
            // 8. Loc Type
            if (currentFilters.locType !== 'all' && act.locationType !== currentFilters.locType) passes = false;

            return passes;
        });

        if (matchedActivities.length > 0 || relaxedFilters.length >= relaxOrder.length) {
            finishSpin(matchedActivities, relaxedFilters, relaxOrder);
        } else {
            const nextRelax = relaxOrder[relaxedFilters.length];
            relaxedFilters.push(nextRelax.key);
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
        resetSpinButton();
    } else {
        const selected = matches[Math.floor(Math.random() * matches.length)];
        currentResultData = selected; 
        
        // Only show filters that were ACTUALLY relaxed (not "Any")
        const actualRelaxed = relaxedKeys.filter(key => {
            let userKey = key;
            if (key === 'level') userKey = 'level';
            if (key === 'locType') userKey = 'locationType';
            
            const originalVal = document.getElementById(userKey)?.value;
            return originalVal !== 'all';
        });

        const labels = actualRelaxed.map(k => {
            const r = orderList.find(x => x.key === k); 
            return r ? r.label : k;
        });

        renderResult(selected, labels);
    }

    resetSpinButton();
}

function resetSpinButton() {
    if(spinBtn) {
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<span class="text-2xl mr-2">🎲</span> Spin Again!';
    }
}

// --- RENDER FUNCTIONS ---
function renderResult(data, relaxedLabels) {
    if(!contentArea) return;

    let noteHtml = '';
    if(relaxedLabels.length > 0) {
        noteHtml = `
            <div class="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 p-4 mb-6 rounded-r-md shadow-sm">
                <strong class="font-bold">✨ Smart Match!</strong>
                <p class="text-sm">Relaxed: ${relaxedLabels.join(', ')}</p>
            </div>
        `;
    }

    const detailsHtml = data.details && Array.isArray(data.details) && data.details.length > 0 
        ? data.details.map(d => `<li class="ml-4 list-disc">${d}</li>`).join('') 
        : '<li class="text-slate-500 italic">No specific details available.</li>';

    const sponsorBadge = data.sponsored 
        ? `<span class="absolute top-4 right-16 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">⭐ Sponsored</span>` 
        : '';

    // Rating Overlays (Top Right of Image) - Neutral Background
    const ratingOverlay = `
        <div class="rating-overlay">
            <button onclick="handleRating('happy')" class="group relative">
                <div class="w-10 h-10 rounded-full bg-white/90 dark:bg-white/80 text-green-600 flex items-center justify-center text-2xl hover:scale-110 transition-transform shadow-md border border-gray-200 dark:border-gray-300">😊</div>
            </button>
            <button onclick="handleRating('unhappy')" class="group relative">
                <div class="w-10 h-10 rounded-full bg-white/90 dark:bg-white/80 text-red-600 flex items-center justify-center text-2xl hover:scale-110 transition-transform shadow-md border border-gray-200 dark:border-gray-300">😕</div>
            </button>
        </div>
    `;

    // Edit Button (Below Image)
    const editBtn = `
        <button onclick="openFeedbackModal()" class="w-full mt-4 py-2 bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-slate-600 transition-colors font-medium text-sm">
            ✏️ Suggest an Edit
        </button>
    `;

    contentArea.innerHTML = `
        ${noteHtml}
        
        <!-- Full Width Image -->
        <div class="relative w-full h-64 md:h-80 rounded-lg overflow-hidden shadow-lg mb-0">
            ${sponsorBadge}
            ${ratingOverlay}
            <img src="${data.image}" alt="${data.title}" class="w-full h-full object-cover">
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 text-white">
                <h2 class="text-3xl font-bold drop-shadow-md">${data.title}</h2>
            </div>
        </div>

        <!-- Content Padding starts here -->
        <div class="p-6 space-y-4">
            <p class="text-lg text-slate-700 dark:text-slate-300 leading-relaxed bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-slate-100 dark:border-slate-700">${data.description}</p>
            
            <div class="flex flex-wrap gap-2 justify-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">💰 ${mapPrice(data.price)}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">📍 ${mapDistance(data.distance)}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">⏱️ ${mapDuration(data.duration)}</span>
                ${data.kidsFriendly ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200">👨‍👩‍👧‍👦 Kid Friendly</span>' : ''}
                ${data.romantic ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">❤️ Romantic</span>' : ''}
            </div>

            <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-inner border border-slate-100 dark:border-slate-700 mt-4">
                <h3 class="font-bold text-slate-800 dark:text-white mb-3 text-lg flex items-center">
                    <svg class="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    Key Details
                </h3>
                <ul class="space-y-2 text-slate-600 dark:text-slate-300 pl-4">${detailsHtml}</ul>
            </div>
            
            ${editBtn}
        </div>
    `;

    contentArea.classList.remove('hidden');
    contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- HELPERS FOR DISPLAY MAPPING ---
function mapDistance(val) {
    return val || '-';
}

function mapDuration(val) {
    return val || '-';
}

function mapPrice(val) {
    if (val === '$') return 'Budget/Free';
    if (val === '$$') return 'Moderate';
    if (val === '$$$') return 'Luxury';
    return 'Any';
}

function renderNoMatch() {
    if(!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="text-center py-12 px-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
            <div class="text-6xl mb-4">🗺️</div>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">No Matches Found</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">Even after relaxing all filters, no adventures match your criteria.</p>
            <button onclick="location.reload()" class="bg-brand hover:bg-teal-800 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md">Refresh Page</button>
        </div>
    `;
    
    contentArea.classList.remove('hidden');
}

// --- INTERACTION HANDLERS ---
function handleRating(type) {
    if(!currentResultData) return;
    
    const key = `rating_${currentResultData.dbId}_${Date.now()}`;
    localStorage.setItem(key, type);
    
    if (type === 'happy') {
        showToast("We like this one too!", "success");
    } else {
        showToast("Not your vibe? Spin again!", "info");
    }
}

function openFeedbackModal() {
    if(!currentResultData) return;
    document.getElementById('feedbackTitle').innerText = `Suggest Edit: ${currentResultData.title}`;
    document.getElementById('feedbackText').value = '';
    document.getElementById('feedbackEmail').value = '';
    feedbackModal.classList.remove('hidden');
    feedbackModal.classList.add('flex');
}

function closeFeedbackModal() {
    feedbackModal.classList.add('hidden');
    feedbackModal.classList.remove('flex');
}

document.getElementById('submitFeedbackBtn').addEventListener('click', async () => {
    const text = document.getElementById('feedbackText').value.trim();
    const emailInput = document.getElementById('feedbackEmail');
    const email = emailInput.value.trim();
    
    if (!text) {
        showToast("Please enter some feedback.", "error");
        return;
    }

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("Invalid email format.", "error");
            return;
        }
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('feedback_suggestions')
            .insert([
                {
                    activity_id: currentResultData.dbId,
                    feedback_text: text,
                    user_email: email || null,
                    status: 'pending'
                }
            ])
            .select();

        if (error) throw error;

        showToast("Feedback submitted successfully!", "success");
        closeFeedbackModal();

    } catch (err) {
        console.error("Error submitting feedback:", err);
        // Check if it's the same permission error
        if (err.code === '42501' || err.message.includes('permission denied')) {
             showToast("Permission error. Check SQL policies.", "error");
        } else {
             showToast("Failed to submit. Try again.", "error");
        }
    }
});

// --- UTILS ---
function resetFilters() {
    document.getElementById('price').value = 'all';
    document.getElementById('level').value = 'all';
    document.getElementById('style').value = 'all';
    document.getElementById('distance').value = 'all';
    document.getElementById('duration').value = 'all';
    document.getElementById('weather').value = 'all';
    document.getElementById('locationType').value = 'all';
    document.getElementById('hideSeasonal').checked = false;
    showToast("Filters reset.", "info");
}

function getShortMonthName(monthIndex) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return months[monthIndex];
}

function showToast(message, type = 'info') {
    toast.innerText = message;
    toast.className = `fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-xl transform transition-all duration-300 z-50 font-medium text-sm flex items-center gap-2`;
    
    if (type === 'success') {
        toast.classList.add('bg-green-600', 'text-white');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600', 'text-white');
    } else {
        toast.classList.add('bg-slate-800', 'text-white');
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

window.startSpin = startSpin;
window.handleRating = handleRating;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.resetFilters = resetFilters;
