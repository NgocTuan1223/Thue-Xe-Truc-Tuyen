
let ownerBikes = [...DEFAULT_OWNER_BIKES];
let ownerBookings = [];

const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + 'đ';

// 1. KIỂM TRA PHIÊN ĐĂNG NHẬP CỦA CHỦ XE
function initOwnerSession() {
    const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
    if (!rawUser) {
        alert('Bạn chưa đăng nhập. Vui lòng đăng nhập với tư cách Người cho thuê xe!');
        window.location.href = 'login.html';
        return null;
    }

    const user = JSON.parse(rawUser);

    // Cập nhật thông tin lên Banner
    const nameDisplay = document.getElementById('owner-name-display');
    const fullname = document.getElementById('owner-fullname');
    const shopTitle = document.getElementById('shop-name-title');
    const addressText = document.getElementById('shop-address-text');
    const phoneText = document.getElementById('shop-phone-text');
    const fleetText = document.getElementById('shop-fleet-text');

    if (nameDisplay) nameDisplay.textContent = user.name;
    if (fullname) fullname.textContent = user.name;
    if (shopTitle) shopTitle.textContent = user.shopName || ('Cửa Hàng Của ' + user.name);
    if (addressText) addressText.textContent = user.address || 'Hà Nội';
    if (phoneText) phoneText.textContent = user.phone || 'Chưa cập nhật';
    if (fleetText) fleetText.textContent = user.fleetSize || '1-5 xe';

    return user;
}

// 2. TẢI DANH SÁCH XE CỦA CỬA HÀNG
async function loadOwnerBikes() {
    updateOwnerKPIs();
    renderOwnerBikesTable(ownerBikes);

    try {
        const endpoints = [
            '/api/bikes',
            'http://localhost:5000/api/bikes',
            'http://127.0.0.1:5000/api/bikes'
        ];

        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        ownerBikes = data;
                        updateOwnerKPIs();
                        renderOwnerBikesTable(ownerBikes);
                        break;
                    }
                }
            } catch (err) { }
        }
    } catch (err) {
        console.warn('Dùng danh sách xe mặc định cho chủ xe:', err);
    }
}

// 3. CẬP NHẬT CHỈ SỐ THỐNG KÊ (KPIs)
function updateOwnerKPIs() {
    const total = ownerBikes.length;
    const available = ownerBikes.filter(b => b.status === 'available' || b.status === 'Đang trống' || !b.status).length;
    const renting = ownerBikes.filter(b => b.status === 'renting' || b.status === 'Đang thuê' || b.status === 'reserved').length;

    // Doanh thu ước tính từ các xe đang cho thuê
    let revenue = 0;
    ownerBikes.forEach(b => {
        if (b.status === 'renting' || b.status === 'Đang thuê') {
            revenue += (b.price * 3);
        }
    });

    const totalEl = document.getElementById('kpi-total-bikes');
    const availEl = document.getElementById('kpi-available-bikes');
    const rentingEl = document.getElementById('kpi-renting-bikes');
    const revEl = document.getElementById('kpi-total-revenue');

    if (totalEl) totalEl.textContent = total;
    if (availEl) availEl.textContent = available;
    if (rentingEl) rentingEl.textContent = renting;
    if (revEl) revEl.textContent = formatVND(revenue || 2400000);
}

// 4. HIỂN THỊ BẢNG DANH SÁCH XE
function renderOwnerBikesTable(list) {
    const tbody = document.getElementById('owner-bike-list');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: #94a3b8;">Chưa có xe nào trong danh sách. Hãy nhấn "Đăng thêm xe mới"!</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(bike => {
        const isAvailable = bike.status === 'available' || bike.status === 'Đang trống' || !bike.status;
        const isRenting = bike.status === 'renting' || bike.status === 'Đang thuê';
        const isMaintenance = bike.status === 'maintenance' || bike.status === 'Bảo trì';

        const engine = bike.specs?.engine || '110cc - 150cc';
        const fuel = bike.specs?.fuel || 'Tiết kiệm xăng';

        return `
            <tr>
                <td>
                    <div class="bike-cell">
                        <img src="${bike.image}" alt="${bike.name}" class="bike-thumb" onerror="this.src='https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80'">
                        <div class="bike-cell-info">
                            <strong>${bike.name}</strong>
                            <span>Mã xe: ${bike.id}</span>
                        </div>
                    </div>
                </td>
                <td><span style="font-weight: 500;">${bike.categoryLabel || bike.category || 'Xe máy'}</span></td>
                <td><strong style="color: var(--accent-cyan);">${formatVND(bike.price)}</strong> / ngày</td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">
                    <div><i class="fa-solid fa-gauge-high"></i> ${engine}</div>
                    <div><i class="fa-solid fa-gas-pump"></i> ${fuel}</div>
                </td>
                <td>
                    <select class="status-select-btn" onchange="changeBikeStatus('${bike.id}', this.value)">
                        <option value="available" ${isAvailable ? 'selected' : ''}>🟢 Sẵn sàng cho thuê</option>
                        <option value="renting" ${isRenting ? 'selected' : ''}>🔵 Đang có khách thuê</option>
                        <option value="maintenance" ${isMaintenance ? 'selected' : ''}>🔴 Đang bảo dưỡng</option>
                    </select>
                </td>
                <td style="text-align: right;">
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.82rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="deleteOwnerBike('${bike.id}')" title="Xóa xe khỏi danh sách">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Đổi trạng thái xe nhanh
window.changeBikeStatus = async function (bikeId, newStatus) {
    const bike = ownerBikes.find(b => b.id === bikeId);
    if (!bike) return;

    bike.status = newStatus;
    if (newStatus === 'available') bike.statusText = 'Sẵn sàng';
    if (newStatus === 'renting') bike.statusText = 'Đang thuê';
    if (newStatus === 'maintenance') bike.statusText = 'Bảo trì';

    fetch(`/api/bikes/${bikeId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, statusText: bike.statusText })
    }).catch(() => { });

    updateOwnerKPIs();
    renderOwnerBikesTable(ownerBikes);
};

// Xóa xe
window.deleteOwnerBike = function (bikeId) {
    if (!confirm('Bạn có chắc chắn muốn xóa mẫu xe này khỏi danh sách cho thuê?')) return;
    ownerBikes = ownerBikes.filter(b => b.id !== bikeId);
    localStorage.setItem('motogo_owner_bikes', JSON.stringify(ownerBikes));
    updateOwnerKPIs();
    renderOwnerBikesTable(ownerBikes);
};

// 5. TẢI VÀ HIỂN THỊ YÊU CẦU THUÊ XE TỪ MONGODB
async function loadOwnerBookings() {
    const tbody = document.getElementById('owner-booking-list');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i><br>Đang tải đơn thuê...
    </td></tr>`;

    const apiCandidates = ['/api/bookings', 'http://localhost:5000/api/bookings'];
    let bookings = [];

    for (const url of apiCandidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                bookings = Array.isArray(data) ? data : [];
                break;
            }
        } catch { /* thử URL tiếp theo */ }
    }

    ownerBookings = bookings;
    renderOwnerBookingsTable(ownerBookings);
}

function renderOwnerBookingsTable(list) {
    const tbody = document.getElementById('owner-booking-list');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;">
            <i class="fa-solid fa-inbox" style="font-size:2rem;display:block;margin-bottom:12px;"></i>
            Chưa có đơn thuê xe nào. Khi khách đặt xe sẽ hiện ở đây.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(b => {
        const id       = b.bookingId || b._id || 'N/A';
        const name     = b.customerName   || 'Khách hàng';
        const phone    = b.customerPhone  || '---';
        const bikeName = b.bikeName       || '---';
        const dates    = `${b.pickupDate || ''} → ${b.returnDate || ''} (${b.days || 1} ngày)`;
        const total    = b.totalPrice     || 0;
        const status   = b.status         || 'pending';

        let statusBadge, actionBtn;

        if (status === 'approved') {
            statusBadge = '<span class="status-pill renting">🔵 Đang cho thuê</span>';
            actionBtn   = `<button class="btn btn-outline" style="padding:6px 14px;font-size:0.85rem;color:var(--status-success,#10b981);border-color:var(--status-success,#10b981);" onclick="completeBooking('${id}')">
                <i class="fa-solid fa-flag-checkered"></i> Hoàn tất
            </button>`;
        } else if (status === 'completed') {
            statusBadge = '<span class="status-pill available">🟢 Hoàn thành</span>';
            actionBtn   = '<span style="font-size:0.85rem;color:#94a3b8;"><i class="fa-solid fa-circle-check"></i> Đã trả xe</span>';
        } else if (status === 'cancelled') {
            statusBadge = '<span class="status-pill maintenance">🔴 Đã hủy</span>';
            actionBtn   = '<span style="font-size:0.85rem;color:#94a3b8;">Đã hủy</span>';
        } else {
            // pending
            statusBadge = '<span class="status-pill renting">🟡 Chờ duyệt</span>';
            actionBtn   = `<button class="btn btn-primary" style="padding:6px 14px;font-size:0.85rem;" onclick="approveBooking('${id}')">
                <i class="fa-solid fa-check"></i> Duyệt & Giao xe
            </button>`;
        }

        return `
        <tr>
            <td><strong style="color:var(--royal-blue,#2563eb);font-family:monospace;">${id}</strong></td>
            <td>
                <strong>${name}</strong>
                <div style="font-size:0.8rem;color:var(--text-secondary,#94a3b8);">
                    <i class="fa-solid fa-phone"></i> ${phone}
                </div>
            </td>
            <td>${bikeName}</td>
            <td style="color:var(--text-secondary,#94a3b8);font-size:0.85rem;">${dates}</td>
            <td><strong style="color:var(--accent-cyan,#38bdf8);">${formatVND(total)}</strong></td>
            <td>${statusBadge}</td>
            <td style="text-align:right;">${actionBtn}</td>
        </tr>`;
    }).join('');
}

window.approveBooking = async function (bookingId) {
    const b = ownerBookings.find(item => (item.bookingId || item._id) === bookingId);
    if (!b) return;

    try {
        const res = await fetch(`/api/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });
        if (res.ok) {
            b.status = 'approved';
            renderOwnerBookingsTable(ownerBookings);
            alert(`✅ Đã duyệt đơn ${bookingId} và ghi nhận bàn giao xe cho khách!`);
        }
    } catch {
        b.status = 'approved';
        renderOwnerBookingsTable(ownerBookings);
        alert(`✅ Đã duyệt đơn ${bookingId} (offline).`);
    }
};

window.completeBooking = async function (bookingId) {
    const b = ownerBookings.find(item => (item.bookingId || item._id) === bookingId);
    if (!b) return;

    try {
        const res = await fetch(`/api/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        if (res.ok) {
            b.status = 'completed';
            renderOwnerBookingsTable(ownerBookings);
            alert(`🏁 Đơn thuê ${bookingId} đã hoàn tất — khách đã trả xe!`);
        }
    } catch {
        b.status = 'completed';
        renderOwnerBookingsTable(ownerBookings);
        alert(`🏁 Đơn thuê ${bookingId} đã hoàn tất (offline).`);
    }
};

// 6. TÌM KIẾM & BỘ LỌC XE
function applyBikeFilter() {
    const searchBikeInput = document.getElementById('owner-search-bike');
    const filterStatusSelect = document.getElementById('owner-filter-status');

    const kw = searchBikeInput ? searchBikeInput.value.trim().toLowerCase() : '';
    const status = filterStatusSelect ? filterStatusSelect.value : 'all';

    const filtered = ownerBikes.filter(b => {
        const matchName = b.name.toLowerCase().includes(kw);
        const matchStatus = (status === 'all') || (b.status === status);
        return matchName && matchStatus;
    });

    renderOwnerBikesTable(filtered);
}

// 7. MODAL ĐĂNG THÊM XE MỚI
function initModalEvents() {
    const addBikeModal = document.getElementById('add-bike-modal');
    const btnOpenAddBike = document.getElementById('btn-open-add-bike');
    const btnCloseAddBike = document.getElementById('close-add-bike-modal');
    const addBikeForm = document.getElementById('add-bike-form');

    btnOpenAddBike?.addEventListener('click', () => {
        addBikeModal?.classList.add('active');
    });

    btnCloseAddBike?.addEventListener('click', () => {
        addBikeModal?.classList.remove('active');
    });

    addBikeModal?.addEventListener('click', (e) => {
        if (e.target === addBikeModal) {
            addBikeModal.classList.remove('active');
        }
    });

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('new-bike-image');
            if (input) input.value = btn.dataset.img;
        });
    });

    addBikeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-bike-name').value.trim();
        const category = document.getElementById('new-bike-category').value;
        const price = parseInt(document.getElementById('new-bike-price').value) || 150000;
        const year = document.getElementById('new-bike-year').value.trim() || '2024';
        const engine = document.getElementById('new-bike-engine').value.trim() || '125cc';
        const fuel = document.getElementById('new-bike-fuel').value.trim() || '2.0L / 100km';
        const image = document.getElementById('new-bike-image').value.trim();
        const perksStr = document.getElementById('new-bike-perks').value.trim();

        const perks = perksStr ? perksStr.split(',').map(s => s.trim()) : ['2 Mũ bảo hiểm', 'Áo mưa'];

        let categoryLabel = 'Xe Tay Ga';
        let badgeClass = 'badge-scooter';
        if (category === 'manual') {
            categoryLabel = 'Xe Số';
            badgeClass = 'badge-manual';
        } else if (category === 'clutch') {
            categoryLabel = 'Côn Tay';
            badgeClass = 'badge-clutch';
        }

        const newBike = {
            id: 'bike_' + Date.now(),
            name,
            category,
            categoryLabel,
            badgeClass,
            price,
            status: 'available',
            statusText: 'Sẵn sàng',
            image: image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80',
            specs: { engine, year, fuel },
            perks
        };

        ownerBikes.unshift(newBike);
        localStorage.setItem('motogo_owner_bikes', JSON.stringify(ownerBikes));

        fetch('/api/bikes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBike)
        }).catch(() => { });

        addBikeModal?.classList.remove('active');
        addBikeForm.reset();

        updateOwnerKPIs();
        renderOwnerBikesTable(ownerBikes);

        alert(`Đã đăng thành công mẫu xe "${name}" lên sàn cho thuê!`);
    });

    document.getElementById('owner-search-bike')?.addEventListener('input', applyBikeFilter);
    document.getElementById('owner-filter-status')?.addEventListener('change', applyBikeFilter);

    document.getElementById('btn-owner-logout')?.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi Kênh Người cho thuê xe?')) {
            localStorage.removeItem('motogo_user');
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    });
}

// KHỞI ĐỘNG KHI TẢI TRANG
function initOwnerApp() {
    const user = initOwnerSession();
    if (user) {
        initModalEvents();
        loadOwnerBikes();
        loadOwnerBookings();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOwnerApp);
} else {
    initOwnerApp();
}
