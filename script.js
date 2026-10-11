// ============ STORAGE KEYS ============
const KEYS = {
    records: 'vm_records_v2',
    customers: 'vm_customers_v2',
    reminders: 'vm_reminders_v2',
    settings: 'vm_settings_v2'
};

const defSettings = {
    oilChangeKm: 5000, oilChangeMos: 6,
    tireRotateKm: 10000, tuneUpKm: 20000
};

// ============ HELPER FUNCTIONS ============
function load(k) {return JSON.parse(localStorage.getItem(k))||[];}
function save(k,d) {localStorage.setItem(k, JSON.stringify(d));}
function loadSettings() {
    const s=localStorage.getItem(KEYS.settings);
    return s ? {...defSettings, ...JSON.parse(s)} : {...defSettings};
}
function saveSettings(s) {localStorage.setItem(KEYS.settings, JSON.stringify(s));}

function fmtDate(d) {
    if(!d)return'';
    return new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
}
function fmtNum(n) {return Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});}
function daysBetween(a,b) {
    return Math.ceil((new Date(b)-new Date(a))/(1000*60*60*24));
}
function addMonths(d,m) {
    let dt=new Date(d); dt.setMonth(dt.getMonth()+m); return dt.toISOString().split('T')[0];
}
function today() {return new Date().toISOString().split('T')[0];}

function statusLabel(s){
    const map={
        'pending':'🟡 Pending',
        'in-progress':'🟠 In Progress',
        'ready-payment':'🔵 Ready Payment',
        'done':'🟢 Done (Paid)'
    };
    return map[s]||s;
}

// ============ TABS ============
document.querySelectorAll('.tab-btn').forEach(b=>{
    b.onclick=()=>{
        document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active');
    };
});

// ============ SETTINGS ============
let settings=loadSettings();
document.getElementById('settingForm').addEventListener('submit',e=>{
    e.preventDefault();
    settings.oilChangeKm=Number(document.getElementById('intOilKm').value)||5000;
    settings.oilChangeMos=Number(document.getElementById('intOilMo').value)||6;
    settings.tireRotateKm=Number(document.getElementById('intTireKm').value)||10000;
    settings.tuneUpKm=Number(document.getElementById('intTuneKm').value)||20000;
    saveSettings(settings); alert('✅ Settings saved!');
});

// ============ AUTO-CALCULATE NEXT SERVICE ============
document.getElementById('recMileage').addEventListener('input', autoCalcNext);
document.getElementById('recType').addEventListener('change', autoCalcNext);
document.getElementById('recDate').addEventListener('change', autoCalcNext);
function autoCalcNext(){
    const type=document.getElementById('recType').value;
    const km=Number(document.getElementById('recMileage').value)||0;
    const dt=document.getElementById('recDate').value||today();
    let intKm=5000, intMo=6;
    if(type==='Tire Rotation') {intKm=settings.tireRotateKm; intMo=12;}
    else if(type==='Tune-up') {intKm=settings.tuneUpKm; intMo=12;}
    else if(type==='Oil Change') {intKm=settings.oilChangeKm; intMo=settings.oilChangeMos;}
    document.getElementById('nextKm').value= km ? (km+intKm) : '';
    document.getElementById('nextDate').value= dt ? addMonths(dt,intMo) : '';
}

// ============ CUSTOMER AUTO-FILL / HISTORY PREVIEW ============
let records=load(KEYS.records);
let customers=load(KEYS.customers);
let reminders=load(KEYS.reminders);

const custNameInput=document.getElementById('custName');
const historyBox=document.getElementById('custHistoryPreview');
const historyContent=document.getElementById('historyContent');

custNameInput.addEventListener('input',e=>{
    const name=e.target.value.trim().toLowerCase();
    if(!name) {historyBox.style.display='none'; return;}
    const matches=records.filter(r=>r.custName.toLowerCase().includes(name)).slice(0,3);
    if(matches.length>0){
        historyBox.style.display='block';
        historyContent.innerHTML=matches.map(r=>`
            <div style="margin-top:4px; padding:6px; background:#fff; border-radius:4px;">
                📅 ${fmtDate(r.sDate)} — ${r.sType} · ${r.vehicle} · ${r.status?statusLabel(r.status):''}
                ${r.nextDate?`<br>🔜 Return by: ${fmtDate(r.nextDate)}`:''}
            </div>
        `).join('');
        // Auto-fill vehicle & contact from last record
        const last=matches[0];
        if(!document.getElementById('recVehicle').value) document.getElementById('recVehicle').value=last.vehicle||'';
        if(!document.getElementById('custContact').value) document.getElementById('custContact').value=last.contact||'';
    } else {
        historyBox.style.display='none';
    }
});

// ============ SAVE NEW SERVICE RECORD ============
document.getElementById('recordForm').addEventListener('submit',e=>{
    e.preventDefault();
    const custName=custNameInput.value.trim();
    const status=document.getElementById('recStatus').value;
    const rec={
        id:Date.now(),
        custName: custName,
        contact: document.getElementById('custContact').value,
        vehicle: document.getElementById('recVehicle').value,
        sDate: document.getElementById('recDate').value,
        sType: document.getElementById('recType').value,
        mileage: Number(document.getElementById('recMileage').value),
        nextKm: Number(document.getElementById('nextKm').value)||0,
        nextDate: document.getElementById('nextDate').value,
        cost: Number(document.getElementById('recCost').value||0),
        status: status,
        notes: document.getElementById('recNotes').value,
        created: today()
    };
    
    records.unshift(rec); save(KEYS.records,records);

    // UPDATE CUSTOMER PROFILE
    let custIdx=customers.findIndex(c=>c.name.toLowerCase()===custName.toLowerCase());
    const custData={
        name: custName,
        contact: rec.contact,
        vehicle: rec.vehicle,
        lastService: rec.sDate,
        lastMileage: rec.mileage,
        serviceCount: 1
    };
    if(custIdx===-1) {
        customers.unshift(custData);
    } else {
        customers[custIdx].lastService=rec.sDate;
        customers[custIdx].lastMileage=rec.mileage;
        customers[custIdx].contact=rec.contact || customers[custIdx].contact;
        customers[custIdx].vehicle=rec.vehicle || customers[custIdx].vehicle;
        customers[custIdx].serviceCount=(customers[custIdx].serviceCount||0)+1;
    }
    save(KEYS.customers,customers);

    // AUTO-CREATE REMINDER (Return Date)
    if(rec.nextDate || rec.nextKm){
        reminders.unshift({
            id:Date.now(),
            custName: custName,
            serviceName: rec.sType+' — Return Visit',
            dueDate: rec.nextDate,
            dueKm: rec.nextKm,
            vehicle: rec.vehicle,
            status:'pending',
            created: today()
        });
        save(KEYS.reminders,reminders);
    }

    renderRecords(); renderCustomers(); renderReminders(); updateDashboard();
    e.target.reset(); historyBox.style.display='none';
    alert('✅ Record Saved! Status: '+statusLabel(status));
});

// ============ RENDER SERVICE RECORDS ============
function renderRecords(filter=''){
    const list=document.getElementById('recordsList');
    let filtered=records;
    if(filter) filtered=records.filter(r=>
        (r.custName+' '+r.vehicle+' '+r.sType+' '+r.notes).toLowerCase().includes(filter.toLowerCase())
    );
    list.innerHTML='';
    filtered.forEach((r,i)=>{
        const idx=records.indexOf(r);
        list.innerHTML+=`
        <div class="item-card status-${r.status||'pending'}">
            <div class="item-info">
                <h4>${statusLabel(r.status)} — ${r.custName} · ${r.sType}</h4>
                <p>🚗 ${r.vehicle} ${r.contact?' | 📞 '+r.contact:''}</p>
                <p>📅 Service: ${fmtDate(r.sDate)} · Mileage: ${r.mileage.toLocaleString()} km · 💵 ₱${fmtNum(r.cost)}</p>
                ${(r.nextDate||r.nextKm)?`<p>🔜 <strong>RETURN:</strong> ${r.nextKm?r.nextKm.toLocaleString()+' km':''} ${r.nextDate?' / '+fmtDate(r.nextDate):''}</p>`:''}
                ${r.notes?`<p>📝 ${r.notes}</p>`:''}
            </div>
            <div class="item-actions">
                ${r.status!=='done'?`
                <button class="btn mark-btn" data-status="${idx}" data-val="pending">🟡</button>
                <button class="btn mark-btn" data-status="${idx}" data-val="in-progress">🟠</button>
                <button class="btn mark-btn" data-status="${idx}" data-val="ready-payment">🔵</button>
                <button class="btn mark-btn" data-status="${idx}" data-val="done">✅</button>
                `:'<span style="color:green; font-weight:bold;">✅ PAID</span>'}
                <button class="btn del-btn" data-del-rec="${idx}">🗑️</button>
            </div>
        </div>`;
    });
    document.getElementById('recCount').textContent=`(${filtered.length})`;
    attachActions();
}
document.getElementById('searchRec').addEventListener('input',e=>renderRecords(e.target.value));

// ============ RENDER CUSTOMERS ============
function renderCustomers(filter=''){
    const list=document.getElementById('customersList');
    let filtered=customers;
    if(filter) filtered=customers.filter(c=>
        (c.name+' '+c.contact).toLowerCase().includes(filter.toLowerCase())
    );
    list.innerHTML='';
    filtered.forEach((c,i)=>{
        const idx=customers.indexOf(c);
        list.innerHTML+=`
        <div class="item-card">
            <div class="item-info">
                <h4>🧑‍🤝‍🧑 ${c.name}</h4>
                <p>🚗 Vehicle: ${c.vehicle||'Not specified'} ${c.contact?' | 📞 '+c.contact:''}</p>
                <p>📅 Last Service: ${fmtDate(c.lastService)} | 📊 Last Mileage: ${(c.lastMileage||0).toLocaleString()} km</p>
                <p>🔁 Total Visits: ${c.serviceCount||1} time(s)</p>
            </div>
            <div class="item-actions">
                <button class="btn del-btn" data-del-cust="${idx}">🗑️</button>
            </div>
        </div>`;
    });
    document.getElementById('custCount').textContent=`(${filtered.length})`;
    document.getElementById('statCustomers').textContent=customers.length;
    attachActions();
}
document.getElementById('searchCust').addEventListener('input',e=>renderCustomers(e.target.value));

// ============ RENDER REMINDERS / RETURNS ============
function renderReminders(){
    const list=document.getElementById('remindersList');
    const alertBox=document.getElementById('reminderAlert');
    list.innerHTML=''; let alerts=[], over=0, soon=0;
    reminders.forEach((r,idx)=>{
        if(r.status==='done') return;
        let daysLeft=null, cls='', statusTxt='';
        if(r.dueDate){
            daysLeft=daysBetween(today(), r.dueDate);
            if(daysLeft<0){cls='overdue'; over++; statusTxt=`🔴 OVERDUE ${Math.abs(daysLeft)} day(s)!`; alerts.push(`⚠️ <strong>${r.custName}</strong> — ${r.serviceName} is OVERDUE!`);}
            else if(daysLeft<=7){cls='due-soon'; soon++; statusTxt=`🟡 Due in ${daysLeft} day(s)`; alerts.push(`🔔 <strong>${r.custName}</strong> — ${r.serviceName} due in ${daysLeft} day(s)!`);}
            else {statusTxt=`✅ Due in ${daysLeft} day(s)`;}
        }
        list.innerHTML+=`
        <div class="item-card ${cls}">
            <div class="item-info">
                <h4>🔔 ${r.custName || 'Customer'}</h4>
                <p><strong>Service:</strong> ${r.serviceName}</p>
                <p>📅 Return Date: ${r.dueDate?fmtDate(r.dueDate):'--'} ${daysLeft!==null?`(${daysLeft<0?Math.abs(daysLeft)+'d OVERDUE':'in '+daysLeft+'d'})`:''}
                · 📊 Mileage: ${r.dueKm?r.dueKm.toLocaleString()+' km':'--'}</p>
                <p>${statusTxt}</p>
            </div>
            <div class="item-actions">
                <button class="btn mark-btn" data-done-rem="${idx}">✓ Done</button>
                <button class="btn del-btn" data-del-rem="${idx}">🗑️</button>
            </div>
        </div>`;
    });
    alertBox.innerHTML=alerts.length?alerts.join('<br>'):'✅ All schedules are on track!';
    document.getElementById('remCount').textContent=`(${reminders.filter(x=>x.status!=='done').length})`;
    document.getElementById('statPending').textContent=soon;
    document.getElementById('statOverdue').textContent=over;
    attachActions();
}

// ============ INCOME SUMMARY ============
function renderIncome(){
    const allDone=records.filter(r=>r.status==='done');
    const total=allDone.reduce((s,r)=>s+(r.cost||0),0);
    const thisMonth=today().slice(0,7);
    const mTotal=allDone.filter(r=>r.sDate.slice(0,7)===thisMonth).reduce((s,r)=>s+(r.cost||0),0);
    document.getElementById('totalIncome').textContent=fmtNum(total);
    document.getElementById('monthIncome').textContent=fmtNum(mTotal);

    const list=document.getElementById('expensesList');
    list.innerHTML='';
    allDone.forEach((r,i)=>{
        list.innerHTML+=`
        <div class="item-card">
            <div class="item-info">
                <h4>💰 ₱${fmtNum(r.cost)} — ${r.custName}</h4>
                <p>📅 ${fmtDate(r.sDate)} · ${r.sType} · ${r.vehicle}</p>
            </div>
        </div>`;
    });
}

// ============ DASHBOARD ============
function updateDashboard(){
    document.getElementById('statRecords').textContent=records.length;
    document.getElementById('statTotal').textContent='₱'+fmtNum(records.filter(r=>r.status==='done').reduce((s,r)=>s+(r.cost||0),0));
}

// ============ ACTIONS: UPDATE STATUS & DELETE ============
function attachActions(){
    // Update status
    document.querySelectorAll('[data-status]').forEach(b=>{
        b.onclick=()=>{
            const idx=Number(b.dataset.status);
            records[idx].status=b.dataset.val;
            save(KEYS.records,records);
            renderRecords(); updateDashboard();
        };
    });
    // Mark reminder done
    document.querySelectorAll('[data-done-rem]').forEach(b=>{
        b.onclick=()=>{
            reminders[Number(b.dataset.doneRem)].status='done';
            save(KEYS.reminders,reminders);
            renderReminders();
        };
    });
    // Delete record
    document.querySelectorAll('[data-del-rec]').forEach(b=>{
        b.onclick=()=>{records.splice(b.dataset.delRec,1); save(KEYS.records,records); renderRecords(); updateDashboard();};
    });
    // Delete customer
    document.querySelectorAll('[data-del-cust]').forEach(b=>{
        b.onclick=()=>{customers.splice(b.dataset.delCust,1); save(KEYS.customers,customers); renderCustomers(); updateDashboard();};
    });
    // Delete reminder
    document.querySelectorAll('[data-del-rem]').forEach(b=>{
        b.onclick=()=>{reminders.splice(b.dataset.delRem,1); save(KEYS.reminders,reminders); renderReminders();};
    });
}

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('input[type="date"]').forEach(i=>{if(!i.value)i.value=today();});
    document.getElementById('intOilKm').value=settings.oilChangeKm;
    document.getElementById('intOilMo').value=settings.oilChangeMos;
    document.getElementById('intTireKm').value=settings.tireRotateKm;
    document.getElementById('intTuneKm').value=settings.tuneUpKm;
    
    renderRecords(); renderCustomers(); renderReminders(); renderIncome(); updateDashboard();
});