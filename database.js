'use strict';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thue_xe_db';

// --------------------------------------------------------------------------
// 1. QUẢN TRỊ TRẠNG THÁI KẾT NỐI & BỘ NHỚ ĐỆM (IN-MEMORY FALLBACK)
// --------------------------------------------------------------------------

// Dùng object wrapper để server.js luôn đọc được giá trị hiện tại
// (primitive boolean export bị copy giá trị — object thì pass by reference)
const db = { isMongoConnected: false };

const memoryUsers    = [];
const memoryBookings = [];

// --------------------------------------------------------------------------
// 2. ĐỊNH NGHĨA SCHEMAS & MODELS MONGODB
// --------------------------------------------------------------------------

// 2.1 Schema & Model Xe Máy (Collection: "bikes")
const bikeSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true, index: true },
  name:          { type: String, required: true, trim: true },
  category:      { type: String, required: true, enum: ['scooter', 'manual', 'clutch'] },
  categoryLabel: { type: String, default: 'Xe Máy' },
  badgeClass:    { type: String, default: 'badge-scooter' },
  price:         { type: Number, required: true, min: 0 },
  status:        { type: String, default: 'available' },
  statusText:    { type: String, default: 'Sẵn sàng' },
  image:         { type: String, default: '' },
  specs: {
    engine: { type: String, default: '125cc' },
    year:   { type: String, default: '2024' },
    fuel:   { type: String, default: 'Tiết kiệm xăng' }
  },
  perks:      { type: [String], default: ['2 Mũ bảo hiểm', 'Bảo hiểm chuyến đi'] },
  ownerEmail: { type: String, default: null }
}, { timestamps: true, collection: 'bikes' });

const Bike = mongoose.model('Bike', bikeSchema, 'bikes');

// 2.2 Schema & Model Tài Khoản -> LƯU VÀO MỤC "USES" THEO YÊU CẦU NGHIỆP VỤ
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  phone:     { type: String, required: true, unique: true, trim: true, index: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:  { type: String, required: true },
  role:      { type: String, enum: ['customer', 'owner'], required: true },
  shopName:  { type: String, default: null, trim: true },
  fleetSize: { type: String, default: null },
  address:   { type: String, default: null, trim: true }
}, { timestamps: true, collection: 'USES' }); // Luôn lưu vào collection 'USES'

const User = mongoose.model('User', userSchema, 'USES');

// 2.3 Schema & Model Đơn Thuê Xe (Collection: "bookings")
const bookingSchema = new mongoose.Schema({
  bookingId:     { type: String, required: true, unique: true, index: true },
  bikeId:        { type: String, required: true },
  bikeName:      { type: String, required: true },
  bikeImage:     { type: String, default: '' },
  customerName:  { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  customerEmail: { type: String, default: null, trim: true },
  pickupDate:    { type: String, required: true },
  returnDate:    { type: String, required: true },
  days:          { type: Number, default: 1, min: 1 },
  locationType:  { type: String, default: 'store' },
  totalPrice:    { type: Number, required: true, min: 0 },
  status:        { type: String, default: 'pending' }, // pending, approved, completed, cancelled
  selectedServices: [{
    title: { type: String },
    price: { type: Number, default: 0 }
  }],
  ownerEmail:    { type: String, default: null }
}, { timestamps: true, collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema, 'bookings');

// 2.4 Schema & Model Dịch Vụ Của Chủ Xe (Collection: "services")
const serviceSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price:       { type: Number, default: 0, min: 0 }, // Giá dịch vụ cộng thêm (VNĐ)
  icon:        { type: String, default: 'fa-solid fa-truck-fast' },
  ownerEmail:  { type: String, default: null }
}, { timestamps: true, collection: 'services' });

const Service = mongoose.model('Service', serviceSchema, 'services');

// --------------------------------------------------------------------------
// 3. KẾT NỐI MONGODB
// --------------------------------------------------------------------------
async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
      autoIndex: true
    });
    db.isMongoConnected = true;
    console.log(' Đã kết nối cơ sở dữ liệu MongoDB thành công (thue_xe_db)!');

    // Log số lượng bản ghi hiện có
    const [bikeCount, usesCount] = await Promise.all([
      Bike.countDocuments(),
      User.countDocuments()
    ]);
    console.log(` Hiện có ${bikeCount} xe máy trong MongoDB (collection: bikes).`);
    console.log(` Hiện có ${usesCount} tài khoản trong MongoDB (mục: USES).`);
  } catch (err) {
    db.isMongoConnected = false;
    console.warn(' Chưa kết nối được MongoDB service. Kích hoạt bộ nhớ đệm (In-memory Fallback).');
    console.warn('Chi tiết lỗi kết nối:', err.message);
  }
}

// --------------------------------------------------------------------------
// 6. XUẤT CÁC MODULE
// --------------------------------------------------------------------------
module.exports = {
  db,               // { isMongoConnected: bool } — luôn pass by reference
  memoryUsers,
  memoryBookings,
  Bike,
  User,
  Booking,
  Service,
  connectDatabase,
  mongoose          // để server.js dùng mongoose.connection.close() khi shutdown
};

