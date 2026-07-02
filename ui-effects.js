// --- FALLING LEAVES ANIMATION ---
function createLeaf() {
  const leaves = ['🍂', '🍁', '🍃'];
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.textContent = leaves[Math.floor(Math.random() * leaves.length)];
  
  const startX = Math.random() * 100;
  const delay = Math.random() * 2;
  const duration = 1.5 + Math.random() * 2; // 2-3 second total animation
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
  
  for (let i = 0; i < maxLeaves / 2; i++) {
    setTimeout(addNewLeaf, i * 300);
  }
  
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
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  
  if (isLoading) {
    overlay.classList.remove('hidden');
    initFallingLeaves('fallingLeaves');
    loadingTimeout = setTimeout(() => {
      stopFallingLeaves();
      overlay.classList.add('hidden');
    }, 2000);
  } else {
    stopFallingLeaves();
    overlay.classList.add('hidden');
  }
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

// --- TOAST NOTIFICATIONS ---
const toastEl = document.getElementById('toast');

function showToast(message, type = 'info') {
    toastEl.innerText = message;
    toastEl.className = `fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-xl transform transition-all duration-300 z-50 font-medium text-sm flex items-center gap-2`;
    
    if (type === 'success') {
        toastEl.classList.add('bg-green-600', 'text-white');
    } else if (type === 'error') {
        toastEl.classList.add('bg-red-600', 'text-white');
    } else {
        toastEl.classList.add('bg-slate-800', 'text-white');
    }
    
    toastEl.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toastEl.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}