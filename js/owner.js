
// Khởi tạo rỗng — dữ liệu 100% từ MongoDB qua API
let ownerBikes = [];
let ownerBookings = [];
let ownerServices = [];

const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + 'đ';

const escapeHTML = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

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

// 2. TẢI DANH SÁCH XE CỦA CỬA HÀNG TỪ MONGODB
async function loadOwnerBikes() {
    // Hiển thị loading trước
    const tbody = document.getElementById('owner-bike-list');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;"></i><br>Đang tải danh sách xe...
        </td></tr>`;
    }

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
                // Bình thường hoá — API có thể trả mảng trực tiếp
                const bikes = Array.isArray(data) ? data : (Array.isArray(data.value) ? data.value : []);
                ownerBikes = bikes;
                updateOwnerKPIs();
                renderOwnerBikesTable(ownerBikes);
                return;
            }
        } catch { /* thử URL tiếp theo */ }
    }

    // Nếu không kết nối được
    ownerBikes = [];
    updateOwnerKPIs();
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;color:#f59e0b;display:block;margin-bottom:12px;"></i>
            Không thể kết nối máy chủ. Hãy đảm bảo <code>node server.js</code> đang chạy rồi tải lại trang.
        </td></tr>`;
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
        const id = b.bookingId || b._id || 'N/A';
        const name = b.customerName || 'Khách hàng';
        const phone = b.customerPhone || '---';
        const bikeName = b.bikeName || '---';
        const dates = `${b.pickupDate || ''} → ${b.returnDate || ''} (${b.days || 1} ngày)`;
        const total = b.totalPrice || 0;
        const status = b.status || 'pending';

        let statusBadge, actionBtn;

        if (status === 'approved') {
            const locText = b.locationType === 'delivery' ? '🚚 Đang giao xe' : '🏍️ Xe đã chuẩn bị xong';
            statusBadge = `<span class="status-pill renting">${locText}</span>`;
            actionBtn = `<button class="btn btn-outline" style="padding:6px 14px;font-size:0.85rem;color:var(--status-success,#10b981);border-color:var(--status-success,#10b981);" onclick="completeBooking('${id}')">
                <i class="fa-solid fa-flag-checkered"></i> Hoàn tất
            </button>`;
        } else if (status === 'completed') {
            statusBadge = '<span class="status-pill available"> Hoàn thành</span>';
            actionBtn = '<span style="font-size:0.85rem;color:#94a3b8;"><i class="fa-solid fa-circle-check"></i> Đã trả xe</span>';
        } else if (status === 'cancelled') {
            statusBadge = '<span class="status-pill maintenance"> Đã hủy (Hết hạn/Hủy)</span>';
            actionBtn = '<span style="font-size:0.85rem;color:#94a3b8;">Đã hủy</span>';
        } else {
            // pending: Tính thời gian 5 phút để chủ xe xác nhận
            const createdAt = b.createdAt ? new Date(b.createdAt).getTime() : Date.now();
            const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
            const remainingSeconds = 300 - elapsedSeconds;

            if (remainingSeconds > 0) {
                const remMinutes = Math.floor(remainingSeconds / 60);
                const remSecs = remainingSeconds % 60;
                const timeStr = `${remMinutes}:${remSecs < 10 ? '0' : ''}${remSecs}`;
                statusBadge = `<span class="status-pill renting" style="border-color:#f59e0b;color:#f59e0b;">⏳ Treo đơn (${timeStr})</span>`;
            } else {
                statusBadge = '<span class="status-pill maintenance"> Quá hạn 5p</span>';
            }

            const approveBtnText = b.locationType === 'delivery' ? 'Duyệt & Giao xe' : 'Duyệt & Chuẩn bị';
            actionBtn = `<button class="btn btn-primary" style="padding:6px 14px;font-size:0.85rem;" onclick="approveBooking('${id}')">
                <i class="fa-solid fa-check"></i> ${approveBtnText}
            </button>`;
        }

        // Dịch vụ kèm theo
        const servicesList = Array.isArray(b.selectedServices) && b.selectedServices.length > 0
            ? `<div style="font-size:0.75rem; color:var(--accent-cyan); margin-top:2px;">
                <i class="fa-solid fa-bell-concierge"></i> ${b.selectedServices.map(s => escapeHTML(s.title)).join(', ')}
               </div>`
            : '';

        return `
        <tr>
            <td><strong style="color:var(--royal-blue,#2563eb);font-family:monospace;">${id}</strong></td>
            <td>
                <strong>${name}</strong>
                <div style="font-size:0.8rem;color:var(--text-secondary,#94a3b8);">
                    <i class="fa-solid fa-phone"></i> ${phone}
                </div>
            </td>
            <td>
                <div>${bikeName}</div>
                ${servicesList}
            </td>
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
        alert(` Đã duyệt đơn ${bookingId} (offline).`);
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
        const fuel = document.getElementById('new-bike-fuel').value.trim() || '2.0L/100km';
        const image = document.getElementById('new-bike-image').value.trim();
        const perksStr = document.getElementById('new-bike-perks').value.trim();

        if (!name) { alert('Vui lòng nhập tên xe!'); return; }

        const perks = perksStr
            ? perksStr.split(',').map(s => s.trim()).filter(Boolean)
            : ['2 Mũ bảo hiểm', 'Áo mưa'];

        const categoryMap = {
            scooter: { label: 'Xe Tay Ga', badge: 'badge-scooter' },
            manual: { label: 'Xe Số', badge: 'badge-manual' },
            clutch: { label: 'Côn Tay', badge: 'badge-clutch' }
        };
        const cat = categoryMap[category] || categoryMap.scooter;

        const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
        const user = rawUser ? JSON.parse(rawUser) : null;

        const newBike = {
            id: 'bike_' + Date.now(),
            name,
            category,
            categoryLabel: cat.label,
            badgeClass: cat.badge,
            price,
            status: 'available',
            statusText: 'Sẵn sàng',
            image: image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80',
            specs: { engine, year, fuel },
            perks,
            ownerEmail: user?.email || null
        };

        // Vô hiệu hoá nút trong lúc gửi
        const submitBtn = addBikeForm.querySelector('[type="submit"]');
        const origText = submitBtn?.innerHTML || '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        }

        try {
            const apiCandidates = ['/api/bikes', 'http://localhost:5000/api/bikes'];
            let saved = false;

            for (const url of apiCandidates) {
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newBike)
                    });
                    if (res.ok) { saved = true; break; }
                } catch { /* thử URL tiếp theo */ }
            }

            addBikeModal?.classList.remove('active');
            addBikeForm.reset();

            if (saved) {
                alert(` Đã đăng thành công mẫu xe "${name}" lên MongoDB!\nDanh sách sẽ tự cập nhật.`);
                await loadOwnerBikes(); // Reload từ API để hiển thị xe mới
            } else {
                alert(` Lưu thất bại. Kiểm tra lại kết nối server rồi thử lại.`);
            }
        } catch (err) {
            alert('Có lỗi xảy ra khi thêm xe. Vui lòng thử lại!');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origText;
            }
        }
    });

    document.getElementById('owner-search-bike')?.addEventListener('input', applyBikeFilter);
    document.getElementById('owner-filter-status')?.addEventListener('change', applyBikeFilter);

    // Sự kiện Modal Dịch Vụ
    const serviceModal = document.getElementById('service-modal');
    const serviceForm = document.getElementById('service-form');

    document.getElementById('btn-open-add-service')?.addEventListener('click', () => {
        document.getElementById('service-modal-title').innerHTML = '<i class="fa-solid fa-bell-concierge" style="color:var(--accent-cyan);"></i> Thêm Dịch Vụ Mới';
        document.getElementById('service-edit-id').value = '';
        document.getElementById('service-price').value = '';
        serviceForm?.reset();
        serviceModal?.classList.add('active');
    });

    document.getElementById('close-service-modal')?.addEventListener('click', () => {
        serviceModal?.classList.remove('active');
    });

    serviceModal?.addEventListener('click', (e) => {
        if (e.target === serviceModal) serviceModal.classList.remove('active');
    });

    serviceForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = document.getElementById('service-edit-id').value;
        const title = document.getElementById('service-title').value.trim();
        const price = Number(document.getElementById('service-price').value) || 0;
        const description = document.getElementById('service-desc').value.trim();
        const icon = document.getElementById('service-icon').value;

        const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
        const user = rawUser ? JSON.parse(rawUser) : null;
        const ownerEmail = user?.email || null;

        const btnSave = document.getElementById('btn-save-service');
        const origBtnText = btnSave?.innerHTML || '';
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        }

        try {
            const apiCandidates = [
                editId ? `/api/services/${editId}` : '/api/services',
                editId ? `http://localhost:5000/api/services/${editId}` : 'http://localhost:5000/api/services',
                editId ? `http://127.0.0.1:5000/api/services/${editId}` : 'http://127.0.0.1:5000/api/services'
            ];
            const method = editId ? 'PUT' : 'POST';
            let res = null;
            let success = false;

            for (const url of apiCandidates) {
                try {
                    res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, description, price, icon, ownerEmail })
                    });
                    if (res && res.ok) {
                        success = true;
                        break;
                    }
                } catch {
                    // Thử URL tiếp theo
                }
            }

            if (success) {
                alert(editId ? 'Cập nhật dịch vụ thành công!' : 'Đã thêm dịch vụ mới thành công!');
                serviceModal?.classList.remove('active');
                serviceForm.reset();
                await loadOwnerServices();
            } else {
                const errData = res ? await res.json().catch(() => ({})) : {};
                alert(errData.message || 'Lưu dịch vụ thất bại!');
            }
        } catch (err) {
            alert('Lỗi kết nối tới máy chủ! (' + (err.message || 'Error') + ')');
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = origBtnText;
            }
        }
    });

    document.getElementById('btn-owner-logout')?.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi Kênh Người cho thuê xe?')) {
            localStorage.removeItem('motogo_user');
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    });
}

// --------------------------------------------------------------------------
// 4. QUẢN LÝ DỊCH VỤ CỦA CHỦ XE (CRUD SERVICES)
// --------------------------------------------------------------------------
async function loadOwnerServices() {
    const tbody = document.getElementById('owner-service-list');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:25px;color:#94a3b8;">
            <i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách dịch vụ...
        </td></tr>`;
    }

    const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const ownerEmail = user?.email || '';

    const apiCandidates = [
        `/api/services?ownerEmail=${encodeURIComponent(ownerEmail)}`,
        `http://localhost:5000/api/services?ownerEmail=${encodeURIComponent(ownerEmail)}`,
        `http://127.0.0.1:5000/api/services?ownerEmail=${encodeURIComponent(ownerEmail)}`
    ];

    ownerServices = [];
    for (const url of apiCandidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                ownerServices = Array.isArray(data) ? data : (Array.isArray(data.value) ? data.value : []);
                break;
            }
        } catch {
            // Thử endpoint tiếp theo
        }
    }

    renderOwnerServices(ownerServices);
}

function renderOwnerServices(services) {
    const tbody = document.getElementById('owner-service-list');
    if (!tbody) return;

    if (!services || services.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">
            <i class="fa-solid fa-bell-concierge" style="font-size:2rem;color:#334155;display:block;margin-bottom:8px;"></i>
            Chưa có dịch vụ nào. Hãy bấm <strong>"Thêm Dịch Vụ Mới"</strong> để tạo dịch vụ cho cơ sở của bạn!
        </td></tr>`;
        return;
    }

    tbody.innerHTML = services.map(s => {
        const priceDisplay = s.price > 0 ? `${(s.price).toLocaleString('vi-VN')}đ` : '<span style="color:var(--success);">Miễn phí</span>';
        return `
        <tr>
            <td>
                <div style="width:40px;height:40px;background:var(--bg-surface);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);font-size:1.1rem;">
                    <i class="${escapeHTML(s.icon || 'fa-solid fa-truck-fast')}"></i>
                </div>
            </td>
            <td><strong>${escapeHTML(s.title)}</strong></td>
            <td><strong style="color:var(--accent-cyan);">${priceDisplay}</strong></td>
            <td style="color:var(--text-secondary);font-size:0.88rem;max-width:280px;">${escapeHTML(s.description)}</td>
            <td style="text-align:right;">
                <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:0.8rem;margin-right:6px;" onclick="openEditServiceModal('${s._id}')">
                    <i class="fa-solid fa-pen-to-square"></i> Sửa
                </button>
                <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:0.8rem;color:var(--danger);border-color:var(--danger);" onclick="deleteService('${s._id}')">
                    <i class="fa-solid fa-trash"></i> Xóa
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

window.openEditServiceModal = function (serviceId) {
    const service = ownerServices.find(s => s._id === serviceId);
    if (!service) return;

    document.getElementById('service-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:var(--accent-cyan);"></i> Cập Nhật Dịch Vụ';
    document.getElementById('service-edit-id').value = service._id;
    document.getElementById('service-title').value = service.title;
    document.getElementById('service-price').value = service.price || 0;
    document.getElementById('service-desc').value = service.description;
    document.getElementById('service-icon').value = service.icon || 'fa-solid fa-truck-fast';

    document.getElementById('service-modal')?.classList.add('active');
};

window.deleteService = async function (serviceId) {
    if (!confirm('Bạn có chắc muốn xóa dịch vụ này không?')) return;

    const apiCandidates = [
        `/api/services/${serviceId}`,
        `http://localhost:5000/api/services/${serviceId}`,
        `http://127.0.0.1:5000/api/services/${serviceId}`
    ];

    let success = false;
    for (const url of apiCandidates) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
                success = true;
                break;
            }
        } catch {
            // Thử endpoint tiếp theo
        }
    }

    if (success) {
        alert('Đã xóa dịch vụ thành công!');
        await loadOwnerServices();
    } else {
        alert('Không thể xóa dịch vụ. Vui lòng thử lại!');
    }
};

// KHỞI ĐỘNG KHI TẢI TRANG
function initOwnerApp() {
    const user = initOwnerSession();
    if (user) {
        initModalEvents();
        loadOwnerBikes();
        loadOwnerBookings();
        loadOwnerServices();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOwnerApp);
} else {
    initOwnerApp();
}
