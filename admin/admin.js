// admin.js - Robust Initialization for GitHub Pages

const SUPABASE_URL = 'https://gvknesxtslnflmftboyb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhyzgEKeQ6Bip8RgO8M1zQ_CPs0A2gY';

console.log("Starting Supabase initialization...");

let supabaseLib = null;

// 1. Check for the library in both possible global variable names
if (typeof Supabase !== 'undefined') {
    console.log("Found global 'Supabase' (Uppercase).");
    supabaseLib = Supabase;
} else if (typeof supabase !== 'undefined') {
    console.log("Found global 'supabase' (Lowercase).");
    supabaseLib = supabase;
} else {
    // Debug: Log what IS available globally
    console.error("Available globals starting with 'sup':", Object.keys(window).filter(k => k.toLowerCase().includes('sup')));
    console.error("Supabase library NOT found globally. Check CDN script tag in dashboard.html.");
    throw new Error("Supabase library not found");
}

// 2. Create the client using the found library
try {
    window.supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase Client Created Successfully!");
    console.log("Auth object available:", !!window.supabase.auth);
    
    // Sanity check
    if (!window.supabase.auth) {
        throw new Error("Client created but auth object missing!");
    }
} catch (err) {
    console.error("Error creating client:", err);
    alert("Critical Error: Could not initialize Supabase. Check console.");
    throw err;
}

console.log("Final Client Status:", !!window.supabase.auth);
console.log("Supabase Client Initialized: true");// ... Rest of your functions (flattenActivity, fetchAllActivities, etc.) remain exactly the same ...// ... Rest of your functions (flattenActivity, fetchAllActivities, etc.) remain exactly the same ...

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

window.fetchAllActivities = async () => {
    try {
        const { data, error } = await window.supabase.from('activities').select('*');
        if (error) throw error;
        return data.map(flattenActivity);
    } catch (err) {
        console.error("Fetch error:", err);
        throw err;
    }
};

window.updateActivity = async (id, updates) => {
    try {
        const { data: current, error: fetchError } = await window.supabase.from('activities').select('data').eq('id', id).single();
        if (fetchError) throw fetchError;
        const newData = { ...current.data, ...updates };
        const { error } = await window.supabase.from('activities').update({ data: newData }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error("Update error:", err);
        throw err;
    }
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

window.requireAuth = async () => {
    console.log("Running requireAuth check...");
    if (!window.supabase || !window.supabase.auth) {
        console.error("Supabase client or auth object missing!");
        throw new Error("Authentication system unavailable.");
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();
    
    if (error || !session) {
        console.log("No session found. Redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    console.log("Session found for user:", session.user.email);

    const { data: profile, error: profError } = await window.supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .limit(1)
        .single();

    if (profError || !profile || profile.role !== 'admin') {
        console.error("Role check failed:", profError, profile);
        alert("Access Denied: You are not an admin.");
        await window.supabase.auth.signOut();
        window.location.href = 'login.html';
        return;
    }
    
    console.log("Admin check passed.");
};

window.logout = async () => {
    await window.supabase.auth.signOut();
    window.location.href = 'login.html';
};
