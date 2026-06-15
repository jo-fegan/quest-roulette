// admin.js - Robust Client Initialization

const SUPABASE_URL = 'https://gvknesxtslnflmftboyb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhyzgEKeQ6Bip8RgO8M1zQ_CPs0A2gY';

// Wait for the Supabase library to load from the CDN
// The CDN usually exposes it as 'Supabase' (Capital S) globally
if (!window.supabase) {
    if (typeof Supabase !== 'undefined') {
        // If the global variable is 'Supabase', use that to create the client
        console.log("Found global 'Supabase' object.");
        window.supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase library not found! Check if the CDN script loaded correctly.");
        throw new Error("Supabase library failed to load.");
    }
} else {
    // If window.supabase already exists, ensure it has auth
    if (!window.supabase.auth) {
        console.warn("window.supabase exists but no .auth method. Re-initializing...");
        // Fallback re-init just in case
        if (typeof Supabase !== 'undefined') {
             window.supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
    }
}

console.log("Supabase Client Initialized:", !!window.supabase);

// ... Rest of your functions (flattenActivity, fetchAllActivities, etc.) remain exactly the same ...

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