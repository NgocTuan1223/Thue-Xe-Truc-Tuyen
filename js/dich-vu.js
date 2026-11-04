'use strict';

// 1. KIỂM TRA PHIÊN ĐĂNG NHẬP TRÊN NAVBAR
(function checkNavAuth() {
    const raw = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
    if (!raw) return;

    try {
        const user = JSON.parse(raw);
        const loginBtn = document.getElementById('nav-login-btn');
        if (!user || !loginBtn) return;

        const parent = loginBtn.parentElement;
        if (!parent) return;

        const safeName = (user.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        if (user.role === 'owner') {
            parent.innerHTML = `
                <a href="owner.html" class="btn btn-outline"
                   style="text-decoration:none;border-color:var(--accent-cyan);color:var(--accent-cyan);">
                    <i class="fa-solid fa-shop"></i> Kênh Chủ Xe
                </a>
                <button type="button" class="btn btn-outline" id="btn-logout">
                    <i class="fa-solid fa-user-tie"></i> ${safeName} (Đăng xuất)
                </button>`;
        } else {
            parent.innerHTML = `
                <a href="index.html" class="btn btn-outline" id="btn-my-bookings">
                    <i class="fa-solid fa-receipt"></i> Đơn của tôi
                </a>
                <button type="button" class="btn btn-primary" id="btn-logout">
                    <i class="fa-solid fa-circle-user"></i> ${safeName} (Đăng xuất)
                </button>`;
        }

        document.getElementById('btn-logout')?.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                localStorage.removeItem('motogo_user');
                localStorage.removeItem('currentUser');
                location.reload();
            }
        });
    } catch (e) {
        console.error('[MotoGo] Lỗi đọc phiên đăng nhập:', e);
    }
})();

// 2. TẢI 100% DỮ LIỆU DỊCH VỤ TỪ MONGODB QUA API (KHÔNG DÙNG DỮ LIỆU CỨNG)
const SERVICE_API_ENDPOINTS = [
    '/api/services',
    'http://localhost:5000/api/services',
    'http://127.0.0.1:5000/api/services'
];

async function loadServices() {
    const grid = document.querySelector('.service-grid');
    if (!grid) return;

    // Hiển thị trạng thái đang tải
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--royal-blue); margin-bottom: 12px; display: block;"></i>
            Đang tải dữ liệu dịch vụ từ hệ thống...
        </div>
    `;

    for (const url of SERVICE_API_ENDPOINTS) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;

            const data = await res.json();
            const services = Array.isArray(data) ? data : (Array.isArray(data.value) ? data.value : []);

            if (services.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-secondary);">
                        <i class="fa-solid fa-bell-concierge" style="font-size: 2.5rem; color: #334155; margin-bottom: 12px; display: block;"></i>
                        <h4 style="color: var(--text-primary); margin-bottom: 6px;">Chưa có dịch vụ nào</h4>
                        <p>Các đối tác đang cập nhật dịch vụ cho quý khách.</p>
                    </div>
                `;
                return;
            }

            renderServices(services, grid);
            return;
        } catch {
            // Thử endpoint tiếp theo
        }
    }

    // Nếu không kết nối được API
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--warning); margin-bottom: 12px; display: block;"></i>
            <h4 style="color: var(--text-primary); margin-bottom: 6px;">Không thể tải danh sách dịch vụ</h4>
            <p>Vui lòng kiểm tra lại kết nối máy chủ.</p>
            <button type="button" class="btn btn-outline" onclick="loadServices()" style="margin-top: 15px;">
                <i class="fa-solid fa-rotate-right"></i> Thử lại
            </button>
        </div>
    `;
}

// Hàm xử lý chuỗi văn bản bị thiếu
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

container.innerHTML = services.map(s => `
        <div class="service-card">
            <div class="service-icon">
                <i class="${escapeHTML(s.icon || 'fa-solid fa-truck-fast')}"></i>
            </div>
            <h3>${escapeHTML(s.title)}</h3>
            <p>${escapeHTML(s.description)}</p>
        </div>
    `).join('');


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadServices);
} else {
    loadServices();
}
