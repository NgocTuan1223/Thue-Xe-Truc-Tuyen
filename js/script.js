/**
 * MOTO GO - CLIENT HOMEPAGE SCRIPT (js/script.js)
 * Tải danh sách xe máy, tìm kiếm & bộ lọc, modal đặt xe trực tuyến
 */

// Danh sách xe mặc định có sẵn (Đảm bảo hiển thị 100% ngay lập tức dù mở bằng file://, Live Server hay Express)
const DEFAULT_BIKES = [
    {
        id: "bike-01",
        name: "Honda AirBlade 160 ABS",
        category: "scooter",
        categoryLabel: "Xe Tay Ga",
        badgeClass: "badge-scooter",
        price: 180000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "160cc", year: "Đời 2024", fuel: "2.2L/100km" },
        perks: ["2 Mũ bảo hiểm", "Áo mưa"]
    },
    {
        id: "bike-02",
        name: "Yamaha Exciter 155 VVA",
        category: "clutch",
        categoryLabel: "Côn Tay",
        badgeClass: "badge-clutch",
        price: 200000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "155cc", year: "Đời 2024", fuel: "2.0L/100km" },
        perks: ["Giá đỡ điện thoại", "Bảo hiểm"]
    },
    {
        id: "bike-03",
        name: "Honda Wave Alpha 110cc",
        category: "manual",
        categoryLabel: "Xe Số",
        badgeClass: "badge-manual",
        price: 120000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "110cc", year: "Đời 2023", fuel: "1.6L/100km" },
        perks: ["2 Mũ bảo hiểm", "Tiết kiệm xăng"]
    },
    {
        id: "bike-04",
        name: "Honda Vision 2024 Smartkey",
        category: "scooter",
        categoryLabel: "Xe Tay Ga",
        badgeClass: "badge-scooter",
        price: 150000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "110cc", year: "Đời 2024", fuel: "1.8L/100km" },
        perks: ["Khóa Smartkey", "Cốp rộng"]
    },
    {
        id: "bike-05",
        name: "Honda Winner X ABS V3",
        category: "clutch",
        categoryLabel: "Côn Tay",
        badgeClass: "badge-clutch",
        price: 190000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "150cc", year: "Đời 2024", fuel: "1.9L/100km" },
        perks: ["Phanh ABS", "Cổng sạc USB"]
    },
    {
        id: "bike-06",
        name: "Yamaha Sirius FI 115cc",
        category: "manual",
        categoryLabel: "Xe Số",
        badgeClass: "badge-manual",
        price: 130000,
        status: "available",
        statusText: "Sẵn sàng",
        image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80",
        specs: { engine: "115cc", year: "Đời 2023", fuel: "1.7L/100km" },
        perks: ["2 Mũ bảo hiểm", "Máy bốc leo dốc"]
    }
];

let bikesData = [...DEFAULT_BIKES];
let selectedBike = null;

const formatVND = (amount) => (amount || 0).toLocaleString('vi-VN') + 'đ';

// 1. TẢI DỮ LIỆU XE (Render ngay lập tức -> Đồng bộ MongoDB nền)
async function loadBikes() {
    // Render ngay danh sách xe có sẵn để không bao giờ bị màn hình trắng
    renderBikes(bikesData);

    // Thử đồng bộ dữ liệu mới nhất từ Server MongoDB
    try {
        const endpoints = [
            '/api/bikes',
            'http://localhost:5000/api/bikes',
            'http://127.0.0.1:5000/api/bikes',
            './data/bikes.json'
        ];

        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        bikesData = data;
                        renderBikes(bikesData);
                        console.log(`✅ Đã đồng bộ ${bikesData.length} xe từ: ${url}`);
                        break;
                    }
                }
            } catch (err) {
                // Tiếp tục thử cổng tiếp theo
            }
        }
    } catch (error) {
        console.warn('Sử dụng danh sách xe cục bộ:', error);
    }
}

// 2. RENDER LƯỚI DANH SÁCH XE MÁY
function renderBikes(list) {
    const listEl = document.getElementById('bike-list');
    if (!listEl) return;

    if (!list || list.length === 0) {
        listEl.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: #94a3b8;">
                <i class="fa-solid fa-motorcycle" style="font-size: 2.5rem; color: #334155; margin-bottom: 12px;"></i>
                <p>Không tìm thấy mẫu xe nào phù hợp với bộ lọc.</p>
            </div>`;
        return;
    }

    listEl.innerHTML = list.map(bike => {
        const categoryBadge = bike.badgeClass || (bike.category === 'scooter' ? 'badge-scooter' : (bike.category === 'manual' ? 'badge-manual' : 'badge-clutch'));
        const categoryText = bike.categoryLabel || (bike.category === 'scooter' ? 'Xe Tay Ga' : (bike.category === 'manual' ? 'Xe Số' : 'Côn Tay'));
        
        let statusClass = 'available';
        let statusText = 'Sẵn sàng';
        if (bike.status === 'renting' || bike.status === 'Đang thuê') {
            statusClass = 'renting';
            statusText = 'Đang thuê';
        } else if (bike.status === 'maintenance' || bike.status === 'Bảo trì') {
            statusClass = 'maintenance';
            statusText = 'Bảo trì';
        }

        const engine = bike.specs?.engine || '125cc';
        const year = bike.specs?.year || 'Đời mới';
        const fuel = bike.specs?.fuel || 'Tiết kiệm xăng';
        const perks = (bike.perks && bike.perks.length > 0) ? bike.perks : ['2 Mũ bảo hiểm', 'Bảo hiểm'];

        return `
            <div class="bike-card">
                <div class="bike-img-wrapper">
                    <span class="bike-badge ${categoryBadge}">${categoryText}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <img src="${bike.image}" alt="${bike.name}" onerror="this.src='https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=700&q=80'">
                </div>
                <div class="bike-info">
                    <h3 class="bike-title">${bike.name}</h3>
                    <div class="bike-specs">
                        <span><i class="fa-solid fa-gauge-high"></i> ${engine}</span>
                        <span><i class="fa-solid fa-calendar-check"></i> ${year}</span>
                        <span><i class="fa-solid fa-gas-pump"></i> ${fuel}</span>
                    </div>
                    <div class="bike-perks">
                        ${perks.map(perk => `<span><i class="fa-solid fa-check"></i> ${perk}</span>`).join('')}
                    </div>
                    <div class="bike-footer">
                        <div class="bike-price">
                            <span class="price-amount">${formatVND(bike.price)}</span>
                            <span class="price-unit">/ ngày</span>
                        </div>
                        <button class="btn btn-primary btn-book" onclick="openBookingModal('${bike.id}')">
                            <i class="fa-solid fa-bolt"></i> Đặt thuê
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 3. TÌM KIẾM VÀ BỘ LỌC XE
function filterAndSortBikes() {
    const searchInput = document.getElementById('search-keyword');
    const filterCategory = document.getElementById('filter-category');
    const sortPrice = document.getElementById('sort-price');

    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const category = filterCategory ? filterCategory.value : 'all';
    const sort = sortPrice ? sortPrice.value : 'default';

    let filtered = bikesData.filter(bike => {
        const matchName = bike.name.toLowerCase().includes(keyword);
        const matchCat = (category === 'all') || (bike.category === category);
        return matchName && matchCat;
    });

    if (sort === 'asc') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'desc') filtered.sort((a, b) => b.price - a.price);

    renderBikes(filtered);
}

// 4. MODAL ĐẶT XE TRỰC TUYẾN
window.openBookingModal = function (bikeId) {
    selectedBike = bikesData.find(b => b.id === bikeId);
    if (!selectedBike) return;

    const modal = document.getElementById('booking-modal');
    const pickupInput = document.getElementById('pickup-date');
    const returnInput = document.getElementById('return-date');

    const imgEl = document.getElementById('modal-bike-img');
    const nameEl = document.getElementById('modal-bike-name');
    const priceEl = document.getElementById('modal-bike-price');

    if (imgEl) imgEl.src = selectedBike.image;
    if (nameEl) nameEl.textContent = selectedBike.name;
    if (priceEl) priceEl.textContent = selectedBike.price.toLocaleString('vi-VN');

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    if (pickupInput) {
        pickupInput.min = today;
        pickupInput.value = today;
    }
    if (returnInput) {
        returnInput.min = today;
        returnInput.value = tomorrow;
    }

    // Tự động điền họ tên, số điện thoại nếu khách đã đăng nhập
    const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
    if (rawUser) {
        try {
            const user = JSON.parse(rawUser);
            const nameField = document.getElementById('customer-name');
            const phoneField = document.getElementById('customer-phone');
            if (nameField && user.name) nameField.value = user.name;
            if (phoneField && user.phone) phoneField.value = user.phone;
        } catch (e) {}
    }

    updateTotalPrice();
    if (modal) modal.classList.add('active');
};

function updateTotalPrice() {
    if (!selectedBike) return;

    const pickupInput = document.getElementById('pickup-date');
    const returnInput = document.getElementById('return-date');
    const locationSelect = document.getElementById('pickup-location');

    const startVal = pickupInput ? pickupInput.value : '';
    const endVal = returnInput ? returnInput.value : '';

    let days = 1;
    if (startVal && endVal) {
        const start = new Date(startVal);
        const end = new Date(endVal);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        days = diffDays > 0 ? diffDays : 1;
    }

    const deliveryFee = (locationSelect && locationSelect.value === 'delivery') ? 30000 : 0;
    const total = (days * selectedBike.price) + deliveryFee;

    const daysEl = document.getElementById('total-days');
    const priceEl = document.getElementById('total-price');

    if (daysEl) daysEl.textContent = `${days} ngày`;
    if (priceEl) priceEl.textContent = formatVND(total);
}

// 5. KIỂM TRA PHIÊN ĐĂNG NHẬP (Hiển thị Avatar & Tên User trên Navbar)
function checkUserLogin() {
    const rawUser = localStorage.getItem('motogo_user') || localStorage.getItem('currentUser');
    const loginBtn = document.getElementById('nav-login-btn');
    if (rawUser && loginBtn) {
        try {
            const user = JSON.parse(rawUser);
            const parentActions = loginBtn.parentElement;

            if (user.role === 'owner') {
                // Người cho thuê xe
                parentActions.innerHTML = `
                    <a href="owner.html" class="btn btn-outline" style="text-decoration: none; border-color: var(--accent-cyan); color: var(--accent-cyan);">
                        <i class="fa-solid fa-shop"></i> Kênh Chủ Xe
                    </a>
                    <button class="btn btn-outline" id="btn-logout" title="Nhấn để đăng xuất">
                        <i class="fa-solid fa-user-tie"></i> ${user.name} (Đăng xuất)
                    </button>
                `;
            } else {
                // Khách thuê xe
                parentActions.innerHTML = `
                    <button class="btn btn-outline" id="btn-my-bookings">
                        <i class="fa-solid fa-receipt"></i> Đơn của tôi <span class="badge" id="booking-count">0</span>
                    </button>
                    <button class="btn btn-primary" id="btn-logout" title="Nhấn để đăng xuất">
                        <i class="fa-solid fa-circle-user"></i> ${user.name} (Đăng xuất)
                    </button>
                `;
            }

            document.getElementById('btn-logout')?.addEventListener('click', () => {
                if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                    localStorage.removeItem('motogo_user');
                    localStorage.removeItem('currentUser');
                    window.location.reload();
                }
            });
        } catch (e) {}
    }
}

// 6. GẮN SỰ KIỆN KHI DOM ĐÃ SẴN SÀNG
function initEvents() {
    const searchInput = document.getElementById('search-keyword');
    const filterCategory = document.getElementById('filter-category');
    const sortPrice = document.getElementById('sort-price');
    const btnFilter = document.getElementById('btn-filter');
    const tabButtons = document.querySelectorAll('.tab-btn');

    searchInput?.addEventListener('input', filterAndSortBikes);
    sortPrice?.addEventListener('change', filterAndSortBikes);
    btnFilter?.addEventListener('click', filterAndSortBikes);

    filterCategory?.addEventListener('change', (e) => {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.category === e.target.value));
        filterAndSortBikes();
    });

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (filterCategory) filterCategory.value = btn.dataset.category;
            filterAndSortBikes();
        });
    });

    // Sự kiện Modal
    const modal = document.getElementById('booking-modal');
    const pickupInput = document.getElementById('pickup-date');
    const returnInput = document.getElementById('return-date');
    const locationSelect = document.getElementById('pickup-location');
    const closeModalBtn = document.getElementById('close-modal');
    const bookingForm = document.getElementById('booking-form');

    pickupInput?.addEventListener('change', updateTotalPrice);
    returnInput?.addEventListener('change', updateTotalPrice);
    locationSelect?.addEventListener('change', updateTotalPrice);

    closeModalBtn?.addEventListener('click', () => {
        if (modal) modal.classList.remove('active');
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    bookingForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const countEl = document.getElementById('booking-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
        alert(`🎉 Đặt thành công xe: ${selectedBike?.name || 'Xe máy'}!\nChúng tôi sẽ liên hệ trong 5 phút để xác nhận.`);
        if (modal) modal.classList.remove('active');
        bookingForm.reset();
    });
}

// KHỞI CHẠY HỆ THỐNG
function initApp() {
    checkUserLogin();
    initEvents();
    loadBikes();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
