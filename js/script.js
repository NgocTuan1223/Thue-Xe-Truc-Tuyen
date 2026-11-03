
'use strict';

// --------------------------------------------------------------------------
// 1. CẤU HÌNH API
// Thứ tự ưu tiên: relative (khi mở từ localhost:5000) -> absolute fallback
// --------------------------------------------------------------------------
const BIKE_API_CANDIDATES = [
    '/api/bikes',
    'http://localhost:5000/api/bikes',
    'http://127.0.0.1:5000/api/bikes'
];

// State toàn cục
const AppState = {
    bikes: [],         // Toàn bộ dữ liệu xe từ MongoDB
    selectedBike: null // Xe đang được chọn để đặt thuê
};

// Bộ nhớ đệm DOM
const DOM = {};

// --------------------------------------------------------------------------
// 2. HÀM TIỆN ÍCH
// --------------------------------------------------------------------------
const formatVND = (amount) =>
    (Number(amount) || 0).toLocaleString('vi-VN') + 'đ';

const escapeHTML = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const getStoredUser = () => {
    try {
        const raw = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

// --------------------------------------------------------------------------
// 3. SKELETON LOADING — hiển thị trong khi chờ API phản hồi
// --------------------------------------------------------------------------
function showSkeletonLoading() {
    if (!DOM.bikeList) return;
    DOM.bikeList.innerHTML = Array(6).fill(null).map(() => `
        <div class="bike-card skeleton-card">
            <div class="bike-img-wrapper skeleton-box" style="height:210px;"></div>
            <div class="bike-info" style="padding:22px; display:flex; flex-direction:column; gap:12px;">
                <div class="skeleton-box" style="height:22px; width:75%; border-radius:6px;"></div>
                <div class="skeleton-box" style="height:14px; width:55%; border-radius:6px;"></div>
                <div style="display:flex; gap:8px;">
                    <div class="skeleton-box" style="height:26px; width:80px; border-radius:20px;"></div>
                    <div class="skeleton-box" style="height:26px; width:80px; border-radius:20px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                    <div class="skeleton-box" style="height:28px; width:100px; border-radius:6px;"></div>
                    <div class="skeleton-box" style="height:36px; width:90px; border-radius:10px;"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// --------------------------------------------------------------------------
// 4. TẢI DỮ LIỆU XE TỪ MONGODB QUA API
// --------------------------------------------------------------------------
async function loadBikes() {
    showSkeletonLoading();

    for (const url of BIKE_API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) continue; // thử URL tiếp theo

            const data = await res.json();

            // Bình thường hóa: API có thể trả mảng trực tiếp
            const bikes = Array.isArray(data) ? data : (Array.isArray(data.value) ? data.value : []);

            if (bikes.length === 0) {
                showEmptyState('MongoDB chưa có dữ liệu xe. Vui lòng thêm xe qua Kênh Chủ Xe.');
                return;
            }

            AppState.bikes = bikes;
            applyFiltersAndSort();
            console.log(`[MotoGo] ✅ Đã tải ${bikes.length} xe từ: ${url}`);
            return; // thành công — thoát vòng lặp

        } catch (err) {
            // Thử URL tiếp theo
            console.warn(`[MotoGo] Không kết nối được ${url}:`, err.message);
        }
    }

    // Tất cả URL đều thất bại
    showErrorState('⚠️ Không thể kết nối máy chủ. Hãy đảm bảo server đang chạy (node server.js) rồi nhấn Thử lại.');
    console.error('[MotoGo] Lỗi: Không kết nối được bất kỳ API endpoint nào.');
}

// --------------------------------------------------------------------------
// 5. HIỂN THỊ TRẠNG THÁI TRỐNG VÀ LỖI
// --------------------------------------------------------------------------
function showEmptyState(message = 'Không tìm thấy xe phù hợp.') {
    if (!DOM.bikeList) return;
    DOM.bikeList.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-secondary,#94a3b8);">
            <i class="fa-solid fa-motorcycle" style="font-size:3rem; color:#334155; display:block; margin-bottom:16px;"></i>
            <h4 style="color:var(--text-primary,#f8fafc); margin-bottom:8px;">Chưa có xe nào</h4>
            <p style="font-size:0.92rem; max-width:400px; margin:0 auto;">${escapeHTML(message)}</p>
        </div>`;
}

function showErrorState(message) {
    if (!DOM.bikeList) return;
    DOM.bikeList.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#f59e0b; display:block; margin-bottom:16px;"></i>
            <h4 style="color:#f8fafc; margin-bottom:8px;">Không thể tải danh sách xe</h4>
            <p style="color:#94a3b8; font-size:0.92rem; max-width:440px; margin:0 auto 20px;">${escapeHTML(message)}</p>
            <button type="button" onclick="loadBikes()" class="btn btn-outline" style="margin:0 auto;">
                <i class="fa-solid fa-rotate-right"></i> Thử lại
            </button>
        </div>`;
}

// --------------------------------------------------------------------------
// 6. RENDER LƯỚI XE MÁY
// --------------------------------------------------------------------------
function renderBikes(list) {
    if (!DOM.bikeList) return;

    if (!Array.isArray(list) || list.length === 0) {
        showEmptyState('Không tìm thấy xe phù hợp với bộ lọc. Vui lòng thử từ khóa khác.');
        return;
    }

    const categoryMap = {
        scooter: { label: 'Xe Tay Ga', badge: 'badge-scooter' },
        manual: { label: 'Xe Số', badge: 'badge-manual' },
        clutch: { label: 'Côn Tay', badge: 'badge-clutch' }
    };

    DOM.bikeList.innerHTML = list.map(bike => {
        const cat = categoryMap[bike.category] || { label: 'Xe Máy', badge: 'badge-scooter' };
        const categoryText = escapeHTML(bike.categoryLabel || cat.label);
        const categoryBadge = escapeHTML(bike.badgeClass || cat.badge);

        let statusClass = 'available', statusText = 'Sẵn sàng';
        if (['renting', 'Đang thuê'].includes(bike.status)) { statusClass = 'renting'; statusText = 'Đang thuê'; }
        else if (['maintenance', 'Bảo trì'].includes(bike.status)) { statusClass = 'maintenance'; statusText = 'Bảo trì'; }

        const engine = escapeHTML(bike.specs?.engine || '125cc');
        const year = escapeHTML(bike.specs?.year || 'Đời mới');
        const fuel = escapeHTML(bike.specs?.fuel || 'Tiết kiệm xăng');
        const perks = (Array.isArray(bike.perks) && bike.perks.length) ? bike.perks : ['2 Mũ bảo hiểm', 'Bảo hiểm'];
        const safeId = escapeHTML(String(bike.id));
        const safeName = escapeHTML(bike.name);
        const safeImg = escapeHTML(bike.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80');

        return `
        <article class="bike-card" data-bike-id="${safeId}">
            <div class="bike-img-wrapper">
                <span class="bike-badge ${categoryBadge}">${categoryText}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
                <img src="${safeImg}" alt="${safeName}" loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80'">
            </div>
            <div class="bike-info">
                <h3 class="bike-title">${safeName}</h3>
                <div class="bike-specs">
                    <span><i class="fa-solid fa-gauge-high"></i> ${engine}</span>
                    <span><i class="fa-solid fa-calendar-check"></i> ${year}</span>
                    <span><i class="fa-solid fa-gas-pump"></i> ${fuel}</span>
                </div>
                <div class="bike-perks">
                    ${perks.map(p => `<span><i class="fa-solid fa-check"></i> ${escapeHTML(p)}</span>`).join('')}
                </div>
                <div class="bike-footer">
                    <div class="bike-price">
                        <span class="price-amount">${formatVND(bike.price)}</span>
                        <span class="price-unit">/ ngày</span>
                    </div>
                    <button type="button" class="btn btn-primary btn-book"
                            onclick="openBookingModal('${safeId}')">
                        <i class="fa-solid fa-bolt"></i> Đặt thuê
                    </button>
                </div>
            </div>
        </article>`;
    }).join('');
}

// --------------------------------------------------------------------------
// 7. BỘ LỌC TÌM KIẾM, PHÂN LOẠI & SẮP XẾP
// --------------------------------------------------------------------------
function applyFiltersAndSort() {
    const keyword = DOM.searchKeyword?.value.trim().toLowerCase() || '';
    const category = DOM.filterCategory?.value || 'all';
    const sort = DOM.sortPrice?.value || 'default';

    let result = AppState.bikes.filter(bike => {
        const matchName = (bike.name || '').toLowerCase().includes(keyword);
        const matchCat = category === 'all' || bike.category === category;
        return matchName && matchCat;
    });

    if (sort === 'asc') result.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'desc') result.sort((a, b) => (b.price || 0) - (a.price || 0));

    renderBikes(result);
}

// --------------------------------------------------------------------------
// 8. MODAL ĐẶT XE
// --------------------------------------------------------------------------
window.openBookingModal = function (bikeId) {
    const bike = AppState.bikes.find(b => String(b.id) === String(bikeId));
    if (!bike) return;

    AppState.selectedBike = bike;

    if (DOM.modalBikeImg) DOM.modalBikeImg.src = bike.image;
    if (DOM.modalBikeName) DOM.modalBikeName.textContent = bike.name;
    if (DOM.modalBikePrice) DOM.modalBikePrice.textContent = (bike.price || 0).toLocaleString('vi-VN');

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    if (DOM.pickupDate) { DOM.pickupDate.min = today; DOM.pickupDate.value = today; }
    if (DOM.returnDate) { DOM.returnDate.min = today; DOM.returnDate.value = tomorrow; }

    const user = getStoredUser();
    if (user) {
        if (DOM.customerName && user.name) DOM.customerName.value = user.name;
        if (DOM.customerPhone && user.phone) DOM.customerPhone.value = user.phone;
    }

    updateTotalPrice();
    DOM.bookingModal?.classList.add('active');
};

function updateTotalPrice() {
    if (!AppState.selectedBike) return;

    const start = new Date(DOM.pickupDate?.value);
    const end = new Date(DOM.returnDate?.value);
    const diffDays = Math.ceil((end - start) / 86400000);
    const days = diffDays > 0 ? diffDays : 1;

    const delivery = DOM.pickupLocation?.value === 'delivery' ? 30000 : 0;
    const total = days * (AppState.selectedBike.price || 0) + delivery;

    if (DOM.totalDays) DOM.totalDays.textContent = `${days} ngày`;
    if (DOM.totalPrice) DOM.totalPrice.textContent = formatVND(total);
}

function closeBookingModal() {
    DOM.bookingModal?.classList.remove('active');
}

// --------------------------------------------------------------------------
// 9. KIỂM TRA PHIÊN ĐĂNG NHẬP
// --------------------------------------------------------------------------
function checkUserLogin() {
    const user = getStoredUser();
    const loginBtn = document.getElementById('nav-login-btn');
    if (!user || !loginBtn) return;

    const parent = loginBtn.parentElement;
    if (!parent) return;

    if (user.role === 'owner') {
        parent.innerHTML = `
            <a href="owner.html" class="btn btn-outline"
               style="text-decoration:none;border-color:var(--accent-cyan);color:var(--accent-cyan);">
                <i class="fa-solid fa-shop"></i> Kênh Chủ Xe
            </a>
            <button type="button" class="btn btn-outline" id="btn-logout">
                <i class="fa-solid fa-user-tie"></i> ${escapeHTML(user.name)} (Đăng xuất)
            </button>`;
    } else {
        parent.innerHTML = `
            <button type="button" class="btn btn-outline" id="btn-my-bookings">
                <i class="fa-solid fa-receipt"></i> Đơn của tôi
                <span class="badge" id="booking-count">0</span>
            </button>
            <button type="button" class="btn btn-primary" id="btn-logout">
                <i class="fa-solid fa-circle-user"></i> ${escapeHTML(user.name)} (Đăng xuất)
            </button>`;
    }

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            localStorage.removeItem('motogo_user');
            localStorage.removeItem('currentUser');
            location.reload();
        }
    });
}

// --------------------------------------------------------------------------
// 10. CACHE DOM & BIND EVENTS
// --------------------------------------------------------------------------
function cacheDOMElements() {
    DOM.bikeList = document.getElementById('bike-list');
    DOM.searchKeyword = document.getElementById('search-keyword');
    DOM.filterCategory = document.getElementById('filter-category');
    DOM.sortPrice = document.getElementById('sort-price');
    DOM.btnFilter = document.getElementById('btn-filter');
    DOM.tabButtons = document.querySelectorAll('.tab-btn');

    DOM.bookingModal = document.getElementById('booking-modal');
    DOM.closeModalBtn = document.getElementById('close-modal');
    DOM.bookingForm = document.getElementById('booking-form');
    DOM.pickupDate = document.getElementById('pickup-date');
    DOM.returnDate = document.getElementById('return-date');
    DOM.pickupLocation = document.getElementById('pickup-location');
    DOM.customerName = document.getElementById('customer-name');
    DOM.customerPhone = document.getElementById('customer-phone');

    DOM.modalBikeImg = document.getElementById('modal-bike-img');
    DOM.modalBikeName = document.getElementById('modal-bike-name');
    DOM.modalBikePrice = document.getElementById('modal-bike-price');
    DOM.totalDays = document.getElementById('total-days');
    DOM.totalPrice = document.getElementById('total-price');
}

function bindEventListeners() {
    DOM.searchKeyword?.addEventListener('input', applyFiltersAndSort);
    DOM.sortPrice?.addEventListener('change', applyFiltersAndSort);
    DOM.btnFilter?.addEventListener('click', applyFiltersAndSort);

    DOM.filterCategory?.addEventListener('change', (e) => {
        DOM.tabButtons.forEach(btn =>
            btn.classList.toggle('active', btn.dataset.category === e.target.value));
        applyFiltersAndSort();
    });

    DOM.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (DOM.filterCategory) DOM.filterCategory.value = btn.dataset.category || 'all';
            applyFiltersAndSort();
        });
    });

    DOM.pickupDate?.addEventListener('change', updateTotalPrice);
    DOM.returnDate?.addEventListener('change', updateTotalPrice);
    DOM.pickupLocation?.addEventListener('change', updateTotalPrice);

    DOM.closeModalBtn?.addEventListener('click', closeBookingModal);

    DOM.bookingModal?.addEventListener('click', (e) => {
        if (e.target === DOM.bookingModal) closeBookingModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.bookingModal?.classList.contains('active'))
            closeBookingModal();
    });

    DOM.bookingForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!AppState.selectedBike) return;

        const bike = AppState.selectedBike;
        const customerName = DOM.customerName?.value.trim() || '';
        const customerPhone = DOM.customerPhone?.value.trim() || '';
        const pickupDate = DOM.pickupDate?.value || '';
        const returnDate = DOM.returnDate?.value || '';
        const locationType = DOM.pickupLocation?.value || 'store';

        if (!customerName || !customerPhone || !pickupDate || !returnDate) {
            alert('Vui lòng điền đầy đủ họ tên, số điện thoại và ngày thuê!');
            return;
        }

        const start = new Date(pickupDate);
        const end = new Date(returnDate);
        const days = Math.max(1, Math.ceil((end - start) / 86400000));
        const delivery = locationType === 'delivery' ? 30000 : 0;
        const total = days * (bike.price || 0) + delivery;

        const user = getStoredUser();
        const bookingPayload = {
            bikeId: bike.id,
            bikeName: bike.name,
            bikeImage: bike.image || '',
            customerName,
            customerPhone,
            customerEmail: user?.email || '',
            pickupDate,
            returnDate,
            days,
            locationType,
            totalPrice: total,
            status: 'pending',
            ownerEmail: bike.ownerEmail || null
        };

        // Vô hiệu hóa nút trong lúc gửi
        const submitBtn = DOM.bookingForm.querySelector('[type="submit"]');
        const originalText = submitBtn?.innerHTML || '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đặt xe...';
        }

        try {
            // Thử lần lượt các endpoint để lưu vào MongoDB
            const apiCandidates = ['/api/bookings', 'http://localhost:5000/api/bookings'];
            let saved = false;

            for (const url of apiCandidates) {
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bookingPayload)
                    });
                    if (res.ok) {
                        const result = await res.json();
                        saved = true;
                        console.log(`[MotoGo] đã nhận thông tin : ${result.bookingId}`);
                        break;
                    }
                } catch { /* thử URL tiếp theo */ }
            }

            // Cập nhật badge số đơn
            const countEl = document.getElementById('booking-count');
            if (countEl) countEl.textContent = String(parseInt(countEl.textContent || '0', 10) + 1);

            const savedMsg = saved
                ? `MotoGo Đã Nhận thông tin Thuê Xe!`
                : `.`;

            alert(` Đặt thuê xe "${bike.name}" thành công!\n${savedMsg}\nMotoGo sẽ liên hệ trong 5 phút.`);
            closeBookingModal();
            DOM.bookingForm.reset();

        } catch (err) {
            alert('Có lỗi xảy ra khi đặt xe. Vui lòng thử lại!');
            console.error('[MotoGo] Lỗi đặt xe:', err);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });
}

// --------------------------------------------------------------------------
// 11. THÊM CSS SKELETON VÀO TRANG (INJECT ĐỘNG)
// --------------------------------------------------------------------------
function injectSkeletonCSS() {
    if (document.getElementById('skeleton-styles')) return;
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
        .skeleton-box {
            background: linear-gradient(90deg, #182238 25%, #1e2d47 50%, #182238 75%);
            background-size: 200% 100%;
            animation: skeleton-shimmer 1.4s infinite;
        }
        @keyframes skeleton-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .skeleton-card {
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// 12. ENTRY POINT
// --------------------------------------------------------------------------
function initApp() {
    injectSkeletonCSS();
    cacheDOMElements();
    checkUserLogin();
    bindEventListeners();
    loadBikes(); // Tải 100% từ MongoDB — không có dữ liệu cứng
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
