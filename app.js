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
    
    // ★ Null回避：要素が存在する場合のみイベントを付与する（全要素に徹底）
    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'ja' : 'en';
            localStorage.setItem('appLang_' + user.id, currentLang);
            updateLanguage();
            if (typeof loadDashboard === 'function') loadDashboard(); 
        });
    }
    updateLanguage(); 

    function showToast(msg) {
        const toast = document.getElementById('toastMsg');
        if (!toast) return;
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

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "login.html";
        });
    }

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

    // --- マニュアル（Guide）モーダル制御 ---
    const btnGuideOpen = document.getElementById('btnGuideOpen');
    const btnGuideClose = document.getElementById('btnGuideClose');
    const guideModal = document.getElementById('guideModal');
    const settingsModal = document.getElementById('settingsModal');

    if (btnGuideOpen && guideModal && settingsModal) {
        btnGuideOpen.addEventListener('click', () => {
            settingsModal.style.display = 'none';
            guideModal.style.display = 'flex';
        });
    }
    if (btnGuideClose && guideModal && settingsModal) {
        btnGuideClose.addEventListener('click', () => {
            guideModal.style.display = 'none';
            settingsModal.style.display = 'flex';
        });
    }

    // --- KPIカードの詳細解説ポップアップ機能 ---
    const kpiAdvice = {
        ja: {
            weight: "体重は日々の水分量で1〜2kg変動します。一喜一憂せず、7日間のトレンドラインで増減を確認してください。",
            fat_p: "体脂肪率は測定時間や水分量に大きく影響されます。毎日同じ条件（起床直後など）で測定し、長期的な傾向を追うことが重要です。",
            calories: "AIが算出した本日の推定摂取カロリーです。基礎代謝と活動代謝の合計以内に収めることで、計画的なコントロールが可能です。",
            sleep_h: "睡眠はリカバリーの最重要ファクターです。7時間前後を確保することで、メンタルと体重の安定に直結します。",
            mental: "メンタルコンディションは、睡眠時間と食事内容に強い相関があります。スコアが低い日が続く場合は、意識的な休息が必要です。",
            streak: "記録の連続日数は、自己管理スキームの定着度を示します。途切れても気にせず、まずは「再開すること」を最優先してください。",
            completion: "過去30日間の記録完了率です。80%以上をキープすることで、精度の高いデータ分析と軌道修正が可能になります。",
            month_count: "今月記録を行った合計日数です。小さな積み重ねが、目標達成への最も確実なプロセスとなります。"
        },
        en: {
            weight: "Weight fluctuates by 1-2kg daily due to water retention. Focus on the 7-day trend rather than daily changes.",
            fat_p: "Body fat percentage is affected by hydration. Measure under the same conditions daily for accurate tracking.",
            calories: "Today's estimated total calories analyzed by AI. Keeping this within your total daily energy expenditure ensures progress.",
            sleep_h: "Sleep is the most critical recovery factor. Aiming for around 7 hours directly stabilizes mental and physical health.",
            mental: "Mental condition strongly correlates with sleep and diet. If scores drop consistently, prioritize intentional rest.",
            streak: "Consecutive days logged shows your habit consistency. If you break the streak, prioritize restarting immediately.",
            completion: "Log completion rate over the last 30 days. Maintaining 80%+ enables highly accurate data analysis and adjustments.",
            month_count: "Total days logged this month. Consistent small steps are the most reliable process for achieving your goals."
        }
    };

    const kpiModal = document.getElementById('kpiModal');
    const btnKpiClose = document.getElementById('btnKpiClose');
    if (btnKpiClose && kpiModal) {
        btnKpiClose.addEventListener('click', () => { kpiModal.style.display = 'none'; });
    }

    document.querySelectorAll('.kpi-card').forEach((card) => {
        card.addEventListener('click', () => {
            if (!kpiModal) return;
            const key = card.getAttribute('data-kpi-key');
            const labelEl = card.querySelector('.kpi-label');
            const valueEl = card.querySelector('.kpi-value');

            const titleEl = document.getElementById('kpiModalTitle');
            const valEl = document.getElementById('kpiModalValue');
            const descEl = document.getElementById('kpiModalDesc');

            if(titleEl) titleEl.innerText = labelEl ? labelEl.innerText : 'Detail';
            if(valEl) valEl.innerHTML = valueEl ? valueEl.innerHTML : '--';
            if(descEl) descEl.innerText = key && kpiAdvice[currentLang][key] ? kpiAdvice[currentLang][key] : "";
            
            kpiModal.style.display = 'flex';
        });
    });

    // --- セッティング画面のロジック ---
    let settingMVal = 3;
    document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#settingMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); 
            settingMVal = b.dataset.v;
        });
    });

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            const targetW = document.getElementById('settingTargetWeight');
            const targetF = document.getElementById('settingTargetFat');
            if(targetW) targetW.value = TARGET_WEIGHT;
            if(targetF) targetF.value = TARGET_FAT;

            const todayStr = getLocalLogicalDateStr(new Date());
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const { data: tData } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            const { data: yData } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();

            const sWeight = document.getElementById('settingWeight');
            const sFat = document.getElementById('settingFat');
            const sWake = document.getElementById('settingWaketime');
            const sBed = document.getElementById('settingBedtime');

            if (tData) {
                if(sWeight) sWeight.value = tData.weight || "";
                if(sFat) sFat.value = tData.body_fat || "";
                if (sWake) {
                    if(tData.waketime) {
                        const d = new Date(tData.waketime);
                        sWake.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    } else sWake.value = "";
                }
                if (tData.mental_condition) {
                    document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => b.classList.remove('active'));
                    const targetBtn = document.querySelector(`#settingMGrp .cond-btn[data-v="${tData.mental_condition}"]`);
                    if(targetBtn) targetBtn.classList.add('active');
                    settingMVal = tData.mental_condition;
                }
            } else {
                if(sWeight) sWeight.value = "";
                if(sFat) sFat.value = "";
                if(sWake) sWake.value = "";
                document.querySelectorAll('#settingMGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const defaultBtn = document.querySelector(`#settingMGrp .cond-btn[data-v="3"]`);
                if(defaultBtn) defaultBtn.classList.add('active');
                settingMVal = 3;
            }

            if (sBed) {
                if (yData && yData.bedtime) {
                    const d = new Date(yData.bedtime);
                    sBed.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                } else sBed.value = "";
            }

            if (settingsModal) settingsModal.style.display = 'flex';
        });
    }

    const btnSettingsCancel = document.getElementById('btnSettingsCancel');
    if (btnSettingsCancel && settingsModal) {
        btnSettingsCancel.addEventListener('click', () => { settingsModal.style.display = 'none'; });
    }

    const btnSettingsSave = document.getElementById('btnSettingsSave');
    if (btnSettingsSave) {
        btnSettingsSave.addEventListener('click', async () => {
            btnSettingsSave.disabled = true; btnSettingsSave.innerText = "Saving...";

            try {
                const tWeightEl = document.getElementById('settingTargetWeight');
                const tFatEl = document.getElementById('settingTargetFat');
                
                if (tWeightEl && tFatEl) {
                    const tWeight = parseFloat(tWeightEl.value);
                    const tFat = parseFloat(tFatEl.value);
                    if (isNaN(tWeight) || isNaN(tFat)) { 
                        alert("目標数値を正しく入力してください。"); 
                        btnSettingsSave.disabled = false; btnSettingsSave.innerText = "Save Changes"; 
                        return; 
                    }
                    localStorage.setItem('targetWeight_' + user.id, tWeight);
                    localStorage.setItem('targetFat_' + user.id, tFat);
                    TARGET_WEIGHT = tWeight; TARGET_FAT = tFat;
                }

                const todayStr = getLocalLogicalDateStr(new Date());
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = getLocalLogicalDateStr(yesterday);

                const wt = document.getElementById('settingWaketime') ? document.getElementById('settingWaketime').value : null;
                const bt = document.getElementById('settingBedtime') ? document.getElementById('settingBedtime').value : null;
                const wVal = document.getElementById('settingWeight') ? document.getElementById('settingWeight').value : null;
                const fVal = document.getElementById('settingFat') ? document.getElementById('settingFat').value : null;

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

                if (settingsModal) settingsModal.style.display = 'none';
                if (typeof loadDashboard === 'function') loadDashboard(); 
            } catch (err) {
                alert("エラーが発生しました: " + err.message);
            } finally {
                btnSettingsSave.disabled = false; btnSettingsSave.innerText = "Save Changes";
            }
        });
    }

    function resetButtonUI(type) {
        let btn, icon, textSpan;
        if (type === 'wake') {
            btn = document.getElementById('btnWaketime'); icon = document.getElementById('wakeIcon'); textSpan = document.getElementById('wakeText');
            if(btn) {
                btn.classList.remove('recorded');
                if(icon) icon.className = 'fas fa-sun'; 
                if(textSpan) textSpan.innerText = dict[currentLang].wake;
            }
        } else {
            btn = document.getElementById('btnBedtime'); icon = document.getElementById('bedIcon'); textSpan = document.getElementById('bedText');
            if(btn) {
                btn.classList.remove('recorded');
                if(icon) icon.className = 'fas fa-moon'; 
                if(textSpan) textSpan.innerText = dict[currentLang].sleep;
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
        if(icon) icon.className = 'fas fa-check-circle'; 
        if(textSpan) textSpan.innerText = dict[currentLang].recorded; 
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
                    if (typeof loadDashboard === 'function') loadDashboard();
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
            if (typeof loadDashboard === 'function') loadDashboard();

        } catch (e) {
            console.error("Record Time Error:", e);
            alert("保存エラーが発生しました: " + e.message);
        }
    }

    const btnBedtime = document.getElementById('btnBedtime');
    if (btnBedtime) btnBedtime.addEventListener('click', () => recordTime('bed'));
    
    const btnWaketime = document.getElementById('btnWaketime');
    if (btnWaketime) btnWaketime.addEventListener('click', () => recordTime('wake'));

    // ダッシュボード更新ロジック
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

            const { data: kpiData, error: kpiErr } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
            if (!kpiErr && kpiData && kpiData.length > 0) {
                const streakEl = document.getElementById('streakDays');
                const compEl = document.getElementById('completionRate');
                const monthEl = document.getElementById('monthCount');
                if (streakEl) streakEl.innerText = kpiData[0].streak_days;
                if (compEl) compEl.innerText = Math.round(kpiData[0].log_completion_rate);
                if (monthEl) monthEl.innerText = kpiData[0].this_month_count || 0;
            }

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
                if (document.getElementById('healthCorrelationChart')) {
                    renderDynamicChart();
                }
            }

        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    }

    window.loadDashboard = loadDashboard; // グローバルに関数を公開（他のJSファイルやインラインイベントから呼べるようにする）

    function renderDynamicChart() {
        if (globalChartLogs.length === 0) return;
        const ctxEl = document.getElementById('healthCorrelationChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');
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

    const modeWeight = document.getElementById('modeWeight');
    const modeSleep = document.getElementById('modeSleep');
    if (modeWeight && modeSleep) {
        modeWeight.addEventListener('click', () => {
            currentChartMode = 'weight';
            modeWeight.classList.add('active'); modeSleep.classList.remove('active');
            renderDynamicChart();
        });
        modeSleep.addEventListener('click', () => {
            currentChartMode = 'sleep';
            modeSleep.classList.add('active'); modeWeight.classList.remove('active');
            renderDynamicChart();
        });
    }

    const mealModal = document.getElementById('mealModal');
    const btnMealOpen = document.getElementById('btnMealOpen');
    const btnMealCancel = document.getElementById('btnMealCancel');
    
    if (btnMealOpen && mealModal) {
        btnMealOpen.addEventListener('click', () => {
            document.getElementById('quickMealDate').value = getLocalLogicalDateStr(new Date());
            mealModal.style.display = 'flex';
        });
    }
    if (btnMealCancel && mealModal) {
        btnMealCancel.addEventListener('click', () => { mealModal.style.display = 'none'; });
    }

    const btnMealSave = document.getElementById('btnMealSave');
    if (btnMealSave) {
        btnMealSave.addEventListener('click', async () => {
            const mealDate = document.getElementById('quickMealDate').value;
            const type = document.getElementById('quickMealType').value;
            let memo = document.getElementById('quickMealMemo').value;
            const fileInput = document.getElementById('quickMealImage');
            
            if (!mealDate) return;
            btnMealSave.disabled = true; 
            btnMealSave.innerText = fileInput.files.length > 0 ? dict[currentLang].msg_ai_analyzing : "Saving...";

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
                
                if(mealModal) mealModal.style.display = 'none';
                document.getElementById('quickMealMemo').value = '';
                document.getElementById('quickMealImage').value = '';
                
                if (typeof loadDashboard === 'function') loadDashboard();
                showToast("Meal recorded!");

            } catch (err) { 
                alert("Error: " + err.message); 
            } finally { 
                btnMealSave.disabled = false; 
                btnMealSave.innerText = "Save"; 
            }
        });
    }

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
        if (localFlag === 'true') { 
            if (typeof loadDashboard === 'function') loadDashboard(); 
            return; 
        }
        
        const { data } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).limit(1);
        const initialSetupModal = document.getElementById('initialSetupModal');
        
        if (!data || data.length === 0) {
            if (initialSetupModal) initialSetupModal.style.display = 'flex';
        } else {
            localStorage.setItem('initSetup_' + user.id, 'true');
            if (typeof loadDashboard === 'function') loadDashboard();
        }
    }

    let initMVal = 3;
    document.querySelectorAll('#initMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#initMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); initMVal = b.dataset.v;
        });
    });

    const initialSetupForm = document.getElementById('initialSetupForm');
    if (initialSetupForm) {
        initialSetupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('initSaveBtn');
            btn.disabled = true; btn.innerText = "Processing...";
            const tWeight = document.getElementById('initTargetWeight');
            const tFat = document.getElementById('initTargetFat');
            let tWeightVal = TARGET_WEIGHT, tFatVal = TARGET_FAT;
            if(tWeight) tWeightVal = parseFloat(tWeight.value);
            if(tFat) tFatVal = parseFloat(tFat.value);

            localStorage.setItem('targetWeight_' + user.id, tWeightVal);
            localStorage.setItem('targetFat_' + user.id, tFatVal);
            TARGET_WEIGHT = tWeightVal; TARGET_FAT = tFatVal;

            try {
                const now = new Date();
                const todayStr = getLocalLogicalDateStr(now);
                const yesterday = new Date(now.getTime()); yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = getLocalLogicalDateStr(yesterday);

                const btInput = document.getElementById('initBedtime');
                const wtInput = document.getElementById('initWaketime');
                const wInput = document.getElementById('initWeight');
                const fInput = document.getElementById('initFat');

                const btVal = btInput ? btInput.value : null;
                const wtVal = wtInput ? wtInput.value : null;
                const wVal = wInput ? wInput.value : null;
                const fVal = fInput ? fInput.value : null;

                let bDate = createSafeDate(yesterdayStr, btVal);
                if (bDate && bDate.getHours() < 4) bDate.setDate(bDate.getDate() + 1);
                
                let wDate = createSafeDate(todayStr, wtVal);
                let sleepHours = null;
                if(wDate && bDate) {
                    sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));
                    if (sleepHours < 0) sleepHours += 24;
                }

                let yestPayload = { user_id: user.id, measured_date: yesterdayStr };
                if (bDate) yestPayload.bedtime = bDate.toISOString();
                
                const { data: yData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
                if (yData) await supabaseClient.from('health_logs').update(yestPayload).eq('id', yData.id);
                else await supabaseClient.from('health_logs').insert(yestPayload);

                let todayPayload = { user_id: user.id, measured_date: todayStr, mental_condition: parseInt(initMVal) };
                if (wDate) todayPayload.waketime = wDate.toISOString();
                if (sleepHours !== null) todayPayload.sleep_hours = sleepHours;
                if (wVal) todayPayload.weight = parseFloat(wVal);
                if (fVal) todayPayload.body_fat = parseFloat(fVal);

                const { data: tData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
                if (tData) await supabaseClient.from('health_logs').update(todayPayload).eq('id', tData.id);
                else await supabaseClient.from('health_logs').insert(todayPayload);

                localStorage.setItem('initSetup_' + user.id, 'true');
                const initialSetupModal = document.getElementById('initialSetupModal');
                if (initialSetupModal) initialSetupModal.style.display = 'none';
                if (typeof loadDashboard === 'function') loadDashboard();
            } catch (err) { alert("Error: " + err.message); if(btn) btn.disabled = false; }
        });
    }

    // どのページにいても安全に実行するための分岐
    if (document.getElementById('latestWeight') || document.getElementById('btnMealOpen')) {
        checkInitialSetup();
    }
});