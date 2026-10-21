# Đội xe OR-Tools và GPS trực tiếp

Mở **RE Hub → Đội xe trực tiếp** (`#hub-fleet`). Dịch vụ dùng OR-Tools thật;
không gọi heuristic một xe của trang cũ. Tối đa 10 xe và 30 trạm mỗi lần tính.

## Chạy trên Windows

Yêu cầu Node.js, Python 3.12 và mạng để lấy dữ liệu đường.
Trong thư mục gốc repo, mở hai terminal:

```powershell
# Terminal 1: tạo môi trường, cài phiên bản đã khóa và chạy API ở 127.0.0.1:8000
powershell -ExecutionPolicy Bypass -File server/run.ps1
```

```powershell
# Terminal 2
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Mở http://127.0.0.1:5173/#hub-fleet. Script bật `FLEET_DEV=1` để cấp phiên điều phối
cho trình duyệt chạy trên chính máy này. Endpoint cấp phiên kiểm tra peer, Host,
Origin và từ chối header chuyển tiếp. Không bật chế độ này trên máy phục vụ từ xa.
Khóa tự sinh ở `server/data/operator.key`, không đưa vào Git.

Linux/macOS: `python3.12 -m venv .venv`, kích hoạt venv, `pip install -r server/requirements.txt`,
rồi chạy `FLEET_DEV=1 uvicorn server.app:create_app --factory --host 127.0.0.1 --port 8000`.

## Thử quy trình

1. Khai báo xe, người lái, tải trọng, thể tích và ca (giờ Việt Nam, cùng ngày).
2. Nhập thời gian thay thùng, khoảng dự báo và khoảng cấm chạy nếu có.
3. **Tối ưu nhiều xe** → kiểm tra trạm, giờ đến, tải xe và nguồn bản đồ.
4. **Giao tuyến** → sao chép liên kết riêng cho từng xe. Ứng dụng không tự gửi tin nhắn.
5. Tài xế mở liên kết, bấm **Bật chia sẻ vị trí** và cho phép GPS. RE Hub nhận cập nhật
   qua WebSocket. Xác nhận thu gom cập nhật tiến độ trên máy chủ.
6. Tài xế có thể dừng GPS, hoàn tất chuyến; điều phối viên có thể kết thúc đợt để thu hồi
   toàn bộ liên kết và xóa vị trí cuối đang lưu. Cấp liên kết mới sẽ thu hồi liên kết cũ của xe đó.

Liên kết có hiệu lực 24 giờ, chỉ đọc tuyến xe được giao và ghi GPS/tiến độ cho xe đó.
Khóa điều phối có quyền xem toàn đội và giao tuyến. Khóa lưu trong sessionStorage của
tab; hash liên kết tài xế được xóa khỏi thanh địa chỉ sau khi nhận. Máy chủ lưu hash token,
không lưu token tài xế dạng rõ. WebSocket xác thực bằng thông điệp đầu tiên, không đưa khóa
vào query URL. Không có endpoint GPS công khai, CORS mở hoặc dữ liệu vị trí trong log truy cập.

## Dùng trên điện thoại thật

`127.0.0.1` trên điện thoại là chính điện thoại. Cần triển khai cùng frontend/API trên một
địa chỉ **HTTPS** mà điện thoại truy cập được. `watchPosition` yêu cầu secure context và
quyền vị trí; ứng dụng web không bảo đảm GPS khi khóa màn hình hoặc chạy nền.

- Build frontend: `npm run build`.
- Đặt `FLEET_STATIC_DIR=dist`, `FLEET_DEV=0`, `FLEET_DATA_DIR` tới thư mục dữ liệu bền vững.
- Đặt `FLEET_OPERATOR_KEY` bằng chuỗi ngẫu nhiên bí mật ít nhất 24 ký tự, hoặc dùng khóa tự sinh.
  Chỉ quản trị viên/điều phối viên được biết khóa này. Nhập khóa ở màn hình kết nối.
- Chạy Uvicorn **một worker** sau reverse proxy TLS; chuyển tiếp WebSocket `/api/live`.
  Giới hạn kích thước body (2 MB) và rate limit tại reverse proxy. Không công khai cổng API riêng.
- Vite chỉ phục vụ phát triển. GitHub Pages chỉ chứa file tĩnh nên không chạy được dịch vụ Python.
- Dockerfile tùy chọn: `docker build -f server/Dockerfile -t re-fleet .`; mount `/app/data`,
  cung cấp secret qua môi trường và đặt sau proxy HTTPS. Dockerfile chưa được kiểm thử build
  trên môi trường Windows hiện tại; quy trình Python/Vite đã được kiểm thử.

Một worker là giới hạn có chủ ý: SQLite giữ kế hoạch, token hash và vị trí cuối; luồng
WebSocket và phương án nháp nằm trong bộ nhớ của tiến trình. Muốn nhiều worker cần chuyển
pub/sub và khóa điều phối sang dịch vụ dùng chung. Không dùng `--workers 2` với bản này.

## Ràng buộc và cách đọc kết quả

- Hai chiều tải độc lập: khối lượng làm tròn lên gram, thể tích làm tròn lên cm³ theo hệ số
  1.000.000 trên m³; tải xe làm tròn xuống. Mỗi trạm chiếm thể tích một thùng.
- Trạm ≥ ngưỡng cảnh báo hoặc dự báo đạt ngưỡng là bắt buộc. Trạm ≥ ngưỡng dừng là bắt buộc
  và có phạt phục vụ muộn trong hàm mục tiêu (100 đơn vị khoảng cách/phút).
- Trạm 50–60% là tùy chọn: phạt bỏ điểm tương đương 2 km để ưu tiên điểm gần tuyến.
  Đây là ngưỡng chi phí trong mục tiêu tổng, không phải chứng minh mọi detour riêng lẻ ≤2 km.
- Xe xuất phát từ bãi chung, kết thúc ở điểm tiếp nhận chung; xe không sử dụng ở lại bãi.
  Ghé trạm và thay thùng phải hoàn tất trong giờ mở cửa, tới điểm cuối trước hết ca.
- Khoảng cấm áp dụng bảo thủ cho mọi chặng của mọi xe, kể cả chặng về. Cho phép chờ trước
  khi chạy; không phải cơ sở dữ liệu quy định giao thông theo từng đường.
- Ma trận có hướng lấy từ Valhalla/OSRM; ô null là không đi được. Dữ liệu đường thẳng chỉ
  dùng xem trước và bị chặn giao tuyến cả phía giao diện lẫn máy chủ. OSRM là profile ô tô,
  UI nhắc kiểm tra hạn chế xe tải. Không mô hình hóa tắc đường trực tiếp.
- OR-Tools tìm kiếm tối đa 3 giây sau khi dựng mô hình; kết quả có thể khả thi mà chưa tối ưu
  toàn cục. Không tìm được lời giải không tự động có nghĩa đã chứng minh vô nghiệm.
- Phương án nháp hết hạn sau 15 phút. Không ghi đè đợt đang hoạt động; yêu cầu revision để
  tránh hai điều phối viên cùng giao tuyến dựa trên trạng thái cũ.
- Kế hoạch chụp lại dữ liệu trạm đang có ở trình duyệt lúc tính. Hiện trạm/giao dịch vẫn là
  dữ liệu demo. GPS thật và tiến độ lưu trên máy chủ không tự biến thành chứng từ EPR,
  không tự reset thùng demo hoặc cập nhật KPI cân thực tế của luồng một xe cũ.

## GPS và mất kết nối

Tài xế chủ động bật/tắt. Chỉ giữ fix mới nhất chờ gửi, tối đa một request đang gửi, cách
nhau ít nhất 5 giây; không tích lũy lịch sử vị trí offline. Sau 30 giây không có fix mới,
Hub hiển thị mất tín hiệu; khi WebSocket mất kết nối, Hub không gắn nhãn vị trí là trực tiếp.
WebSocket tự thử lại 1–15 giây và nhận snapshot đầy đủ sau kết nối lại.
Máy chủ kiểm tra tọa độ, độ chính xác, timestamp, từ chối fix lùi thời gian, quá cũ (>120 giây)
hoặc quá xa trong tương lai (>30 giây). Đồng hồ điện thoại cần đồng bộ.

Chỉ vị trí cuối được ghi SQLite; dừng chia sẻ giữ vị trí cuối với trạng thái đã dừng,
hoàn tất chuyến/xóa đợt xóa vị trí. Khởi động lại dịch vụ không nhận nhầm vị trí cũ là đang
chia sẻ. Dữ liệu điều phối và vị trí không bị xóa bởi nút “Đặt lại demo” của frontend.

## Kiểm thử

```powershell
.venv/Scripts/python.exe -m pytest server -q
npm test
npm run build
npm run test:fleet
```

Kiểm thử trình duyệt mở API/preview riêng trên 8001/4175 và cơ sở dữ liệu tạm, dùng GPS
giả lập trong trình duyệt kiểm thử, không lấy vị trí của người đang dùng ứng dụng.
Máy chủ OR-Tools và WebSocket là thật; chỉ dịch vụ đường/bản đồ ngoài được thay bằng fixture.

Tham khảo: [OR-Tools CVRPTW](https://developers.google.com/optimization/routing/vrptw),
[capacity dimensions](https://developers.google.com/optimization/routing/cvrp),
[FastAPI WebSocket](https://fastapi.tiangolo.com/advanced/websockets/),
[Geolocation watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
