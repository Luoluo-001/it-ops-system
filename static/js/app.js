// API基础配置（使用当前域名，避免localhost/127.0.0.1不一致导致Cookie丢失）
const API_BASE = `${window.location.origin}/api`;


// 全局fetch包装函数（自动携带credentials）
const apiFetch = (url, options = {}) => {
    const defaultHeaders = {};
    
    // 如果body不是FormData，则设置Content-Type为json
    if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
    }
    
    return fetch(url, {
        ...options,
        credentials: "include",
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
};

// 全局变量
let currentPage = "dashboard";

let currentEventId = null;
let currentSystemId = null;
let processStepCounter = 0;
let eventAttachments = [];
let hostCounter = 0;
let middlewareCounter = 0;
let currentConfigKey = null;
let configCache = {};
let editingRobotName = null;
let planTaskView = 'all';
let planTaskDataCache = [];
let planTaskPrepCache = {};

let planTaskPage = 1;
let planTaskPerPage = 10;
let statusAction = null;
let statusTaskId = null;

let planTaskPreparations = [];


const DEFAULT_REMINDER_TEMPLATE = "任务：{title}\n时间：{plan_time}\n负责人：{owner}\n准备进度：{prep_progress}\n准备清单：{preparations}";


/**
 * 设置高清晰度 Canvas (处理 Retina/High-DPI 屏幕)
 */
function setupCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 如果没有提供 width/height，则使用容器或现有尺寸
    const logicalWidth = width || canvas.clientWidth || rect.width || 300;
    const logicalHeight = height || canvas.clientHeight || rect.height || 300;
    
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
}




// 页面初始化
document.addEventListener("DOMContentLoaded", function() {
    initNavigation();
    loadDictConfigs(); // 加载字典配置
    setPlanTaskTabActive('all');
    initHeaderUserMenu();
    initLogoutButtons();
    checkCurrentUser(); // 检查当前用户及权限
    
    const urlPage = new URLSearchParams(window.location.search).get('page');

    const savedPage = localStorage.getItem('currentPage');
    const startPage = urlPage || savedPage || 'dashboard';
    showPage(startPage);

    // 事件上传区域点击事件

    const uploadArea = document.getElementById("event-upload-area");
    if (uploadArea) {
        uploadArea.addEventListener("click", function() {
            document.getElementById("event-file-input").click();
        });
    }

    const scheduleTypeSelect = document.getElementById("plan-task-schedule-type");
    if (scheduleTypeSelect) {
        scheduleTypeSelect.addEventListener("change", handlePlanTaskScheduleChange);
    }

    const planSearchInput = document.getElementById("plan-task-keyword");
    if (planSearchInput) {
        planSearchInput.addEventListener("keyup", function(event) {
            if (event.key === "Enter") {
                loadPlanTasks(planTaskView);
            }
        });
    }

    const reminderToggle = document.getElementById("plan-task-reminder-enabled");
    if (reminderToggle) {
        reminderToggle.addEventListener("change", () => toggleReminderFields(reminderToggle.checked));
        toggleReminderFields(reminderToggle.checked);
    }

    const perPageSelect = document.getElementById("plan-task-per-page");
    if (perPageSelect) {
        perPageSelect.addEventListener("change", () => {
            planTaskPerPage = Number(perPageSelect.value) || 10;
            planTaskPage = 1;
            renderPlanTaskTable(planTaskDataCache);
            updatePlanTaskPagination(planTaskDataCache.length);
        });
    }
});





// 导航初始化
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            const page = this.getAttribute("data-page");
            if (page) {
                showPage(page);
            }
        });
    });
}

async function checkCurrentUser() {
    try {
        const response = await apiFetch(`${API_BASE}/current-user`);
        const result = await response.json();
        
        if (result.code === 0) {
            const user = result.data;
            // 更新顶部用户信息
            const nameEl = document.getElementById("header-username");
            const roleEl = document.getElementById("header-role");
            const avatarEl = document.getElementById("header-avatar");
            
            if (nameEl) nameEl.textContent = user.real_name || user.username;
            if (roleEl) roleEl.textContent = user.role === 'admin' ? '系统管理员' : '普通用户';
            if (avatarEl) {
                const initial = (user.real_name || user.username || "A").trim().charAt(0).toUpperCase();
                avatarEl.textContent = initial;
            }
            
            // 根据权限隐藏/显示功能
            const isAdmin = user.role === 'admin';
            document.querySelectorAll(".admin-only").forEach(el => {
                el.style.display = isAdmin ? "" : "none";
            });
            
            // 如果普通用户强行通过URL进入管理员页面，跳转回仪表盘
            if (!isAdmin && (currentPage === 'users' || currentPage === 'config')) {
                showPage('dashboard');
            }
        } else {
            // 未登录或登录过期
            window.location.href = "/login.html";
        }
    } catch (error) {
        console.error("检查用户信息失败:", error);
    }
}

function initHeaderUserMenu() {

    const menu = document.getElementById("user-menu");
    const toggle = document.getElementById("user-menu-toggle");
    const dropdown = document.getElementById("user-dropdown");
    const nameEl = document.getElementById("header-username");
    const avatarEl = document.getElementById("header-avatar");

    if (avatarEl && nameEl) {
        const initial = (nameEl.textContent || "A").trim().charAt(0).toUpperCase() || "A";
        avatarEl.textContent = initial;
    }

    if (!menu || !toggle || !dropdown) return;

    toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = menu.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (event) => {
        if (!menu.contains(event.target)) {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    });
}

function initLogoutButtons() {
    const ids = ["logout-btn", "header-logout-btn"];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener("click", handleLogout);
        }
    });
}

async function handleLogout(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (!confirm("确定要退出登录吗?")) {
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/logout`, {
            method: "POST"
        });

        const result = await response.json();

        if (result.code === 0) {
            showToast("已退出登录", "success");
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 500);
        }
    } catch (error) {
        console.error("退出登录失败:", error);
        showToast("退出登录失败", "error");
    }
}

// 显示页面
function showPage(pageName) {
    // 权限检查
    const adminPages = ['users', 'config', 'notification-audits'];

    if (adminPages.includes(pageName)) {
        const roleEl = document.getElementById("header-role");
        const role = roleEl ? roleEl.textContent : '';
        if (role && role !== '系统管理员') {
            showToast("权限不足，无法访问该页面", "error");
            return;
        }
    }

    const transition = document.getElementById('page-transition');
    if (transition) {
        transition.classList.add('active');
    }

    setTimeout(() => {
        // 更新导航激活状态
        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.remove("active");
            if (item.getAttribute("data-page") === pageName) {
                item.classList.add("active");
            }
        });
        
        // 显示对应页面
        document.querySelectorAll(".page").forEach(page => {
            page.style.display = "none";
        });
        
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.style.display = "block";
            currentPage = pageName;
            localStorage.setItem('currentPage', pageName);
            
            // 加载页面数据
            loadPageData(pageName);
        } else if (pageName !== 'dashboard') {
            showPage('dashboard');
        }

        if (transition) {
            setTimeout(() => {
                transition.classList.remove('active');
            }, 200);
        }
    }, 250);
}



// 加载页面数据
function loadPageData(pageName) {
    switch(pageName) {
        case "dashboard":
            loadDashboard();
            break;
        case "business-systems":
            loadBusinessSystems();
            break;
        case "events":
            loadEvents();
            break;
        case "plan-tasks":
            loadPlanTasks();
            break;
        case "users":
            loadUsers();
            break;
        case "config":
            loadConfigs();
            break;
        case "notification-audits":
            loadNotificationAudits();
            break;


    }
}

// ==================== 概览页功能 ====================

async function loadDashboard() {
    try {
        const response = await apiFetch(`${API_BASE}/dashboard/overview`);
        const result = await response.json();
        
        if (result.code === 0) {
            const data = result.data;
            
            // 更新统计数据
            document.getElementById("total-systems").textContent = data.total_systems;
            document.getElementById("total-events").textContent = data.total_events;
            const resolvedCount = data.status_stats.find(s => s.status === "已解决")?.count || 0;
            document.getElementById("resolved-events").textContent = resolvedCount;
            document.getElementById("avg-response-time").textContent = data.avg_response_time + "h";

            // 概览卡片
            const totalEvents = Math.max(data.total_events, 1);
            const pendingPercent = Math.round((data.pending_events / totalEvents) * 100);
            const processingPercent = Math.round((data.processing_events / totalEvents) * 100);
            const resolvedPercent = Math.round((resolvedCount / totalEvents) * 100);
            const setSummary = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            setSummary('stat-total-events', data.total_events);
            setSummary('stat-pending-events', data.pending_events);
            setSummary('stat-processing-events', data.processing_events);
            setSummary('stat-resolved-events', resolvedCount);
            const recentCount = (data.recent_events || []).length;
            setSummary('stat-total-events-trend', `今日新增 ${recentCount}`);

            setSummary('stat-pending-events-trend', `占比 ${pendingPercent}%`);
            setSummary('stat-processing-events-trend', `占比 ${processingPercent}%`);
            setSummary('stat-resolved-events-trend', `占比 ${resolvedPercent}%`);
            
            // 渲染状态统计图表
            renderStatusChart(data.status_stats);

            // 渲染计划任务统计图表
            if (data.plan_task_stats) {
                renderPlanTaskStatChart(data.plan_task_stats);
            }
            
            // 渲染趋势图表（默认显示本周）
            loadTrendChart('week');

            
            // 渲染最近事件列表
            renderRecentEvents(data.recent_events);
            
            // 加载用户登录统计
            loadLoginStats();
        }
    } catch (error) {
        console.error("加载概览数据失败:", error);
        showToast("加载概览数据失败", "error");
    }
}

function renderStatusChart(statusStats) {
    const canvas = document.getElementById("status-chart");
    if (!canvas) return;
    
    const logicalWidth = canvas.parentElement.clientWidth;
    const logicalHeight = 300;
    const ctx = setupCanvas(canvas, logicalWidth, logicalHeight);
    
    const colors = {
        "待处理": "#faad14",
        "处理中": "#1890ff",
        "已解决": "#52c41a",
        "已关闭": "#94a3b8"
    };
    
    const total = statusStats.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("暂无数据", logicalWidth / 2, logicalHeight / 2);
        return;
    }

    const centerX = logicalWidth / 2;
    const centerY = logicalHeight / 2 - 40;
    const radius = 85;
    const innerRadius = 60;
    
    // 增加一个简单的入场动画
    let animationProgress = 0;
    const animate = () => {
        if (animationProgress < 1) {
            animationProgress += 0.04;
            if (animationProgress > 1) animationProgress = 1;
            draw(animationProgress);
            requestAnimationFrame(animate);
        } else {
            draw(1);
        }
    };

    function draw(progress) {
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        let currentAngle = -Math.PI / 2;
        
        statusStats.forEach(item => {
            const sliceAngle = (item.count / total) * 2 * Math.PI * progress;
            
            // 绘制扇形
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            
            // 使用径向渐变或简单的颜色
            const baseColor = colors[item.status] || "#999";
            ctx.fillStyle = baseColor;
            ctx.fill();
            
            // 只有在非最后一帧或有多个分段时才画间隔
            if (statusStats.length > 1) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.stroke();
            }
            
            currentAngle += sliceAngle;
        });


        // 绘制正中间的总数
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 28px Inter, sans-serif";
        ctx.fillText(Math.round(total * progress), centerX, centerY - 5);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 12px Inter, sans-serif";
        ctx.fillText("事件总数", centerX, centerY + 20);
        
        // 绘制下方图例 (居中排版)
        const legendY = centerY + radius + 45;
        const itemWidth = logicalWidth / statusStats.length;
        
        statusStats.forEach((item, i) => {
            const x = i * itemWidth + itemWidth / 2;
            
            // 颜色圆点
            ctx.fillStyle = colors[item.status] || "#999";
            ctx.beginPath();
            ctx.arc(x - 35, legendY, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // 状态文字
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#475569";
            ctx.font = "500 13px Inter, sans-serif";
            ctx.fillText(item.status, x - 25, legendY);
            
            // 数量文字
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 13px Inter, sans-serif";
            // 动态计算文字宽度以对齐数量
            const labelWidth = ctx.measureText(item.status).width;
            ctx.fillText(item.count, x - 25 + labelWidth + 8, legendY);
        });
    }

    animate();
}



async function loadTrendChart(period = 'week') {
    try {
        const response = await apiFetch(`${API_BASE}/dashboard/trend?period=${period}`);
        const result = await response.json();
        
        if (result.code === 0) {
            renderTrendChart(result.data.data, result.data.labels, period);
            
            // 更新按钮激活状态
            const chartContainer = document.getElementById('trend-chart')?.closest('.chart-container');
            if (chartContainer) {
                chartContainer.querySelectorAll('.btn-text').forEach(btn => {
                    const text = btn.textContent.trim();
                    const shouldActive = (period === 'today' && text === '今日') ||
                        (period === 'week' && text === '本周') ||
                        (period === 'month' && text === '本月');
                    btn.classList.toggle('active', shouldActive);
                });
            }
        }
    } catch (error) {
        console.error("加载趋势数据失败:", error);
    }
}

function renderTrendChart(data, labels, period) {
    const canvas = document.getElementById("trend-chart");
    if (!canvas) return;
    
    const logicalWidth = canvas.parentElement.clientWidth;
    const logicalHeight = 300;
    const ctx = setupCanvas(canvas, logicalWidth, logicalHeight);
    
    const padding = 50;
    const chartWidth = logicalWidth - padding * 2;
    const chartHeight = logicalHeight - padding * 2;
    const maxValue = Math.max(...data, 5);
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;
    
    // 绘制背景网格
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(logicalWidth - padding, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // 绘制Y轴刻度
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
        const value = Math.round(maxValue * (5 - i) / 5);
        const y = padding + (chartHeight / 5) * i;
        ctx.fillText(value, padding - 15, y);
    }
    
    if (data.length === 0) return;
    
    // 绘制阴影区域
    const areaGradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    areaGradient.addColorStop(0, "rgba(24, 144, 255, 0.15)");
    areaGradient.addColorStop(1, "rgba(24, 144, 255, 0.0)");
    
    ctx.beginPath();
    data.forEach((value, index) => {
        const x = padding + stepX * index;
        const y = padding + chartHeight - (value / maxValue) * chartHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.closePath();
    ctx.fillStyle = areaGradient;
    ctx.fill();
    
    // 绘制折线
    ctx.strokeStyle = "#1890ff";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    data.forEach((value, index) => {
        const x = padding + stepX * index;
        const y = padding + chartHeight - (value / maxValue) * chartHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 绘制数据点
    data.forEach((value, index) => {
        const x = padding + stepX * index;
        const y = padding + chartHeight - (value / maxValue) * chartHeight;
        
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#1890ff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = "#1890ff";
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // 绘制X轴标签
    ctx.fillStyle = "#64748b";
    ctx.font = "500 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    labels.forEach((label, index) => {
        const x = padding + stepX * index;
        ctx.fillText(label, x, logicalHeight - padding + 15);
    });
}


function renderRecentEvents(events) {
    const tbody = document.getElementById("recent-events-body");
    if (!tbody) return;
    
    tbody.innerHTML = events.map(event => `
        <tr>
            <td>${event.event_no}</td>
            <td>${event.system_name}</td>
            <td>${event.event_type}</td>
            <td><span class="status-badge ${getSeverityClass(event.severity)}">${event.severity}</span></td>
            <td><span class="status-badge ${getStatusClass(event.status)}">${event.status}</span></td>
            <td><span class="status-badge ${event.progress_status === '已解决' ? 'success' : event.progress_status === '已挂起' ? 'warning' : 'primary'}">${event.progress_status || "未解决"}</span></td>
            <td>${event.occurred_at}</td>

        </tr>
    `).join("");
}

async function loadLoginStats() {
    try {
        const response = await apiFetch(`${API_BASE}/dashboard/login-stats`);
        const result = await response.json();
        
        if (result.code === 0) {
            renderLoginStats(result.data);
        }
    } catch (error) {
        console.error("加载登录统计失败:", error);
    }
}

function renderLoginStats(stats) {
    const container = document.getElementById("login-stats-container");
    if (!container) return;
    
    if (!stats || stats.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无登录数据</div>';
        return;
    }
    
    container.innerHTML = stats.map(stat => `
        <div class="login-stat-item">
            <div class="login-user">
                <span class="user-icon">??</span>
                <div class="user-info">
                    <div class="user-name">${stat.username} (${stat.real_name || '未设置'})</div>
                    <div class="user-role">${stat.role}</div>
                </div>
            </div>
            <div class="login-time">
                <div class="login-count">登录 ${stat.login_count} 次</div>
                <div class="last-login">最后登录: ${stat.last_login || '从未登录'}</div>
            </div>
        </div>
    `).join("");
}

function loadDashboardByPeriod(type, period) {
    // 更新按钮激活状态
    const target = window.event?.target;
    if (target) {
        const chartHeader = target.closest('.chart-header');
        if (chartHeader) {
            chartHeader.querySelectorAll('.btn-text').forEach(btn => {
                btn.classList.toggle('active', btn === target);
            });
        }
    }
    showToast(`已切换到${period === 'today' ? '今日' : period === 'week' ? '本周' : '本月'}数据`, "info");
}


function renderPlanTaskStatChart(stats) {
    const canvas = document.getElementById("plan-task-stat-chart");
    if (!canvas) return;

    const logicalWidth = canvas.parentElement.clientWidth;
    const logicalHeight = 300;
    const ctx = setupCanvas(canvas, logicalWidth, logicalHeight);
    
    const total = stats.completed + stats.pending;
    const centerX = logicalWidth / 2;
    const centerY = logicalHeight / 2 - 40;

    const radius = 75;
    const thickness = 18;

    if (total === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("暂无计划任务数据", centerX, centerY);
        return;
    }

    const ratio = stats.completed / total;
    let currentRatio = 0;
    
    const animate = () => {
        if (currentRatio < ratio) {
            currentRatio += 0.03;
            if (currentRatio > ratio) currentRatio = ratio;
            draw(currentRatio);
            requestAnimationFrame(animate);
        } else {
            draw(ratio);
        }
    };

    function draw(displayRatio) {
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (displayRatio * 2 * Math.PI);

        // 1. 绘制背景圆环
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = thickness;
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineCap = "round";
        ctx.stroke();

        // 2. 绘制进度圆环
        if (stats.completed > 0) {
            const gradient = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
            gradient.addColorStop(0, "#52c41a");
            gradient.addColorStop(1, "#73d13d");
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.lineWidth = thickness;
            ctx.strokeStyle = gradient;
            ctx.lineCap = "round";
            
            // 发光效果
            ctx.shadowBlur = 12;
            ctx.shadowColor = "rgba(82, 196, 26, 0.25)";
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // 3. 中间文字
        const percent = Math.round(displayRatio * 100);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 32px Inter, sans-serif";
        ctx.fillText(`${percent}%`, centerX, centerY - 8);
        
        ctx.fillStyle = "#64748b";
        ctx.font = "500 13px Inter, sans-serif";
        ctx.fillText("任务完成率", centerX, centerY + 22);

        // 4. 下方数据汇总
        const statsY = centerY + radius + 50;
        const items = [
            { label: "总计划", value: total, color: "#1890ff" },
            { label: "已完成", value: stats.completed, color: "#52c41a" },
            { label: "待执行", value: stats.pending, color: "#faad14" }
        ];

        const itemWidth = logicalWidth / 3;
        items.forEach((item, i) => {
            const x = i * itemWidth + itemWidth / 2;
            
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x - 32, statsY - 5, 4, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 20px Inter, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(item.value, x - 18, statsY);
            
            ctx.fillStyle = "#94a3b8";
            ctx.font = "500 12px Inter, sans-serif";
            ctx.fillText(item.label, x - 18, statsY + 20);
        });
    }

    animate();
}









// ==================== 字典配置加载 ====================

function parseAlertRobots(configValue = "") {
    if (!configValue) return [];
    try {
        const parsed = JSON.parse(configValue);
        if (Array.isArray(parsed)) {
            return parsed
                .map(item => ({
                    name: (item.name || "").trim(),
                    webhook: (item.webhook || "").trim()
                }))
                .filter(item => item.name);
        }
    } catch (e) {
        // ignore json parse error, fallback
    }
    return configValue.split(",")
        .map(item => {
            const [name, webhook = ""] = item.split("|");
            return { name: (name || "").trim(), webhook: (webhook || "").trim() };
        })
        .filter(item => item.name);
}

function serializeAlertRobots(list = []) {
    return JSON.stringify(list.filter(item => item.name));
}

function getAlertRobotWebhook(name) {
    if (!name) return "";
    const robots = configCache.alert_robots || [];
    const found = robots.find(r => r.name === name);
    return found?.webhook || "";
}

function populateAlertRobotSelect(activeName = "") {
    const select = document.getElementById("plan-task-alert-robot");
    if (!select) return;
    const robots = configCache.alert_robots || [];
    const options = ["<option value=\"\">不发送提醒</option>", ...robots.map(r => `<option value="${r.name}">${r.name}</option>`)];
    if (activeName && !robots.some(r => r.name === activeName)) {
        options.push(`<option value="${activeName}">已存：${activeName}</option>`);
    }
    select.innerHTML = options.join("");
    if (activeName) {
        select.value = activeName;
    } else {
        // 如果没有选中的机器人，且有配置，默认选第一个
        if (robots.length > 0) {
            select.value = robots[0].name;
        }
    }
}


function maskWebhook(webhook = "") {
    if (!webhook) return "";
    if (webhook.length <= 30) return webhook;
    return `${webhook.slice(0, 26)}...${webhook.slice(-8)}`;
}

async function loadDictConfigs() {
    try {
        const response = await apiFetch(`${API_BASE}/configs`);
        const result = await response.json();
        
        if (result.code === 0) {
            result.data.forEach(config => {
                if (config.config_key === "alert_robots") {
                    configCache.alert_robots = parseAlertRobots(config.config_value);
                } else {
                    configCache[config.config_key] = config.config_value.split(",");
                }
            });
            updateDictSelects();
            populateAlertRobotSelect();
        }
    } catch (error) {
        console.error("加载字典配置失败:", error);
    }
}

function updateDictSelects() {

    // 更新管理部门
    const deptSelect = document.getElementById("system-department");
    if (deptSelect && configCache["departments"]) {
        deptSelect.innerHTML = '<option value="">请选择</option>' +
            configCache["departments"].map(d => `<option value="${d}">${d}</option>`).join("");
    }
    
    // 更新数据库类型
    const dbSelect = document.getElementById("system-database");
    if (dbSelect && configCache["database_types"]) {
        dbSelect.innerHTML = '<option value="">请选择</option>' +
            configCache["database_types"].map(d => `<option value="${d}">${d}</option>`).join("");
    }

    // 更新计划任务机器人选择
    populateAlertRobotSelect(document.getElementById("plan-task-alert-robot")?.value || "");
}

// ==================== 业务系统管理功能 ====================


async function loadBusinessSystems(page = 1) {
    try {
        const search = document.getElementById("system-search")?.value || "";
        const status = document.getElementById("system-status-filter")?.value || "";
        let url = `${API_BASE}/business-systems?page=${page}&per_page=10&search=${encodeURIComponent(search)}`;
        if (status) {
            url += `&status=${encodeURIComponent(status)}`;
        }
        const response = await apiFetch(url);
        const result = await response.json();
        
        if (result.code === 0) {
            renderBusinessSystemsTable(result.data.items);
            updatePagination("systems", result.data);
        }
    } catch (error) {
        console.error("加载业务系统失败:", error);
        showToast("加载业务系统失败", "error");
    }
}

function renderBusinessSystemsTable(systems) {
    const tbody = document.getElementById("systems-table-body");
    if (!tbody) return;
    
    // 重置全选框
    const selectAll = document.getElementById("systems-select-all");
    if (selectAll) selectAll.checked = false;

    tbody.innerHTML = systems.map(sys => {
        // ... (保持原有逻辑)
        const ipList = (sys.hosts || []).map(h => 
            `<span class="pill pill-soft" style="font-size: 11px; margin: 2px; padding: 2px 6px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2);">${h.ip_address || "-"}</span>`
        ).join("");
        
        const mwList = (sys.middlewares || []).map(m => 
            `<div style="font-size: 11px; color: #64748b; line-height: 1.4;">${m.middleware_type || "-"}${m.middleware_version ? `(${m.middleware_version})` : ""}</div>`
        ).join("");

        const hostSummary = sys.hosts && sys.hosts.length > 0 
            ? `<div style="font-size: 12px; font-weight: 600; color: #1e293b;">${sys.hosts.length} 台主机</div>`
            : '<span style="color: #cbd5e1;">-</span>';

        return `
        <tr>
            <td style="text-align: center;"><input type="checkbox" class="system-checkbox" value="${sys.id}"></td>
            <td style="font-weight: 600; color: #1e293b;">${sys.system_name}</td>
            <td>${hostSummary}</td>
            <td><div style="display: flex; flex-wrap: wrap; max-width: 250px;">${ipList || "-"}</div></td>
            <td>
                <div style="font-weight: 500; color: #334155;">${sys.database || "-"}</div>
                <div style="font-size: 11px; color: #94a3b8;">${sys.database_version || ""}</div>
            </td>
            <td><div style="max-height: 60px; overflow-y: auto;">${mwList || "-"}</div></td>
            <td>${sys.department || "-"}</td>
            <td><span class="status-badge ${getStatusClass(sys.status)}">${sys.status}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn-action" onclick="editSystem(${sys.id})" title="编辑">编辑</button>
                    <button class="btn-action" onclick="showSystemViewDialog(${sys.id})" title="详情">详情</button>
                    <button class="btn-action danger" onclick="deleteSystem(${sys.id})" title="删除">删除</button>
                </div>
            </td>
        </tr>
    `;
    }).join("");
}

// 全选/取消全选
function toggleSelectAllSystems(checkbox) {
    const checkboxes = document.querySelectorAll(".system-checkbox");
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

// 导出Excel
async function exportSystems() {
    const selectedIds = Array.from(document.querySelectorAll(".system-checkbox:checked")).map(cb => parseInt(cb.value));
    
    if (selectedIds.length === 0) {
        if (!confirm("未勾选任何系统，是否导出当前筛选条件下的全部系统信息？")) {
            return;
        }
    }

    try {
        showToast("正在生成导出文件...", "info");
        
        const response = await apiFetch(`${API_BASE}/business-systems/export`, {
            method: "POST",
            body: JSON.stringify({ ids: selectedIds })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const filename = `业务系统导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast("导出成功", "success");
        } else {
            const result = await response.json();
            showToast(result.message || "导出失败", "error");
        }
    } catch (error) {
        console.error("导出失败:", error);
        showToast("导出失败，请重试", "error");
    }
}


function showSystemDialog(systemId = null) {
    currentSystemId = systemId;
    const dialog = document.getElementById("system-dialog");
    const title = document.getElementById("system-dialog-title");
    
    updateDictSelects(); // 更新字典选项
    
    if (systemId) {
        title.textContent = "编辑业务系统";
        loadSystemData(systemId);
    } else {
        title.textContent = "新增业务系统";
        document.getElementById("system-form").reset();
        document.getElementById("system-id").value = "";
        document.getElementById("hosts-list").innerHTML = "";
        document.getElementById("middlewares-list").innerHTML = "";
        hostCounter = 0;
        middlewareCounter = 0;
        // 默认添加一个主机和一个中间件
        addHostRow();
        addMiddlewareRow();
    }
    
    dialog.classList.add("active");
}

function closeSystemDialog() {
    document.getElementById("system-dialog").classList.remove("active");
    currentSystemId = null;
}

async function loadSystemData(systemId) {
    try {
        const response = await apiFetch(`${API_BASE}/business-systems`);
        const result = await response.json();
        
        if (result.code === 0) {
            const system = result.data.items.find(s => s.id === systemId);
            if (system) {
                document.getElementById("system-id").value = system.id;
                document.getElementById("system-name").value = system.system_name;
                document.getElementById("system-code").value = system.system_code || "";
                document.getElementById("system-database").value = system.database || "";
                document.getElementById("system-database-version").value = system.database_version || "";
                document.getElementById("system-department").value = system.department || "";
                document.getElementById("system-description").value = system.description || "";
                document.getElementById("system-contact-person").value = system.contact_person || "";
                document.getElementById("system-contact-phone").value = system.contact_phone || "";
                document.getElementById("system-contact-email").value = system.contact_email || "";
                document.getElementById("system-status").value = system.status || "正常";
                
                // 加载主机信息
                const hostsList = document.getElementById("hosts-list");
                hostsList.innerHTML = "";
                hostCounter = 0;
                if (system.hosts && system.hosts.length > 0) {
                    system.hosts.forEach(host => addHostRow(host));
                } else {
                    addHostRow();
                }
                
                // 加载中间件信息
                const mwList = document.getElementById("middlewares-list");
                mwList.innerHTML = "";
                middlewareCounter = 0;
                if (system.middlewares && system.middlewares.length > 0) {
                    system.middlewares.forEach(mw => addMiddlewareRow(mw));
                } else {
                    addMiddlewareRow();
                }
            }
        }
    } catch (error) {
        console.error("加载系统数据失败:", error);
        showToast("加载系统数据失败", "error");
    }
}

function addHostRow(hostData = null) {
    hostCounter++;
    const hostsList = document.getElementById("hosts-list");
    
    const hostDiv = document.createElement("div");
    hostDiv.className = "host-row";
    hostDiv.setAttribute("data-host-id", hostCounter);
    
    const hostTypeOptions = configCache["host_types"] 
        ? configCache["host_types"].map(t => `<option value="${t}" ${hostData && hostData.host_type === t ? "selected" : ""}>${t}</option>`).join("")
        : "";
    
    hostDiv.innerHTML = `
        <span class="row-remove" onclick="removeHostRow(${hostCounter})">×</span>
        <div class="form-row">
            <div class="form-group">
                <label>主机类型</label>
                <select class="host-type">
                    <option value="">请选择</option>
                    ${hostTypeOptions}
                </select>
            </div>
            <div class="form-group">
                <label>IP地址</label>
                <input type="text" class="host-ip" placeholder="192.168.1.100" value="${hostData?.ip_address || ""}" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>操作系统</label>
                <input type="text" class="host-os" placeholder="CentOS 7.9 / Windows 2016" value="${hostData?.os_version || ""}" />
            </div>
            <div class="form-group">
                <label>配置 (CPU/内存/磁盘)</label>
                <div style="display: flex; gap: 4px;">
                    <input type="text" class="host-cpu" style="width: 30%;" placeholder="核数" value="${hostData?.cpu_cores || ""}" />
                    <input type="text" class="host-mem" style="width: 35%;" placeholder="内存(GB)" value="${hostData?.memory_gb || ""}" />
                    <input type="text" class="host-disk" style="width: 35%;" placeholder="磁盘(GB)" value="${hostData?.disk_gb || ""}" />
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group full-width">
                <label>主机用途</label>
                <input type="text" class="host-purpose" placeholder="应用服务器、数据库服务器等" value="${hostData?.host_purpose || ""}" />
            </div>
        </div>
    `;
    
    hostsList.appendChild(hostDiv);
}

function removeHostRow(hostId) {
    const row = document.querySelector(`[data-host-id="${hostId}"]`);
    if (row) {
        row.remove();
    }
}

function addMiddlewareRow(mwData = null) {
    middlewareCounter++;
    const mwList = document.getElementById("middlewares-list");
    
    const mwDiv = document.createElement("div");
    mwDiv.className = "middleware-row";
    mwDiv.setAttribute("data-mw-id", middlewareCounter);
    
    const mwTypeOptions = configCache["middleware_types"]
        ? configCache["middleware_types"].map(t => `<option value="${t}" ${mwData && mwData.middleware_type === t ? "selected" : ""}>${t}</option>`).join("")
        : "";
    
    mwDiv.innerHTML = `
        <span class="row-remove" onclick="removeMiddlewareRow(${middlewareCounter})">×</span>
        <div class="form-row">
            <div class="form-group">
                <label>中间件类型</label>
                <select class="middleware-type">
                    <option value="">请选择</option>
                    ${mwTypeOptions}
                </select>
            </div>
            <div class="form-group">
                <label>中间件版本</label>
                <input type="text" class="middleware-version" placeholder="12c" value="${mwData?.middleware_version || ""}" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>数量</label>
                <input type="number" class="middleware-quantity" placeholder="1" value="${mwData?.quantity || 1}" min="1" />
            </div>
        </div>
    `;
    
    mwList.appendChild(mwDiv);
}

function removeMiddlewareRow(mwId) {
    const row = document.querySelector(`[data-mw-id="${mwId}"]`);
    if (row) {
        row.remove();
    }
}

async function saveSystem() {
    const systemId = document.getElementById("system-id").value;
    const systemName = document.getElementById("system-name").value.trim();
    
    if (!systemName) {
        showToast("系统名称为必填项", "error");
        document.getElementById("system-name").focus();
        return;
    }
    
    // 收集主机信息
    const hosts = [];
    document.querySelectorAll(".host-row").forEach(row => {
        const hostType = row.querySelector(".host-type").value;
        const ipAddress = row.querySelector(".host-ip").value;
        const hostPurpose = row.querySelector(".host-purpose").value;
        const osVersion = row.querySelector(".host-os").value;
        const cpuCores = row.querySelector(".host-cpu").value;
        const memoryGb = row.querySelector(".host-mem").value;
        const diskGb = row.querySelector(".host-disk").value;
        if (hostType || ipAddress) {
            hosts.push({
                host_type: hostType,
                ip_address: ipAddress,
                host_purpose: hostPurpose,
                os_version: osVersion,
                cpu_cores: cpuCores,
                memory_gb: memoryGb,
                disk_gb: diskGb
            });
        }
    });
    
    // 收集中间件信息
    const middlewares = [];
    document.querySelectorAll(".middleware-row").forEach(row => {
        const mwType = row.querySelector(".middleware-type").value;
        const mwVersion = row.querySelector(".middleware-version").value;
        const quantity = parseInt(row.querySelector(".middleware-quantity").value) || 1;
        if (mwType) {
            middlewares.push({
                middleware_type: mwType,
                middleware_version: mwVersion,
                quantity: quantity
            });
        }
    });
    
    const data = {
        system_name: document.getElementById("system-name").value,
        system_code: document.getElementById("system-code").value,
        database: document.getElementById("system-database").value,
        database_version: document.getElementById("system-database-version").value,
        department: document.getElementById("system-department").value,
        status: document.getElementById("system-status").value,
        description: document.getElementById("system-description").value,
        contact_person: document.getElementById("system-contact-person").value,
        contact_phone: document.getElementById("system-contact-phone").value,
        contact_email: document.getElementById("system-contact-email").value,
        hosts: hosts,
        middlewares: middlewares
    };
    
    try {
        const url = systemId ? `${API_BASE}/business-systems/${systemId}` : `${API_BASE}/business-systems`;
        const method = systemId ? "PUT" : "POST";
        
        const response = await apiFetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast(systemId ? "更新成功" : "创建成功", "success");
            closeSystemDialog();
            loadBusinessSystems();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("保存失败:", error);
        showToast("保存失败", "error");
    }
}

function editSystem(systemId) {
    showSystemDialog(systemId);
}

function viewSystem(systemId) {
    showSystemViewDialog(systemId);
}

async function showSystemViewDialog(systemId) {
    try {
        const response = await apiFetch(`${API_BASE}/business-systems`);
        const result = await response.json();
        if (result.code === 0) {
            const system = result.data.items.find(s => s.id === systemId);
            if (system) {
                renderSystemView(system);
                const dialog = document.getElementById("system-view-dialog");
                if (dialog) dialog.classList.add("active");
            }
        }
    } catch (error) {
        console.error("加载业务系统详情失败:", error);
        showToast("加载业务系统详情失败", "error");
    }
}

function renderSystemView(data) {
    const body = document.getElementById("system-view-body");
    const titleEl = document.getElementById("system-view-title");
    if (!body || !titleEl) return;

    titleEl.textContent = data.system_name || '业务系统详情';

    const hosts = (data.hosts || []).map(h => `
        <div class="host-glass-card">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; justify-content: space-between;">
                <span>${h.ip_address || '-'}</span>
                <span class="event-view-badge primary" style="font-size: 10px;">${h.host_type || '主机'}</span>
            </div>
            <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
                <div>系统: ${h.os_version || '-'}</div>
                <div>配置: ${h.cpu_cores || '-'}核 / ${h.memory_gb || '-'}GB / ${h.disk_gb || '-'}GB</div>
            </div>
        </div>
    `).join("") || '<div class="event-view-desc" style="grid-column: 1/-1;">暂无主机信息</div>';

    const middlewares = (data.middlewares || []).map(m => `
        <div class="event-view-desc" style="background: rgba(255, 255, 255, 0.5); padding: 8px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(226, 232, 240, 0.6);">
            <div style="font-weight: 600; color: #334155; font-size: 13px;">${m.middleware_type || '未知中间件'}</div>
            <div style="font-size: 12px; color: #64748b;">版本: ${m.middleware_version || '-'}</div>
            ${m.remarks ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${m.remarks}</div>` : ''}
        </div>
    `).join("") || '<div class="event-view-desc">暂无中间件信息</div>';

    body.innerHTML = `
        <div class="system-view-grid">
            <!-- 左侧核心信息 -->
            <div class="system-view-main">
                <div class="system-view-card" style="flex: 1;">
                    <div class="event-view-title-row">
                        <h3>基本信息</h3>
                        <span class="event-view-badge ${getStatusClass(data.status) === 'success' ? 'success' : getStatusClass(data.status) === 'danger' ? 'danger' : 'warn'}">${data.status}</span>
                    </div>
                    <div class="event-view-meta" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <span>系统编码：${data.system_code || '-'}</span>
                        <span>管理部室：${data.department || '-'}</span>
                        <span>负责人：${data.contact_person || '-'}</span>
                        <span>联系电话：${data.contact_phone || '-'}</span>
                    </div>
                    <div class="event-view-section-title" style="margin-top:16px;">系统描述</div>
                    <div class="event-view-desc" style="background: #f8fafc; padding: 10px; border-radius: 8px;">${data.description || '暂无描述'}</div>
                </div>
            </div>

            <!-- 右侧组件环境 -->
            <div class="system-view-side">
                <div class="system-view-card" style="height: 100%;">
                    <div class="event-view-section-title">组件环境</div>
                    
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; font-weight: 700; color: #6366f1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Database</div>
                        <div class="event-view-card compact" style="padding: 10px; background: linear-gradient(135deg, #f5f7ff, #ffffff);">
                            <div style="font-weight: 700; color: #1e293b;">${data.database || '-'}</div>
                            <div style="font-size: 12px; color: #64748b;">版本: ${data.database_version || '-'}</div>
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 12px; font-weight: 700; color: #6366f1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Middleware</div>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${middlewares}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 下方主机资源（自适应平铺） -->
            <div class="system-view-bottom">
                <div class="system-view-card">
                    <div class="event-view-section-title" style="display: flex; align-items: center; gap: 8px;">
                        <span>主机资源清单</span>
                        <span style="font-size: 11px; font-weight: normal; color: #94a3b8; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${data.hosts?.length || 0} 台</span>
                    </div>
                    <div class="host-grid-container">
                        ${hosts}
                    </div>
                </div>
            </div>
        </div>
    `;
}


function closeSystemViewDialog() {
    const dialog = document.getElementById("system-view-dialog");
    if (dialog) dialog.classList.remove("active");
}


async function deleteSystem(systemId) {
    if (!confirm("确定要删除该业务系统吗?")) {
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/business-systems/${systemId}`, {
            method: "DELETE"
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast("删除成功", "success");
            loadBusinessSystems();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("删除失败:", error);
        showToast("删除失败", "error");
    }
}

// ==================== 事件管理功能 ====================

async function loadEvents(page = 1) {
    try {
        const systemName = document.getElementById("event-system-name")?.value || "";
        const title = document.getElementById("event-title-filter")?.value || "";
        const status = document.getElementById("event-status-filter")?.value || "";
        const startDate = document.getElementById("event-start-date")?.value || "";
        const endDate = document.getElementById("event-end-date")?.value || "";
        const eventType = document.getElementById("event-type-filter")?.value || "";
        const severity = document.getElementById("event-severity-filter")?.value || "";
        const progressStatus = document.getElementById("event-progress-filter")?.value || "";
        
        let url = `${API_BASE}/events?page=${page}&per_page=10`;
        if (systemName) url += `&system_name=${encodeURIComponent(systemName)}`;
        if (title) url += `&title=${encodeURIComponent(title)}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;
        if (progressStatus) url += `&progress_status=${encodeURIComponent(progressStatus)}`;

        if (eventType) url += `&event_type=${encodeURIComponent(eventType)}`;

        if (severity) url += `&severity=${encodeURIComponent(severity)}`;
        if (startDate) url += `&start_date=${startDate}T00:00:00`;
        if (endDate) url += `&end_date=${endDate}T23:59:59`;
        
        const response = await apiFetch(url);
        const result = await response.json();
        
        if (result.code === 0) {
            renderEventsTable(result.data.items);
            document.getElementById("events-total").textContent = result.data.total;
        }
    } catch (error) {
        console.error("加载事件失败:", error);
        showToast("加载事件失败", "error");
    }
}


function renderEventsTable(events) {
    const tbody = document.getElementById("events-table-body");
    if (!tbody) return;
    
    tbody.innerHTML = events.map(event => `
        <tr>
            <td>${event.event_no}</td>
            <td>${event.system_name}</td>
            <td>${event.event_type}</td>
            <td><span class="status-badge ${getSeverityClass(event.severity)}">${event.severity}</span></td>
            <td><span class="status-badge ${getStatusClass(event.status)}">${event.status}</span></td>
            <td><span class="status-badge ${event.progress_status === '已解决' ? 'success' : event.progress_status === '已挂起' ? 'warning' : 'primary'}">${event.progress_status || "未解决"}</span></td>
            <td>${event.occurred_at}</td>

            <td>${event.reported_by || "-"}</td>
            <td>
                <button class="btn-action" onclick="editEvent(${event.id})">编辑</button>
                <button class="btn-action" onclick="showEventViewDialog(${event.id})">查看</button>
                <button class="btn-action danger" onclick="deleteEvent(${event.id})">删除</button>
            </td>

        </tr>
    `).join("");
}

async function showEventDialog(eventId = null) {
    currentEventId = eventId;
    const dialog = document.getElementById("event-dialog");
    const title = document.getElementById("event-dialog-title");
    
    // 加载业务系统选项
    await loadSystemOptions();
    
    if (eventId) {
        title.textContent = "编辑事件";
        await loadEventData(eventId);
    } else {
        title.textContent = "新增事件";
        document.getElementById("event-form").reset();
        document.getElementById("event-id").value = "";
        document.getElementById("process-list").innerHTML = "";
        document.getElementById("event-file-list").innerHTML = "";
        eventAttachments = [];
        processStepCounter = 0;
        
        // 设置默认发生时间
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
        document.getElementById("event-occurred-at").value = localDateTime;
    }
    
    dialog.classList.add("active");
}

function closeEventDialog() {
    document.getElementById("event-dialog").classList.remove("active");
    currentEventId = null;
}

async function loadSystemOptions() {
    try {
        const response = await apiFetch(`${API_BASE}/business-systems?per_page=100`);
        const result = await response.json();
        
        if (result.code === 0) {
            const select = document.getElementById("event-system-id");
            select.innerHTML = '<option value="">请选择业务系统</option>' +
                result.data.items.map(sys => 
                    `<option value="${sys.id}">${sys.system_name}</option>`
                ).join("");
        }
    } catch (error) {
        console.error("加载系统选项失败:", error);
    }
}

async function loadEventData(eventId) {
    try {
        const response = await apiFetch(`${API_BASE}/events/${eventId}`);
        const result = await response.json();
        
        if (result.code === 0) {
            const event = result.data;
            document.getElementById("event-id").value = event.id;
            document.getElementById("event-system-id").value = event.system_id;
            
            // 转换时间格式
            const occurredAt = new Date(event.occurred_at);
            const localDateTime = new Date(occurredAt.getTime() - occurredAt.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            document.getElementById("event-occurred-at").value = localDateTime;
            
            document.getElementById("event-type").value = event.event_type;
            document.getElementById("event-severity").value = event.severity;

            document.getElementById("event-status").value = event.status;
            document.getElementById("event-reported-by").value = event.reported_by || "";
            document.getElementById("event-assigned-to").value = event.assigned_to || "";
            document.getElementById("event-title").value = event.title;
            document.getElementById("event-description").value = event.description || "";
            document.getElementById("event-progress-status").value = event.progress_status || "未解决";
            document.getElementById("event-resolution").value = event.resolution || "";

            document.getElementById("event-root-cause").value = event.root_cause || "";
            
            // 加载处置流程
            const processList = document.getElementById("process-list");
            processList.innerHTML = "";
            processStepCounter = 0;
            event.processes.forEach(process => {
                addProcessStep(process);
            });
            
            // 加载附件列表
            renderAttachments(event.attachments);
        }
    } catch (error) {
        console.error("加载事件数据失败:", error);
        showToast("加载事件数据失败", "error");
    }
}

function addProcessStep(processData = null) {
    processStepCounter++;
    const processList = document.getElementById("process-list");
    
    const stepDiv = document.createElement("div");
    stepDiv.className = "process-step";
    stepDiv.setAttribute("data-step-id", processStepCounter);
    
    stepDiv.innerHTML = `
        <div class="process-step-header">
            <span class="process-step-title">步骤 ${processStepCounter}</span>
            <span class="process-step-remove" onclick="removeProcessStep(${processStepCounter})">×</span>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>操作时间</label>
                <input type="datetime-local" class="process-time" value="${processData?.operated_at ? processData.operated_at.replace(' ', 'T').substring(0, 16) : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}" />
            </div>
            <div class="form-group">
                <label>操作人</label>
                <input type="text" class="process-operator" placeholder="操作人" value="${processData?.operator || ""}" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group full-width">
                <label>备注</label>
                <input type="text" class="process-remarks" placeholder="备注信息" value="${processData?.remarks || ""}" />
            </div>
        </div>

        <div class="form-row">
            <div class="form-group full-width">
                <label>处置动作</label>
                <input type="text" class="process-action" placeholder="描述具体的处置动作" value="${processData?.action || ""}" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group full-width">
                <label>处置结果</label>
                <textarea class="process-result" rows="2" placeholder="处置后的结果">${processData?.result || ""}</textarea>
            </div>
        </div>

    `;
    
    processList.appendChild(stepDiv);
}

function removeProcessStep(stepId) {
    const step = document.querySelector(`[data-step-id="${stepId}"]`);
    if (step) {
        step.remove();
    }
}

function handleEventFileUpload(files) {
    for (let file of files) {
        eventAttachments.push(file);
    }
    renderFileList();
}

function renderFileList() {
    const fileList = document.getElementById("event-file-list");
    fileList.innerHTML = eventAttachments.map((file, index) => `
        <div class="file-item">
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <span class="file-remove" onclick="removeFile(${index})">×</span>
        </div>
    `).join("");
}

function renderAttachments(attachments) {
    const fileList = document.getElementById("event-file-list");
    fileList.innerHTML = attachments.map(att => `
        <div class="file-item">
            <div class="file-info">
                <span class="file-name">${att.file_name}</span>
                <span class="file-size">(${formatFileSize(att.file_size)})</span>
            </div>
            <a href="${API_BASE}/attachments/${att.id}/download" class="btn-action">下载</a>
            <span class="file-remove" onclick="deleteAttachment(${att.id})">×</span>
        </div>
    `).join("");
}

function removeFile(index) {
    eventAttachments.splice(index, 1);
    renderFileList();
}

async function deleteAttachment(attachmentId) {
    if (!confirm("确定要删除该附件吗?")) {
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/attachments/${attachmentId}`, {
            method: "DELETE"
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast("删除成功", "success");
            if (currentEventId) {
                loadEventData(currentEventId);
            }
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("删除失败:", error);
        showToast("删除失败", "error");
    }
}

async function saveEvent() {
    const eventId = document.getElementById("event-id").value;
    
    // 收集处置流程
    const processes = [];
    document.querySelectorAll(".process-step").forEach(step => {
        const action = step.querySelector(".process-action").value;
        if (action) {
            processes.push({
                action: action,
                result: step.querySelector(".process-result").value,
                operator: step.querySelector(".process-operator").value,
                operated_at: step.querySelector(".process-time").value,
                remarks: step.querySelector(".process-remarks").value
            });
        }

    });
    
    const data = {
        system_id: parseInt(document.getElementById("event-system-id").value),
        occurred_at: document.getElementById("event-occurred-at").value,
        event_type: document.getElementById("event-type").value,
        severity: document.getElementById("event-severity").value,
        status: document.getElementById("event-status").value,

        reported_by: document.getElementById("event-reported-by").value,
        assigned_to: document.getElementById("event-assigned-to").value,
        title: document.getElementById("event-title").value,
        description: document.getElementById("event-description").value,
        progress_status: document.getElementById("event-progress-status").value,
        resolution: document.getElementById("event-resolution").value,
        root_cause: document.getElementById("event-root-cause").value,

        processes: processes
    };
    
    try {
        const url = eventId ? `${API_BASE}/events/${eventId}` : `${API_BASE}/events`;
        const method = eventId ? "PUT" : "POST";
        
        const response = await apiFetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            // 如果有附件需要上传
            if (eventAttachments.length > 0 && !eventId) {
                await uploadAttachments(result.data.id);
            } else if (eventAttachments.length > 0 && eventId) {
                await uploadAttachments(eventId);
            }
            
            showToast(eventId ? "更新成功" : "创建成功", "success");
            closeEventDialog();
            loadEvents();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("保存失败:", error);
        showToast("保存失败", "error");
    }
}

async function uploadAttachments(eventId) {
    for (let file of eventAttachments) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("uploaded_by", "当前用户");
        
        try {
            await apiFetch(`${API_BASE}/events/${eventId}/attachments`, {
                method: "POST",
                body: formData
            });
        } catch (error) {
            console.error("上传附件失败:", error);
        }
    }
    eventAttachments = [];
}

function editEvent(eventId) {
    showEventDialog(eventId);
}

function viewEvent(eventId) {
    showEventDialog(eventId);
}

async function showEventViewDialog(eventId) {
    try {
        const response = await apiFetch(`${API_BASE}/events/${eventId}`);
        const result = await response.json();
        if (result.code === 0) {
            renderEventView(result.data);
            const dialog = document.getElementById("event-view-dialog");
            if (dialog) dialog.classList.add("active");
        }
    } catch (error) {
        console.error("加载事件详情失败:", error);
        showToast("加载事件详情失败", "error");
    }
}

function renderEventView(data) {
    const body = document.getElementById("event-view-body");
    const titleEl = document.getElementById("event-view-title");
    if (!body || !titleEl) return;
    const severityBadge = `<span class="event-view-badge ${getSeverityClass(data.severity) === 'danger' ? 'danger' : getSeverityClass(data.severity) === 'warning' ? 'warn' : 'primary'}">${data.severity || '-'}</span>`;
    const statusBadge = `<span class="event-view-badge ${getStatusClass(data.status) === 'success' ? 'success' : getStatusClass(data.status) === 'danger' ? 'danger' : 'primary'}">${data.status || '-'}</span>`;

    titleEl.textContent = data.title || '事件详情';

    const processes = (data.processes || []).map((p, idx) => `
        <div class="event-view-card compact">
            <div class="event-view-title-row">
                <h3>处置步骤 ${idx + 1}</h3>
                <span class="event-view-badge primary">${p.operator || '未填'}</span>
            </div>
            <div class="event-view-section-title">动作</div>
            <div class="event-view-desc">${p.action || '-'}</div>
            <div class="event-view-section-title" style="margin-top:8px;">结果</div>
            <div class="event-view-desc">${p.result || '-'}</div>
            ${p.remarks ? `<div class="event-view-section-title" style="margin-top:8px;">备注</div><div class="event-view-desc">${p.remarks}</div>` : ''}
        </div>
    `).join("") || '<div class="event-view-desc">暂无处置记录</div>';

    const attachments = (data.attachments || []).map(att => `
        <div class="event-view-desc" style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <span>${att.file_name} (${formatFileSize(att.file_size)})</span>
            <a class="btn-action" href="${API_BASE}/attachments/${att.id}/download">下载</a>
        </div>
    `).join("") || '<div class="event-view-desc">暂无附件</div>';

    body.innerHTML = `
        <div class="event-view-card">
            <div class="event-view-title-row">
                <h3>${data.event_no || '—'}</h3>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${severityBadge}
                    ${statusBadge}
                </div>
            </div>
            <div class="event-view-section-title">标题</div>
            <div class="event-view-desc">${data.title || '未填写标题'}</div>
            <div class="event-view-meta" style="margin-top:8px;">
                <span>业务系统：${data.system_name || '-'}</span>
                <span>类型：${data.event_type || '-'}</span>
                <span>发生时间：${formatDateTimeDisplay(data.occurred_at)}</span>
                <span>报告人：${data.reported_by || '-'}</span>
                <span>处理人：${data.assigned_to || '-'}</span>
            </div>
        </div>
        <div class="event-view-card compact">
            <div class="event-view-section-title">事件描述</div>
            <div class="event-view-desc">${data.description || '暂无描述'}</div>
        </div>
        <div class="event-view-card">
            <div class="event-view-section-title">处置流程</div>
            ${processes}
        </div>
        <div class="event-view-card">
            <div class="event-view-section-title">进度结果</div>
            <div class="event-view-desc"><strong>处置进度：</strong>${data.progress_status || '未解决'}</div>
            <div class="event-view-desc" style="margin-top:6px;"><strong>解决方案：</strong>${data.resolution || '暂无'}</div>
            <div class="event-view-desc" style="margin-top:6px;"><strong>根本原因：</strong>${data.root_cause || '未填写'}</div>
        </div>

        <div class="event-view-card compact">
            <div class="event-view-section-title">附件</div>
            ${attachments}
        </div>
    `;
}

function closeEventViewDialog() {
    const dialog = document.getElementById("event-view-dialog");
    if (dialog) dialog.classList.remove("active");
}

async function deleteEvent(eventId) {

    if (!confirm("确定要删除该事件吗?")) {
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/events/${eventId}`, {
            method: "DELETE"
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast("删除成功", "success");
            loadEvents();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("删除失败:", error);
        showToast("删除失败", "error");
    }
}

function searchEvents() {
    loadEvents();
}

function resetEventFilters() {
    document.getElementById("event-system-name").value = "";
    document.getElementById("event-title-filter").value = "";
    document.getElementById("event-start-date").value = "";

    document.getElementById("event-end-date").value = "";
    document.getElementById("event-type-filter").value = "";
    document.getElementById("event-status-filter").value = "";
    document.getElementById("event-severity-filter").value = "";
    if (document.getElementById("event-progress-filter")) {
        document.getElementById("event-progress-filter").value = "";
    }
    loadEvents();

}

// ==================== 系统配置功能 ====================

async function loadConfigs() {
    try {
        const response = await apiFetch(`${API_BASE}/configs`);
        const result = await response.json();
        
        if (result.code === 0) {
            const configs = result.data;
            configCache = {};
            
            configs.forEach(config => {
                if (config.config_key === "alert_robots") {
                    configCache.alert_robots = parseAlertRobots(config.config_value);
                } else {
                    configCache[config.config_key] = config.config_value.split(",");
                }
            });
            
            const configMap = {
                "departments": "departments-list",
                "host_types": "host-types-list",
                "middleware_types": "middleware-types-list",
                "database_types": "database-types-list",
                "system_status": "system-status-list",
                "event_types": "event-types-list",
                "severity_levels": "severity-levels-list",
                "event_status": "event-status-list"
            };
            
            for (const [key, elementId] of Object.entries(configMap)) {
                if (configCache[key]) {
                    renderConfigList(elementId, configCache[key], key);
                }
            }

            renderAlertRobotList(configCache.alert_robots || []);
            populateAlertRobotSelect();
        }
    } catch (error) {
        console.error("加载配置失败:", error);
        showToast("加载配置失败", "error");
    }
}


function renderConfigList(elementId, items, configKey) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = items.map(item => `
        <div class="config-item">
            <span>${item}</span>
            <span class="config-item-remove" data-config-key="${configKey}" data-item="${item}">×</span>
        </div>
    `).join("");
    
    // 使用事件委托绑定删除事件
    element.querySelectorAll(".config-item-remove").forEach(btn => {
        btn.addEventListener("click", function() {
            const key = this.getAttribute("data-config-key");
            const itemValue = this.getAttribute("data-item");
            removeConfigItem(key, itemValue);
        });
    });
}

function renderAlertRobotList(items = []) {
    const element = document.getElementById("alert-robots-list");
    if (!element) return;
    if (!items.length) {
        element.innerHTML = '<div class="empty-hint">暂无机器人，请点击右上角添加</div>';
        return;
    }
    element.innerHTML = items.map(robot => `
        <div class="config-item">
            <div class="config-item-content">
                <span class="config-item-title">${robot.name}</span>
                <span class="config-item-sub">${maskWebhook(robot.webhook) || '未配置Webhook'}</span>
            </div>
            <div class="config-item-actions">
                <button class="btn-link" onclick='showRobotConfigDialog(${JSON.stringify(robot.name)})'>编辑</button>
                <span class="config-item-remove" onclick='removeRobotConfig(${JSON.stringify(robot.name)})'>×</span>
            </div>

        </div>
    `).join("");
}

function showRobotConfigDialog(robotName = "") {
    editingRobotName = robotName || null;
    const dialog = document.getElementById("robot-config-dialog");
    const title = document.getElementById("robot-config-title");
    const nameInput = document.getElementById("robot-name");
    const webhookInput = document.getElementById("robot-webhook");
    const robots = configCache.alert_robots || [];

    if (editingRobotName) {
        const target = robots.find(r => r.name === editingRobotName) || { name: editingRobotName, webhook: "" };
        title.textContent = "编辑告警机器人";
        nameInput.value = target.name || "";
        webhookInput.value = target.webhook || "";
    } else {
        title.textContent = "新增告警机器人";
        nameInput.value = "";
        webhookInput.value = "";
    }
    dialog.classList.add("active");
}

function closeRobotConfigDialog() {
    editingRobotName = null;
    const dialog = document.getElementById("robot-config-dialog");
    if (dialog) dialog.classList.remove("active");
}

async function saveRobotConfig() {
    const name = document.getElementById("robot-name")?.value.trim();
    const webhook = document.getElementById("robot-webhook")?.value.trim();
    if (!name) {
        showToast("请输入机器人名称", "warning");
        return;
    }
    if (!webhook) {
        showToast("请输入Webhook", "warning");
        return;
    }

    let robots = [...(configCache.alert_robots || [])];
    const existIndex = robots.findIndex(r => r.name === name);
    if (existIndex >= 0) {
        robots[existIndex] = { name, webhook };
    } else if (editingRobotName) {
        // 名称被修改
        const editingIndex = robots.findIndex(r => r.name === editingRobotName);
        if (editingIndex >= 0) {
            robots[editingIndex] = { name, webhook };
        } else {
            robots.push({ name, webhook });
        }
    } else {
        robots.push({ name, webhook });
    }

    try {
        const payload = serializeAlertRobots(robots);
        const resp = await apiFetch(`${API_BASE}/configs?config_type=alert_robots`);
        const data = await resp.json();
        if (data.code === 0 && data.data && data.data.length > 0) {
            const configId = data.data[0].id;
            const updateResp = await apiFetch(`${API_BASE}/configs/${configId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config_value: payload })
            });
            const updateResult = await updateResp.json();
            if (updateResult.code !== 0) {
                showToast(updateResult.message || "保存失败", "error");
                return;
            }
        } else {
            const createResp = await apiFetch(`${API_BASE}/configs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    config_key: "alert_robots",
                    config_value: payload,
                    config_type: "告警机器人",
                    description: "计划任务提醒机器人配置"
                })
            });
            const createResult = await createResp.json();
            if (createResult.code !== 0) {
                showToast(createResult.message || "保存失败", "error");
                return;
            }
        }

        configCache.alert_robots = robots;
        renderAlertRobotList(robots);
        populateAlertRobotSelect(name);
        closeRobotConfigDialog();
        showToast("机器人保存成功", "success");
    } catch (error) {
        console.error("保存机器人配置失败", error);
        showToast("保存机器人配置失败", "error");
    }
}

async function removeRobotConfig(name) {
    if (!confirm(`确定删除机器人 “${name}” 吗？`)) return;
    let robots = [...(configCache.alert_robots || [])].filter(r => r.name !== name);
    try {
        const payload = serializeAlertRobots(robots);
        const resp = await apiFetch(`${API_BASE}/configs?config_type=alert_robots`);
        const data = await resp.json();
        if (data.code === 0 && data.data && data.data.length > 0) {
            const configId = data.data[0].id;
            const updateResp = await apiFetch(`${API_BASE}/configs/${configId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config_value: payload })
            });
            const updateResult = await updateResp.json();
            if (updateResult.code !== 0) {
                showToast(updateResult.message || "删除失败", "error");
                return;
            }
        }
        configCache.alert_robots = robots;
        renderAlertRobotList(robots);
        populateAlertRobotSelect();
        showToast("已删除", "success");
    } catch (error) {
        console.error("删除机器人失败", error);
        showToast("删除机器人失败", "error");
    }
}

function showConfigDialog(configKey) {

    console.log("showConfigDialog 调用, configKey:", configKey);
    currentConfigKey = configKey;
    const dialog = document.getElementById("config-dialog");
    const title = document.getElementById("config-dialog-title");
    
    console.log("dialog 元素:", dialog);
    console.log("title 元素:", title);
    
    const configNames = {
        "departments": "管理部门",
        "host_types": "主机类型",
        "middleware_types": "中间件类型",
        "database_types": "数据库类型",
        "system_status": "系统状态",
        "event_types": "事件类型",
        "severity_levels": "严重程度",
        "event_status": "事件状态"
    };
    
    title.textContent = `添加${configNames[configKey] || "配置"}`;
    document.getElementById("config-item-value").value = "";
    dialog.classList.add("active");
    console.log("对话框应该已显示");
}

function closeConfigDialog() {
    document.getElementById("config-dialog").classList.remove("active");
    currentConfigKey = null;
}

async function saveConfigItem() {
    const value = document.getElementById("config-item-value").value.trim();
    if (!value) {
        showToast("请输入配置项名称", "warning");
        return;
    }
    
    if (!currentConfigKey) return;
    
    try {
        // 获取当前配置
        const response = await apiFetch(`${API_BASE}/configs?config_type=${currentConfigKey}`);
        const result = await response.json();
        
        if (result.code === 0 && result.data.length > 0) {
            const config = result.data[0];
            const currentValues = config.config_value.split(",");
            
            if (currentValues.includes(value)) {
                showToast("该配置项已存在", "warning");
                return;
            }
            
            currentValues.push(value);
            
            // 更新配置
            const updateResponse = await apiFetch(`${API_BASE}/configs/${config.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    config_value: currentValues.join(",")
                })
            });
            
            const updateResult = await updateResponse.json();
            
            if (updateResult.code === 0) {
                showToast("添加成功", "success");
                closeConfigDialog();
                loadConfigs();
                loadDictConfigs(); // 重新加载字典配置
            } else {
                showToast(updateResult.message, "error");
            }
        }
    } catch (error) {
        console.error("保存配置失败:", error);
        showToast("保存配置失败", "error");
    }
}

async function removeConfigItem(configKey, item) {
    if (!confirm(`确定要删除配置项"${item}"吗?`)) {
        return;
    }
    
    try {
        // 获取当前配置
        const response = await apiFetch(`${API_BASE}/configs?config_type=${configKey}`);
        const result = await response.json();
        
        if (result.code === 0 && result.data.length > 0) {
            const config = result.data[0];
            const currentValues = config.config_value.split(",");
            const newValues = currentValues.filter(v => v !== item);
            
            // 更新配置
            const updateResponse = await apiFetch(`${API_BASE}/configs/${config.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    config_value: newValues.join(",")
                })
            });
            
            const updateResult = await updateResponse.json();
            
            if (updateResult.code === 0) {
                showToast("删除成功", "success");
                loadConfigs();
                loadDictConfigs(); // 重新加载字典配置
            } else {
                showToast(updateResult.message, "error");
            }
        }
    } catch (error) {
        console.error("删除配置失败:", error);
        showToast("删除配置失败", "error");
    }
}

// ==================== 工具函数 ====================

function getStatusClass(status) {
    const statusMap = {
        "正常": "success",
        "运行中": "success",
        "已解决": "success",
        "已关闭": "default",
        "处理中": "info",
        "待处理": "warning",
        "维护中": "warning",
        "已停用": "danger",
        "故障": "danger",
        "已取消": "danger"
    };

    return statusMap[status] || "default";
}

function getSeverityClass(severity) {
    const severityMap = {
        "紧急": "danger",
        "严重": "danger",
        "一般": "warning",
        "较低": "info"
    };
    return severityMap[severity] || "default";
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function updatePagination(prefix, data) {
    const totalEl = document.getElementById(`${prefix}-total`);
    const pageEl = document.getElementById(`${prefix}-page`);
    const perPageEl = document.getElementById(`${prefix}-per-page`);
    
    if (totalEl) totalEl.textContent = data.total;
    if (pageEl) pageEl.textContent = data.page;
    if (perPageEl) perPageEl.textContent = data.per_page;
}

function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// ==================== 计划任务管理 ====================

const scheduleLabels = {
    once: "一次性",
    daily: "每天",
    weekly: "每周",
    monthly: "每月",
    cron: "自定义Cron"
};


function getScheduleLabel(type) {
    return scheduleLabels[type] || type || "-";
}

function computePrepStats(preps = []) {
    const done = preps.filter(p => p.status === '已完成').length;
    const total = preps.length;
    return { done, total, text: `${done}/${total}` };
}

function getPrepProgressDisplay(task) {
    if (!task || !task.id) return "0/0";
    if (planTaskPrepCache[task.id]) return planTaskPrepCache[task.id].text;
    const preps = Array.isArray(task.preparations) ? task.preparations : null;
    if (preps) {
        planTaskPrepCache[task.id] = computePrepStats(preps);
        return planTaskPrepCache[task.id].text;
    }
    return "加载中";
}

async function fetchPrepForTasks(ids = []) {
    const need = ids.filter(id => id && !planTaskPrepCache[id]);
    if (!need.length) return;
    await Promise.allSettled(need.map(async id => {
        try {
            const res = await apiFetch(`${API_BASE}/plan-tasks/${id}`);
            const result = await res.json();
            if (result.code === 0) {
                const preps = result.data.preparations || [];
                planTaskPrepCache[id] = computePrepStats(preps);
                const idx = planTaskDataCache.findIndex(t => t.id === id);
                if (idx > -1) planTaskDataCache[idx].preparations = preps;
            }
        } catch (error) {
            console.error("加载准备事项失败", error);
        }
    }));
    renderPlanTaskTable(planTaskDataCache);
}

function formatDateTimeDisplay(value) {

    if (!value) return "-";
    try {
        const normalized = value.replace(' ', 'T');
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) {
            return d.toLocaleString();
        }
    } catch (e) {
        // ignore
    }
    return value;
}

function formatReminderText(minutes) {
    const mins = Number(minutes) || 0;
    if (mins >= 1440 && mins % 1440 === 0) {
        const days = Math.round(mins / 1440);
        return `提前${days}天`;
    }
    if (mins >= 60 && mins % 60 === 0) {
        const hours = Math.round(mins / 60);
        return `提前${hours}小时`;
    }
    return `提前${mins}分钟`;
}

function toggleReminderFields(enabled) {
    const minutesInput = document.getElementById("plan-task-reminder");
    const robotSelect = document.getElementById("plan-task-alert-robot");
    if (minutesInput) minutesInput.disabled = !enabled;
    if (robotSelect) robotSelect.disabled = !enabled;
}

function setReminderPreset(minutes) {
    const minutesInput = document.getElementById("plan-task-reminder");
    if (!minutesInput) return;
    minutesInput.value = minutes;
    const toggle = document.getElementById("plan-task-reminder-enabled");
    if (toggle && !toggle.checked) {
        toggle.checked = true;
        toggleReminderFields(true);
    }
}

async function loadPlanTasks(view = planTaskView) {

    try {
        const status = document.getElementById("plan-task-status-filter")?.value || "";
        const type = document.getElementById("plan-task-type-filter")?.value || "";
        const keyword = document.getElementById("plan-task-keyword")?.value || "";
        planTaskView = view || planTaskView;
        setPlanTaskTabActive(planTaskView);
        let url = `${API_BASE}/plan-tasks?view=${planTaskView}`;

        if (status) url += `&status=${encodeURIComponent(status)}`;
        if (type) url += `&task_type=${encodeURIComponent(type)}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        
        const tbody = document.getElementById("plan-task-table-body");
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="loading-hint">加载中...</div></td></tr>';
        }
        const response = await apiFetch(url);
        const result = await response.json();
        if (result.code === 0) {
            const items = result.data.items || [];

            planTaskPrepCache = {};
            items.forEach(item => {
                if (Array.isArray(item.preparations)) {
                    planTaskPrepCache[item.id] = computePrepStats(item.preparations);
                }
            });
            planTaskDataCache = items;
            const total = result.data.total || items.length;
            renderPlanTaskTable(planTaskDataCache);
            updatePlanTaskStats(planTaskDataCache, total);
            updatePlanTaskPagination(total);
            const totalEl = document.getElementById("plan-task-total");
            if (totalEl) totalEl.textContent = total;
        }


    } catch (error) {

        console.error("加载计划任务失败:", error);
        showToast("加载计划任务失败", "error");
    }
}


function getPaginatedTasks(tasks = []) {
    const start = (planTaskPage - 1) * planTaskPerPage;
    return tasks.slice(start, start + planTaskPerPage);
}

function renderPlanTaskTable(tasks) {
    const tbody = document.getElementById("plan-task-table-body");
    if (!tbody) return;
    if (!tasks.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-hint">暂无符合条件的任务，点击“新建任务”进行创建</div></td></tr>';
        return;
    }
    const paged = getPaginatedTasks(tasks);
    if (!paged.length) {
        planTaskPage = 1;
    }
    const dataToRender = getPaginatedTasks(tasks);
    const missingPrepIds = new Set();
    tbody.innerHTML = dataToRender.map(task => {

        const webhook = getAlertRobotWebhook(task.alert_robot) || task.webhook_url;
        const reminderText = task.reminder_enabled
            ? `${formatReminderText(task.reminder_minutes)} · ${task.alert_robot || '未选择机器人'}`
            : '提醒已关闭';
        const reminderSub = task.reminder_enabled
            ? (webhook ? 'Webhook 已配置（系统配置）' : 'Webhook 未配置')
            : '打开提醒后可配置机器人';
        const planTimeText = formatDateTimeDisplay(task.plan_time);
        const scheduleLabel = getScheduleLabel(task.schedule_type);
        const actions = [
            `<button class="btn-action" onclick="viewPlanTaskDetail(${task.id})">查看</button>`,
            `<button class="btn-action" onclick="editPlanTask(${task.id})">编辑</button>`,
            `<button class="btn-action danger" onclick="deletePlanTask(${task.id})">删除</button>`
        ];


        if (task.status === '待执行') {
            actions.push(`<button class="btn-action" onclick="showStatusDialog(${task.id}, 'start')">开始</button>`);
        }
        if (task.status === '进行中') {
            actions.push(`<button class="btn-action" onclick="showStatusDialog(${task.id}, 'complete')">完成</button>`);
        }
        if (task.status !== '已取消' && task.status !== '已完成') {
            actions.push(`<button class="btn-action danger" onclick="showStatusDialog(${task.id}, 'cancel')">取消</button>`);
        }

        const description = task.description ? `<div class="plan-task-desc">${task.description}</div>` : '';
        const collaborators = (task.responsible || []).join('、') || '暂无协同人';
        const prepProgress = getPrepProgressDisplay(task);
        if (prepProgress === '加载中') missingPrepIds.add(task.id);
        return `
            <tr>
                <td>
                    <div class="plan-task-title">${task.title}</div>
                    ${description}
                    <div class="plan-task-meta meta-inline">
                        <span class="pill pill-soft">类型：${task.task_type || '-'}</span>
                        <span class="pill pill-soft">准备：${prepProgress}</span>
                    </div>
                </td>


                <td>
                    <div class="plan-task-meta">
                        <span class="pill pill-time">${planTimeText}</span>
                        <span class="pill pill-soft">周期：${scheduleLabel}</span>
                    </div>
                </td>
                <td>
                    <div class="plan-task-meta">
                        <span class="pill pill-reminder">${reminderText}</span>
                        <span class="pill pill-soft">${reminderSub}</span>
                    </div>
                </td>

                <td>
                    <div class="plan-task-meta meta-inline">
                        <span class="pill pill-soft">负责人：${task.owner || '-'}</span>
                        <span class="pill pill-soft">协同：${collaborators}</span>
                    </div>
                </td>
                <td><span class="status-badge ${getStatusClass(task.status)}">${task.status}</span></td>
                <td class="actions">${actions.join('')}</td>
            </tr>
        `;
    }).join("");
    if (missingPrepIds.size) {
        fetchPrepForTasks([...missingPrepIds]);
    }
}

function updatePlanTaskPagination(total = 0) {

    const info = document.getElementById("plan-task-page-info");
    const prevBtn = document.getElementById("plan-task-page-prev");
    const nextBtn = document.getElementById("plan-task-page-next");
    const totalPages = Math.max(1, Math.ceil(total / planTaskPerPage));
    if (planTaskPage > totalPages) planTaskPage = totalPages;
    const start = total ? (planTaskPage - 1) * planTaskPerPage + 1 : 0;
    const end = Math.min(total, planTaskPage * planTaskPerPage);
    if (info) info.textContent = `第 ${planTaskPage}/${totalPages} 页 · 显示 ${start}-${end} / ${total}`;
    if (prevBtn) prevBtn.disabled = planTaskPage <= 1;
    if (nextBtn) nextBtn.disabled = planTaskPage >= totalPages;
}

function goPlanTaskPage(direction) {
    const total = planTaskDataCache.length;
    const totalPages = Math.max(1, Math.ceil(total / planTaskPerPage));
    if (direction === 'prev' && planTaskPage > 1) planTaskPage -= 1;
    if (direction === 'next' && planTaskPage < totalPages) planTaskPage += 1;
    renderPlanTaskTable(planTaskDataCache);
    updatePlanTaskPagination(total);
}

function updatePlanTaskStats(tasks = [], totalFromApi = null) {

    const total = totalFromApi ?? tasks.length;
    const pending = tasks.filter(t => t.status === '待执行').length;
    const running = tasks.filter(t => t.status === '进行中').length;
    const finished = tasks.filter(t => t.status === '已完成').length;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('plan-stat-total', total);
    setText('plan-stat-pending', pending);
    setText('plan-stat-running', running);
    setText('plan-stat-finished', finished);
    setText('plan-stat-total-desc', total ? `活跃任务 ${Math.round((running / total) * 100)}%` : '活跃任务 0%');
    setText('plan-stat-pending-desc', `待准备 ${pending} 项`);
    setText('plan-stat-running-desc', `执行中 ${running} 项`);
    setText('plan-stat-finished-desc', total ? `完成率 ${Math.round((finished / total) * 100)}%` : '完成率 0%');
}

function resetPlanTaskFilters() {
    document.getElementById("plan-task-status-filter").value = "";
    document.getElementById("plan-task-type-filter").value = "";
    document.getElementById("plan-task-keyword").value = "";
    switchPlanTaskTab('all');
}

function setPlanTaskTabActive(view) {
    const tabs = document.querySelectorAll('#plan-task-tabs .plan-tab');
    tabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-view') === view));
}

function switchPlanTaskTab(view) {
    setPlanTaskTabActive(view);
    planTaskView = view;
    loadPlanTasks(view);
}

function handlePlanTaskScheduleChange() {
    const select = document.getElementById("plan-task-schedule-type");
    const cronRow = document.getElementById("plan-task-cron-row");
    const planTimeInput = document.getElementById("plan-task-plan-time");
    const planTimeGroup = document.getElementById("plan-task-plan-time-group");
    const weeklyRow = document.getElementById("plan-task-weekly-row");
    const monthlyRow = document.getElementById("plan-task-monthly-row");
    const planTimeLabel = document.getElementById("plan-task-plan-time-label");

    if (!select || !cronRow || !planTimeInput) return;

    // 控制各行的显示隐藏
    cronRow.style.display = select.value === 'cron' ? 'flex' : 'none';
    weeklyRow.style.display = select.value === 'weekly' ? 'flex' : 'none';
    monthlyRow.style.display = select.value === 'monthly' ? 'flex' : 'none';
    
    // Cron 模式下隐藏计划时间
    planTimeGroup.style.display = select.value === 'cron' ? 'none' : 'flex';

    // 根据周期类型切换时间选择器类型和标签
    if (select.value === 'once') {
        planTimeInput.type = 'datetime-local';
        planTimeLabel.innerHTML = '计划执行时间 <span class="required">*</span>';
        if (planTimeInput.value && planTimeInput.value.length === 5) {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            planTimeInput.value = `${dateStr}T${planTimeInput.value}`;
        }
    } else {
        // 每天、每周、每月，只选择具体时间点
        planTimeLabel.innerHTML = '执行时间点 <span class="required">*</span>';
        const currentValue = planTimeInput.value;
        planTimeInput.type = 'time';
        if (currentValue && currentValue.includes('T')) {
            planTimeInput.value = currentValue.split('T')[1].substring(0, 5);
        }
    }
}


function setPreparationItems(items = []) {
    planTaskPreparations = items.map(item => ({
        description: item.description || '',
        status: item.status || '未开始',
        estimated_minutes: item.estimated_minutes || ''
    }));
    renderPreparationList();
}

function renderPreparationList() {
    const list = document.getElementById("preparation-list");
    if (!list) return;
    list.innerHTML = "";
    if (planTaskPreparations.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-hint";
        empty.textContent = "暂无准备事项，可点击添加";
        list.appendChild(empty);
        return;
    }
    planTaskPreparations.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.className = "preparation-item";
        itemEl.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>事项描述</label>
                    <input type="text" class="prep-description" placeholder="请输入准备事项" />
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select class="prep-status">
                        <option value="未开始">未开始</option>
                        <option value="进行中">进行中</option>
                        <option value="已完成">已完成</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>预计耗时(分钟)</label>
                    <input type="number" class="prep-estimated" min="0" placeholder="可选" />
                </div>
            </div>
            <div class="preparation-actions">
                <button type="button" onclick="removePreparationItem(${index})">删除</button>
            </div>
        `;
        list.appendChild(itemEl);
        const descInput = itemEl.querySelector(".prep-description");
        const statusSelect = itemEl.querySelector(".prep-status");
        const estimateInput = itemEl.querySelector(".prep-estimated");
        descInput.value = item.description || "";
        statusSelect.value = item.status || "未开始";
        estimateInput.value = item.estimated_minutes || "";
        descInput.addEventListener("input", e => planTaskPreparations[index].description = e.target.value);
        statusSelect.addEventListener("change", e => planTaskPreparations[index].status = e.target.value);
        estimateInput.addEventListener("input", e => planTaskPreparations[index].estimated_minutes = e.target.value);
    });
}

function addPreparationItem(item = { description: '', status: '未开始', estimated_minutes: '' }) {
    planTaskPreparations.push(item);
    renderPreparationList();
}

function removePreparationItem(index) {
    planTaskPreparations.splice(index, 1);
    renderPreparationList();
}

function collectPreparationData() {
    return planTaskPreparations
        .filter(item => item.description?.trim())
        .map(item => ({
            description: item.description.trim(),
            status: item.status || '未开始',
            estimated_minutes: item.estimated_minutes ? Number(item.estimated_minutes) : null
        }));
}

function setDefaultPlanTaskTime() {
    const input = document.getElementById("plan-task-plan-time");
    if (!input) return;
    const now = new Date(Date.now() + 3600 * 1000);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
    input.value = local;
}

async function showPlanTaskDialog(taskId = null) {
    const dialog = document.getElementById("plan-task-dialog");
    const title = document.getElementById("plan-task-dialog-title");
    const form = document.getElementById("plan-task-form");
    form.reset();
    document.getElementById("plan-task-id").value = "";
    document.getElementById("plan-task-webhook-cache").value = "";
    document.getElementById("plan-task-reminder-enabled").checked = true;
    toggleReminderFields(true);
    document.getElementById("plan-task-reminder-message").value = DEFAULT_REMINDER_TEMPLATE;
    setPreparationItems([]);


    populateAlertRobotSelect();

    const robots = configCache.alert_robots || [];
    if (robots.length && document.getElementById("plan-task-alert-robot")) {
        document.getElementById("plan-task-alert-robot").value = robots[0].name;
    }

    handlePlanTaskScheduleChange();
    setDefaultPlanTaskTime();
    if (taskId) {
        title.textContent = "编辑计划任务";
        await fillPlanTaskForm(taskId);
    } else {
        title.textContent = "新建计划任务";
    }
    dialog.classList.add("active");
}


function closePlanTaskDialog() {
    document.getElementById("plan-task-dialog").classList.remove("active");
}

async function fillPlanTaskForm(taskId) {
    try {
        const response = await apiFetch(`${API_BASE}/plan-tasks/${taskId}`);
        const result = await response.json();
        if (result.code === 0) {
            const data = result.data;
            document.getElementById("plan-task-id").value = data.id;
            document.getElementById("plan-task-title").value = data.title || "";
            document.getElementById("plan-task-type").value = data.task_type || "其他";
            document.getElementById("plan-task-schedule-type").value = data.schedule_type || "once";
            
            // 填充周/月执行日
            if (data.schedule_type === 'weekly') {
                document.getElementById("plan-task-weekly-day").value = data.schedule_value || "0";
            } else if (data.schedule_type === 'monthly') {
                document.getElementById("plan-task-monthly-day").value = data.schedule_value || "1";
            } else if (data.schedule_type === 'cron') {
                document.getElementById("plan-task-schedule-value").value = data.schedule_value || "";
            }
            
            // 先应用周期变化逻辑，以确保 input 类型正确
            handlePlanTaskScheduleChange();

            
            let planTimeValue = data.plan_time ? data.plan_time.replace(' ', 'T') : "";
            if (data.schedule_type !== 'once' && data.schedule_type !== 'cron' && planTimeValue.includes('T')) {
                // 如果是周期性任务且当前是日期时间格式，截取时间部分
                planTimeValue = planTimeValue.split('T')[1].substring(0, 5);
            }
            document.getElementById("plan-task-plan-time").value = planTimeValue;

            document.getElementById("plan-task-webhook-cache").value = data.webhook_url || "";
            document.getElementById("plan-task-responsible").value = (data.responsible || []).join(',');

            document.getElementById("plan-task-owner").value = data.owner || "";
            document.getElementById("plan-task-reminder").value = data.reminder_minutes || 1440;
            document.getElementById("plan-task-reminder-enabled").checked = !!data.reminder_enabled;
            toggleReminderFields(!!data.reminder_enabled);
            populateAlertRobotSelect(data.alert_robot || "");
            document.getElementById("plan-task-reminder-message").value = data.reminder_message || DEFAULT_REMINDER_TEMPLATE;
            document.getElementById("plan-task-description").value = data.description || "";
            setPreparationItems(data.preparations || []);
        }
    } catch (error) {
        console.error("加载任务详情失败:", error);
        showToast("加载任务详情失败", "error");
    }
}

async function savePlanTask() {
    const id = document.getElementById("plan-task-id").value;
    const selectedRobot = document.getElementById("plan-task-alert-robot")?.value || "";
    const cachedWebhook = document.getElementById("plan-task-webhook-cache")?.value || "";
    const webhookFromConfig = getAlertRobotWebhook(selectedRobot) || cachedWebhook;
    
    let planTime = document.getElementById("plan-task-plan-time").value;
    const scheduleType = document.getElementById("plan-task-schedule-type").value;
    let scheduleValue = "";

    if (scheduleType === 'weekly') {
        scheduleValue = document.getElementById("plan-task-weekly-day").value;
    } else if (scheduleType === 'monthly') {
        scheduleValue = document.getElementById("plan-task-monthly-day").value;
    } else if (scheduleType === 'cron') {
        scheduleValue = document.getElementById("plan-task-schedule-value").value.trim();
    }
    
    // 如果是周期性任务且只选了时间，补全为当前的日期以便后端解析
    if (planTime && planTime.length === 5 && scheduleType !== 'once') {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        planTime = `${year}-${month}-${day}T${planTime}`;
    } else if (scheduleType === 'cron') {
        // Cron 模式下 plan_time 可能为空，给个默认值（当前时间）以便后端不报错
        if (!planTime) {
            const now = new Date();
            planTime = now.toISOString().slice(0, 16);
        }
    }

    const payload = {
        title: document.getElementById("plan-task-title").value.trim(),
        task_type: document.getElementById("plan-task-type").value,
        schedule_type: scheduleType,
        schedule_value: scheduleValue,
        plan_time: planTime,

        responsible: document.getElementById("plan-task-responsible").value
            .split(',').map(item => item.trim()).filter(Boolean),
        owner: document.getElementById("plan-task-owner").value.trim(),
        reminder_minutes: Number(document.getElementById("plan-task-reminder").value) || 0,
        reminder_enabled: document.getElementById("plan-task-reminder-enabled").checked,
        alert_robot: selectedRobot,
        webhook_url: webhookFromConfig,
        reminder_message: document.getElementById("plan-task-reminder-message").value.trim(),
        description: document.getElementById("plan-task-description").value.trim(),
        preparations: collectPreparationData()
    };

    if (!payload.reminder_message) {
        payload.reminder_message = DEFAULT_REMINDER_TEMPLATE;
    }

    if (!payload.title) {
        showToast("请填写任务标题", "warning");
        return;
    }
    if (!payload.plan_time && payload.schedule_type !== 'cron') {
        showToast("请选择计划执行时间", "warning");
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/plan-tasks/${id}` : `${API_BASE}/plan-tasks`;
        const response = await apiFetch(url, {
            method,
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.code === 0) {
            showToast(id ? "任务更新成功" : "任务创建成功", "success");
            closePlanTaskDialog();
            loadPlanTasks(planTaskView);
        } else {
            showToast(result.message || "保存失败", "error");
        }
    } catch (error) {
        console.error("保存任务失败:", error);
        showToast("保存任务失败", "error");
    }
}

async function testPlanTaskNotification() {
    const robotName = document.getElementById("plan-task-alert-robot").value;
    const webhook = getAlertRobotWebhook(robotName);
    const template = document.getElementById("plan-task-reminder-message").value;
    
    if (!robotName) {
        showToast("请先选择告警机器人", "warning");
        return;
    }
    
    if (!webhook) {
        showToast("该机器人未配置Webhook地址", "warning");
        return;
    }
    
    const payload = {
        webhook_url: webhook,
        reminder_message: template || DEFAULT_REMINDER_TEMPLATE,
        title: document.getElementById("plan-task-title").value || "测试任务",
        plan_time: document.getElementById("plan-task-plan-time").value || new Date().toLocaleString(),
        owner: document.getElementById("plan-task-owner").value || "测试负责人",
        responsible: document.getElementById("plan-task-responsible").value.split(',').filter(i => i.trim()),
        preparations: collectPreparationData()
    };
    
    try {
        showToast("正在发送测试通知...", "info");
        const response = await apiFetch(`${API_BASE}/plan-tasks/test-notification`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.code === 0) {
            showToast("测试通知发送成功", "success");
        } else {
            showToast(result.message || "测试通知发送失败", "error");
        }
    } catch (error) {
        console.error("测试通知失败:", error);
        showToast("请求失败，请检查网络", "error");
    }
}


async function deletePlanTask(id) {
    if (!confirm("确定要删除该计划任务吗？")) return;
    
    try {
        const response = await apiFetch(`${API_BASE}/plan-tasks/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.code === 0) {
            showToast("删除成功");
            loadPlanTasks();
        } else {
            showToast(result.message || "删除失败", "error");
        }
    } catch (error) {
        console.error("删除任务失败:", error);
        showToast("网络错误", "error");
    }
}

async function editPlanTask(id) {
    await showPlanTaskDialog(id);
}

async function viewPlanTaskDetail(id) {
    try {
        const response = await apiFetch(`${API_BASE}/plan-tasks/${id}`);
        const result = await response.json();
        if (result.code === 0) {
            renderPlanTaskDetail(result.data);
        }
    } catch (error) {
        console.error("加载任务详情失败:", error);
        showToast("加载任务详情失败", "error");
    }
}

function renderPlanTaskDetail(data) {
    const body = document.getElementById("plan-task-detail-body");
    const footer = document.getElementById("plan-task-detail-footer");
    if (!body || !footer) return;
    const planTimeText = formatDateTimeDisplay(data.plan_time);
    const scheduleLabel = getScheduleLabel(data.schedule_type);
    const preps = data.preparations || [];
    const prepProgress = `${preps.filter(p => p.status === '已完成').length}/${preps.length || 0}`;
    body.innerHTML = `
        <div class="detail-block">
            <div class="detail-row"><span>任务类型</span><strong>${data.task_type || '-'} </strong></div>
            <div class="detail-row"><span>计划时间</span><strong>${planTimeText}</strong></div>
            <div class="detail-row"><span>执行周期</span><strong>${scheduleLabel}</strong></div>
            <div class="detail-row"><span>责任人</span><strong>${(data.responsible || []).join('、') || '-'}</strong></div>

            <div class="detail-row"><span>主负责人</span><strong>${data.owner || '-'}</strong></div>
            <div class="detail-row"><span>提醒</span><strong>${data.reminder_enabled ? formatReminderText(data.reminder_minutes) : '关闭'}</strong></div>
            <div class="detail-row"><span>准备进度</span><strong>${prepProgress}</strong></div>

            <div class="detail-row"><span>告警机器人</span><strong>${data.alert_robot || '-'}</strong></div>
            <div class="detail-row"><span>Webhook</span><strong>${(getAlertRobotWebhook(data.alert_robot) || data.webhook_url) ? maskWebhook(getAlertRobotWebhook(data.alert_robot) || data.webhook_url) : '未配置'}</strong></div>
            <div class="detail-row"><span>状态</span><strong>${data.status}</strong></div>
        </div>

        <div class="detail-block">

            <div class="detail-row"><span>提醒内容</span><p>${(data.reminder_message || DEFAULT_REMINDER_TEMPLATE).replace(/\n/g, '<br/>')}</p></div>
        </div>
        <div class="detail-block">
            <div class="detail-row"><span>任务描述</span><p>${data.description || '暂无描述'}</p></div>
        </div>

        <div class="detail-block">
            <div class="detail-row"><span>准备事项</span></div>
            <div class="prep-detail-list">
                ${(data.preparations || []).map(item => `
                    <div class="prep-detail-item">
                        <div>${item.description}</div>
                        <span class="badge ${getStatusClass(item.status)}">${item.status}</span>
                    </div>
                `).join('') || '<p style="color:#999;">暂无准备事项</p>'}
            </div>
        </div>
    `;
    footer.innerHTML = '';
    if (data.status === '待执行') {
        footer.innerHTML += `<button class="btn btn-primary" onclick="showStatusDialog(${data.id}, 'start')">开始任务</button>`;
    }
    if (data.status === '进行中') {
        footer.innerHTML += `<button class="btn btn-primary" onclick="showStatusDialog(${data.id}, 'complete')">完成任务</button>`;
    }
    if (data.status !== '已完成' && data.status !== '已取消') {
        footer.innerHTML += `<button class="btn" onclick="showStatusDialog(${data.id}, 'cancel')">取消任务</button>`;
    }

    document.getElementById("plan-task-detail-dialog").classList.add("active");
    document.getElementById("plan-task-detail-title").textContent = data.title;
}

function closePlanTaskDetail() {
    document.getElementById("plan-task-detail-dialog").classList.remove("active");
}

function showStatusDialog(id, action) {
    statusTaskId = id;
    statusAction = action;
    const dialog = document.getElementById("plan-task-status-dialog");
    const title = document.getElementById("plan-task-status-title");
    const statusSelect = document.getElementById("plan-task-result-status");
    const noteInput = document.getElementById("plan-task-status-notes");
    const hint = document.getElementById("plan-task-status-hint");
    if (!dialog || !title || !statusSelect || !noteInput || !hint) return;

    if (action === 'complete') {
        statusSelect.parentElement.style.display = 'block';
        statusSelect.value = '成功';
        hint.textContent = '记录执行结果，便于后续追溯。';
    } else {
        statusSelect.parentElement.style.display = 'none';
        statusSelect.value = '';
        hint.textContent = action === 'cancel' ? '请输入取消原因，便于沟通和追踪。' : '确认开始执行该计划任务。';
    }
    noteInput.value = '';
    title.textContent = action === 'start' ? '开始任务' : action === 'complete' ? '完成任务' : '取消任务';
    dialog.classList.add('active');
}

function closeStatusDialog() {
    const dialog = document.getElementById("plan-task-status-dialog");
    if (dialog) dialog.classList.remove('active');
    statusAction = null;
    statusTaskId = null;
}


async function submitStatusDialog() {
    const dialog = document.getElementById("plan-task-status-dialog");
    const statusSelect = document.getElementById("plan-task-result-status");
    const noteInput = document.getElementById("plan-task-status-notes");
    const submitBtn = document.getElementById("plan-task-status-submit");
    if (!dialog || !statusSelect || !noteInput || !submitBtn || !statusTaskId || !statusAction) return;
    const payload = { action: statusAction };
    if (statusAction === 'complete') {
        payload.result_status = statusSelect.value || '成功';
        payload.result_notes = noteInput.value || '';
    }
    if (statusAction === 'cancel') {
        if (!noteInput.value.trim()) {
            showToast('请填写取消原因', 'warning');
            return;
        }
        payload.result_notes = noteInput.value.trim();
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    try {
        const response = await apiFetch(`${API_BASE}/plan-tasks/${statusTaskId}/status`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.code === 0) {
            showToast("状态更新成功", "success");
            loadPlanTasks(planTaskView);
            closePlanTaskDetail();
            closeStatusDialog();
        } else {
            showToast(result.message || "状态更新失败", "error");
        }
    } catch (error) {
        console.error("更新任务状态失败:", error);
        showToast("更新任务状态失败", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '确认';
    }
}



// 导出函数供HTML调用
window.showPage = showPage;
window.showSystemDialog = showSystemDialog;
window.closeSystemDialog = closeSystemDialog;
window.saveSystem = saveSystem;
window.editSystem = editSystem;
window.viewSystem = viewSystem;
window.showSystemViewDialog = showSystemViewDialog;
window.closeSystemViewDialog = closeSystemViewDialog;

window.deleteSystem = deleteSystem;
window.loadBusinessSystems = loadBusinessSystems;
window.showEventDialog = showEventDialog;
window.closeEventDialog = closeEventDialog;
window.saveEvent = saveEvent;
window.editEvent = editEvent;
window.viewEvent = viewEvent;
window.showEventViewDialog = showEventViewDialog;
window.closeEventViewDialog = closeEventViewDialog;
window.deleteEvent = deleteEvent;
window.searchEvents = searchEvents;
window.resetEventFilters = resetEventFilters;
window.addProcessStep = addProcessStep;
window.showStatusDialog = showStatusDialog;
window.closeStatusDialog = closeStatusDialog;
window.submitStatusDialog = submitStatusDialog;

window.removeProcessStep = removeProcessStep;

window.handleEventFileUpload = handleEventFileUpload;
window.removeFile = removeFile;
window.deleteAttachment = deleteAttachment;
window.showConfigDialog = showConfigDialog;
window.closeConfigDialog = closeConfigDialog;
window.saveConfigItem = saveConfigItem;
window.removeConfigItem = removeConfigItem;
window.showRobotConfigDialog = showRobotConfigDialog;
window.closeRobotConfigDialog = closeRobotConfigDialog;
window.saveRobotConfig = saveRobotConfig;
window.removeRobotConfig = removeRobotConfig;
window.addHostRow = addHostRow;

window.removeHostRow = removeHostRow;
window.addMiddlewareRow = addMiddlewareRow;
window.removeMiddlewareRow = removeMiddlewareRow;
window.showUserDialog = showUserDialog;
window.closeUserDialog = closeUserDialog;
window.saveUser = saveUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.loadPlanTasks = loadPlanTasks;
window.resetPlanTaskFilters = resetPlanTaskFilters;
window.switchPlanTaskTab = switchPlanTaskTab;
window.showPlanTaskDialog = showPlanTaskDialog;
window.closePlanTaskDialog = closePlanTaskDialog;
let notificationAuditPage = 1;
const notificationAuditPerPage = 15;
let currentNotificationAudits = [];

async function loadNotificationAudits(page = 1) {
    notificationAuditPage = page;
    const start = document.getElementById("audit-filter-start").value;
    const end = document.getElementById("audit-filter-end").value;
    const title = document.getElementById("audit-filter-title").value;
    
    let url = `${API_BASE}/notification-audits?page=${page}&per_page=${notificationAuditPerPage}`;
    if (start) url += `&start_date=${start}`;
    if (end) url += `&end_date=${end}`;
    if (title) url += `&task_title=${encodeURIComponent(title)}`;
    
    try {
        const response = await apiFetch(url);
        const result = await response.json();
        if (result.code === 0) {
            currentNotificationAudits = result.data;
            renderNotificationAuditTable(result.data);
            renderAuditPagination(result.total, result.pages, result.current_page);
        }
    } catch (error) {
        console.error("加载通知审计失败:", error);
        showToast("加载通知审计失败", "error");
    }
}

let selectedAuditIds = new Set();

function renderNotificationAuditTable(data) {
    const tbody = document.getElementById("audit-tbody");
    if (!tbody) return;
    
    // 重置选择
    selectedAuditIds.clear();
    const selectAll = document.getElementById("audit-select-all");
    if (selectAll) selectAll.checked = false;
    updateBulkDeleteButton();

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 60px; color: #94a3b8;">暂无通知审计记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map((audit, index) => {
        const statusClass = audit.status === '成功' ? 'status-resolved' : 'status-unresolved';
        return `
            <tr style="cursor: pointer;" onclick="handleAuditRowClick(event, ${index})">
                <td style="text-align: center;" onclick="event.stopPropagation()">
                    <input type="checkbox" class="audit-checkbox" value="${audit.id}" onclick="toggleAuditSelection(this)">
                </td>
                <td style="font-family: 'Cascadia Code', monospace; color: #64748b; font-size: 13px;">${audit.sent_at}</td>
                <td>
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 2px;">${audit.task_title || '-'}</div>
                    <div style="font-size: 11px; color: #94a3b8;">关联ID: ${audit.task_id || '测试通知'}</div>
                </td>
                <td>
                    <div style="font-weight: 500; color: #334155; line-height: 1.4;">${audit.title || '-'}</div>
                </td>
                <td>
                    <div style="color: #475569; font-size: 13px; font-weight: 500;">${audit.robot_name || '默认机器人'}</div>
                    <div style="font-size: 11px; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;" title="${audit.webhook_url}">
                        ${audit.webhook_url}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}" style="padding: 4px 12px; border-radius: 4px; font-weight: 500; font-size: 12px;">
                        ${audit.status === '成功' ? '● 发送成功' : '● 发送失败'}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

function handleAuditRowClick(event, index) {
    // 如果点击的是 checkbox，不触发展开详情
    if (event.target.type === 'checkbox' || event.target.closest('input[type="checkbox"]')) {
        return;
    }
    showAuditDetail(index);
}

function toggleSelectAllAudits(checkbox) {
    const checkboxes = document.querySelectorAll('.audit-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        if (checkbox.checked) {
            selectedAuditIds.add(cb.value);
        } else {
            selectedAuditIds.delete(cb.value);
        }
    });
    updateBulkDeleteButton();
}

function toggleAuditSelection(checkbox) {
    if (checkbox.checked) {
        selectedAuditIds.add(checkbox.value);
    } else {
        selectedAuditIds.delete(checkbox.value);
    }
    
    // 更新全选状态
    const selectAll = document.getElementById("audit-select-all");
    const checkboxes = document.querySelectorAll('.audit-checkbox');
    selectAll.checked = Array.from(checkboxes).every(cb => cb.checked);
    
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const btn = document.getElementById("btn-bulk-delete");
    if (!btn) return;
    if (selectedAuditIds.size > 0) {
        btn.style.display = "inline-block";
        btn.textContent = `批量删除 (${selectedAuditIds.size})`;
    } else {
        btn.style.display = "none";
    }
}

async function bulkDeleteAudits() {
    if (selectedAuditIds.size === 0) return;
    
    if (!confirm(`确定要删除选中的 ${selectedAuditIds.size} 条审计记录吗？此操作不可撤销。`)) {
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/notification-audits/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify({
                ids: Array.from(selectedAuditIds)
            })
        });
        const result = await response.json();
        if (result.code === 0) {
            showToast(result.message, "success");
            loadNotificationAudits(notificationAuditPage);
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("批量删除失败:", error);
        showToast("操作失败，请重试", "error");
    }
}

function renderAuditPagination(total, pages, current) {
    const container = document.getElementById("audit-pagination");
    if (!container) return;
    
    let html = `
        <span class="pagination-info">共计 ${total} 条, 当前第 ${current} / ${pages} 页</span>
        <div class="pagination-controls">
    `;
    
    // 上一页
    html += `<button class="btn-pagination" ${current <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="loadNotificationAudits(${current - 1})"><</button>`;
    
    // 页码逻辑
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
        html += `<button class="btn-pagination ${i === current ? 'active' : ''}" onclick="loadNotificationAudits(${i})">${i}</button>`;
    }
    
    // 下一页
    html += `<button class="btn-pagination" ${current >= pages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="loadNotificationAudits(${current + 1})">></button>`;
    
    html += '</div>';
    container.innerHTML = html;
}

function resetAuditFilters() {
    document.getElementById("audit-filter-start").value = "";
    document.getElementById("audit-filter-end").value = "";
    document.getElementById("audit-filter-title").value = "";
    loadNotificationAudits(1);
}

function showAuditDetail(index) {
    try {
        const audit = currentNotificationAudits[index];
        if (!audit) return;
        
        document.getElementById("audit-detail-time").textContent = audit.sent_at;
        document.getElementById("audit-detail-task").textContent = audit.task_title || "未关联任务";
        document.getElementById("audit-detail-robot").textContent = audit.robot_name || "默认机器人";
        
        const statusEl = document.getElementById("audit-detail-status");
        statusEl.textContent = audit.status;
        statusEl.className = audit.status === '成功' ? 'status-badge status-resolved' : 'status-badge status-unresolved';
        statusEl.style.display = "inline-block";
        
        const errorContainer = document.getElementById("audit-detail-error-container");
        if (audit.status === '失败' && audit.error_msg) {
            document.getElementById("audit-detail-error").textContent = audit.error_msg;
            errorContainer.style.display = "block";
        } else {
            errorContainer.style.display = "none";
        }
        
        document.getElementById("audit-detail-webhook").textContent = audit.webhook_url;
        document.getElementById("audit-detail-content").textContent = audit.content;
        
        openModal("audit-detail-dialog");
    } catch (e) {
        console.error("解析审计详情失败:", e);
        showToast("无法加载详情数据", "error");
    }
}

window.addPreparationItem = addPreparationItem;
window.removePreparationItem = removePreparationItem;
window.savePlanTask = savePlanTask;
window.testPlanTaskNotification = testPlanTaskNotification;
window.deletePlanTask = deletePlanTask;
window.loadNotificationAudits = loadNotificationAudits;
window.resetAuditFilters = resetAuditFilters;
window.showAuditDetail = showAuditDetail;
window.toggleSelectAllAudits = toggleSelectAllAudits;
window.toggleAuditSelection = toggleAuditSelection;
window.bulkDeleteAudits = bulkDeleteAudits;
window.handleAuditRowClick = handleAuditRowClick;



window.editPlanTask = editPlanTask;
window.viewPlanTaskDetail = viewPlanTaskDetail;
window.closePlanTaskDetail = closePlanTaskDetail;
window.showStatusDialog = showStatusDialog;
window.closeStatusDialog = closeStatusDialog;
window.submitStatusDialog = submitStatusDialog;




// ==================== 用户管理 ====================


let currentUserPage = 1;

async function loadUsers(page = 1) {
    try {
        const response = await apiFetch(`${API_BASE}/users?page=${page}&per_page=10`);
        const result = await response.json();
        
        if (result.code === 0) {
            const tbody = document.getElementById("users-tbody");
            tbody.innerHTML = result.data.items.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.real_name}</td>
                    <td><span class="badge ${user.role === "admin" ? "badge-success" : "badge-info"}">${user.role === "admin" ? "管理员" : "普通用户"}</span></td>
                    <td>${user.department || "-"}</td>
                    <td>${user.phone || "-"}</td>
                    <td><span class="badge ${user.is_active ? "badge-success" : "badge-danger"}">${user.is_active ? "启用" : "禁用"}</span></td>
                    <td>${user.last_login || "从未登录"}</td>
                    <td class="actions">
                        <button class="btn btn-sm" onclick="editUser(${user.id})">编辑</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">删除</button>
                    </td>
                </tr>
            `).join("");
            
            currentUserPage = page;
            renderUserPagination(result.data.total, page, result.data.per_page);
        }
    } catch (error) {
        console.error("加载用户失败:", error);
        showToast("加载用户失败", "error");
    }
}

function renderUserPagination(total, page, perPage) {
    const totalPages = Math.ceil(total / perPage);
    const pagination = document.getElementById("users-pagination");
    
    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }
    
    let html = `<button class="pagination-btn" onclick="loadUsers(${page - 1})" ${page === 1 ? "disabled" : ""}>上一页</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
            html += `<button class="pagination-btn ${i === page ? "active" : ""}" onclick="loadUsers(${i})">${i}</button>`;
        } else if (i === page - 3 || i === page + 3) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    html += `<button class="pagination-btn" onclick="loadUsers(${page + 1})" ${page === totalPages ? "disabled" : ""}>下一页</button>`;
    pagination.innerHTML = html;
}

function showUserDialog(userId = null) {
    const dialog = document.getElementById("user-dialog");
    const title = document.getElementById("user-dialog-title");
    const form = document.getElementById("user-form");
    const passwordHint = document.getElementById("password-hint");
    
    form.reset();
    document.getElementById("user-id").value = "";
    document.getElementById("user-is-active").checked = true;
    
    if (userId) {
        title.textContent = "编辑用户";
        passwordHint.textContent = "(留空则不修改)";
        loadUserData(userId);
    } else {
        title.textContent = "新增用户";
        passwordHint.textContent = "(必填)";
    }
    
    dialog.classList.add("active");
}

function closeUserDialog() {
    document.getElementById("user-dialog").classList.remove("active");
}

async function loadUserData(userId) {
    try {
        const response = await apiFetch(`${API_BASE}/users?page=1&per_page=1000`);
        const result = await response.json();
        
        if (result.code === 0) {
            const user = result.data.items.find(u => u.id === userId);
            if (user) {
                document.getElementById("user-id").value = user.id;
                document.getElementById("user-username").value = user.username;
                document.getElementById("user-realname").value = user.real_name;
                document.getElementById("user-role").value = user.role;
                document.getElementById("user-department").value = user.department || "";
                document.getElementById("user-phone").value = user.phone || "";
                document.getElementById("user-email").value = user.email || "";
                document.getElementById("user-is-active").checked = user.is_active;
            }
        }
    } catch (error) {
        console.error("加载用户数据失败:", error);
        showToast("加载用户数据失败", "error");
    }
}

async function saveUser() {
    const id = document.getElementById("user-id").value;
    const username = document.getElementById("user-username").value.trim();
    const realName = document.getElementById("user-realname").value.trim();
    const role = document.getElementById("user-role").value;
    const department = document.getElementById("user-department").value;
    const phone = document.getElementById("user-phone").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const password = document.getElementById("user-password").value;
    const isActive = document.getElementById("user-is-active").checked;
    
    if (!username || !realName) {
        showToast("请填写必填项", "warning");
        return;
    }
    
    if (!id && !password) {
        showToast("新增用户必须设置密码", "warning");
        return;
    }
    
    const data = {
        username,
        real_name: realName,
        role,
        department,
        phone,
        email,
        is_active: isActive
    };
    
    if (password) {
        data.password = password;
    }
    
    try {
        const url = id ? `${API_BASE}/users/${id}` : `${API_BASE}/users`;
        const method = id ? "PUT" : "POST";
        
        const response = await apiFetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast(id ? "更新成功" : "创建成功", "success");
            closeUserDialog();
            loadUsers(currentUserPage);
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("保存用户失败:", error);
        showToast("保存用户失败", "error");
    }
}

function editUser(userId) {
    showUserDialog(userId);
}

async function deleteUser(userId) {
    if (!confirm("确定要删除该用户吗?")) {
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`, {
            method: "DELETE"
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast("删除成功", "success");
            loadUsers(currentUserPage);
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        console.error("删除用户失败:", error);
        showToast("删除用户失败", "error");
    }
}







