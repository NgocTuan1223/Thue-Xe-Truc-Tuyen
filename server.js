const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Cho phép kết nối CORS từ mọi nguồn (Live Server 5500, localhost 5000, v.v.)
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let isMongoConnected = false;
let memoryUsers = [];
let memoryBookings = [];

// 1. Kết nối MongoDB Local
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thue_xe_db';
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    isMongoConnected = true;
    console.log('✅ Đã kết nối MongoDB thành công!');
    seedDatabase();
  })
  .catch(err => {
    isMongoConnected = false;
    console.warn('⚠️ Chưa kết nối được MongoDB service. Hệ thống kích hoạt bộ nhớ đệm dự phòng!');
    console.warn('Chi tiết lỗi:', err.message);
  });

// 2. Schema Xe Máy (Bike)
const bikeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  categoryLabel: String,
  badgeClass: String,
  price: { type: Number, required: true },
  status: { type: String, default: 'available' },
  statusText: { type: String, default: 'Sẵn sàng' },
  image: String,
  specs: { engine: String, year: String, fuel: String },
  perks: [String],
  ownerEmail: { type: String, default: null }
}, { timestamps: true });

const Bike = mongoose.model('Bike', bikeSchema);

// 3. Schema & Model Tài Khoản -> LƯU CHÍNH XÁC VÀO MỤC "USES" TRONG MONGODB
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'owner'], required: true },
  shopName: { type: String, default: null },
  fleetSize: { type: String, default: null },
  address: { type: String, default: null }
}, { timestamps: true, collection: 'USES' }); // Chỉ định rõ ràng collection 'USES'

const User = mongoose.model('User', userSchema, 'USES');

// 4. Schema Đơn Thuê Xe (Booking)
const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  bikeId: { type: String, required: true },
  bikeName: { type: String, required: true },
  bikeImage: String,
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: String,
  pickupDate: { type: String, required: true },
  returnDate: { type: String, required: true },
  days: { type: Number, default: 1 },
  locationType: { type: String, default: 'store' },
  totalPrice: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // pending, approved, completed, cancelled
  ownerEmail: String
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// Khởi tạo dữ liệu mẫu nếu chưa có
async function seedDatabase() {
  if (!isMongoConnected) return;
  try {
    // Nạp xe mẫu từ data/bikes.json
    const count = await Bike.countDocuments();
    if (count === 0) {
      const jsonPath = path.join(__dirname, 'data', 'bikes.json');
      if (fs.existsSync(jsonPath)) {
        const bikes = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        await Bike.insertMany(bikes);
        console.log(`🚀 Đã tự động nạp ${bikes.length} xe vào MongoDB!`);
      }
    }

    // Tự động đồng bộ tài khoản cũ (nếu có từ collection 'users' sang 'USES')
    const usesCount = await User.countDocuments();
    if (usesCount === 0) {
      try {
        const oldUsers = await mongoose.connection.db.collection('users').find().toArray();
        if (oldUsers && oldUsers.length > 0) {
          const formatted = oldUsers.map(({ _id, ...rest }) => rest);
          await User.insertMany(formatted);
          console.log(`📦 Đã nạp ${oldUsers.length} tài khoản vào mục USES trong MongoDB!`);
        }
      } catch (e) {
        // bỏ qua nếu không có collection cũ
      }
    }
    console.log(`📊 Hiện có ${await User.countDocuments()} tài khoản trong mục USES của MongoDB.`);
  } catch (error) {
    console.error('Lỗi nạp dữ liệu ban đầu:', error.message);
  }
}

// ==========================================
// CÁC ROUTE ĐIỀU HƯỚNG TRANG CHỦ
// ==========================================

// Trang chủ của Người thuê xe (Customer Homepage)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Trang chủ của Người cho thuê xe (Owner Homepage)
app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'owner.html'));
});
app.get('/owner.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'owner.html'));
});

// Trang Đăng nhập & Đăng ký
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ==========================================
// CÁC API AUTH (ĐĂNG NHẬP / ĐĂNG KÝ)
// ==========================================

// 1. API Đăng ký -> LƯU VÀO MỤC USES CỦA MONGODB
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, email, password, role, shopName, fleetSize, address } = req.body;

    if (!name || !phone || !email || !password || !role) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc!' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    let existingUser = null;

    if (isMongoConnected) {
      existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
      });
    } else {
      existingUser = memoryUsers.find(
        u => u.email === normalizedEmail || u.phone === normalizedPhone
      );
    }

    if (existingUser) {
      const duplicateField = existingUser.email === normalizedEmail ? 'Email' : 'Số điện thoại';
      const roleLabel = existingUser.role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';
      return res.status(409).json({
        message: `${duplicateField} này đã được đăng ký cho một tài khoản (${roleLabel}). Vui lòng đăng nhập!`
      });
    }

    const userData = {
      name: name.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      password,
      role,
      shopName: role === 'owner' ? (shopName || 'Cửa hàng của tôi') : null,
      fleetSize: role === 'owner' ? (fleetSize || '1-5') : null,
      address: role === 'owner' ? (address || 'Tại địa chỉ đăng ký') : null
    };

    let savedUser;
    if (isMongoConnected) {
      savedUser = await User.create(userData);
      console.log(`✅ [MongoDB] Đã lưu tài khoản (${role}) vào mục USES thành công: ${savedUser.email}`);
    } else {
      savedUser = { _id: 'user_' + Date.now(), ...userData };
      memoryUsers.push(savedUser);
      console.log(`⚠️ [Bộ nhớ tạm] Đã lưu tài khoản (${role}): ${savedUser.email}`);
    }

    res.status(201).json({
      message: `Đăng ký tài khoản ${role === 'owner' ? 'Người cho thuê xe' : 'Khách hàng'} thành công!`,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        shopName: savedUser.shopName,
        fleetSize: savedUser.fleetSize,
        address: savedUser.address
      }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi máy chủ: ' + error.message });
  }
});

// 2. API Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập Email/SĐT và Mật khẩu!' });
    }

    const cleanEmail = identifier.trim().toLowerCase();
    const cleanPhone = identifier.trim();
    const roleLabel = role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';

    let user = null;
    if (isMongoConnected) {
      user = await User.findOne({
        $or: [{ email: cleanEmail }, { phone: cleanPhone }]
      });
    } else {
      user = memoryUsers.find(
        u => u.email === cleanEmail || u.phone === cleanPhone
      );
    }

    if (!user) {
      return res.status(404).json({
        needRegister: true,
        message: `Tài khoản ${roleLabel} chưa tồn tại trên hệ thống! Vui lòng chuyển sang tab "Đăng ký tài khoản" để tạo mới.`
      });
    }

    if (user.role !== role) {
      const actualRoleLabel = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';
      return res.status(403).json({
        message: `Tài khoản này được đăng ký với vai trò "${actualRoleLabel}". Vui lòng chọn đúng vai trò "${actualRoleLabel}" ở phía trên để đăng nhập!`
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!'
      });
    }

    console.log(`🔑 Đăng nhập thành công: ${user.name} (${user.role})`);

    res.json({
      message: `Đăng nhập tài khoản ${roleLabel} thành công!`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        shopName: user.shopName,
        fleetSize: user.fleetSize,
        address: user.address
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ: ' + error.message });
  }
});

// 3. API Lấy danh sách tài khoản trong mục USES (Dành cho kiểm tra / Quản trị)
app.get('/api/users', async (req, res) => {
  try {
    if (isMongoConnected) {
      const users = await User.find({}, '-password');
      return res.json({ count: users.length, collection: 'USES', users });
    }
    const safeUsers = memoryUsers.map(({ password, ...u }) => u);
    res.json({ count: safeUsers.length, collection: 'USES (Memory)', users: safeUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// CÁC API DÀNH CHO XE MÁY & ĐƠN THUÊ
// ==========================================

// Lấy danh sách xe máy
app.get('/api/bikes', async (req, res) => {
  try {
    if (isMongoConnected) {
      const bikes = await Bike.find().sort({ createdAt: -1 });
      return res.json(bikes);
    }
    const jsonPath = path.join(__dirname, 'data', 'bikes.json');
    if (fs.existsSync(jsonPath)) {
      const bikes = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      return res.json(bikes);
    }
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách xe', error: error.message });
  }
});

// Người cho thuê thêm xe máy mới
app.post('/api/bikes', async (req, res) => {
  try {
    const bikeData = req.body;
    bikeData.id = 'bike_' + Date.now();

    if (isMongoConnected) {
      const newBike = await Bike.create(bikeData);
      return res.status(201).json(newBike);
    }
    res.status(201).json(bikeData);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm xe', error: error.message });
  }
});

// Cập nhật trạng thái xe (Sẵn sàng / Đang thuê / Bảo dưỡng)
app.put('/api/bikes/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, statusText } = req.body;

    if (isMongoConnected) {
      const updated = await Bike.findOneAndUpdate(
        { id },
        { status, statusText },
        { new: true }
      );
      return res.json(updated);
    }
    res.json({ id, status, statusText });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái xe', error: error.message });
  }
});

// Lấy danh sách đơn thuê
app.get('/api/bookings', async (req, res) => {
  try {
    if (isMongoConnected) {
      const bookings = await Booking.find().sort({ createdAt: -1 });
      return res.json(bookings);
    }
    res.json(memoryBookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo đơn thuê xe mới
app.post('/api/bookings', async (req, res) => {
  try {
    const data = req.body;
    data.bookingId = 'BK' + Math.floor(100000 + Math.random() * 900000);

    if (isMongoConnected) {
      const newBooking = await Booking.create(data);
      return res.status(201).json(newBooking);
    }
    memoryBookings.unshift(data);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật trạng thái đơn thuê (Duyệt, Bàn giao, Hoàn thành, Hủy)
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (isMongoConnected) {
      const updated = await Booking.findOneAndUpdate(
        { bookingId: id },
        { status },
        { new: true }
      );
      return res.json(updated);
    }
    const item = memoryBookings.find(b => b.bookingId === id);
    if (item) item.status = status;
    res.json(item || { bookingId: id, status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Kiểm tra tình trạng kết nối server
app.get('/api/health', async (req, res) => {
  let userCount = 0;
  if (isMongoConnected) {
    userCount = await User.countDocuments();
  }
  res.json({
    status: 'ok',
    mongoConnected: isMongoConnected,
    collection: 'USES',
    totalUsersInUses: userCount
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 MOTO GO SERVER ĐANG CHẠY THÀNH CÔNG:`);
  console.log(`👉 Trang chủ đăng nhập:     http://localhost:${PORT}/index.html`);
  console.log(`=================================================`);
});
