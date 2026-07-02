// --- VERSION & DEBUGGER ---
(function() {
    const version = "v5.4-FNQ-FINAL";
    const time = new Date().toLocaleTimeString();
    console.log(`%c🌴 [See and Do FNQ] ${version} loaded at ${time}`, "color: #0f766e; font-weight: bold;");
})();

const spinBtn = document.getElementById('spinBtn');
const resultArea = document.getElementById('result-area');
const loadingOverlay = document.getElementById('loadingOverlay');
const contentArea = document.getElementById('content-area');
const feedbackModal = document.getElementById('feedbackModal');
const toast = document.getElementById('toast');

let globalActivities = []; 
let currentResultData = null; 
let startTime = Date.now();

// FALLING LEAVES ANIMATION FUNCTIONS
function createLeaf() {
  const leaves = ['🍂', '🍁', '🍃'];
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.textContent = leaves[Math.floor(Math.random() * leaves.length)];
  
  const startX = Math.random() * 100;
  const delay = Math.random() * 2;
  const duration = 1.5 + Math.random() * 2; // Faster for 2-second animation
  const size = 0.8 + Math.random() * 0.7;
  
  leaf.style.left = `${startX}%`;
  leaf.style.animationDuration = `${duration}s`;
  leaf.style.animationDelay = `${delay}s`;
  leaf.style.fontSize = `${size}rem`;
  leaf.style.opacity = 0;
  
  return leaf;
}

let leafInterval = null;
let activeLeaves = [];
let loadingTimeout = null;

function initFallingLeaves(containerId, maxLeaves = 12) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear any previous interval
  if (leafInterval) clearInterval(leafInterval);
  activeLeaves = [];
  
  function addNewLeaf() {
    if (activeLeaves.length >= maxLeaves) {
      const oldLeaf = activeLeaves.shift();
      if (oldLeaf && oldLeaf.parentNode) {
        oldLeaf.parentNode.removeChild(oldLeaf);
      }
    }
    
    const leaf = createLeaf();
    container.appendChild(leaf);
    activeLeaves.push(leaf);
  }
  
  let currentLeaves = [...activeLeaves];
  
  // Initial batch
  for (let i = 0; i < maxLeaves / 2; i++) {
    setTimeout(addNewLeaf, i * 300);
  }
  
  // Continuous spawning (but stops after 2 seconds)
  leafInterval = setInterval(() => {
    if (document.getElementById(containerId)) {
      addNewLeaf();
    }
  }, 400);
}

function stopFallingLeaves() {
  if (leafInterval) {
    clearInterval(leafInterval);
    leafInterval = null;
  }
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  const container = document.getElementById('fallingLeaves');
  if (container) {
    container.innerHTML = '';
    activeLeaves = [];
  }
}

function setLoading(isLoading) {
  if (!loadingOverlay) return;
  
  if (isLoading) {
    loadingOverlay.classList.remove('hidden');
    initFallingLeaves('fallingLeaves');
    // Auto-stop after 2 seconds
    loadingTimeout = setTimeout(() => {
      stopFallingLeaves();
    }, 2000);
  } else {
    stopFallingLeaves();
    loadingOverlay.classList.add('hidden');
  }
}

// -- END OF LEAVES --

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

    // SHOW LOADING OVERLAY WITH LEAVES
    setLoading(true);

    if(spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<span class="text-2xl mr-2">🧭</span> Finding adventure...';
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
        setTimeout(() => {
            tryMatch(1);
        }, 600);

    }, 100);
}

function finishSpin(matches, relaxedKeys, orderList) {
    // HIDE LOADING OVERLAY (already stopped by timer, just hide overlay)
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
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
        spinBtn.innerHTML = '<span class="text-2xl mr-2">🧭</span> Explore again';
    }
}

// --- RENDER FUNCTIONS ---
function renderResult(data, relaxedLabels) {
    if(!contentArea) return;

    let noteHtml = '';
    if(relaxedLabels.length > 0) {
        noteHtml = `
            <div class="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 p-4 mb-6 rounded-r-md shadow-sm">
                <strong class="font-bold">
