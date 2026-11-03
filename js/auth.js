/**
 * MOTO GO - AUTHENTICATION LOGIC (js/auth.js)
 * Xử lý Đăng nhập & Đăng ký cho Khách thuê xe và Người cho thuê
 * Sau khi đăng nhập/đăng ký:
 *   - Khách hàng (customer) -> Di chuyển sang Trang chủ Người thuê (index.html)
 *   - Người cho thuê (owner) -> Di chuyển sang Trang chủ Người cho thuê (owner.html)
 * Dữ liệu tài khoản được lưu trực tiếp vào MongoDB với mục USES
 */

// Danh sách các cổng API để tự động dò tìm Server Express
const API_CANDIDATES = [
    '/api/auth',
    'http://localhost:5000/api/auth',
    'http://127.0.0.1:5000/api/auth'
];

// Hàm gọi API thông minh: Tự động kết nối Server, có cơ chế Fallback nếu Server chưa bật
async function callAuthApi(endpoint, payload) {
    for (const base of API_CANDIDATES) {
        try {
            const res = await fetch(`${base}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json();
                return { ok: res.ok, status: res.status, data };
            }
        } catch (err) {
            // Thử cổng tiếp theo
        }
    }

    // Dự phòng qua LocalStorage nếu chưa bật node server.js
    return handleLocalFallback(endpoint, payload);
}

// Xử lý bộ nhớ tạm LocalStorage khi chưa bật Server
function handleLocalFallback(endpoint, payload) {
    const users = JSON.parse(localStorage.getItem('motogo_users_db') || '[]');

    if (endpoint === '/register') {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const normalizedPhone = payload.phone.trim();

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
            name: payload.name.trim(),
            phone: normalizedPhone,
            email: normalizedEmail,
            password: payload.password,
            role: payload.role,
            shopName: payload.role === 'owner' ? payload.shopName : null,
            fleetSize: payload.role === 'owner' ? payload.fleetSize : null,
            address: payload.role === 'owner' ? payload.address : null
        };

        users.push(newUser);
        localStorage.setItem('motogo_users_db', JSON.stringify(users));

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
        const cleanEmail = payload.identifier.trim().toLowerCase();
        const cleanPhone = payload.identifier.trim();
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
                    message: `Tài khoản này đã được đăng ký với tư cách "${actualRoleLabel}". Vui lòng chọn đúng vai trò "${actualRoleLabel}" ở phía trên!`
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
}

// Nội dung giao diện bên cột trái theo vai trò
const roleContent = {
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
        regBtn: "Tạo tài khoản Khách hàng"
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
        regBtn: "Đăng ký Đối tác Cho thuê xe"
    }
};

let currentRole = 'customer';

// DOM Elements
const roleButtons = document.querySelectorAll('.role-btn');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');
const ownerExtraFields = document.getElementById('owner-extra-fields');

const bannerTag = document.getElementById('banner-tag');
const bannerTitle = document.getElementById('banner-title');
const bannerDesc = document.getElementById('banner-desc');
const bannerBenefits = document.getElementById('banner-benefits');

const btnSubmitLogin = document.getElementById('btn-submit-login');
const btnSubmitRegister = document.getElementById('btn-submit-register');

// Hiển thị thông báo trạng thái
function showMessage(text, type = 'error') {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type} show`;
    setTimeout(() => {
        if (type !== 'error') {
            authMessage.classList.remove('show');
        }
    }, 5000);
}

// 1. CHUYỂN ĐỔI VAI TRÒ (Khách hàng <-> Người cho thuê)
function setRole(role) {
    currentRole = role;
    
    // Cập nhật trạng thái nút
    roleButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    // Cập nhật nội dung Banner cột trái
    const content = roleContent[role];
    bannerTag.textContent = content.tag;
    bannerTitle.textContent = content.title;
    bannerDesc.textContent = content.desc;
    bannerBenefits.innerHTML = content.benefits.map(b => `<li><i class="fa-solid fa-circle-check"></i> ${b}</li>`).join('');

    // Cập nhật text nút bấm
    btnSubmitLogin.textContent = content.loginBtn;
    btnSubmitRegister.textContent = content.regBtn;

    // Ẩn/Hiện trường bổ sung dành cho người cho thuê xe
    if (role === 'owner') {
        ownerExtraFields.classList.remove('hidden');
    } else {
        ownerExtraFields.classList.add('hidden');
    }

    authMessage.className = 'auth-message';
}

roleButtons.forEach(btn => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
});

// 2. CHUYỂN ĐỔI TAB (Đăng nhập <-> Đăng ký)
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const isLogin = tab.dataset.tab === 'login';
        loginForm.classList.toggle('active', isLogin);
        registerForm.classList.toggle('active', !isLogin);
        authMessage.className = 'auth-message';
    });
});

// 3. ẨN / HIỆN MẬT KHẨU
document.querySelectorAll('.toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fa-regular fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fa-regular fa-eye';
        }
    });
});

// 4. NÚT TEST NHANH DEMO ACCOUNTS
document.getElementById('fill-demo-customer')?.addEventListener('click', () => {
    setRole('customer');
    document.getElementById('login-identifier').value = 'khachhang@gmail.com';
    document.getElementById('login-password').value = '123456';
    showMessage('Đã điền tài khoản Demo Khách hàng. Nhấn "Đăng nhập" để trải nghiệm!', 'info');
});

document.getElementById('fill-demo-owner')?.addEventListener('click', () => {
    setRole('owner');
    document.getElementById('login-identifier').value = 'chuxe@gmail.com';
    document.getElementById('login-password').value = '123456';
    showMessage('Đã điền tài khoản Demo Người cho thuê xe. Nhấn "Đăng nhập" để trải nghiệm!', 'info');
});

// 5. XỬ LÝ ĐĂNG NHẬP (LOGIN)
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    btnSubmitLogin.disabled = true;
    btnSubmitLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xác thực...';

    const res = await callAuthApi('/login', {
        identifier,
        password,
        role: currentRole
    });

    btnSubmitLogin.disabled = false;
    btnSubmitLogin.textContent = roleContent[currentRole].loginBtn;

    if (!res.ok) {
        showMessage(res.data?.message || 'Đăng nhập không thành công!', 'error');
        if (res.data?.needRegister) {
            setTimeout(() => {
                const regTab = document.querySelector('[data-tab="register"]');
                if (regTab) regTab.click();
            }, 1800);
        }
        return;
    }

    // Đăng nhập thành công -> Lưu phiên làm việc
    const user = res.data.user;
    localStorage.setItem('motogo_user', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));

    const roleName = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';
    showMessage(`Đăng nhập thành công với tư cách ${roleName}! Đang chuyển hướng...`, 'success');

    // Chuyển hướng sang trang chủ tương ứng
    setTimeout(() => {
        if (user.role === 'owner') {
            window.location.href = 'owner.html'; // Trang chủ của người cho thuê
        } else {
            window.location.href = 'index.html'; // Trang chủ của người thuê
        }
    }, 1000);
});

// 6. XỬ LÝ ĐĂNG KÝ (REGISTER) -> LƯU MONGODB MỤC USES
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const payload = {
        name,
        phone,
        email,
        password,
        role: currentRole
    };

    if (currentRole === 'owner') {
        payload.shopName = document.getElementById('reg-shop-name').value.trim() || 'Nhà xe ' + name;
        payload.fleetSize = document.getElementById('reg-fleet-size').value;
        payload.address = document.getElementById('reg-address').value.trim() || 'Hà Nội';
    }

    btnSubmitRegister.disabled = true;
    btnSubmitRegister.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo tài khoản & lưu vào MongoDB...';

    const res = await callAuthApi('/register', payload);

    btnSubmitRegister.disabled = false;
    btnSubmitRegister.textContent = roleContent[currentRole].regBtn;

    if (!res.ok) {
        showMessage(res.data?.message || 'Đăng ký không thành công!', 'error');
        return;
    }

    // Đăng ký thành công -> Lưu phiên làm việc
    const user = res.data.user;
    localStorage.setItem('motogo_user', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));

    const roleName = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng';
    showMessage(`Đăng ký tài khoản ${roleName} thành công! Đã lưu vào MongoDB mục USES. Đang chuyển hướng...`, 'success');

    // Chuyển hướng sang trang chủ tương ứng
    setTimeout(() => {
        if (user.role === 'owner') {
            window.location.href = 'owner.html'; // Trang chủ của người cho thuê
        } else {
            window.location.href = 'index.html'; // Trang chủ của người thuê
        }
    }, 1200);
});
