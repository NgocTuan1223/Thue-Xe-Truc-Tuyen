'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import toàn bộ DB layer từ database.js
const {
  db,
  memoryUsers,
  memoryBookings,
  Bike,
  User,
  Booking,
  Service,
  connectDatabase,
  mongoose
} = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

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
// 2. KHỞI ĐỘNG KẾT NỐI DATABASE
// --------------------------------------------------------------------------
connectDatabase();

// --------------------------------------------------------------------------
// 3. CÁC ROUTE PHỤC VỤ TRANG GIAO DIỆN (HTML ROUTES)
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
// 4. CÁC API AUTHENTICATION (ĐĂNG KÝ & ĐĂNG NHẬP)
// --------------------------------------------------------------------------

// 4.1 API Đăng ký -> LƯU TRỰC TIẾP VÀO MỤC USES TRONG MONGODB
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
  if (db.isMongoConnected) {
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
    password,  // Trong ứng dụng production có thể hash bằng bcryptjs
    role,
    shopName: role === 'owner' ? (shopName || 'Cửa hàng của tôi') : null,
    fleetSize: role === 'owner' ? (fleetSize || '1-5') : null,
    address: role === 'owner' ? (address || 'Tại địa chỉ đăng ký') : null
  };

  let savedUser;
  if (db.isMongoConnected) {
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

// 4.2 API Đăng nhập
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
  if (db.isMongoConnected) {
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

// 4.3 API Quản trị & Kiểm tra danh sách tài khoản trong mục USES
app.get('/api/users', asyncHandler(async (req, res) => {
  if (db.isMongoConnected) {
    const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();
    return res.status(200).json({ count: users.length, collection: 'USES', users });
  }

  const safeUsers = memoryUsers.map(({ password, ...rest }) => rest);
  return res.status(200).json({ count: safeUsers.length, collection: 'USES (Memory)', users: safeUsers });
}));

// --------------------------------------------------------------------------
// 5. CÁC API DÀNH CHO XE MÁY & ĐƠN THUÊ (BIKES & BOOKINGS)
// --------------------------------------------------------------------------

// 5.1 Lấy danh sách xe máy trực tiếp từ MongoDB (Collection: bikes)
app.get('/api/bikes', asyncHandler(async (req, res) => {
  if (db.isMongoConnected) {
    const bikes = await Bike.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(bikes);
  }
  // MongoDB không kết nối được — trả về mảng rỗng (không dùng seed data)
  return res.status(503).json({ success: false, message: 'Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau!' });
}));

// 5.2 Người cho thuê thêm xe máy mới vào MongoDB
app.post('/api/bikes', asyncHandler(async (req, res) => {
  const bikeData = req.body;
  bikeData.id = bikeData.id || ('bike_' + Date.now());

  if (db.isMongoConnected) {
    const newBike = await Bike.create(bikeData);
    console.log(` Đã lưu xe máy mới vào MongoDB: ${newBike.name}`);
    return res.status(201).json(newBike);
  }

  return res.status(201).json(bikeData);
}));

// 5.3 Cập nhật trạng thái xe (Sẵn sàng / Đang thuê / Bảo trì)
app.put('/api/bikes/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, statusText } = req.body;

  if (db.isMongoConnected) {
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

// Hàm tự động quét và hủy các đơn treo quá 5 phút mà chủ xe chưa xác nhận (status: pending)
async function autoCancelExpiredBookings() {
  if (!db.isMongoConnected) return;
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const expiredBookings = await Booking.find({
      status: 'pending',
      createdAt: { $lt: fiveMinutesAgo }
    });

    if (expiredBookings.length > 0) {
      await Booking.updateMany(
        { status: 'pending', createdAt: { $lt: fiveMinutesAgo } },
        { status: 'cancelled' }
      );
      console.log(`[AutoCancel] Đã tự động hủy ${expiredBookings.length} đơn hàng do quá 5 phút chưa được chủ xe xác nhận.`);
    }
  } catch (err) {
    console.error('[AutoCancel] Lỗi khi quét đơn hết hạn:', err.message);
  }
}

// Chạy định kỳ mỗi 30 giây để quét đơn hết hạn
setInterval(autoCancelExpiredBookings, 30000);

// 5.4 Lấy danh sách đơn thuê xe từ MongoDB (hỗ trợ lọc theo customerPhone hoặc customerEmail)
app.get('/api/bookings', asyncHandler(async (req, res) => {
  // Quét nhanh các đơn hết hạn trước khi trả về
  await autoCancelExpiredBookings();

  const { customerPhone, customerEmail, ownerEmail } = req.query;
  const conditions = [];

  if (customerPhone && customerPhone.trim()) {
    conditions.push({ customerPhone: customerPhone.trim() });
  }
  if (customerEmail && customerEmail.trim()) {
    conditions.push({ customerEmail: customerEmail.trim().toLowerCase() });
  }
  if (ownerEmail && ownerEmail.trim()) {
    conditions.push({ ownerEmail: ownerEmail.trim().toLowerCase() });
  }

  const filter = conditions.length > 0 ? { $or: conditions } : {};

  if (db.isMongoConnected) {
    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json(bookings);
  }

  let list = memoryBookings;
  if (conditions.length > 0) {
    list = list.filter(b => 
      (customerPhone && b.customerPhone === customerPhone.trim()) ||
      (customerEmail && b.customerEmail === customerEmail.trim().toLowerCase())
    );
  }
  return res.status(200).json(list);
}));

// 5.5 Tạo đơn thuê xe mới vào MongoDB
app.post('/api/bookings', asyncHandler(async (req, res) => {
  const data = req.body;
  data.bookingId = data.bookingId || ('BK' + Math.floor(100000 + Math.random() * 900000));

  if (db.isMongoConnected) {
    const newBooking = await Booking.create(data);
    console.log(` Đã lưu đơn thuê xe vào MongoDB: ${newBooking.bookingId}`);
    return res.status(201).json(newBooking);
  }

  memoryBookings.unshift(data);
  return res.status(201).json(data);
}));

// 5.6 Cập nhật trạng thái đơn thuê (Duyệt, Bàn giao, Hoàn thành, Hủy)
app.put('/api/bookings/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, cancelReason } = req.body;

  if (db.isMongoConnected) {
    // Nếu khách hàng yêu cầu hủy đơn, kiểm tra điều kiện trong vòng 5 phút (300.000 ms)
    if (status === 'cancelled') {
      const existing = await Booking.findOne({ bookingId: id });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê xe!' });
      }

      if (existing.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Chủ xe đã xác nhận và chuẩn bị bàn giao xe. Quý khách không thể tự hủy đơn trực tuyến, vui lòng liên hệ hotline!'
        });
      }

      if (existing.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Đơn hàng đã hoàn tất, không thể hủy!' });
      }

      const createdAt = new Date(existing.createdAt).getTime();
      const now = Date.now();
      const diffMinutes = (now - createdAt) / (1000 * 60);

      if (diffMinutes > 5) {
        return res.status(400).json({
          success: false,
          message: 'Đã quá thời hạn 5 phút kể từ khi đặt xe. Quý khách không thể tự hủy đơn trực tuyến, vui lòng liên hệ hotline!'
        });
      }
    }

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
// 6. CÁC API DÀNH CHO DỊCH VỤ (SERVICES)
// --------------------------------------------------------------------------

// 6.1 Lấy danh sách dịch vụ (lọc theo chủ xe nếu có ?ownerEmail=)
app.get('/api/services', asyncHandler(async (req, res) => {
  const { ownerEmail } = req.query;
  const filter = ownerEmail ? { ownerEmail } : {};

  if (db.isMongoConnected) {
    const services = await Service.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json(services);
  }
  return res.status(503).json({ success: false, message: 'Chưa kết nối cơ sở dữ liệu' });
}));

// 6.2 Thêm dịch vụ mới
app.post('/api/services', asyncHandler(async (req, res) => {
  const { title, description, price, icon, ownerEmail } = req.body;
  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và mô tả dịch vụ!' });
  }

  if (db.isMongoConnected) {
    const newService = await Service.create({
      title: title.trim(),
      description: description.trim(),
      price: Math.max(0, Number(price) || 0),
      icon: icon || 'fa-solid fa-truck-fast',
      ownerEmail: ownerEmail || null
    });
    return res.status(201).json(newService);
  }
  return res.status(503).json({ success: false, message: 'Chưa kết nối cơ sở dữ liệu' });
}));

// 6.3 Cập nhật dịch vụ
app.put('/api/services/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, price, icon } = req.body;

  if (db.isMongoConnected) {
    const updateData = { title, description, icon };
    if (price !== undefined) updateData.price = Math.max(0, Number(price) || 0);

    const updated = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ!' });
    }
    return res.status(200).json(updated);
  }
  return res.status(503).json({ success: false, message: 'Chưa kết nối cơ sở dữ liệu' });
}));

// 6.4 Xóa dịch vụ
app.delete('/api/services/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (db.isMongoConnected) {
    const deleted = await Service.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ!' });
    }
    return res.status(200).json({ success: true, message: 'Đã xóa dịch vụ thành công!' });
  }
  return res.status(503).json({ success: false, message: 'Chưa kết nối cơ sở dữ liệu' });
}));

// --------------------------------------------------------------------------
// 7. API KIỂM TRA TRẠNG THÁI SỨC KHỎE HỆ THỐNG (HEALTH CHECK)
// --------------------------------------------------------------------------
app.get('/api/health', asyncHandler(async (req, res) => {
  let userCount = 0;
  let bikeCount = 0;
  let bookingCount = 0;

  if (db.isMongoConnected) {
    [userCount, bikeCount, bookingCount] = await Promise.all([
      User.countDocuments(),
      Bike.countDocuments(),
      Booking.countDocuments()
    ]);
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongoConnected: db.isMongoConnected,
    database: 'thue_xe_db',
    collections: {
      users: { name: 'USES', count: userCount },
      bikes: { name: 'bikes', count: bikeCount },
      bookings: { name: 'bookings', count: bookingCount }
    }
  });
}));

// --------------------------------------------------------------------------
// 7. BỘ XỬ LÝ LỖI TRUNG TÂM & 404 (CENTRALIZED ERROR HANDLING MIDDLEWARE)
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
// 8. KHỞI CHẠY MÁY CHỦ & ĐÓNG KẾT NỐI AN TOÀN (GRACEFUL SHUTDOWN)
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
    if (db.isMongoConnected) {
      await mongoose.connection.close();
      console.log(' Đã đóng an toàn kết nối MongoDB.');
    }
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
