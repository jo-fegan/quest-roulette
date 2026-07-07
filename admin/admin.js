// admin.js - Self-Contained Secure Dashboard

const SUPABASE_URL = 'https://gvknesxtslnflmftboyb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lhyzgEKeQ6Bip8RgO8M1zQ_CPs0A2gY';

// Helper: Flatten activity data
function flattenActivity(dbRow) {
    const data = dbRow.data || {};
    return {
        dbId: dbRow.id,
        ...data,
        season: dbRow.season || {},
        kidsFriendly: typeof data.kidsFriendly === 'boolean' ? data.kidsFriendly : (data.kidsFriendly === 'true'),
        romantic: typeof data.romantic === 'boolean' ? data.romantic : (data.romantic === 'true'),
        accessibility: typeof data.accessibility === 'boolean' ? data.accessibility : (data.accessibility === 'true'),
        bookingRequired: typeof data.bookingRequired === 'boolean' ? data.bookingRequired : (data.bookingRequired === 'true')
    };
}

// --- EXPOSED GLOBAL FUNCTIONS ---

window.fetchAllActivities = async () => {
    const { data, error } = await window.supabase.from('activities').select('*');
    if (error) throw error;
    return data.map(flattenActivity);
};

window.updateActivity = async (id, updates) => {
    const { data: current, error: fetchError } = await window.supabase.from('activities').select('data,season').eq('id', id).single();
    if (fetchError) throw fetchError;
    const newData = { ...current.data, ...updates };
    const payload = { data: newData };

    if (updates.season) {
        payload.season = { ...current.season, ...updates.season };
    }

    const { error } = await window.supabase.from('activities').update(payload).eq('id', id);
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

// --- START DASHBOARD UI FUNCTIONS ---

// 1. Declare Global State FIRST (MUST be before functions)
let allActivities = [];
let allFeedback = [];
let selectedIds = new Set();
let currentEditId = null;
let pendingDeleteId = null;
let isBulkMode = false;
let isCreateMode = false;
let sortKey = 'title';
let sortDirection = 'asc';
let hideInactive = true;

// 2. Define window.refreshData
window.refreshData = async () => {
    try {
        console.log("Fetching activities...");
        allActivities = await window.fetchAllActivities();
        console.log(`Loaded ${allActivities.length} activities.`);
        
        if (typeof window.renderTable === 'function') {
            window.renderTable();
        } else {
            console.error("renderTable function not found on window.");
        }
    } catch (err) {
        console.error("Error loading data:", err);
        alert("Failed to load data: " + err.message);
    }
};

// 3. Define UI Functions
const isActivityInactive = (activity) => {
    const season = activity.season || {};
    const values = Object.values(season);
    return values.length > 0 && values.every(value => String(value).toUpperCase() === 'N');
};

window.renderTable = () => {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) return;
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const filtered = allActivities.filter(act => {
        if (hideInactive && isActivityInactive(act)) return false;
        return act.title.toLowerCase().includes(searchTerm) || 
            (act.area && act.area.toLowerCase().includes(searchTerm)) ||
            act.dbId.toString().includes(searchTerm);
    });

    const sorted = [...filtered].sort((a, b) => {
        const aValue = a[sortKey] ?? '';
        const bValue = b[sortKey] ?? '';
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = '';
    
    if (sorted.length === 0) {
        const note = hideInactive ? " Toggle off 'hide inactive' to expand search" : '';
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No activities found.${note}</td></tr>`;
        return;
    }

    sorted.forEach(act => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        // Ensure JSON.stringify is safe
        try {
            tr.innerHTML = `
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" value="${act.dbId}" 
                           ${selectedIds.has(act.dbId) ? 'checked' : ''}
                           onchange="toggleSelection(${act.dbId})"
                           class="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand">
                </td>
                <td class="px-4 py-3 font-medium text-slate-800">${act.dbId}</td>
                <td class="px-4 py-3 font-medium text-slate-800">${act.title}</td>
                <td class="px-4 py-3"><span class="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">${act.area || 'Unknown'}</span></td>
                <td class="px-4 py-3">${act.price || '-'}</td>
                <td class="px-4 py-3 text-slate-500 truncate max-w-xs">${act.description || ''}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="openEditModal(${act.dbId})" class="text-blue-600 hover:text-blue-800 mr-2">Edit</button>
                    <button onclick="confirmDelete(${act.dbId})" class="text-red-600 hover:text-red-800">Delete</button>
                </td>
            `;
        } catch (e) {
            console.error("Error rendering row:", e, act);
        }
        tbody.appendChild(tr);
    });
};

window.showAdminTab = async (tab) => {
    const activitiesTab = document.getElementById('activitiesTab');
    const feedbackTab = document.getElementById('feedbackTab');
    const activitiesBtn = document.getElementById('activitiesTabBtn');
    const feedbackBtn = document.getElementById('feedbackTabBtn');

    if (!activitiesTab || !feedbackTab || !activitiesBtn || !feedbackBtn) return;

    if (tab === 'feedback') {
        activitiesTab.classList.add('hidden');
        feedbackTab.classList.remove('hidden');
        activitiesBtn.className = 'px-4 py-2 rounded-full text-slate-600 hover:text-brand text-sm font-semibold';
        feedbackBtn.className = 'px-4 py-2 rounded-full bg-white text-brand shadow-sm text-sm font-semibold';
        await window.refreshFeedback();
    } else {
        activitiesTab.classList.remove('hidden');
        feedbackTab.classList.add('hidden');
        activitiesBtn.className = 'px-4 py-2 rounded-full bg-white text-brand shadow-sm text-sm font-semibold';
        feedbackBtn.className = 'px-4 py-2 rounded-full text-slate-600 hover:text-brand text-sm font-semibold';
    }
};

window.setSort = (key) => {
    if (sortKey === key) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey = key;
        sortDirection = 'asc';
    }
    window.renderTable();
};

window.openNewActivityModal = () => {
    isCreateMode = true;
    currentEditId = null;
    const blankActivity = {
        title: '',
        area: '',
        price: '',
        distance: '',
        duration: '',
        activityLevel: '',
        locationType: '',
        weatherSuitable: [],
        description: '',
        season: {
            jan: 'Y', feb: 'Y', mar: 'Y', apr: 'Y', may: 'Y', jun: 'Y', jul: 'Y', aug: 'Y', sep: 'Y', oct: 'Y', nov: 'Y', dec: 'Y'
        }
    };
    window.openEditModal(blankActivity, true);
};

window.fetchActivityById = async (id) => {
    const { data, error } = await window.supabase.from('activities').select('*').eq('id', id).single();
    if (error) throw error;
    return flattenActivity(data);
};

window.openActivityFromFeedback = async (activityId) => {
    try {
        let activity = allActivities.find(a => a.dbId === activityId);
        if (!activity) {
            activity = await window.fetchActivityById(activityId);
            allActivities.push(activity);
        }
        if (activity) {
            isCreateMode = false;
            currentEditId = activity.dbId;
            window.openEditModal(activity, false);
            window.showAdminTab('activities');
        }
    } catch (err) {
        alert('Unable to open activity: ' + err.message);
    }
};

window.fetchFeedback = async () => {
    const status = document.getElementById('feedbackStatusFilter')?.value || 'pending';
    let query = window.supabase.from('feedback_suggestions').select('*').order('submitted_at', { ascending: true });
    if (status === 'pending') query = query.eq('status', 'pending');
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

window.refreshFeedback = async () => {
    const container = document.getElementById('feedbackContent');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-500">Loading feedback...</div>';
    try {
        allFeedback = await window.fetchFeedback();
        const generalItems = allFeedback.filter(item => item.feedback_type === 'general');
        const activityItems = allFeedback.filter(item => item.feedback_type === 'activity');
        let html = '';

        if (generalItems.length > 0) {
            html += '<section class="mb-6"><h3 class="text-base font-semibold text-slate-800 mb-3">General feedback</h3>';
            html += '<div class="space-y-3">';
            generalItems.forEach(item => {
                html += `<div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center text-sm text-slate-500 mb-2">
                        <span>Status: ${item.status || 'unknown'}</span>
                        <span>${item.user_email || 'No email'}</span>
                        <button type="button" onclick="markFeedbackDone('${item.id}')" class="self-start sm:self-auto px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">Mark done</button>
                    </div>
                    <p class="text-slate-700">${item.feedback_text || ''}</p>
                </div>`;
            });
            html += '</div></section>';
        }

        if (activityItems.length > 0) {
            const grouped = activityItems.reduce((acc, item) => {
                const key = item.activity_id || 'unknown';
                acc[key] = acc[key] || [];
                acc[key].push(item);
                return acc;
            }, {});

            html += '<section><h3 class="text-base font-semibold text-slate-800 mb-3">Activity feedback</h3>';
            Object.keys(grouped).forEach(activityId => {
                html += `<div class="mb-5 rounded-2xl border border-slate-200 p-4">
                    <div class="mb-3 text-sm font-semibold text-slate-700">Activity ID: <button type="button" onclick="openActivityFromFeedback(${activityId})" class="text-brand underline hover:text-brand-dark">${activityId}</button></div>
                    <div class="space-y-3">`;
                grouped[activityId].forEach(item => {
                    html += `<div class="rounded-xl border border-slate-200 p-4 bg-white">
                        <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center text-sm text-slate-500 mb-2">
                            <span>Status: ${item.status || 'unknown'}</span>
                            <span>${item.user_email || 'No email'}</span>
                            <button type="button" onclick="markFeedbackDone('${item.id}')" class="self-start sm:self-auto px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">Mark done</button>
                        </div>
                        <p class="text-slate-700">${item.feedback_text || ''}</p>
                    </div>`;
                });
                html += '</div></div>';
            });
            html += '</section>';
        }

        if (!generalItems.length && !activityItems.length) {
            html = '<div class="text-slate-500">No feedback found for the selected status.</div>';
        }

        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="text-red-600">Failed to load feedback: ${err.message}</div>`;
    }
};

window.toggleSelection = (id) => {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = allActivities.every(a => selectedIds.has(a.dbId));
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

window.toggleHideInactive = () => {
    hideInactive = !hideInactive;
    const button = document.getElementById('hideInactiveBtn');
    if (button) {
        button.innerText = hideInactive ? 'Hide inactive: ON' : 'Hide inactive: OFF';
        button.className = hideInactive
            ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors'
            : 'bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors';
    }
    window.renderTable();
};

window.openEditModal = async (activityOrId, isCreate = false) => {
    isBulkMode = false;
    isCreateMode = !!isCreate;

    let activity = activityOrId;
    if (typeof activityOrId === 'number') {
        activity = await window.fetchActivityById(activityOrId);
    }

    if (!activity) {
        alert('Unable to load activity details.');
        return;
    }

    currentEditId = isCreate ? null : activity.dbId;

    const modal = document.getElementById('editModal');
    const contentContainer = document.getElementById('modalContent');
    const titleEl = document.getElementById('modalTitle');

    if (!modal || !contentContainer || !titleEl) return;

    titleEl.innerText = isCreate ? 'Add Activity' : `Edit: ${activity.title}`;

    const season = activity.season || {};
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weatherOptions = ['sun', 'rain', 'hot'];
    const areaOptions = ['Cairns', 'Tablelands', 'Port Douglas', 'Cassowary Coast', 'Reef'];

    const monthInputs = monthKeys.map((key, index) => {
        const checked = season[key] === 'Y' ? 'checked' : '';
        return `<label class="inline-flex items-center gap-2 mr-4 mb-2">
                    <input type="checkbox" name="season_${key}" ${checked} class="h-4 w-4 rounded border-slate-300 text-brand">
                    <span class="text-sm text-slate-700">${monthLabels[index]}</span>
                </label>`;
    }).join('');

    const weatherInputs = weatherOptions.map((value) => {
        const checked = Array.isArray(activity.weatherSuitable) && activity.weatherSuitable.includes(value) ? 'checked' : '';
        return `<label class="inline-flex items-center gap-2 mr-4 mb-2">
                    <input type="checkbox" name="weatherSuitable" value="${value}" ${checked} class="h-4 w-4 rounded border-slate-300 text-brand">
                    <span class="text-sm text-slate-700 capitalize">${value}</span>
                </label>`;
    }).join('');

    const activityStyle = activity.romantic ? 'romantic' : activity.kidsFriendly ? 'kidFriendly' : 'all';

    const formHtml = `
        <form id="editForm" class="space-y-6">
            <div class="grid gap-6 lg:grid-cols-[1fr_1px_1fr]">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input type="text" name="title" value="${activity.title || ''}" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Area</label>
                        <select name="area" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="" ${!activity.area ? 'selected' : ''}>Select area</option>
                            ${areaOptions.map(area => `<option value="${area}" ${activity.area === area ? 'selected' : ''}>${area}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Price</label>
                        <select name="price" class="w-full px-3 py-2 border rounded-lg">
                            <option value="" ${!activity.price ? 'selected' : ''}>Select price</option>
                            <option value="$" ${activity.price === '$' ? 'selected' : ''}>$</option>
                            <option value="$$" ${activity.price === '$$' ? 'selected' : ''}>$$</option>
                            <option value="$$$" ${activity.price === '$$$' ? 'selected' : ''}>$$$</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Driving time</label>
                        <select name="distance" class="w-full px-3 py-2 border rounded-lg">
                            <option value="" ${!activity.distance ? 'selected' : ''}>Select driving time</option>
                            <option value="Under 25mins" ${activity.distance === 'Under 25mins' ? 'selected' : ''}>Under 25mins</option>
                            <option value="Under 90mins" ${activity.distance === 'Under 90mins' ? 'selected' : ''}>Under 90mins</option>
                            <option value="Longer Drive" ${activity.distance === 'Longer Drive' ? 'selected' : ''}>Longer drive</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                        <select name="duration" class="w-full px-3 py-2 border rounded-lg">
                            <option value="" ${!activity.duration ? 'selected' : ''}>Select duration</option>
                            <option value="Half Day or Less" ${activity.duration === 'Half Day or Less' ? 'selected' : ''}>Half Day or Less</option>
                            <option value="Full Day" ${activity.duration === 'Full Day' ? 'selected' : ''}>Full Day</option>
                            <option value="Multi-Day" ${activity.duration === 'Multi-Day' ? 'selected' : ''}>Multi-Day</option>
                        </select>
                    </div>
                </div>
                <div class="hidden lg:block bg-slate-200/70"></div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Intensity</label>
                        <select name="activityLevel" class="w-full px-3 py-2 border rounded-lg">
                            <option value="" ${!activity.activityLevel ? 'selected' : ''}>Select intensity</option>
                            <option value="relaxed" ${activity.activityLevel === 'relaxed' ? 'selected' : ''}>Relaxed</option>
                            <option value="active" ${activity.activityLevel === 'active' ? 'selected' : ''}>Active</option>
                            <option value="intense" ${activity.activityLevel === 'intense' ? 'selected' : ''}>Intense</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Activity style</label>
                        <select name="activityStyle" class="w-full px-3 py-2 border rounded-lg">
                            <option value="all" ${activityStyle === 'all' ? 'selected' : ''}>Any</option>
                            <option value="kidFriendly" ${activityStyle === 'kidFriendly' ? 'selected' : ''}>Kid-friendly</option>
                            <option value="romantic" ${activityStyle === 'romantic' ? 'selected' : ''}>Couples/romantic</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Setting</label>
                        <select name="locationType" class="w-full px-3 py-2 border rounded-lg">
                            <option value="" ${!activity.locationType ? 'selected' : ''}>Select setting</option>
                            <option value="outdoor" ${activity.locationType === 'outdoor' ? 'selected' : ''}>Outdoor</option>
                            <option value="indoor" ${activity.locationType === 'indoor' ? 'selected' : ''}>Indoor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Weather</label>
                        <div class="flex flex-wrap">${weatherInputs}</div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <textarea name="description" rows="3" class="w-full px-3 py-2 border rounded-lg" required>${activity.description || ''}</textarea>
                    </div>
                </div>
            </div>
            <div class="border-t border-slate-200 pt-4">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <div class="text-sm font-semibold text-slate-700">Season</div>
                        <div class="text-xs text-slate-500">Tick months when the activity is available.</div>
                    </div>
                    <button type="button" onclick="setSeasonInactive()" class="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Mark inactive</button>
                </div>
                <div class="flex flex-wrap gap-2">${monthInputs}</div>
            </div>
        </form>
    `;

    contentContainer.innerHTML = formHtml;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.setSeasonInactive = () => {
    const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    monthKeys.forEach(month => {
        const input = document.querySelector(`input[name="season_${month}"]`);
        if (input) input.checked = false;
    });
};

//suspect this will fail to due to no tag wrapping.
window.openBulkEditModal = () => {
    if (selectedIds.size === 0) {
        alert("Please select at least one activity first.");
        return;
    }
    isBulkMode = true;
    currentEditId = null;
    
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    const titleEl = document.getElementById('modalTitle');
    
    if (!modal || !content || !titleEl) return;

    titleEl.innerText = `Bulk Edit (${selectedIds.size} items)`;
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
    const modal = document.getElementById('editModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.saveChanges = async () => {
    const saveBtn = document.getElementById('saveBtn');
    if(!saveBtn) return;
    
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        if (isBulkMode) {
            const field = document.getElementById('bulkField')?.value;
            let value = document.getElementById('bulkValue')?.value;
            
            if (!field || value === undefined) throw new Error("Missing bulk edit fields");

            if (field === 'kidsFriendly' || field === 'romantic') {
                value = value === 'true';
            }
            if (field === 'weatherSuitable') {
                value = value.split(',').map(s => s.trim()).filter(s => s);
            }

            await window.bulkUpdateActivityIds(Array.from(selectedIds), field, value);
            alert(`Successfully updated ${selectedIds.size} items!`);
            selectedIds.clear();
        } else if (!isCreateMode) {
            const form = document.getElementById('editForm'); 
            if(!form) throw new Error("Edit form not found. Are you in Edit mode?");
            
            const formData = new FormData(form);
            const updates = {};
            const weather = [];
            let activityStyle = null;

            for (let [key, val] of formData.entries()) {
                if (key === 'weatherSuitable') {
                    weather.push(val);
                    continue;
                }
                if (key === 'activityStyle') {
                    activityStyle = val;
                    continue;
                }
                if (key.startsWith('season_')) {
                    continue;
                }

                if (key === 'price' || key === 'distance' || key === 'duration' || key === 'activityLevel' || key === 'locationType' || key === 'title' || key === 'description' || key === 'area') {
                    updates[key] = val;
                    continue;
                }

                updates[key] = val;
            }

            if (activityStyle === 'kidFriendly') {
                updates.kidsFriendly = true;
                updates.romantic = false;
            } else if (activityStyle === 'romantic') {
                updates.kidsFriendly = false;
                updates.romantic = true;
            } else if (activityStyle === 'all') {
                updates.kidsFriendly = false;
                updates.romantic = false;
            }

            if (weather.length) {
                updates.weatherSuitable = weather;
            } else {
                updates.weatherSuitable = [];
            }

            const seasonKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            const season = {};
            let anyChecked = false;
            seasonKeys.forEach(key => {
                const checked = document.querySelector(`input[name="season_${key}"]`)?.checked;
                if (checked) {
                    season[key] = 'Y';
                    anyChecked = true;
                } else {
                    season[key] = 'N';
                }
            });
            updates.season = season;

            await window.updateActivity(currentEditId, updates);
            alert("Activity updated!");
        } else {
            const form = document.getElementById('editForm'); 
            if(!form) throw new Error("Edit form not found. Are you in Create mode?");

            const formData = new FormData(form);
            const updates = {};
            const weather = [];
            let activityStyle = null;

            for (let [key, val] of formData.entries()) {
                if (key === 'weatherSuitable') {
                    weather.push(val);
                    continue;
                }
                if (key === 'activityStyle') {
                    activityStyle = val;
                    continue;
                }
                if (key.startsWith('season_')) {
                    continue;
                }
                updates[key] = val;
            }

            if (activityStyle === 'kidFriendly') {
                updates.kidsFriendly = true;
                updates.romantic = false;
            } else if (activityStyle === 'romantic') {
                updates.kidsFriendly = false;
                updates.romantic = true;
            } else {
                updates.kidsFriendly = false;
                updates.romantic = false;
            }

            if (weather.length) {
                updates.weatherSuitable = weather;
            } else {
                updates.weatherSuitable = [];
            }

            const seasonKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            const season = {};
            seasonKeys.forEach(key => {
                const checked = document.querySelector(`input[name="season_${key}"]`)?.checked;
                season[key] = checked ? 'Y' : 'N';
            });

            await window.createActivity({ ...updates }, season);
            alert('Activity created!');
        }
        
        closeModal();
        await window.refreshData();

    } catch (err) {
        alert("Error saving: " + err.message);
        console.error(err);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Changes";
    }
};

window.createActivity = async (data, season) => {
    const payload = { data, season };
    const { error } = await window.supabase.from('activities').insert([payload]);
    if (error) throw error;
};

window.markFeedbackDone = async (feedbackId) => {
    const { error } = await window.supabase.from('feedback_suggestions').update({ status: 'done' }).eq('id', feedbackId);
    if (error) throw error;
    await window.refreshFeedback();
};

window.confirmDelete = (id) => {
    pendingDeleteId = id;
    const modal = document.getElementById('deleteModal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
if(confirmDeleteBtn) {
    confirmDeleteBtn.onclick = async () => {
        if (!pendingDeleteId) return;
        try {
            await window.deleteActivity(pendingDeleteId);
            alert("Deleted successfully.");
            const modal = document.getElementById('deleteModal');
            if(modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            await window.refreshData();
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };
}

window.addEventListener('DOMContentLoaded', async () => {
    if (await window.checkAuth()) {
        await window.refreshData();
    }
});
