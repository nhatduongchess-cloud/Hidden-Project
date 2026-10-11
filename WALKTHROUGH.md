# RE prototype — three-minute walkthrough

Before presenting, click **Đặt lại demo** in the dark top bar, then **Khôi phục**, so everyone sees the
same seed: RE-001 is accepting, RE-002 has lost its connection, and RE-003 is full and has stopped.
Labels in bold are quoted as they appear on screen.

**0:00 – 0:20 · The idea (Website)**
"Trả chai PET. Nhận điểm. Theo dõi hành trình tái chế." Point at "Mô hình đề xuất · PCIC 2026" and the
pilot section's "Đã có / Chưa có" split: the design exists, the physical prototype and network do not.
Click **Trải nghiệm trả chai**.

**0:20 – 1:05 · Return a bottle (Ứng dụng trả chai)**
1. Click **Dùng trạm RE-001**, **Quét mã (mô phỏng)**, then **Đã đặt chai vào khe**. The station
   cutaway on the left runs check, flatten and drop. "Points are credited only after the drop sensor
   confirms the bottle is in the bin."
2. Click **Trả thêm chai**, choose **Còn nước** in the demo panel, and place it again:
   "Vui lòng đổ hết nước trước khi thử lại." Zero points.
3. Optional: turn off **Kết nối 4G với RE Hub**, return one bottle ("Giao dịch đang chờ đồng bộ."), then
   turn it back on to sync once.

**1:05 – 1:50 · Decide what to do (RE Hub → Tổng quan)**
Open **RE Hub**. "Cần xử lý" answers which station, why and what next: RE-003 has stopped at 95 %, and
RE-002's last reading is stale. Click **Lên lịch thu gom** on RE-003, then **Tạo yêu cầu và lập tuyến**.
On **Tuyến thu gom**, show the stop classes (Ưu tiên, Bắt buộc, Ghé thêm), the reason on each stop and
the comparison with the fixed-order baseline. The route is drawn on the road map; the line under the
plan says which routing service produced the times ("Đường thực tế · Valhalla" when online). Click
**Giao tuyến cho tài xế**.

**1:50 – 2:20 · Drive and swap the bin (Tài xế)**
Open **Tài xế** and click **Bắt đầu tuyến**. On the stop card click **Dẫn đường**, then **Bắt đầu**:
the banner shows the next turn, the bottom sheet the arrival time. Pick **×20** and **Tới chỗ rẽ** to
reach the station, then **Xác nhận thay thùng** and **Đã thay thùng**. Optional: the **Bản đồ** tab
ranks the remaining stations by driving time from the truck. Finish the other stops from **Tuyến** and
click **Kết thúc tuyến**. Back in RE Hub, RE-003 is accepting again and its history is kept.

**2:20 – 3:00 · Trace a batch (Nhãn hàng)**
In the RE Hub sidebar, switch **Xem với vai trò (demo)** to **Nhãn hàng**. Open **LO-0001**: five
stages, the weighed mass of the whole batch next to the brand's estimated share, and the missing
recycler document. Close it and click **Xuất tài liệu EPR**. "A support document for EPR reporting,
not a certificate. Nothing counts as recycled without the recycler's document."
