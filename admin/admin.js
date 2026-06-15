// admin.js - Secure Admin Dashboard (RLS Protected)

const SUPABASE_URL = 'https://gvknesxtslnflmftboyb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhyzgEKeQ6Bip8RgO8M1zQ_CPs0A2gY';

let supabase = null;

// Initialize Supabase Client
async function initSupabase() {
    if (window.supabase) {
        supabase = window.supabase;
        console.log("✓ Supabase client loaded");
        return true;
    }
    console.error("✗ Supabase client not found!");
    return false;
}

// Flatten activity data structure
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

// Fetch all activities (RLS protects unauthorized writes)
window.fetchAllActivities = async () => {
    const { data, error } = await supabase.from('activities').select('*');
    if (error) throw error;
    return data.map(flattenActivity);
};

// Update activity (RLS blocks non-admin updates)
window.updateActivity = async (id, updates) => {
    // Get current data first
    const { data: current, error: fetchError } = await supabase.from('activities').select('data').eq('id', id).single();
    if (fetchError) throw fetchError;
    
    const newData = { ...current.data, ...updates };
    const { error } = await supabase.from('activities').update({ data: newData }).eq('id', id);
    if (error) throw error;
};

// Delete activity (RLS blocks non-admin deletes)
window.deleteActivity = async (id) => {
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
};

// Bulk update (RLS protects each operation)
window.bulkUpdateActivityIds = async (ids, field, value) => {
    for (const id of ids) {
        await window.updateActivity(id, { [field]: value });
    }
};

// Check if user is authenticated (UX only - RLS does real protection)
window.checkAuth = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
        console.log("No session found. Redirecting to login.");
        window.location.href = '../login.html';
        return false;
    }
    
    console.log("✓ Authenticated as:", session.user.email);
    return true;
};

// Logout
window.logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '../login.html';
};

// Error handler wrapper for UI operations
window.safeOperation = async (operationName, operationFn) => {
    try {
        await operationFn();
        return { success: true };
    } catch (err) {
        console.error(`${operationName} failed:`, err);
        // Check if it's an RLS permission error
        if (err.code === 'PGRST301') {
            alert("Access denied. You may not have permission to perform this action.");
        } else {
            alert(`Error: ${err.message}`);
        }
        return { success: false, error: err };
    }
};
