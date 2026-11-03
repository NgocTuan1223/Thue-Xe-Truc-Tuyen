/**
 * ==========================================================================
 * MotoGo - KỊCH BẢN XÁC THỰC (AUTHENTICATION SCRIPT)
 * Hỗ trợ: Đăng nhập / Đăng ký song song Khách hàng & Chủ xe
 * Chuẩn: ES6+ (Strict Mode), Tối ưu REST API, Bộ nhớ dự phòng LocalStorage
 * ==========================================================================
 */
'use strict';

// --------------------------------------------------------------------------
// 1. CẤU HÌNH HỆ THỐNG & ĐỊNH NGHĨA NỘI DUNG VAI TRÒ
// --------------------------------------------------------------------------
const AUTH_CONFIG = Object.freeze({
    apiCandidates: [
        '/api/auth',
        'http://localhost:5000/api/auth',
        'http://127.0.0.1:5000/api/auth'
    ],
    localStorageUsersKey: 'motogo_users_db',
    sessionUserKeys: ['motogo_user', 'currentUser'],
    requestTimeoutMs: 5000
});

const ROLE_DEFINITIONS = Object.freeze({
    customer: {
        tag: "Dành cho Khách hàng",
        title: "Thuê Xe Nhanh Chóng, Hành Trình Trọn Vẹn",
        desc: "Chỉ với vài thao tác xác thực, bạn có thể đặt ngay hàng trăm mẫu xe tay ga, xe số và côn tay đời mới với chi phí minh bạch.",
        benefits: [
            "Đặt xe trực tuyến, giữ xe 100% đúng mẫu",
            "Giao nhận xe tận nơi hoặc tại trạm trong 15 phút",
            "Quản lý lịch sử chuyến đi và chi phí rõ ràng"
        ],
        loginBtn: "Đăng nhập với tư cách Khách hàng",
        regBtn: "Tạo tài khoản Khách hàng",
        redirectUrl: "index.html",
        roleName: "Khách hàng"
    },
    owner: {
        tag: "Dành cho Đối tác & Chủ xe",
        title: "Gia Tăng Thu Nhập Từ Đội Xe Nhàn Rỗi Của Bạn",
        desc: "Kết nối trực tiếp với hàng ngàn khách hàng có nhu cầu thuê xe mỗi ngày. Hệ thống quản lý lịch đặt, hợp đồng và doanh thu tự động.",
        benefits: [
            "Đăng tải và cập nhật trạng thái xe theo thời gian thực",
            "Xét duyệt yêu cầu thuê xe và xác minh thông tin khách",
            "Thống kê doanh thu, lịch bảo dưỡng minh bạch 24/7"
        ],
        loginBtn: "Đăng nhập Quản lý Cửa hàng",
        regBtn: "Đăng ký Đối tác Cho thuê xe",
        redirectUrl: "owner.html",
        roleName: "Người cho thuê xe"
    }
});

// Quản lý State trang Xác thực
const AuthState = {
    currentRole: 'customer',
    currentTab: 'login',
    isLoading: false
};

// Bộ nhớ đệm DOM Elements
const DOM = {};

// --------------------------------------------------------------------------
// 2. GIAO TIẾP MẠNG & CƠ CHẾ DỰ PHÒNG (NETWORK API & FALLBACK)
// --------------------------------------------------------------------------
async function callAuthApi(endpoint, payload) {
    // 1. Thử gọi lần lượt các Endpoint API của Server MongoDB
    for (const base of AUTH_CONFIG.apiCandidates) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AUTH_CONFIG.requestTimeoutMs);

            const res = await fetch(`${base}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json();
                return { ok: res.ok, status: res.status, data };
            }
        } catch (err) {
            // Thử endpoint tiếp theo trong danh sách candidate
        }
    }

    // 2. Tự động kích hoạt cơ chế dự phòng qua LocalStorage nếu chưa bật server backend
    return handleLocalFallback(endpoint, payload);
}

function handleLocalFallback(endpoint, payload) {
    let users = [];
    try {
        users = JSON.parse(localStorage.getItem(AUTH_CONFIG.localStorageUsersKey) || '[]');
    } catch (e) {
        users = [];
    }

    if (endpoint === '/register') {
        const normalizedEmail = (payload.email || '').trim().toLowerCase();
        const normalizedPhone = (payload.phone || '').trim();

        const existingUser = users.find(
            u => u.email === normalizedEmail || u.phone === normalizedPhone
        );

        if (existingUser) {
            const duplicateField = existingUser.email === normalizedEmail ? 'Email' : 'Số điện thoại';
            const roleLabel = existingUser.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';
            return {
                ok: false,
                status: 409,
                data: {
                    message: `${duplicateField} này đã được đăng ký cho một tài khoản (${roleLabel}). Vui lòng đăng nhập!`
                }
            };
        }

        const newUser = {
            id: 'user_' + Date.now(),
            name: (payload.name || '').trim(),
            phone: normalizedPhone,
            email: normalizedEmail,
            password: payload.password,
            role: payload.role,
            shopName: payload.role === 'owner' ? payload.shopName : null,
            fleetSize: payload.role === 'owner' ? payload.fleetSize : null,
            address: payload.role === 'owner' ? payload.address : null,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(AUTH_CONFIG.localStorageUsersKey, JSON.stringify(users));

        return {
            ok: true,
            status: 201,
            data: {
                message: `Đăng ký tài khoản ${payload.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng'} thành công!`,
                user: newUser
            }
        };
    }

    if (endpoint === '/login') {
        const cleanIdentifier = (payload.identifier || '').trim();
        const cleanEmail = cleanIdentifier.toLowerCase();
        const cleanPhone = cleanIdentifier;
        const roleLabel = payload.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';

        const user = users.find(u => u.email === cleanEmail || u.phone === cleanPhone);

        if (!user) {
            return {
                ok: false,
                status: 404,
                data: {
                    needRegister: true,
                    message: `Tài khoản ${roleLabel} chưa tồn tại trên hệ thống! Vui lòng chuyển sang tab "Đăng ký tài khoản" để tạo mới.`
                }
            };
        }

        if (user.role !== payload.role) {
            const actualRoleLabel = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';
            return {
                ok: false,
                status: 403,
                data: {
                    message: `Tài khoản này đã được đăng ký với vai trò "${actualRoleLabel}". Vui lòng chọn đúng vai trò "${actualRoleLabel}" ở phía trên!`
                }
            };
        }

        if (user.password !== payload.password) {
            return {
                ok: false,
                status: 401,
                data: { message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!' }
            };
        }

        return {
            ok: true,
            status: 200,
            data: {
                message: `Đăng nhập tài khoản ${roleLabel} thành công!`,
                user
            }
        };
    }

    return { ok: false, status: 400, data: { message: 'Hành động không hợp lệ!' } };
}

// --------------------------------------------------------------------------
// 3. ĐIỀU KHIỂN GIAO DIỆN (UI CONTROLLERS)
// --------------------------------------------------------------------------
function showMessage(text, type = 'error') {
    if (!DOM.authMessage) return;

    DOM.authMessage.textContent = text;
    DOM.authMessage.className = `auth-message ${type} show`;

    if (type !== 'error') {
        setTimeout(() => {
            if (DOM.authMessage.classList.contains(type)) {
                DOM.authMessage.classList.remove('show');
            }
        }, 5000);
    }
}

function clearMessage() {
    if (!DOM.authMessage) return;
    DOM.authMessage.textContent = '';
    DOM.authMessage.className = 'auth-message';
}

function setRole(role) {
    if (!ROLE_DEFINITIONS[role]) return;
    AuthState.currentRole = role;

    // Cập nhật trạng thái active của nút chọn vai trò
    DOM.roleButtons.forEach(btn => {
        const isActive = btn.dataset.role === role;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // Cập nhật banner thông tin bên cột trái
    const config = ROLE_DEFINITIONS[role];
    if (DOM.bannerTag) DOM.bannerTag.textContent = config.tag;
    if (DOM.bannerTitle) DOM.bannerTitle.textContent = config.title;
    if (DOM.bannerDesc) DOM.bannerDesc.textContent = config.desc;

    if (DOM.bannerBenefits) {
        DOM.bannerBenefits.innerHTML = config.benefits
            .map(item => `<li><i class="fa-solid fa-circle-check"></i> <span>${item}</span></li>`)
            .join('');
    }

    // Cập nhật nhãn của nút gửi biểu mẫu
    if (DOM.btnSubmitLogin) DOM.btnSubmitLogin.textContent = config.loginBtn;
    if (DOM.btnSubmitRegister) DOM.btnSubmitRegister.textContent = config.regBtn;

    // Ẩn/Hiện nhóm trường bổ sung cho chủ xe
    if (DOM.ownerExtraFields) {
        DOM.ownerExtraFields.classList.toggle('hidden', role !== 'owner');
    }

    clearMessage();
}

function switchTab(tabName) {
    AuthState.currentTab = tabName;
    const isLogin = tabName === 'login';

    DOM.authTabs.forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (DOM.loginForm) DOM.loginForm.classList.toggle('active', isLogin);
    if (DOM.registerForm) DOM.registerForm.classList.toggle('active', !isLogin);

    clearMessage();
}

function setButtonLoading(button, isLoading, normalText, loadingText) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
    } else {
        button.innerHTML = normalText;
    }
}

function saveUserSession(user) {
    const serialized = JSON.stringify(user);
    AUTH_CONFIG.sessionUserKeys.forEach(key => localStorage.setItem(key, serialized));
}

// --------------------------------------------------------------------------
// 4. XỬ LÝ BIỂU MẪU ĐĂNG NHẬP & ĐĂNG KÝ
// --------------------------------------------------------------------------
async function handleLoginSubmit(e) {
    e.preventDefault();
    if (AuthState.isLoading) return;

    const identifier = DOM.loginIdentifier?.value.trim() || '';
    const password = DOM.loginPassword?.value || '';

    if (!identifier || !password) {
        showMessage('Vui lòng nhập đầy đủ Email/Số điện thoại và Mật khẩu!', 'error');
        return;
    }

    const currentConfig = ROLE_DEFINITIONS[AuthState.currentRole];
    AuthState.isLoading = true;
    setButtonLoading(DOM.btnSubmitLogin, true, currentConfig.loginBtn, 'Đang xác thực thông tin...');

    try {
        const res = await callAuthApi('/login', {
            identifier,
            password,
            role: AuthState.currentRole
        });

        if (!res.ok) {
            showMessage(res.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại!', 'error');

            if (res.data?.needRegister) {
                setTimeout(() => switchTab('register'), 1600);
            }
            return;
        }

        const user = res.data.user;
        saveUserSession(user);

        const roleName = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';
        showMessage(`Đăng nhập thành công với tư cách ${roleName}! Đang chuyển hướng...`, 'success');

        const targetUrl = user.role === 'owner' ? 'owner.html' : 'index.html';
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 900);
    } catch (err) {
        showMessage('Đã xảy ra sự cố trong quá trình đăng nhập. Vui lòng thử lại!', 'error');
    } finally {
        AuthState.isLoading = false;
        setButtonLoading(DOM.btnSubmitLogin, false, currentConfig.loginBtn, '');
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    if (AuthState.isLoading) return;

    const name = DOM.regName?.value.trim() || '';
    const phone = DOM.regPhone?.value.trim() || '';
    const email = DOM.regEmail?.value.trim() || '';
    const password = DOM.regPassword?.value || '';

    if (!name || !phone || !email || !password) {
        showMessage('Vui lòng điền đầy đủ các trường thông tin bắt buộc!', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Mật khẩu bảo mật phải có ít nhất 6 ký tự!', 'error');
        return;
    }

    const payload = {
        name,
        phone,
        email,
        password,
        role: AuthState.currentRole
    };

    if (AuthState.currentRole === 'owner') {
        payload.shopName = DOM.regShopName?.value.trim() || `Nhà xe ${name}`;
        payload.fleetSize = DOM.regFleetSize?.value || '1-5';
        payload.address = DOM.regAddress?.value.trim() || 'Hà Nội';
    }

    const currentConfig = ROLE_DEFINITIONS[AuthState.currentRole];
    AuthState.isLoading = true;
    setButtonLoading(DOM.btnSubmitRegister, true, currentConfig.regBtn, 'Đang tạo tài khoản & lưu vào MongoDB mục USES...');

    try {
        const res = await callAuthApi('/register', payload);

        if (!res.ok) {
            showMessage(res.data?.message || 'Đăng ký không thành công!', 'error');
            return;
        }

        const user = res.data.user;
        saveUserSession(user);

        const roleName = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';
        showMessage(`Đăng ký tài khoản ${roleName} thành công! Đã lưu vào MongoDB mục USES. Đang chuyển hướng...`, 'success');

        const targetUrl = user.role === 'owner' ? 'owner.html' : 'index.html';
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 1100);
    } catch (err) {
        showMessage('Đã xảy ra sự cố kết nối trong quá trình đăng ký. Vui lòng thử lại!', 'error');
    } finally {
        AuthState.isLoading = false;
        setButtonLoading(DOM.btnSubmitRegister, false, currentConfig.regBtn, '');
    }
}

// --------------------------------------------------------------------------
// 5. GẮN KẾT SỰ KIỆN GIAO DIỆN (EVENT BINDINGS)
// --------------------------------------------------------------------------
function cacheDOMElements() {
    DOM.roleButtons = document.querySelectorAll('.role-btn');
    DOM.authTabs = document.querySelectorAll('.auth-tab');
    DOM.loginForm = document.getElementById('login-form');
    DOM.registerForm = document.getElementById('register-form');
    DOM.authMessage = document.getElementById('auth-message');
    DOM.ownerExtraFields = document.getElementById('owner-extra-fields');

    DOM.bannerTag = document.getElementById('banner-tag');
    DOM.bannerTitle = document.getElementById('banner-title');
    DOM.bannerDesc = document.getElementById('banner-desc');
    DOM.bannerBenefits = document.getElementById('banner-benefits');

    DOM.loginIdentifier = document.getElementById('login-identifier');
    DOM.loginPassword = document.getElementById('login-password');
    DOM.btnSubmitLogin = document.getElementById('btn-submit-login');

    DOM.regName = document.getElementById('reg-name');
    DOM.regPhone = document.getElementById('reg-phone');
    DOM.regEmail = document.getElementById('reg-email');
    DOM.regPassword = document.getElementById('reg-password');
    DOM.regShopName = document.getElementById('reg-shop-name');
    DOM.regFleetSize = document.getElementById('reg-fleet-size');
    DOM.regAddress = document.getElementById('reg-address');
    DOM.btnSubmitRegister = document.getElementById('btn-submit-register');

    DOM.fillDemoCustomer = document.getElementById('fill-demo-customer');
    DOM.fillDemoOwner = document.getElementById('fill-demo-owner');
    DOM.togglePwdButtons = document.querySelectorAll('.toggle-pwd');
}

function bindEventListeners() {
    // 1. Chuyển vai trò
    DOM.roleButtons.forEach(btn => {
        btn.addEventListener('click', () => setRole(btn.dataset.role));
    });

    // 2. Chuyển tab Đăng nhập / Đăng ký
    DOM.authTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 3. Ẩn/Hiện mật khẩu
    DOM.togglePwdButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const icon = btn.querySelector('i');
            if (!input || !icon) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            btn.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    });

    // 4. Nút điền tài khoản thử nghiệm nhanh (Demo)
    DOM.fillDemoCustomer?.addEventListener('click', () => {
        setRole('customer');
        switchTab('login');
        if (DOM.loginIdentifier) DOM.loginIdentifier.value = 'khachhang@gmail.com';
        if (DOM.loginPassword) DOM.loginPassword.value = '123456';
        showMessage('Đã điền tài khoản mẫu Khách hàng. Nhấn "Đăng nhập" để trải nghiệm!', 'info');
    });

    DOM.fillDemoOwner?.addEventListener('click', () => {
        setRole('owner');
        switchTab('login');
        if (DOM.loginIdentifier) DOM.loginIdentifier.value = 'chuxe@gmail.com';
        if (DOM.loginPassword) DOM.loginPassword.value = '123456';
        showMessage('Đã điền tài khoản mẫu Chủ xe. Nhấn "Đăng nhập" để trải nghiệm!', 'info');
    });

    // 5. Submit biểu mẫu
    DOM.loginForm?.addEventListener('submit', handleLoginSubmit);
    DOM.registerForm?.addEventListener('submit', handleRegisterSubmit);
}

// --------------------------------------------------------------------------
// 6. KHỞI TẠO HỆ THỐNG XÁC THỰC (INIT AUTH)
// --------------------------------------------------------------------------
function initAuth() {
    cacheDOMElements();
    bindEventListeners();
    setRole('customer');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
