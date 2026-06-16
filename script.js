// --- VERSION & DEBUGGER ---
(function() {
    const version = "v4.0-ENHANCED";
    const time = new Date().toLocaleTimeString();
    console.log(`%c🚀 [Quest Roulette] ${version} loaded at ${time}`, "color: #6c5ce7; font-weight: bold;");
})();

const spinBtn = document.getElementById('spinBtn');
const resultArea = document.getElementById('result-area');
const spinner = document.getElementById('spinner');
const contentArea = document.getElementById('content-area');
const feedbackModal = document.getElementById('feedbackModal');
const toast = document.getElementById('toast');

let globalActivities = []; 
let currentResultData = null; // Store current activity for feedback/rating
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

// Initialize Theme
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
        showToast("Error: Could not connect to database.", "error");
        return;
    }

    if (!window.supabaseClient) {
        setTimeout(init, 500);
        return;
    }

    if(resultArea) resultArea.classList.add('hidden');
    if(spinner) spinner.classList.add('hidden');
    if(contentArea) contentArea.classList.add('hidden');

    console.log('🔄 Fetching activities from Supabase...');
    try {
        const { data, error } = await window.supabaseClient
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching activities:', error);
            alert('Failed to load activities.');
            return;
        }

        // Map Supabase JSONB 'data' column + top-level fields
        globalActivities = data.map(row => {
            const base = {
                id: row.id,
                presentation_count: row.presentation_count || 0,
                happy_count: row.happy_count || 0,
                unhappy_count: row.unhappy_count || 0,
                sponsored: row.sponsored || false, // Safe check for new column
                season: row.season || {}
            };
            return { ...base, ...(row.data || {}) };
        });

        console.log(`✅ Loaded ${globalActivities.length} activities.`);
        if (globalActivities.length === 0) {
            alert('⚠️ No activities found. Please add data to the database.');
        }

    } catch (err) {
        console.error('❌ Critical Fetch Error:', err);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}

// --- FILTER LOGIC ---
function startSpin() {
    if (!spinBtn) return;
    if (globalActivities.length === 0) {
        alert('No data loaded yet.');
        return;
    }

    // Reset UI
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
        spinBtn.innerText = 'Spinning...';
    }

    // Get Filters
    const priceVal = document.getElementById('price')?.value || 'all';
    const hideSeasonal = document.getElementById('hideSeasonal')?.checked || false;
    
    const userFilters = {
        price: priceVal,
        distance: document.getElementById('distance')?.value || 'all',
        style: document.getElementById('style')?.value || 'all', // Consolidated
        weather: document.getElementById('weather')?.value || 'all',
        duration: document.getElementById('duration')?.value || 'all',
        level: document.getElementById('level')?.value || 'all',
        locType: document.getElementById('locationType')?.value || 'all',
        hideSeasonal: hideSeasonal
    };

    // Smart Match Relax Order (Consistent with new filter order)
    const relaxOrder = [
        { key: 'weather', label: 'Weather Suitability' },
        { key: 'locType', label: 'Location Type' },
        { key: 'level', label: 'Activity Intensity' },
        { key: 'duration', label: 'Duration' },
        { key: 'style', label: 'Activity Style' },
        { key: 'distance', label: 'Driving Distance' },
        { key: 'price', label: 'Budget Range' }
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
            // Basic Safety
            if (!act.title) return false;

            // 1. Seasonal Check
            if (currentFilters.hideSeasonal && act.season) {
                const currentMonthKey = getShortMonthName(new Date().getMonth()); // e.g., 'jan'
                const isAvailable = act.season[currentMonthKey] === 'Y';
                if (!isAvailable) return false;
            }

            let passes = true;

            // 2. Price Logic ($ includes Free)
            if (currentFilters.price !== 'all') {
                if (currentFilters.price === '$') {
                    // Accept $ or 'Free'
                    if (act.price !== '$' && act.price !== 'Free' && act.price !== 'free') passes = false;
                } else {
                    if (act.price !== currentFilters.price) passes = false;
                }
            }

            // 3. Distance
            if (currentFilters.distance !== 'all' && act.distance !== currentFilters.distance) passes = false;

            // 4. Style (Kids/Adults Logic)
            if (currentFilters.style !== 'all') {
                if (currentFilters.style === 'kidFriendly') {
                    if (!act.kidsFriendly) passes = false;
                } else if (currentFilters.style === 'romantic') {
                    if (!act.romantic) passes = false;
                }
            }

            // 5. Weather
            if (currentFilters.weather !== 'all') {
                if (!act.weatherSuitable || !act.weatherSuitable.includes(currentFilters.weather)) passes = false;
            }

            // 6. Duration
            if (currentFilters.duration !== 'all' && act.duration !== currentFilters.duration) passes = false;

            // 7. Level
            if (currentFilters.level !== 'all' && act.activityLevel !== currentFilters.level) passes = false;
            
            // 8. Location Type
            if (currentFilters.locType !== 'all') {
                if (act.locationType !== currentFilters.locType) passes = false;
            }

            return passes;
        });

        console.log(`📊 Attempt ${attempt}: ${matchedActivities.length} matches found (Relaxed: ${relaxedFilters.length})`);

        if (matchedActivities.length > 0 || relaxedFilters.length >= relaxOrder.length) {
            finishSpin(matchedActivities, relaxedFilters, relaxOrder);
        } else {
            const nextRelax = relaxOrder[relaxedFilters.length];
            relaxedFilters.push(nextRelax.key);
            // console.log(`🔻 Relaxed: ${nextRelax.label}`);
            setTimeout(() => tryMatch(attempt + 1), 600);
        }
    }

    // Trigger Wheel Animation
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
        currentResultData = selected; // Store for interactions
        
        const labels = relaxedKeys.map(k => {
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
        spinBtn.innerText = '🎲 SPIN AGAIN!';
    }
}

// --- RENDER FUNCTIONS ---
function renderResult(data, relaxedLabels) {
    if(!contentArea) return;

    // Session Tracking (Option A)
    const sessionKey = `session_${Date.now()}`;
    let sessionStats = JSON.parse(localStorage.getItem('quest_stats_' + sessionKey) || '{}');
    
    // Increment presentation count locally for this session
    sessionStats[data.title] = (sessionStats[data.title] || 0) + 1;
    localStorage.setItem('quest_stats_' + sessionKey, JSON.stringify(sessionStats));

    let noteHtml = '';
    if(relaxedLabels.length > 0) {
        noteHtml = `
            <div class="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 mb-6 rounded-r-md shadow-sm">
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

    const detailsHtml = data.details && Array.isArray(data.details) && data.details.length > 0 
        ? data.details.map(d => `<li class="ml-4 list-disc">${d}</li>`).join('') 
        : '<li class="text-slate-500 italic">No specific details available.</li>';

    // Sponsored Star
    const sponsorBadge = data.sponsored 
        ? `<span class="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">⭐ Sponsored</span>` 
        : '';

    // Rating Buttons (Local Session)
    const ratingHtml = `
        <div class="flex justify-center gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <span class="text-sm text-slate-500 mr-2 self-center">How did you like this?</span>
            <button onclick="handleRating('happy')" class="flex flex-col items-center group">
                <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">😊</div>
                <span class="text-xs text-slate-500 mt-1">Happy</span>
            </button>
            <button onclick="handleRating('unhappy')" class="flex flex-col items-center group">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">😕</div>
                <span class="text-xs text-slate-500 mt-1">Unhappy</span>
            </button>
            <button onclick="openFeedbackModal()" class="flex flex-col items-center ml-4 group">
                <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">✏️</div>
                <span class="text-xs text-slate-500 mt-1">Suggest Edit</span>
            </button>
        </div>
    `;

    // Handle Image Padding Issue: Remove outer padding of image container
    contentArea.innerHTML = `
        ${noteHtml}
        
        <!-- Full Width Image Section -->
        <div class="relative w-full h-64 md:h-80 rounded-xl overflow-hidden shadow-2xl mb-0">
            ${sponsorBadge}
            <img src="${data.image}" alt="${data.title}" class="w-full h-full object-cover">
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 text-white">
                <h2 class="text-3xl font-bold drop-shadow-md">${data.title}</h2>
            </div>
        </div>

        <!-- Content Padding starts here -->
        <div class="p-6 space-y-4">
            <p class="text-lg text-slate-700 dark:text-slate-300 leading-relaxed bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-slate-100 dark:border-slate-700">${data.description}</p>
            
            <div class="flex flex-wrap gap-2 justify-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">💰 ${data.price}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">📍 ${data.distance === 'near' ? '<25m' : data.distance}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">⏱️ ${data.duration}</span>
                ${data.kidsFriendly ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200">👨‍👩‍👧‍👦 Kid Friendly</span>' : ''}
                ${data.romantic ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">❤️ Romantic</span>' : ''}
            </div>

            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-inner border border-slate-100 dark:border-slate-700 mt-4">
                <h3 class="font-bold text-slate-800 dark:text-white mb-3 text-lg flex items-center">
                    <svg class="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    Key Details
                </h3>
                <ul class="space-y-2 text-slate-600 dark:text-slate-300 pl-4">${detailsHtml}</ul>
            </div>
            
            ${ratingHtml}
        </div>
    `;

    contentArea.classList.remove('hidden');
    contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderNoMatch() {
    if(!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">No Matches Found</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">Even after relaxing all filters, no activities match your criteria.</p>
            <p class="text-sm text-slate-500 mb-6">Try selecting "Any" for more results.</p>
            <button onclick="location.reload()" class="bg-brand hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md">Refresh Page</button>
        </div>
    `;
    
    contentArea.classList.remove('hidden');
}

// --- INTERACTION HANDLERS (OPTION A) ---
function handleRating(type) {
    if(!currentResultData) return;
    
    const key = `rating_${currentResultData.id}_${Date.now()}`;
    localStorage.setItem(key, type);
    
    // Update UI temporarily
    const icon = type === 'happy' ? '😊' : '😕';
    showToast(`You rated this ${icon}! Thanks for feedback.`, 'success');
    
    // Note: In Option A, we don't update the DB. The DB counters would remain static
    // until an admin script aggregates local storage data or a backend function is used.
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

    // Email Validation: Optional, but if present must be valid
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("Invalid email format.", "error");
            return;
        }
    }

    try {
        // Insert into feedback_suggestions
        const { data, error } = await window.supabaseClient
            .from('feedback_suggestions')
            .insert([
                {
                    activity_id: currentResultData.id,
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
        showToast("Failed to submit feedback. Try again.", "error");
    }
});

// --- UTILS ---
function getShortMonthName(monthIndex) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return months[monthIndex];
}

function showToast(message, type = 'info') {
    toast.innerText = message;
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl transform transition-all duration-300 z-50 font-medium`;
    
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
