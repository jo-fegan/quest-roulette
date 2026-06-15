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

// --- START DASHBOARD UI FUNCTIONS ---

let allActivities = [];
let selectedIds = new Set();

window.renderTable = () => {
    const tbody = document.getElementById('activityTableBody');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    const filtered = allActivities.filter(act => 
        act.title.toLowerCase().includes(searchTerm) || 
        (act.area && act.area.toLowerCase().includes(searchTerm))
    );

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No activities found.</td></tr>`;
        return;
    }

    filtered.forEach(act => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" value="${act.dbId}" 
                       ${selectedIds.has(act.dbId) ? 'checked' : ''}
                       onchange="toggleSelection(${act.dbId})"
                       class="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand">
            </td>
            <td class="px-4 py-3 font-medium text-slate-800">${act.title}</td>
            <td class="px-4 py-3"><span class="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">${act.area || 'Unknown'}</span></td>
            <td class="px-4 py-3">${act.price || '-'}</td>
            <td class="px-4 py-3 text-slate-500 truncate max-w-xs">${act.description || ''}</td>
            <td class="px-4 py-3 text-right">
                <button onclick='openEditModal(${JSON.stringify(act)})' class="text-blue-600 hover:text-blue-800 mr-2">Edit</button>
                <button onclick="confirmDelete(${act.dbId})" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.toggleSelection = (id) => {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    const selectAll = document.getElementById('selectAll');
    selectAll.checked = allActivities.every(a => selectedIds.has(a.dbId));
};

window.toggleSelectAll = () => {
    const checked = document.getElementById('selectAll').checked;
    if (checked) {
        allActivities.forEach(a => selectedIds.add(a.dbId));
    } else {
        selectedIds.clear();
    }
    window.renderTable();
};

window.openEditModal = (activity) => {
    currentEditId = activity.dbId;
    isBulkMode = false;
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    document.getElementById('modalTitle').innerText = `Edit: ${activity.title}`;
    
    const fields = ['title', 'description', 'price', 'distance', 'duration', 'area', 'kidsFriendly', 'romantic', 'weatherSuitable'];
    
    content.innerHTML = fields.map(field => {
        let val = activity[field];
        if (typeof val === 'boolean') {
            return `<div><label class="block text-sm font-medium text-slate-700 mb-1 capitalize">${field.replace(/([A-Z])/g, ' $1')}</label><select class="w-full px-3 py-2 border rounded-lg" name="${field}"><option value="true" ${val ? 'selected' : ''}>True</option><option value="false" ${!val ? 'selected' : ''}>False</option></select></div>`;
        } else if (Array.isArray(val)) {
            return `<div><label class="block text-sm font-medium text-slate-700 mb-1 capitalize">${field.replace(/([A-Z])/g, ' $1')}</label><textarea class="w-full px-3 py-2 border rounded-lg" name="${field}" rows="2">${val.join(', ')}</textarea><p class="text-xs text-slate-400 mt-1">Comma separated values</p></div>`;
        } else {
            return `<div><label class="block text-sm font-medium text-slate-700 mb-1 capitalize">${field.replace(/([A-Z])/g, ' $1')}</label><input type="text" name="${field}" value="${val || ''}" class="w-full px-3 py-2 border rounded-lg"></div>`;
        }
    }).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.openBulkEditModal = () => {
    if (selectedIds.size === 0) {
        alert("Please select at least one activity first.");
        return;
    }
    isBulkMode = true;
    currentEditId = null;
    
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    document.getElementById('modalTitle').innerText = `Bulk Edit (${selectedIds.size} items)`;

    content.innerHTML = `
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p class="text-sm text-yellow-800">⚠️ This will update <strong>${selectedIds.size}</strong> items with the same value.</p>
        </div>
        <div><label class="block text-sm font-medium text-slate-700 mb-1">Field to Update</label><select id="bulkField" class="w-full px-3 py-2 border rounded-lg"><option value="price">Price</option><option value="area">Area</option><option value="distance">Distance</option><option value="duration">Duration</option></select></div>
        <div><label class="block text-sm font-medium text-slate-700 mb-1">New Value</label><input type="text" id="bulkValue" class="w-full px-3 py-2 border rounded-lg" placeholder="e.g. $$"></div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeModal = () => {
    document.getElementById('editModal').classList.add('hidden');
    document.getElementById('editModal').classList.remove('flex');
};

window.saveChanges = async () => {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        if (isBulkMode) {
            const field = document.getElementById('bulkField').value;
            let value = document.getElementById('bulkValue').value;
            
            if (field === 'kidsFriendly' || field === 'romantic') {
                value = value === 'true';
            }
            if (field === 'weatherSuitable') {
                value = value.split(',').map(s => s.trim()).filter(s => s);
            }

            await window.bulkUpdateActivityIds(Array.from(selectedIds), field, value);
            alert(`Successfully updated ${selectedIds.size} items!`);
            selectedIds.clear();
        } else {
            const formData = new FormData(document.getElementById('modalContent'));
            const updates = {};
            
            for (let [key, val] of formData.entries()) {
                if (key === 'kidsFriendly' || key === 'romantic') {
                    updates[key] = val === 'true';
                } else if (key === 'weatherSuitable') {
                    updates[key] = val.split(',').map(s => s.trim()).filter(s => s);
                } else {
                    updates[key] = val;
                }
            }

            await window.updateActivity(currentEditId, updates);
            alert("Activity updated!");
        }
        
        closeModal();
        await window.refreshData();

    } catch (err) {
        alert("Error saving: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Changes";
    }
};

window.confirmDelete = (id) => {
    pendingDeleteId = id;
    document.getElementById('deleteModal').classList.remove('hidden');
    document.getElementById('deleteModal').classList.add('flex');
};

document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (!pendingDeleteId) return;
    try {
        await window.deleteActivity(pendingDeleteId);
        alert("Deleted successfully.");
        document.getElementById('deleteModal').classList.add('hidden');
        document.getElementById('deleteModal').classList.remove('flex');
        await window.refreshData();
    } catch (err) {
        alert("Error deleting: " + err.message);
    }
};

// Global state variables needed by UI functions
let currentEditId = null;
let pendingDeleteId = null;
let isBulkMode = false;
//End of UI Functions

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
