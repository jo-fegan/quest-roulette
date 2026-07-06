// --- VERSION & DEBUGGER ---
(function() {
    const version = "v5.8-FNQ-DarkModeFix";
    const time = new Date().toLocaleTimeString();
    console.log(`%c🌴 [See and Do FNQ] ${version} loaded at ${time}`, "color: #0f766e; font-weight: bold;");
})();

// --- GLOBAL DATA ELEMENTS ---
const spinBtn = document.getElementById('spinBtn');
const resultArea = document.getElementById('result-area');
const contentArea = document.getElementById('content-area');
const feedbackModal = document.getElementById('feedbackModal');
const toast = document.getElementById('toast');
const globalFeedbackBtn = document.getElementById('global-feedback-btn');

let globalActivities = []; 
let currentResultData = null; 
let startTime = Date.now();

// --- FALLING LEAVES ANIMATION FUNCTIONS ---
let leafSpawnInterval = null;
let activeFallingLeaves = [];

function createFallingLeaf() {
  const leaves = ['🍂', '🍁', '🍃'];
  const leaf = document.createElement('span');
  leaf.className = 'falling-leaf';
  leaf.textContent = leaves[Math.floor(Math.random() * leaves.length)];
  
  // Random starting position across container
  const leftPosition = Math.random() * 100;
  const animationType = ['fallLeft', 'fallCenter', 'fallRight'][Math.floor(Math.random() * 3)];
  const duration = 2 + Math.random() * 2; // 2-4 seconds per leaf
  const delay = Math.random() * 1; // 0-1 second stagger
  const size = 1 + Math.random() * 1; // 1-2rem variation
  
  leaf.style.left = `${leftPosition}%`;
  leaf.style.top = '-20px';
  leaf.style.animation = `${animationType} ${duration}s linear ${delay}s`;
  leaf.style.fontSize = `${size}rem`;
  leaf.style.opacity = '0';
  
  return leaf;
}

function startFallingLeaves(containerId, maxLeaves = 15) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear any previous interval
  if (leafSpawnInterval) clearInterval(leafSpawnInterval);
  activeFallingLeaves = [];
  
  function addNewLeaf() {
    if (activeFallingLeaves.length >= maxLeaves) {
      // Remove oldest leaf
      const oldLeaf = activeFallingLeaves.shift();
      if (oldLeaf && oldLeaf.parentNode) {
        oldLeaf.parentNode.removeChild(oldLeaf);
      }
    }
    
    const leaf = createFallingLeaf();
    container.appendChild(leaf);
    activeFallingLeaves.push(leaf);
    
    // Clean up after animation completes
    setTimeout(() => {
      if (leaf.parentNode) {
        leaf.parentNode.removeChild(leaf);
        const idx = activeFallingLeaves.indexOf(leaf);
        if (idx > -1) activeFallingLeaves.splice(idx, 1);
      }
    }, 4000); // Slightly longer than max animation duration
  }
  
  // Initial batch
  for (let i = 0; i < maxLeaves / 2; i++) {
    setTimeout(addNewLeaf, i * 150);
  }
  
  // Continuous spawning
  leafSpawnInterval = setInterval(() => {
    addNewLeaf();
  }, 200);
}

function stopFallingLeaves(containerId) {
  if (leafSpawnInterval) {
    clearInterval(leafSpawnInterval);
    leafSpawnInterval = null;
  }
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
    activeFallingLeaves = [];
  }
}

// --- RENDER FUNCTIONS ---

// NEW: Render loading animation WITH FALLING LEAVES IN PHOTO CONTAINER
function renderLoading() {
    if(!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="relative w-full h-64 md:h-80 rounded-lg overflow-hidden shadow-lg mb-0 bg-gradient-to-br from-teal-50 via-white to-slate-50 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
            <div id="loading-text-container" class="text-center p-6 z-10">
                <p class="text-slate-600 dark:text-slate-300 font-medium text-base mb-4">Finding adventure...</p>
            </div>
            <!-- Falls leaves will spawn here -->
            <div id="falling-leaves-wrapper" class="loading-leaves-container absolute inset-0"></div>
        </div>
    `;
    
    contentArea.classList.remove('hidden');
    
    // Start falling leaves animation
    startFallingLeaves('falling-leaves-wrapper', 20);
}

// UPDATED: Original function handles results only (NO inline feedback button)
function renderResult(data, relaxedLabels) {
    if(!contentArea) return;

    // Stop any falling leaves first
    stopFallingLeaves('falling-leaves-wrapper');

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
        : '<li class="text-slate-500 dark:text-slate-400 italic">No specific details available.</li>';

    const sponsorBadge = data.sponsored 
        ? `<span class="absolute top-4 right-16 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">⭐ Sponsored</span>` 
        : '';

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

// Show activity tags
       contentArea.innerHTML = `
        ${noteHtml}
        
        <div class="relative w-full h-64 md:h-80 rounded-lg overflow-hidden shadow-lg mb-0">
            ${sponsorBadge}
            ${ratingOverlay}
            <img src="${data.image}" alt="${data.title}" class="w-full h-full object-cover">
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 text-white">
                <h2 class="text-3xl font-bold drop-shadow-md">${data.title}</h2>
            </div>
            <h2 class="text-3xl font-bold drop-shadow-md">${data.title}</h2>
<!-- Uncomment below when GPS data available -->
<!-- 
${data.latitude && data.longitude ? `
    <a href="https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}" 
       target="_blank" 
       rel="noopener noreferrer" 
       class="ml-2 inline-block align-middle">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4285F4" class="w-5 h-5 inline-block">
            <path d="M20.7 9.6c-.4-4.3-4-7.6-8.4-7.6C5.9 2 2 5.9 2 10.7c0 5.4 8.3 12 8.3 12s8.3-6.7 8.4-12c.2-.6.2-1 .1-1.1zM10.3 14c-1.8 0-3.3-1.5-3.3-3.3s1.5-3.3 3.3-3.3 3.3 1.5 3.3 3.3S12.1 14 10.3 14z"/>
        </svg>
    </a>
` : ''}
-->
        </div>

        <div class="pt-0 px-6 pb-6 space-y-4 mt-[-1rem]"> <!-- Reset top to above image -->
            <p class="text-lg leading-relaxed bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-600 p-6 rounded-lg shadow-inner border border-slate-100 dark:border-slate-700">${data.description}</p>


            <div class="flex flex-wrap gap-2 justify-center">
    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/50 text-teal-700 dark:text-teal-600">💰 ${mapPrice(data.price)}</span>
    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/50 text-teal-700 dark:text-teal-600">🚗 ${mapDistance(data.distance)}</span>
    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-teal-700 dark:text-teal-600">🏃 ${mapIntensity(data.activityLevel)}</span>
    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/50 text-teal-700 dark:text-teal-600">⏱️ ${mapDuration(data.duration)}</span>
</div>

            <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-inner border border-slate-100 dark:border-slate-700 mt-4">
                <h3 class="font-bold text-slate-800 dark:text-slate-100 mb-3 text-lg flex items-center">
                    <svg class="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    Key details
                </h3>
                <ul class="space-y-2 text-slate-600 dark:text-slate-300 pl-4">${detailsHtml}</ul>
            </div>
            
            <!-- NO FEEDBACK BUTTON HERE - IT'S IN HTML BELOW FILTERS -->
        </div>
    `;

contentArea.classList.remove('hidden');

requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        const pos = contentArea.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: pos, behavior: 'smooth' });
        contentArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
});

if(globalFeedbackBtn) {
    globalFeedbackBtn.disabled = false;
}

}

function mapDistance(val) {
    return val || '-';
}

function mapDuration(val) {
    return val || '-';
}

function mapPrice(val) {
    if (val === '$') return 'Budget/free';
    if (val === '$$') return 'Moderate';
    if (val === '$$$') return 'Luxury';
    return 'Any';
}

function mapIntensity(val) {
    if (val === 'relaxed') return 'Relaxed 😌';
    if (val === 'active') return 'Active 🏃';
    if (val === 'intense') return 'Intense 💪';
    return 'Any';
}

function renderNoMatch() {
    if(!contentArea) return;
    
    // Disable feedback button when no matches
    if(globalFeedbackBtn) globalFeedbackBtn.disabled = true;
    
    contentArea.innerHTML = `
        <div class="text-center py-12 px-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
            <div class="text-6xl mb-4">🗺️</div>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">No matches found</h3>
            <p class="text-slate-600 dark:text-slate-300 mb-4">Even after relaxing all filters, no adventures match your criteria.</p>
            <button onclick="location.reload()" class="bg-brand hover:bg-brandHover text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md">Refresh page</button>
        </div>
    `;
    
    contentArea.classList.remove('hidden');
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
    if(contentArea) contentArea.classList.add('hidden');

    // Disable feedback button initially
    if(globalFeedbackBtn) globalFeedbackBtn.disabled = true; 

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

        globalActivities = data.map(row => {
            const jsonb = row.data || {};
            return {
                dbId: row.id,
                ...jsonb,
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

    // Show loading with falling leaves in-place
    renderLoading();

    if(spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<span class="text-2xl mr-2">🧭</span> Finding adventure...';
    }

    // Disable feedback while finding
    if(globalFeedbackBtn) globalFeedbackBtn.disabled = true;

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
        
        relaxedFilters.forEach(relaxedKey => {
            if (relaxedKey === 'weather') currentFilters.weather = 'all';
            else if (relaxedKey === 'locType') currentFilters.locType = 'all';
            else if (relaxedKey === 'level') currentFilters.level = 'all';
            else if (relaxedKey === 'duration') currentFilters.duration = 'all';
            else if (relaxedKey === 'style') currentFilters.style = 'all';
            else if (relaxedKey === 'distance') currentFilters.distance = 'all';
            else if (relaxedKey === 'price') currentFilters.price = 'all';
            else if (relaxedKey === 'petFriendly') currentFilters.price = 'all';
        });

        matchedActivities = globalActivities.filter((act) => {
            if (!act.title) return false;

            if (currentFilters.hideSeasonal && act.season) {
                const currentMonthKey = getShortMonthName(new Date().getMonth()); 
                if (act.season[currentMonthKey] !== 'Y') return false;
            }

            let passes = true;

// Get selected prices from checkboxes (XOR handled in UI)
const selectedPrices = getSelectedPrices(); // Returns array like ['$'] or []

if (selectedPrices.length > 0) {
    const actPrice = act.price;
    if (actPrice === 'Free' || actPrice === 'free') {
        if (!selectedPrices.includes('$')) passes = false; // Budget checkbox means Free included
    } else if (!selectedPrices.includes(actPrice)) {
        passes = false;
    }
}

            if (currentFilters.distance !== 'all' && act.distance !== currentFilters.distance) passes = false;

            if (currentFilters.style !== 'all') {
                if (currentFilters.style === 'kidFriendly' && !act.kidsFriendly) passes = false;
                if (currentFilters.style === 'romantic' && !act.romantic) passes = false;
            }

            if (currentFilters.weather !== 'all') {
                if (!act.weatherSuitable || !act.weatherSuitable.includes(currentFilters.weather)) passes = false;
            }

            if (currentFilters.duration !== 'all' && act.duration !== currentFilters.duration) passes = false;

            if (currentFilters.level !== 'all' && act.activityLevel !== currentFilters.level) passes = false;
            
            if (currentFilters.locType !== 'all' && act.locationType !== currentFilters.locType) passes = false;

            // Pet friendly filter
if (document.getElementById('petFriendly')?.value !== 'all') {
    const petPreference = document.getElementById('petFriendly').value;
    const actPetFriendly = (data.petFriendly === 'true' || data.petFriendly === true);
    
    if (petPreference === 'yes' && !actPetFriendly) passes = false;
    if (petPreference === 'no' && actPetFriendly) passes = false;
}

            return passes;
        });

        if (matchedActivities.length > 0 || relaxedFilters.length >= relaxOrder.length) {
            finishSpin(matchedActivities, relaxedFilters, relaxOrder);
        } else {
            const nextRelax = relaxOrder[relaxedFilters.length];
            relaxedFilters.push(nextRelax.key);
            setTimeout(() => tryMatch(attempt + 1), 2000);
        }
    }

tryMatch(1);
}

function getSelectedPrices() {
    const checkboxes = document.querySelectorAll('[name="priceOpt"]:checked');
    const values = Array.from(checkboxes).map(cb => cb.value);
    
    // If "any" is selected OR no selections, return empty (meaning any price OK)
    if (values.includes('any') || values.length === 0) return [];
    
    return values;
}

function finishSpin(matches, relaxedKeys, orderList) {
    if(!matches || matches.length === 0) {
        renderNoMatch();
        resetSpinButton();
    } else {
        const selected = matches[Math.floor(Math.random() * matches.length)];
        currentResultData = selected; 
        
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
        spinBtn.innerHTML = '<span class="text-2xl mr-2">🧭</span> Explore again';
    }
}

function handleRating(type) {
    if(!currentResultData) return;
    
    const key = `rating_${currentResultData.dbId}_${Date.now()}`;
    localStorage.setItem(key, type);
    
    if (type === 'happy') {
        showToast("We like this one too!", "success");
    } else {
showToast("Not your vibe? Try the filters.", "info");
    }
}

function openFeedbackModal() {
    if(!currentResultData) return;
    document.getElementById('feedbackTitle').innerText = `Give feedback: ${currentResultData.title}`;
    document.getElementById('feedbackText').value = '';
    document.getElementById('feedbackEmail').value = '';
    const radioButtons = document.getElementsByName('feedbackType');
    if(radioButtons.length > 0) {
        radioButtons[0].checked = true;
    }
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
    const feedbackType = document.querySelector('input[name="feedbackType"]:checked')?.value || 'activity';
    
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
                    status: 'pending',
                    feedback_type: feedbackType
                }
            ])
            .select();

        if (error) throw error;

        showToast("Feedback submitted successfully!", "success");
        closeFeedbackModal();

    } catch (err) {
        console.error("Error submitting feedback:", err);
        if (err.code === '42501' || err.message.includes('permission denied')) {
             showToast("Permission error. Check SQL policies.", "error");
        } else {
             showToast("Failed to submit. Try again.", "error");
        }
    }
});

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

// Toast notification (uses dark mode aware styles)
function showToast(message, type = 'info') {
    toast.innerText = message;
    toast.className = `fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-xl transform transition-all duration-300 z-50 font-medium text-sm flex items-center gap-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900`;
    
    if (type === 'success') {
        toast.classList.add('bg-green-600', 'text-white');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600', 'text-white');
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

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

// Export functions globally
window.startSpin = startSpin;
window.handleRating = handleRating;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.resetFilters = resetFilters;
