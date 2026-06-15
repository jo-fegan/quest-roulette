// admin.js - Self-Contained Secure Dashboard

const SUPABASE_URL = 'https://gvknesxtslnflmftboyb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhyzgEKeQ6Bip8RgO8M1zQ_CPs0A2gY';

// Helper: Flatten activity data
function flattenActivity(dbRow) {
    return {
        dbId: dbRow.id,
        ...dbRow.data, 
        kidsFriendly: typeof dbRow.data.kidsFriendly === 'boolean' ? dbRow.data.kidsFriendly : (dbRow.data.kidsFriendly === 'true'),
        romantic: typeof dbRow.data.romantic === 'boolean' ? dbRow.data.romantic : (dbRow.data.romantic === 'true'),
        accessibility: typeof dbRow.data.accessibility === 'boolean' ? dbRow.data.accessibility : (dbRow.data.accessibility === 'true'),
        bookingRequired: typeof dbRow.data.bookingRequired === 'boolean' ? dbRow.data.bookingRequired : (dbRow.data.bookingRequired === 'true')
    };
}

// --- EXPOSED GLOBAL FUNCTIONS ---

window.fetchAllActivities = async () => {
    const { data, error } = await window.supabase.from('activities').select('*');
    if (error) throw error;
    return data.map(flattenActivity);
};

window.updateActivity = async (id, updates) => {
    const { data: current, error: fetchError } = await window.supabase.from('activities').select('data').eq('id', id).single();
    if (fetchError) throw fetchError;
    const newData = { ...current.data, ...updates };
    const { error } = await window.supabase.from('activities').update({ data: newData }).eq('id', id);
    if (error) throw error;
};

window.deleteActivity = async (id) => {
    const { error } = await window.supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
};

window.bulkUpdateActivityIds = async (ids, field, value) => {
    for (const id of ids) {
        await window.updateActivity(id, { [field]: value });
    }
};

window.checkAuth = async () => {
    const { data: { session }, error } = await window.supabase.auth.getSession();
    if (!session) {
        console.log("No session found. Redirecting to login.");
        // Ensure path is relative to /admin/ directory
        window.location.href = '../login.html'; 
        return false;
    }
    console.log("✓ Authenticated as:", session.user.email);
    return true;
};

window.logout = async () => {
    await window.supabase.auth.signOut();
    window.location.href = '../login.html';
};

// --- DASHBOARD LOGIC (Defined Here to avoid Scope Issues) ---

let allActivities = [];
let selectedIds = new Set();

// This function is defined here so it exists when we call it
window.refreshData = async () => {
    try {
        console.log("Fetching activities...");
        allActivities = await window.fetchAllActivities();
        console.log(`Loaded ${allActivities.length} activities.`);
        
        // Trigger render if the table element exists
        if (typeof renderTable === 'function') {
            renderTable();
        } else {
            console.error("renderTable function not found on window. Check dashboard.html.");
        }
    } catch (err) {
        console.error("Error loading data:", err);
        alert("Failed to load data: " + err.message);
    }
};

// Main Initialization Sequence
async function initDashboard() {
    console.log("Admin.js starting initialization...");

    // 1. Wait for Supabase Client
    if (!window.supabase) {
        console.error("CRITICAL: window.supabase is missing. Check dashboard.html module script.");
        alert("System Error: Database connection failed.");
        return;
    }

    // 2. Check Authentication (Redirects if fails)
    const isAuthenticated = await window.checkAuth();
    if (!isAuthenticated) return; 

    // 3. Auth passed! Load Data
    console.log("Auth passed. Loading data...");
    await window.refreshData();
    
    console.log("Dashboard Ready.");
}

// START THE APP
console.log("Admin.js loaded. Running initDashboard...");
initDashboard();
