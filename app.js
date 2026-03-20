document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    
    // --- 多言語対応 (i18n) 設定 ---
    let currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    const dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "KPI", weight: "Weight", sleep_h: "Sleep", mental: "Mental Condition",
            nav_meals: "Meals", nav_log: "Daily Log", nav_history: "History", chart_title: "Recent 7-Day Trend",
            analysis: "Analysis", trend: "7-Day Trend",
            recorded: "Logged",
            fat_p: "Fat", streak: "Streak", days: "Days", consecutive: "Consecutive",
            completion: "Completion", last30days: "Last 30 Days",
            calories: "Calories", today_total: "Today's Total", month_count: "Month Count", logging: "Logging",
            msg_wake: "Good morning! Have a great day! ☀️",
            msg_sleep: "Good work today. Have a good night! 🌙",
            msg_undo: "Record reset", confirm_undo: "Do you want to reset (undo) this record?",
            msg_ai_analyzing: "AI Analyzing image..."
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "主要指標", weight: "体重", sleep_h: "睡眠時間", mental: "メンタル状態",
            nav_meals: "食事録", nav_log: "日次記録", nav_history: "履歴", chart_title: "直近7日間の推移",
            analysis: "分析", trend: "7日間の推移",
            recorded: "記録済み",
            fat_p: "体脂肪率", streak: "継続日数", days: "日", consecutive: "連続記録中",
            completion: "完了率", last30days: "過去30日間",
            calories: "摂取カロリー", today_total: "本日の合計", month_count: "月間記録日数", logging: "記録済み",
            msg_wake: "おはようございます！今日も一日頑張りましょう☀️",
            msg_sleep: "お疲れ様でした。ゆっくり休んでくださいね🌙",
            msg_undo: "打刻をリセットしました", confirm_undo: "打刻をリセット（取り消し）しますか？",
            msg_ai_analyzing: "AIが食事を解析中..."
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerText = dict[currentLang][key];
        });
    }
    
    document.getElementById('langToggleBtn').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ja' : 'en';
        localStorage.setItem('appLang_' + user.id, currentLang);
        updateLanguage();
        loadDashboard(); 
    });
    updateLanguage(); 

    function showToast(msg) {
        const toast = document.getElementById('toastMsg');
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3500);
    }

    const mentalIcons = [
        '<i class="far fa-sad-tear"></i>',
        '<i class="far fa-frown"></i>',
        '<i class="far fa-meh"></i>',
        '<i class="far fa-smile"></i>',
        '<i class="far fa-laugh-beam"></i>'
    ];

    let currentChartMode = 'weight';
    let globalChartLogs = [];
    
    let TARGET_WEIGHT = parseFloat(localStorage.getItem('targetWeight_' + user.id)) || 65.0;
    let TARGET_FAT = parseFloat(localStorage.getItem('targetFat_' + user.id)) || 13.0;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    function getLocalLogicalDateStr(dateObj) {
        const d = new Date(dateObj.getTime());
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function createSafeDate(dateStr, timeStr) {
        if (!timeStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        const [h, min] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, h, min);
    }

    document.getElementById('btnGuideOpen').addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('guideModal').style.display = 'flex';
    });
    document.getElementById('btnGuideClose').addEventListener('click', () => {
        document.getElementById('guideModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'flex';
    });

    const settingsModal = document.getElementById('settingsModal');
    let settingMVal = 3;

    document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#settingMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); 
            settingMVal = b.dataset.v;
        });
    });

    document.getElementById('settingsBtn').addEventListener('click', async () => {
        document.getElementById('settingTargetWeight').value = TARGET_WEIGHT;
        document.getElementById('settingTargetFat').value = TARGET_FAT;

        const todayStr = getLocalLogicalDateStr(new Date());
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalLogicalDateStr(yesterday);

        const { data: tData } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
        const { data: yData } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();

        if (tData) {
            document.getElementById('settingWeight').value = tData.weight || "";
            document.getElementById('settingFat').value = tData.body_fat || "";
            
            if (tData.waketime) {
                const d = new Date(tData.waketime);
                document.getElementById('settingWaketime').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } else { document.getElementById('settingWaketime').value = ""; }

            if (tData.mental_condition) {
                document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const targetBtn = document.querySelector(`#settingMGrp .cond-btn[data-v="${tData.mental_condition}"]`);
                if(targetBtn) targetBtn.classList.add('active');
                settingMVal = tData.mental_condition;
            }
        } else {
            document.getElementById('settingWeight').value = "";
            document.getElementById('settingFat').value = "";
            document.getElementById('settingWaketime').value = "";
            document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => b.classList.remove('active'));
            const defaultBtn = document.querySelector(`#settingMGrp .cond-btn[data-v="3"]`);
            if(defaultBtn) defaultBtn.classList.add('active');
            settingMVal = 3;
        }

        if (yData && yData.bedtime) {
            const d = new Date(yData.bedtime);
            document.getElementById('settingBedtime').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else { 
            document.getElementById('settingBedtime').value = ""; 
        }

        settingsModal.style.display = 'flex';
    });

    document.getElementById('btnSettingsCancel').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    document.getElementById('btnSettingsSave').addEventListener('click', async () => {
        const btn = document.getElementById('btnSettingsSave');
        btn.disabled = true; btn.innerText = "Saving...";

        try {
            const tWeight = parseFloat(document.getElementById('settingTargetWeight').value);
            const tFat = parseFloat(document.getElementById('settingTargetFat').value);
            if (isNaN(tWeight) || isNaN(tFat)) { alert("目標数値を正しく入力してください。"); btn.disabled = false; btn.innerText = "Save Changes"; return; }
            
            localStorage.setItem('targetWeight_' + user.id, tWeight);
            localStorage.setItem('targetFat_' + user.id, tFat);
            TARGET_WEIGHT = tWeight; TARGET_FAT = tFat;

            const todayStr = getLocalLogicalDateStr(new Date());
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const wt = document.getElementById('settingWaketime').value;
            const bt = document.getElementById('settingBedtime').value;
            const wVal = document.getElementById('settingWeight').value;
            const fVal = document.getElementById('settingFat').value;

            let yPayload = { user_id: user.id, measured_date: yesterdayStr };
            if (bt) {
                let bDate = createSafeDate(yesterdayStr, bt);
                if (bDate.getHours() < 4) bDate.setDate(bDate.getDate() + 1);
                yPayload.bedtime = bDate.toISOString();
            } else {
                yPayload.bedtime = null; 
            }
            const { data: yExisting } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
            if (yExisting && yExisting.id) await supabaseClient.from('health_logs').update(yPayload).eq('id', yExisting.id);
            else await supabaseClient.from('health_logs').insert(yPayload);

            let tPayload = { user_id: user.id, measured_date: todayStr, mental_condition: parseInt(settingMVal) };
            if (wVal) tPayload.weight = parseFloat(wVal); else tPayload.weight = null;
            if (fVal) tPayload.body_fat = parseFloat(fVal); else tPayload.body_fat = null;

            if (wt) {
                tPayload.waketime = createSafeDate(todayStr, wt).toISOString();
                const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
                if (prevDay && prevDay.bedtime) {
                    let hours = (new Date(tPayload.waketime) - new Date(prevDay.bedtime)) / 3600000;
                    if (hours < 0) hours += 24;
                    tPayload.sleep_hours = parseFloat(hours.toFixed(1));
                }
            } else {
                tPayload.waketime = null;
                tPayload.sleep_hours = null;
            }

            const { data: tExisting } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            if (tExisting && tExisting.id) await supabaseClient.from('health_logs').update(tPayload).eq('id', tExisting.id);
            else await supabaseClient.from('health_logs').insert(tPayload);

            settingsModal.style.display = 'none';
            loadDashboard(); 
        } catch (err) {
            alert("エラーが発生しました: " + err.message);
        } finally {
            btn.disabled = false; btn.innerText = "Save Changes";
        }
    });

    function resetButtonUI(type) {
        let btn, icon, textSpan;
        if (type === 'wake') {
            btn = document.getElementById('btnWaketime'); icon = document.getElementById('wakeIcon'); textSpan = document.getElementById('wakeText');
            if(btn) {
                btn.classList.remove('recorded');
                icon.className = 'fas fa-sun'; textSpan.innerText = dict[currentLang].wake;
            }
        } else {
            btn = document.getElementById('btnBedtime'); icon = document.getElementById('bedIcon'); textSpan = document.getElementById('bedText');
            if(btn) {
                btn.classList.remove('recorded');
                icon.className = 'fas fa-moon'; textSpan.innerText = dict[currentLang].sleep;
            }
        }
    }

    function setButtonRecorded(type) {
        let btn, icon, textSpan;
        if (type === 'wake') {
            btn = document.getElementById('btnWaketime'); icon = document.getElementById('wakeIcon'); textSpan = document.getElementById('wakeText');
        } else {
            btn = document.getElementById('btnBedtime'); icon = document.getElementById('bedIcon'); textSpan = document.getElementById('bedText');
        }
        if(!btn) return;
        btn.classList.add('recorded');
        icon.className = 'fas fa-check-circle'; 
        textSpan.innerText = dict[currentLang].recorded; 
    }

    async function recordTime(type) {
        try {
            const now = new Date();
            const logicalDateStr = getLocalLogicalDateStr(now);
            const timeISO = now.toISOString();

            const { data: existing, error: fetchErr } = await supabaseClient.from('health_logs')
                .select('id, waketime, bedtime').eq('user_id', user.id).eq('measured_date', logicalDateStr).maybeSingle();

            if (fetchErr) throw fetchErr;

            const isAlreadyRecorded = existing && ((type === 'wake' && existing.waketime) || (type === 'bed' && existing.bedtime));

            if (isAlreadyRecorded) {
                if (confirm(dict[currentLang].confirm_undo)) {
                    let undoPayload = {};
                    if (type === 'wake') { undoPayload.waketime = null; undoPayload.sleep_hours = null; }
                    if (type === 'bed') { undoPayload.bedtime = null; }
                    
                    await supabaseClient.from('health_logs').update(undoPayload).eq('id', existing.id);
                    resetButtonUI(type);
                    loadDashboard();
                    showToast(dict[currentLang].msg_undo);
                }
                return;
            }

            let updatePayload = {};
            if (type === 'wake') {
                updatePayload.waketime = timeISO;
                const yesterday = new Date(now.getTime()); yesterday.setDate(yesterday.getDate() - 1);
                const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', getLocalLogicalDateStr(yesterday)).maybeSingle();
                
                if (prevDay && prevDay.bedtime) {
                    let diff = (new Date(timeISO) - new Date(prevDay.bedtime)) / (1000 * 60 * 60);
                    if (diff < 0) diff += 24; 
                    updatePayload.sleep_hours = parseFloat(diff.toFixed(1));
                }
                showToast(dict[currentLang].msg_wake);
            } else if (type === 'bed') {
                updatePayload.bedtime = timeISO;
                showToast(dict[currentLang].msg_sleep);
            }

            if (existing && existing.id) {
                const { error: updateErr } = await supabaseClient.from('health_logs').update(updatePayload).eq('id', existing.id);
                if (updateErr) throw updateErr;
            } else {
                updatePayload.user_id = user.id; updatePayload.measured_date = logicalDateStr;
                const { error: insertErr } = await supabaseClient.from('health_logs').insert(updatePayload);
                if (insertErr) throw insertErr;
            }

            setButtonRecorded(type);
            loadDashboard();

        } catch (e) {
            console.error("Record Time Error:", e);
            alert("保存エラーが発生しました: " + e.message);
        }
    }

    document.getElementById('btnBedtime').addEventListener('click', () => recordTime('bed'));
    document.getElementById('btnWaketime').addEventListener('click', () => recordTime('wake'));

    async function loadDashboard() {
        try {
            const now = new Date();
            const logicalDateStr = getLocalLogicalDateStr(now);

            resetButtonUI('wake');
            resetButtonUI('bed');

            const { data: todayLog } = await supabaseClient.from('health_logs')
                .select('waketime, bedtime').eq('user_id', user.id).eq('measured_date', logicalDateStr).maybeSingle();
            
            if (todayLog) {
                if (todayLog.waketime) setButtonRecorded('wake');
                if (todayLog.bedtime) setButtonRecorded('bed');
            }

            // ★KPIデータの反映（月間記録日数の復活を含む）
            const { data: kpiData, error: kpiErr } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
            if (!kpiErr && kpiData && kpiData.length > 0) {
                const streakEl = document.getElementById('streakDays');
                const compEl = document.getElementById('completionRate');
                const monthEl = document.getElementById('monthCount');
                if (streakEl) streakEl.innerText = kpiData[0].streak_days;
                if (compEl) compEl.innerText = Math.round(kpiData[0].log_completion_rate);
                if (monthEl) monthEl.innerText = kpiData[0].this_month_count || 0;
            }

            // ★AIカロリー集計の反映（今日のデータを合算）
            const { data: todayMeals } = await supabaseClient.from('meal_logs')
                .select('calories')
                .eq('user_id', user.id)
                .eq('meal_date', logicalDateStr);
            
            let totalCal = 0;
            if (todayMeals) {
                totalCal = todayMeals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
            }
            const calEl = document.getElementById('todayCalories');
            if (calEl) calEl.innerText = totalCal;

            const { data: recentLogs, error: logErr } = await supabaseClient.from('health_logs')
                .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
            
            if (logErr) throw logErr;

            if (recentLogs && recentLogs.length > 0) {
                const current = recentLogs[0];
                const previous = recentLogs.length > 1 ? recentLogs[1] : null;

                const weightEl = document.getElementById('latestWeight');
                if (weightEl) weightEl.innerText = current.weight ? current.weight.toFixed(1) + " kg" : "-- kg";
                
                const deltaWEl = document.getElementById('deltaWeight');
                if (deltaWEl && current.weight && previous && previous.weight) {
                    const diff = current.weight - previous.weight;
                    if (diff > 0) { deltaWEl.innerHTML = `Δ +${diff.toFixed(1)} kg`; deltaWEl.className = "kpi-delta delta-bad"; } 
                    else if (diff < 0) { deltaWEl.innerHTML = `Δ ${diff.toFixed(1)} kg`; deltaWEl.className = "kpi-delta delta-good"; } 
                    else { deltaWEl.innerText = "Δ 0.0 kg"; deltaWEl.className = "kpi-delta delta-neutral"; }
                }

                const fatEl = document.getElementById('latestFat');
                if (fatEl) fatEl.innerText = current.body_fat ? current.body_fat.toFixed(1) + " %" : "-- %";
                
                const deltaFEl = document.getElementById('deltaFat');
                if (deltaFEl && current.body_fat && previous && previous.body_fat) {
                    const diff = current.body_fat - previous.body_fat;
                    if (diff > 0) { deltaFEl.innerHTML = `Δ +${diff.toFixed(1)} %`; deltaFEl.className = "kpi-delta delta-bad"; } 
                    else if (diff < 0) { deltaFEl.innerHTML = `Δ ${diff.toFixed(1)} %`; deltaFEl.className = "kpi-delta delta-good"; } 
                    else { deltaFEl.innerText = "Δ 0.0 %"; deltaFEl.className = "kpi-delta delta-neutral"; }
                }

                const sleepEl = document.getElementById('latestSleep');
                if (sleepEl) sleepEl.innerText = current.sleep_hours ? current.sleep_hours.toFixed(1) + " h" : "-- h";
                
                const deltaSEl = document.getElementById('deltaSleep');
                if (deltaSEl && current.sleep_hours && previous && previous.sleep_hours) {
                    const diff = current.sleep_hours - previous.sleep_hours;
                    if (diff > 0) { deltaSEl.innerHTML = `Δ +${diff.toFixed(1)} h`; deltaSEl.className = "kpi-delta delta-good"; } 
                    else if (diff < 0) { deltaSEl.innerHTML = `Δ ${diff.toFixed(1)} h`; deltaSEl.className = "kpi-delta delta-bad"; } 
                    else { deltaSEl.innerText = "Δ 0.0 h"; deltaSEl.className = "kpi-delta delta-neutral"; }
                }

                const mentalEl = document.getElementById('latestMental');
                if (mentalEl) mentalEl.innerHTML = current.mental_condition ? mentalIcons[current.mental_condition - 1] : "--";
            }

            const { data: chartData, error: chartErr } = await supabaseClient.from('health_logs')
                .select('measured_date, weight, body_fat, sleep_hours, mental_condition')
                .eq('user_id', user.id)
                .order('measured_date', { ascending: false }) 
                .limit(7);
            
            if (chartErr) throw chartErr;
            if (chartData) {
                globalChartLogs = chartData.reverse(); 
                renderDynamicChart();
            }

        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    }

    function renderDynamicChart() {
        if (globalChartLogs.length === 0) return;
        const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
        if (window.dashChart) window.dashChart.destroy();

        const labels = globalChartLogs.map(l => l.measured_date.split('-')[2]); 
        let datasets = [];
        let scales = {
            x: { ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        };

        if (currentChartMode === 'weight') {
            datasets = [
                {
                    label: 'Weight (kg)', data: globalChartLogs.map(l => l.weight),
                    type: 'line', borderColor: '#f8fafc', borderWidth: 2, pointBackgroundColor: '#f8fafc',
                    pointBorderColor: '#fbbf24', pointBorderWidth: 2, pointRadius: 4, tension: 0.3, yAxisID: 'y1'
                },
                {
                    label: `TARGET ${TARGET_WEIGHT.toFixed(1)}kg`, data: globalChartLogs.map(() => TARGET_WEIGHT),
                    type: 'line', borderColor: 'rgba(251, 191, 36, 0.5)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, yAxisID: 'y1'
                },
                {
                    label: 'Fat (%)', data: globalChartLogs.map(l => l.body_fat),
                    type: 'line', borderColor: '#38bdf8', borderWidth: 2, pointBackgroundColor: '#38bdf8', tension: 0.3, yAxisID: 'y2'
                }
            ];
            scales.y1 = { position: 'right', ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } };
            scales.y2 = { position: 'left', ticks: { color: '#38bdf8', font: { family: 'Inter' } }, grid: { display: false } };
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');gradient.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
            datasets = [
                {
                    label: 'Sleep (h)', data: globalChartLogs.map(l => l.sleep_hours),
                    type: 'bar', backgroundColor: gradient, borderColor: 'rgba(251, 191, 36, 0.5)', borderWidth: 1, barPercentage: 0.5, yAxisID: 'y1'
                },
                {
                    label: 'Mental', data: globalChartLogs.map(l => l.mental_condition),
                    type: 'line', borderColor: '#10b981', pointBackgroundColor: '#10b981', borderWidth: 2, tension: 0.3, yAxisID: 'y2'
                }
            ];
            scales.y1 = { position: 'left', min: 0, max: 12, ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } };
            scales.y2 = { position: 'right', min: 1, max: 5, ticks: { color: '#10b981', font: { family: 'Inter' } }, grid: { display: false } };
        }

        window.dashChart = new Chart(ctx, {
            type: 'bar', 
            data: { labels, datasets },
            options: {
                plugins: { legend: { display: false } },
                layout: { padding: { top: 20 } },
                scales
            }
        });
    }

    document.getElementById('modeWeight').addEventListener('click', (e) => {
        currentChartMode = 'weight';
        document.getElementById('modeWeight').classList.add('active');
        document.getElementById('modeSleep').classList.remove('active');
        renderDynamicChart();
    });
    document.getElementById('modeSleep').addEventListener('click', (e) => {
        currentChartMode = 'sleep';
        document.getElementById('modeSleep').classList.add('active');
        document.getElementById('modeWeight').classList.remove('active');
        renderDynamicChart();
    });

    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => {
        document.getElementById('quickMealDate').value = getLocalLogicalDateStr(new Date());
        mealModal.style.display = 'flex';
    });
    document.getElementById('btnMealCancel').addEventListener('click', () => {
        mealModal.style.display = 'none';
    });

    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const btn = document.getElementById('btnMealSave');
        const mealDate = document.getElementById('quickMealDate').value;
        const type = document.getElementById('quickMealType').value;
        let memo = document.getElementById('quickMealMemo').value;
        const fileInput = document.getElementById('quickMealImage');
        
        if (!mealDate) return;
        btn.disabled = true; 
        btn.innerText = fileInput.files.length > 0 ? dict[currentLang].msg_ai_analyzing : "Saving...";

        try {
            let imageUrl = null;
            let finalCalories = null;

            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                imageUrl = await uploadCompressedImage(file, user.id);
                
                try {
                    const response = await fetch('/api/analyze-meal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: imageUrl, memo: memo })
                    });
                    
                    if (response.ok) {
                        const aiData = await response.json();
                        finalCalories = aiData.calories;
                        memo = memo ? `${memo}\n---\n[AI Analysis] ${aiData.analysis}` : `[AI Analysis] ${aiData.analysis}`;
                    } else {
                        console.warn("AI Analysis failed with status:", response.status);
                    }
                } catch (aiInvokeError) {
                    console.warn("AI Analysis skipped or failed:", aiInvokeError);
                }
            }

            const { error } = await supabaseClient.from('meal_logs').insert({
                user_id: user.id, 
                meal_date: mealDate, 
                meal_type: type, 
                content: memo, 
                image_url: imageUrl, 
                calories: finalCalories,
                created_at: new Date().toISOString()
            });

            if (error) throw error;
            
            mealModal.style.display = 'none';
            document.getElementById('quickMealMemo').value = '';
            document.getElementById('quickMealImage').value = '';
            
            // ★ 保存完了後にダッシュボードをリロードしてカロリーを即座にUIへ反映させる
            loadDashboard();
            showToast("Meal recorded!");

        } catch (err) { 
            alert("Error: " + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = "Save"; 
        }
    });

    async function uploadCompressedImage(file, userId) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width; let height = img.height;
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(async blob => {
                        const fileName = `${userId}/${Date.now()}.jpg`;
                        const { data, error } = await supabaseClient.storage.from('meal_images').upload(fileName, blob, { contentType: 'image/jpeg' });
                        if (error) reject(error);
                        const { data: publicUrlData } = supabaseClient.storage.from('meal_images').getPublicUrl(fileName);
                        resolve(publicUrlData.publicUrl);
                    }, 'image/jpeg', 0.8);
                };
            };
            reader.onerror = error => reject(error);
        });
    }

    async function checkInitialSetup() {
        const localFlag = localStorage.getItem('initSetup_' + user.id);
        if (localFlag === 'true') { loadDashboard(); return; }
        
        const { data } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).limit(1);
        if (!data || data.length === 0) {
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
            localStorage.setItem('initSetup_' + user.id, 'true');
            loadDashboard();
        }
    }

    let initMVal = 3;
    document.querySelectorAll('#initMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#initMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); initMVal = b.dataset.v;
        });
    });

    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true; btn.innerText = "Processing...";
        const tWeight = document.getElementById('initTargetWeight').value;
        const tFat = document.getElementById('initTargetFat').value;
        localStorage.setItem('targetWeight_' + user.id, tWeight);
        localStorage.setItem('targetFat_' + user.id, tFat);
        TARGET_WEIGHT = parseFloat(tWeight); TARGET_FAT = parseFloat(tFat);

        try {
            const now = new Date();
            const todayStr = getLocalLogicalDateStr(now);
            const yesterday = new Date(now.getTime()); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const btVal = document.getElementById('initBedtime').value;
            const wtVal = document.getElementById('initWaketime').value;
            const wVal = document.getElementById('initWeight').value;
            const fVal = document.getElementById('initFat').value;

            let bDate = createSafeDate(yesterdayStr, btVal);
            if (bDate.getHours() < 4) bDate.setDate(bDate.getDate() + 1);
            
            let wDate = createSafeDate(todayStr, wtVal);
            let sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));
            if (sleepHours < 0) sleepHours += 24;

            const yestPayload = { user_id: user.id, measured_date: yesterdayStr, bedtime: bDate.toISOString() };
            const { data: yData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
            if (yData) await supabaseClient.from('health_logs').update(yestPayload).eq('id', yData.id);
            else await supabaseClient.from('health_logs').insert(yestPayload);

            const todayPayload = { user_id: user.id, measured_date: todayStr, waketime: wDate.toISOString(), sleep_hours: sleepHours, mental_condition: parseInt(initMVal) };
            if (wVal) todayPayload.weight = parseFloat(wVal);
            if (fVal) todayPayload.body_fat = parseFloat(fVal);

            const { data: tData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            if (tData) await supabaseClient.from('health_logs').update(todayPayload).eq('id', tData.id);
            else await supabaseClient.from('health_logs').insert(todayPayload);

            localStorage.setItem('initSetup_' + user.id, 'true');
            document.getElementById('initialSetupModal').style.display = 'none';
            loadDashboard();
        } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
    });

    checkInitialSetup();
});