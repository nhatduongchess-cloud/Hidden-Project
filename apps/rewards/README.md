# REwards

Ứng dụng đổi thưởng tiếng Việt bằng React Native + Expo, dùng chung mã nguồn iOS,
Android và bản xem trước trên web. Đây là ứng dụng dành cho thành viên, độc lập với
web vận hành RE Hub ở thư mục gốc.

## Chức năng đã có

- Đăng ký, đăng nhập, đăng xuất; hồ sơ, đổi mật khẩu và xóa tài khoản.
- Số dư điểm, lịch sử cộng/trừ điểm; dữ liệu lưu tại máy chủ.
- Tìm quà không dấu, lọc danh mục và nhãn hàng; chi tiết và điều kiện sử dụng.
- Đổi quà có kiểm tra điểm/tồn kho trong một giao dịch; gửi lại cùng yêu cầu không
  trừ điểm hai lần. Máy khách không tự cấp điểm hoặc quyết định giá đổi.
- Ví quà với mã riêng, hạn dùng, trạng thái còn dùng/đã dùng/hết hạn.
- API vận hành để cập nhật danh mục, cộng điểm từ giao dịch đã xác minh và xác nhận
  mã quà một lần; khóa vận hành không có trong app.
- Giao diện có trạng thái đang tải, lỗi kết nối, tải lại, kéo để làm mới và dữ liệu trống.

Danh mục ban đầu gồm 6 nhãn hàng giả định, quà mẫu và 1.250 điểm mẫu khi đăng ký.
Tên nhãn hàng không thể hiện quan hệ hợp tác thực tế; mã quà mẫu không có giá trị
thanh toán. App ghi rõ điều này tại danh mục, điều kiện và ví quà.

## Chạy bản xem trước đầy đủ

Yêu cầu Node.js phù hợp Expo SDK 58 và Python 3.12. Tại thư mục gốc repo:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r server/requirements.txt
```

Trong `apps/rewards`:

```powershell
npm ci
npm run export:web
```

Quay lại thư mục gốc repo:

```powershell
$env:REWARDS_STATIC_DIR = 'apps/rewards/dist'
$env:REWARDS_SAMPLE_DATA = '1'
.venv/Scripts/python.exe -m uvicorn server.rewards_app:create_app --factory --host 127.0.0.1 --port 8002
```

Mở http://127.0.0.1:8002 rồi tạo tài khoản. Dữ liệu mặc định nằm trong
`server/data/rewards`, được loại khỏi Git. Khi phát triển UI, chạy `npm run web`
trong thư mục app; cổng Expo 8081 tự kết nối API cổng 8002.

## Bản cài Android và iOS

Repo có cấu hình đóng gói, chưa chứa APK/IPA đã ký. Export bundle chỉ kiểm tra việc
biên dịch JavaScript/assets, không thay thế thử nghiệm native trên thiết bị.

1. Triển khai dịch vụ Python qua HTTPS, dùng ổ lưu dữ liệu bền vững. Điện thoại
   không truy cập được `127.0.0.1` của máy phát triển. GitHub Pages không chạy API này.
2. Trong `apps/rewards`, đăng nhập tài khoản Expo và liên kết dự án của bạn:
   `npx eas-cli@latest login`, sau đó `npx eas-cli@latest init`.
3. Tạo biến `EXPO_PUBLIC_API_URL` (ví dụ `https://YOUR-HOST/api/rewards`) trong
   môi trường EAS `preview` và `production`. Đây là URL công khai, không phải khóa.
   Có thể dùng `npx eas-cli@latest env:create --environment preview --name
   EXPO_PUBLIC_API_URL --value https://YOUR-HOST/api/rewards --visibility plaintext`.
   Thay host bằng máy chủ thật; làm tương tự cho production. Khi chạy cấu hình
   tại máy, đặt cùng biến môi trường trong terminal. App chặn EAS build thiếu URL HTTPS.
4. Kiểm tra định danh `com.rehub.rewards` trong `app.json` thuộc quyền quản lý của
   bạn trước khi phát hành. Không sửa định danh sau khi app đã lên store.
5. Đóng gói từ thư mục app:

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile simulator
npx eas-cli@latest build --platform all --profile production
```

`preview` Android tạo APK để cài thử. `simulator` iOS dùng với iOS Simulator trên
macOS, không cài lên iPhone. Bản iPhone nội bộ/TestFlight cần tài khoản Apple
Developer và cấu hình ký; bản Google Play cần tài khoản nhà phát triển tương ứng.
Chưa chạy build cloud hay đăng app lên store trong thay đổi này. Expo Go phải hỗ
trợ đúng SDK 58; nếu chưa có bản tương thích, dùng bản native từ EAS.

Nguồn: [EAS Build](https://docs.expo.dev/build/introduction/),
[APK Android](https://docs.expo.dev/build-reference/apk/),
[iOS Simulator](https://docs.expo.dev/build-reference/simulators/).

## Dịch vụ và dữ liệu thật

Các biến môi trường của API:

| Biến | Ý nghĩa |
| --- | --- |
| `REWARDS_DATA_DIR` | Thư mục SQLite và khóa nội bộ; mặc định `server/data/rewards` |
| `REWARDS_SAMPLE_DATA` | `1`: khởi tạo dữ liệu mẫu, cấp điểm mẫu; `0`: không cấp điểm ban đầu |
| `REWARDS_OPERATOR_KEY` | Khóa bí mật tối thiểu 24 ký tự, chỉ dùng phía máy chủ vận hành |
| `REWARDS_ALLOWED_ORIGINS` | Các origin web được phép, ngăn cách bằng dấu phẩy |
| `REWARDS_STATIC_DIR` | Thư mục web export nếu API phục vụ cả giao diện |

**Khi chuyển sang dữ liệu thật, dùng thư mục dữ liệu mới với
`REWARDS_SAMPLE_DATA=0`.** Đổi biến không xóa hoặc chuyển đổi số điểm/quà mẫu đã lưu.
Không chuyển DB thử nghiệm thành số dư thật. Sau đó nhập danh mục đã được đối tác
xác nhận với `sample=false` và đúng điều kiện sử dụng. Sao lưu SQLite bằng SQLite
backup API, không sao chép riêng file DB khi WAL đang ghi.

Tất cả đường dẫn dưới đây có tiền tố `/api/rewards`. API thành viên dùng
`Authorization: Bearer <session-token>`; API vận hành dùng khóa vận hành qua cùng
header. Không đưa khóa này vào biến `EXPO_PUBLIC_*`, mã client hoặc Git.

| Phương thức / đường dẫn | Nội dung |
| --- | --- |
| POST `/auth/register`, `/auth/login`, `/auth/logout` | Tài khoản và phiên đăng nhập |
| GET/PATCH/DELETE `/me` | Hồ sơ và xóa tài khoản (xóa yêu cầu mật khẩu) |
| POST `/me/password` | Đổi mật khẩu, thu hồi mọi phiên |
| GET `/catalog`, `/ledger`, `/wallet` | Danh mục công khai, điểm và ví của chính thành viên |
| POST `/redeem` | `{reward_id, request_id}`; UUID mới cho mỗi lần đổi có chủ đích |
| POST `/operator/credit` | `{user_id, reference, points, description}`; reference giao dịch duy nhất |
| POST `/operator/catalog` | Upsert quà theo schema `RewardInput` trong `server/rewards_app.py` |
| POST `/operator/use/{code}` | Đánh dấu mã đã sử dụng, kiểm tra hạn và chống dùng lại |

Mật khẩu được băm scrypt có salt; máy chủ chỉ lưu hash token, phiên có hạn 30 ngày.
Native lưu token trong SecureStore; web dùng sessionStorage. Xóa tài khoản xóa hồ
sơ, điểm, ví và phiên. Chưa tích hợp email xác minh/khôi phục mật khẩu, cổng đối tác
hay trạm trả chai thật. Adapter trạm cần xác minh giao dịch rồi gọi API cộng điểm;
không gửi điểm tự khai từ điện thoại. Chính sách quyền riêng tư trong app mô tả
đúng dữ liệu đang lưu, nhưng đơn vị vận hành cần bổ sung thông tin liên hệ thực tế
trước khi công bố.

Khi triển khai, đặt API sau HTTPS reverse proxy có giới hạn body và rate limit;
chỉ tin proxy headers từ proxy của mình. Giới hạn đăng nhập hiện tại nằm trong bộ
nhớ từng tiến trình. SQLite phù hợp một máy chủ, cần DB dùng chung nếu mở rộng nhiều
máy. Không bật quyền truy cập Internet cho máy phát triển làm dịch vụ chính thức.

## Kiểm tra

Trong `apps/rewards`: `npm run lint`, `npm run typecheck`, `npx expo install --check`,
`npx expo export --platform all`.

Tại gốc repo sau khi export web và cài phụ thuộc gốc:

```powershell
.venv/Scripts/python.exe -m pytest server/test_rewards.py -q
npx playwright test --config playwright.rewards.config.ts
```

Kiểm thử trình duyệt dùng DB tạm độc lập, không sửa tài khoản xem trước. Bộ test
bao gồm đổi đồng thời, chống đổi/cộng trùng, quyền truy cập, đổi mật khẩu, xóa tài
khoản, khôi phục phiên, lọc quà, số dư không đủ và lỗi kết nối.

Kiểm tra phụ thuộc ngày 22/10/2026: `npm audit` báo 19 mục mức high lan truyền từ
`braces` và `node-forge` trong chuỗi công cụ Expo/Metro. Phiên bản mới nhất của hai
gói lúc kiểm tra vẫn nằm trong phạm vi cảnh báo. Không dùng `npm audit fix --force`
vì đề xuất hạ Expo xuống SDK 44, phá tương thích. Cần theo dõi và cập nhật bản vá
trước phát hành; không coi kết quả export/test là chứng nhận bảo mật.
Tham chiếu [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) và
[node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
