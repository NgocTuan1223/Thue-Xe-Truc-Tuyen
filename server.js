const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thue_xe_db';

// --------------------------------------------------------------------------
// 1. CẤU HÌNH MIDDLEWARE HỆ THỐNG
// --------------------------------------------------------------------------
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Wrapper xử lý Async an toàn, tự động chuyển giao lỗi cho Error Middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --------------------------------------------------------------------------
// 2. KẾT NỐI VÀ QUẢN TRỊ TRẠNG THÁI MONGODB
// --------------------------------------------------------------------------
let isMongoConnected = false;
const memoryUsers = [];
const memoryBookings = [];

async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
      autoIndex: true
    });
    isMongoConnected = true;
    console.log(' Đã kết nối cơ sở dữ liệu MongoDB thành công (thue_xe_db)!');
    await seedDatabaseIfEmpty();
  } catch (err) {
    isMongoConnected = false;
    console.warn(' Chưa kết nối được MongoDB service. Kích hoạt bộ nhớ đệm (In-memory Fallback).');
    console.warn('Chi tiết lỗi kết nối:', err.message);
  }
}

connectDatabase();

// --------------------------------------------------------------------------
// 3. ĐỊNH NGHĨA SCHEMAS & MODELS MONGODB
// --------------------------------------------------------------------------

// 3.1 Schema & Model Xe Máy (Collection: "bikes")
const bikeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['scooter', 'manual', 'clutch'] },
  categoryLabel: { type: String, default: 'Xe Máy' },
  badgeClass: { type: String, default: 'badge-scooter' },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, default: 'available' },
  statusText: { type: String, default: 'Sẵn sàng' },
  image: { type: String, default: '' },
  specs: {
    engine: { type: String, default: '125cc' },
    year: { type: String, default: '2024' },
    fuel: { type: String, default: 'Tiết kiệm xăng' }
  },
  perks: { type: [String], default: ['2 Mũ bảo hiểm', 'Bảo hiểm chuyến đi'] },
  ownerEmail: { type: String, default: null }
}, { timestamps: true, collection: 'bikes' });

const Bike = mongoose.model('Bike', bikeSchema, 'bikes');

// 3.2 Schema & Model Tài Khoản -> LƯU VÀO MỤC "USES" THEO YÊU CẦU NGHIỆP VỤ
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'owner'], required: true },
  shopName: { type: String, default: null, trim: true },
  fleetSize: { type: String, default: null },
  address: { type: String, default: null, trim: true }
}, { timestamps: true, collection: 'USES' }); // Luôn lưu vào collection 'USES'

const User = mongoose.model('User', userSchema, 'USES');

// 3.3 Schema & Model Đơn Thuê Xe (Collection: "bookings")
const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  bikeId: { type: String, required: true },
  bikeName: { type: String, required: true },
  bikeImage: { type: String, default: '' },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  customerEmail: { type: String, default: null, trim: true },
  pickupDate: { type: String, required: true },
  returnDate: { type: String, required: true },
  days: { type: Number, default: 1, min: 1 },
  locationType: { type: String, default: 'store' },
  totalPrice: { type: Number, required: true, min: 0 },
  status: { type: String, default: 'pending' }, // pending, approved, completed, cancelled
  ownerEmail: { type: String, default: null }
}, { timestamps: true, collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema, 'bookings');

// --------------------------------------------------------------------------
// 4. KHỞI TẠO DỮ LIỆU BAN ĐẦU (SEED DATABASE)
// --------------------------------------------------------------------------

async function seedDatabaseIfEmpty() {
  if (!isMongoConnected) return;
  try {
    const bikeCount = await Bike.countDocuments();
    if (bikeCount === 0) {
      await Bike.insertMany(INITIAL_BIKES);
      console.log(` Đã tự động tạo mẫu ${INITIAL_BIKES.length} xe máy khởi tạo vào MongoDB collection: bikes`);
    } else {
      console.log(` Hiện có ${bikeCount} xe máy trong MongoDB (collection: bikes).`);
    }

    const usesCount = await User.countDocuments();
    console.log(` Hiện có ${usesCount} tài khoản trong MongoDB (mục: USES).`);
  } catch (error) {
    console.error('Lỗi khi kiểm tra và khởi tạo dữ liệu ban đầu:', error.message);
  }
}

// --------------------------------------------------------------------------
// 5. CÁC ROUTE PHỤC VỤ TRANG GIAO DIỆN (HTML ROUTES)
// --------------------------------------------------------------------------

// Trang chủ Khách thuê xe
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Trang Kênh Chủ Xe (Đối tác cho thuê)
app.get(['/owner', '/owner.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'owner.html'));
});

// Trang Đăng nhập / Đăng ký tài khoản
app.get(['/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// --------------------------------------------------------------------------
// 6. CÁC API AUTHENTICATION (ĐĂNG KÝ & ĐĂNG NHẬP)
// --------------------------------------------------------------------------

// 6.1 API Đăng ký -> LƯU TRỰC TIẾP VÀO MỤC USES TRONG MONGODB
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { name, phone, email, password, role, shopName, fleetSize, address } = req.body;

  if (!name || !phone || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ họ tên, số điện thoại, email, mật khẩu và vai trò!'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  let existingUser = null;
  if (isMongoConnected) {
    existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
    }).lean();
  } else {
    existingUser = memoryUsers.find(
      u => u.email === normalizedEmail || u.phone === normalizedPhone
    );
  }

  if (existingUser) {
    const duplicateField = existingUser.email === normalizedEmail ? 'Email' : 'Số điện thoại';
    const roleLabel = existingUser.role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';
    return res.status(409).json({
      success: false,
      message: `${duplicateField} này đã được đăng ký cho một tài khoản (${roleLabel}). Vui lòng đăng nhập!`
    });
  }

  const userData = {
    name: name.trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    password, // Trong ứng dụng production có thể hash bằng bcryptjs
    role,
    shopName: role === 'owner' ? (shopName || 'Cửa hàng của tôi') : null,
    fleetSize: role === 'owner' ? (fleetSize || '1-5') : null,
    address: role === 'owner' ? (address || 'Tại địa chỉ đăng ký') : null
  };

  let savedUser;
  if (isMongoConnected) {
    savedUser = await User.create(userData);
    console.log(` [MongoDB] Đã lưu tài khoản (${role}) vào mục USES: ${savedUser.email}`);
  } else {
    savedUser = { _id: 'user_' + Date.now(), ...userData };
    memoryUsers.push(savedUser);
    console.log(` [In-Memory] Đã lưu tài khoản (${role}): ${savedUser.email}`);
  }

  return res.status(201).json({
    success: true,
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
}));

// 6.2 API Đăng nhập
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập Email hoặc Số điện thoại và Mật khẩu đăng nhập!'
    });
  }

  const cleanEmail = identifier.trim().toLowerCase();
  const cleanPhone = identifier.trim();
  const roleLabel = role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';

  let user = null;
  if (isMongoConnected) {
    user = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }]
    }).lean();
  } else {
    user = memoryUsers.find(
      u => u.email === cleanEmail || u.phone === cleanPhone
    );
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      needRegister: true,
      message: `Tài khoản ${roleLabel} chưa tồn tại trên hệ thống! Vui lòng chuyển sang tab "Đăng ký tài khoản" để tạo mới.`
    });
  }

  if (user.role !== role) {
    const actualRoleLabel = user.role === 'owner' ? 'Người cho thuê xe' : 'Khách thuê xe';
    return res.status(403).json({
      success: false,
      message: `Tài khoản này được đăng ký với vai trò "${actualRoleLabel}". Vui lòng chọn đúng vai trò "${actualRoleLabel}" ở phía trên để đăng nhập!`
    });
  }

  if (user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!'
    });
  }

  console.log(` Đăng nhập thành công: ${user.name} (${user.role})`);

  return res.status(200).json({
    success: true,
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
}));

// 6.3 API Quản trị & Kiểm tra danh sách tài khoản trong mục USES
app.get('/api/users', asyncHandler(async (req, res) => {
  if (isMongoConnected) {
    const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();
    return res.status(200).json({ count: users.length, collection: 'USES', users });
  }

  const safeUsers = memoryUsers.map(({ password, ...rest }) => rest);
  return res.status(200).json({ count: safeUsers.length, collection: 'USES (Memory)', users: safeUsers });
}));

// --------------------------------------------------------------------------
// 7. CÁC API DÀNH CHO XE MÁY & ĐƠN THUÊ (BIKES & BOOKINGS)
// --------------------------------------------------------------------------

// 7.1 Lấy danh sách xe máy trực tiếp từ MongoDB (Collection: bikes)
app.get('/api/bikes', asyncHandler(async (req, res) => {
  if (isMongoConnected) {
    const bikes = await Bike.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(bikes);
  }
  return res.status(200).json(INITIAL_BIKES);
}));

// 7.2 Người cho thuê thêm xe máy mới vào MongoDB
app.post('/api/bikes', asyncHandler(async (req, res) => {
  const bikeData = req.body;
  bikeData.id = bikeData.id || ('bike_' + Date.now());

  if (isMongoConnected) {
    const newBike = await Bike.create(bikeData);
    console.log(` Đã lưu xe máy mới vào MongoDB: ${newBike.name}`);
    return res.status(201).json(newBike);
  }

  return res.status(201).json(bikeData);
}));

// 7.3 Cập nhật trạng thái xe (Sẵn sàng / Đang thuê / Bảo trì)
app.put('/api/bikes/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, statusText } = req.body;

  if (isMongoConnected) {
    const updated = await Bike.findOneAndUpdate(
      { id },
      { status, statusText },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe yêu cầu!' });
    }
    return res.status(200).json(updated);
  }

  return res.status(200).json({ id, status, statusText });
}));

// 7.4 Lấy danh sách đơn thuê xe từ MongoDB
app.get('/api/bookings', asyncHandler(async (req, res) => {
  if (isMongoConnected) {
    const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(bookings);
  }
  return res.status(200).json(memoryBookings);
}));

// 7.5 Tạo đơn thuê xe mới vào MongoDB
app.post('/api/bookings', asyncHandler(async (req, res) => {
  const data = req.body;
  data.bookingId = data.bookingId || ('BK' + Math.floor(100000 + Math.random() * 900000));

  if (isMongoConnected) {
    const newBooking = await Booking.create(data);
    console.log(` Đã lưu đơn thuê xe vào MongoDB: ${newBooking.bookingId}`);
    return res.status(201).json(newBooking);
  }

  memoryBookings.unshift(data);
  return res.status(201).json(data);
}));

// 7.6 Cập nhật trạng thái đơn thuê (Duyệt, Bàn giao, Hoàn thành, Hủy)
app.put('/api/bookings/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (isMongoConnected) {
    const updated = await Booking.findOneAndUpdate(
      { bookingId: id },
      { status },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê xe!' });
    }
    return res.status(200).json(updated);
  }

  const item = memoryBookings.find(b => b.bookingId === id);
  if (item) item.status = status;
  return res.status(200).json(item || { bookingId: id, status });
}));

// --------------------------------------------------------------------------
// 8. API KIỂM TRA TRẠNG THÁI SỨC KHỎE HỆ THỐNG (HEALTH CHECK)
// --------------------------------------------------------------------------
app.get('/api/health', asyncHandler(async (req, res) => {
  let userCount = 0;
  let bikeCount = 0;
  let bookingCount = 0;

  if (isMongoConnected) {
    [userCount, bikeCount, bookingCount] = await Promise.all([
      User.countDocuments(),
      Bike.countDocuments(),
      Booking.countDocuments()
    ]);
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongoConnected: isMongoConnected,
    database: 'thue_xe_db',
    collections: {
      users: { name: 'USES', count: userCount },
      bikes: { name: 'bikes', count: bikeCount },
      bookings: { name: 'bookings', count: bookingCount }
    }
  });
}));

// --------------------------------------------------------------------------
// 9. BỘ XỬ LÝ LỖI TRUNG TÂM & 404 (CENTRALIZED ERROR HANDLING MIDDLEWARE)
// --------------------------------------------------------------------------

// Xử lý Route không tồn tại
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn API '${req.originalUrl}' không tồn tại trên hệ thống MotoGo!`
  });
});

// Middleware bắt mọi lỗi phát sinh (ngăn ngừa tuyệt đối sập server)
app.use((err, req, res, next) => {
  console.error(' [Unhandled Exception]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: 'Đã xảy ra sự cố nội bộ trên máy chủ MotoGo!',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// --------------------------------------------------------------------------
// 10. KHỞI CHẠY MÁY CHỦ & ĐÓNG KẾT NỐI AN TOÀN (GRACEFUL SHUTDOWN)
// --------------------------------------------------------------------------
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================================');
  console.log(' MOTO GO SERVER ĐANG CHẠY THÀNH CÔNG:');

  console.log(`Trang chủ:     http://localhost:${PORT}/index.html`);

  console.log('=================================================');
});

// Đóng kết nối an toàn khi server nhận tín hiệu dừng
const gracefulShutdown = async () => {
  console.log('\n Đang ngắt kết nối an toàn đến máy chủ MotoGo...');
  server.close(async () => {
    if (isMongoConnected) {
      await mongoose.connection.close();
      console.log(' Đã đóng an toàn kết nối MongoDB.');
    }
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
