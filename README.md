# RE Hub

Ứng dụng thành viên iOS/Android **REwards** nằm tại [`apps/rewards`](apps/rewards/README.md):
đăng nhập, điểm thưởng, danh mục đổi quà và ví quà với dịch vụ lưu trữ riêng.

Web quản lý vận hành thu gom, giao diện tiếng Việt. Mở ứng dụng là vào Tổng quan;
không còn trang giới thiệu dự án, thiết kế máy, ứng dụng trả chai hoặc thanh chuyển bản mẫu.
Các URL cũ như `#home`, `#pilot`, `#design`, `#app-return` chuyển về `#hub`.

## Chức năng

| Chức năng | Đường dẫn | Nội dung |
|---|---|---|
| Tổng quan | `#hub` | Trạng thái mạng lưới, cảnh báo, bản đồ, xu hướng và việc cần xử lý |
| Bản đồ trạm | `#hub-map` | Vị trí, mã trạm, trạng thái, mức đầy; tìm kiếm và lọc |
| Quản lý trạm | `#hub-stations` | Danh sách, số liệu từng trạm, yêu cầu bảo trì và thu gom |
| Số lượng thu gom | `#hub-analytics` | Chai/kg theo trạm, ngày, loại chai, nhãn hàng; biểu đồ và CSV |
| Dự báo mức đầy | `#hub-forecasts` | Dự báo theo lịch sử, giờ/ngày, kịch bản nhu cầu; thời điểm đạt ngưỡng |
| Đội xe trực tiếp | `#hub-fleet` | OR-Tools nhiều xe, tải trọng/thể tích, ca, giờ mở cửa/cấm chạy; giao tuyến, GPS |
| Tuyến thu gom | `#hub-routes` | Lập và so sánh tuyến một xe; giao tuyến và xác nhận thay thùng |
| Báo cáo EPR | `#hub-trace` | Vật liệu theo nhãn hàng, phiếu cân, tài liệu tái chế và xuất báo cáo hỗ trợ |
| KPI | `#hub-kpis` | Đồng/kg, kg/km, mức đầy khi lấy, giờ trạm đầy, tỷ lệ từ chối |
| Giao dịch | `#hub-transactions` | Lọc và tra cứu các lượt nhận chai |
| Cài đặt | `#hub-settings` | Thông số trạm, khung giờ, vị trí, phạm vi và quản lý dữ liệu mẫu |

Màn hình tài xế là một phần của luồng vận hành: `#driver`, `#driver-map`,
`#driver-nav-RE-003`. Đội xe nhiều xe dùng liên kết riêng `#driver-live-<token>`
do điều phối viên cấp, không cần đi qua trang giới thiệu.

## Chạy tại máy

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Mở http://127.0.0.1:5173/. Để dùng tối ưu nhiều xe và GPS, chạy thêm terminal thứ hai
(với Python 3.12 đã cài):

```powershell
powershell -ExecutionPolicy Bypass -File server/run.ps1
```

Xem [hướng dẫn dịch vụ đội xe](server/README.md) cho cấu hình, quyền truy cập,
luồng tài xế và triển khai HTTPS trên điện thoại. GitHub Pages chỉ phục vụ phần web tĩnh;
OR-Tools, SQLite và WebSocket cần dịch vụ Python.

## Dữ liệu và nguồn bản đồ

Dữ liệu trạm/giao dịch ban đầu là dữ liệu mẫu lưu trong trình duyệt. Vị trí và tiến độ
đội xe được chia sẻ qua máy chủ; GPS chỉ gửi sau khi tài xế bật chia sẻ. Xác nhận tiến độ
đội xe không tự tạo phiếu cân hoặc bằng chứng EPR. Nhãn dữ liệu mẫu, số liệu ước tính và
chứng từ còn thiếu được giữ trong các màn hình liên quan.

Bản đồ dùng OpenStreetMap; định tuyến ưu tiên Valhalla với profile xe tải nhỏ, sau đó
OSRM profile ô tô. Khi không lấy được đường thực, hiển thị ước tính và không cho giao tuyến
nhiều xe. Dịch vụ bản đồ công cộng có giới hạn sử dụng. Tham khảo
[chi tiết vận hành](OPERATIONS.md) và [hướng dẫn kiểm tra](WALKTHROUGH.md).

## Kiểm tra và build

```powershell
npm test
npm run build
$env:PW_CHANNEL='chrome'
npm run test:e2e
.venv/Scripts/python.exe -m pytest server -q
npm run test:fleet
```

Kiểm thử trình duyệt dùng bản đồ và GPS giả lập. Bộ kiểm thử đội xe chạy API, OR-Tools,
SQLite và WebSocket thật trong môi trường riêng. `npm run build` tạo web trong `dist/`.
