import { ZONES, type ZoneId } from '../../components/StationIllustration';
import type { IconName } from '../../components/icons';
import cutaway from '../../assets/cutaway-34.webp';
import sensors from '../../assets/fill-sensors.webp';
import binSwap from '../../assets/bin-swap.webp';
import lobby from '../../assets/station-lobby.webp';
import sectionAA from '../../assets/section-aa.webp';

/** The station's parts, as the explorer, the home page and the site search describe them. */
export interface ZoneInfo {
  name: string;
  icon: IconName;
  summary: string;
  facts: [string, string][];
  notes: string[];
  image?: { src: string; alt: string };
}

export const ZONE_INFO: Record<ZoneId, ZoneInfo> = {
  ui: {
    name: 'QR và màn hình',
    icon: 'qr',
    summary: 'Định danh người dùng và hướng dẫn từng bước. Khi trạm đầy hoặc có lỗi, màn hình nói rõ và không hiện mã QR.',
    facts: [
      ['Cao độ màn hình', '1.320 mm'],
      ['Thành phần', 'Màn hình cảm ứng, vùng quét QR, đèn trạng thái'],
      ['An toàn', 'Nút dừng khẩn cấp ở mặt trước'],
    ],
    notes: ['Người dùng quét mã trên màn hình bằng ứng dụng RE.'],
    image: { src: lobby, alt: 'Ảnh dựng: người dùng đứng trước màn hình trạm' },
  },
  inspection: {
    name: 'Khoang nhận diện',
    icon: 'camera',
    summary: 'Giữ đúng một chai trong khoang kín có đèn cố định. Camera, mã vạch và cân cùng quyết định nhận hay trả lại.',
    facts: [
      ['Cao độ khe nhận', '1.125 mm'],
      ['Cân', 'Load cell ≤ 1 kg dưới sàn rơi hai cánh'],
      ['Nhận diện', 'Camera + đèn LED, đầu đọc mã vạch, AI chạy tại trạm'],
    ],
    notes: ['Camera một mình không xác định chắc chắn loại nhựa; vì vậy luôn kết hợp mã vạch và cân.', 'Trường hợp không chắc chắn: trả chai lại cho người dùng.'],
    image: { src: sectionAA, alt: 'Mặt cắt A–A với khoang nhận diện ở giữa' },
  },
  flatten: {
    name: 'Rulo cán dẹt',
    icon: 'rollers',
    summary: 'Hai rulo có răng quay ngược chiều chọc thủng và cán dẹt chai. Rulo chỉ quay khi cửa ngoài đã đóng.',
    facts: [
      ['Khe cán', '15 mm'],
      ['Động cơ', '300 W, 40–50 Nm, ≈ 35 vòng/phút (chưa kiểm chứng)'],
      ['Xác nhận', 'Cảm biến xác nhận chai đã rơi qua rulo'],
    ],
    notes: ['Điểm chỉ được cộng sau tín hiệu xác nhận rơi, để chặn kiểu bỏ chai vào rồi rút ra.', 'Xử lý chai còn nắp là mục tiêu thiết kế, cần thử trên bàn trước.'],
    image: { src: cutaway, alt: 'Ảnh dựng cắt mở 3/4: cụm rulo kép phía trên thùng chứa' },
  },
  bin: {
    name: 'Thùng chứa tháo rời',
    icon: 'bin',
    summary: 'Một thùng xe đẩy nhận chai đã cán dẹt. Tài xế đổi thùng đầy lấy thùng rỗng tại trạm.',
    facts: [
      ['Thể tích', '≈ 0,24 m³'],
      ['Số thùng', 'Một thùng trong giai đoạn thí điểm'],
      ['Cửa', 'Có công tắc liên động'],
    ],
    notes: ['Không tách màu vật lý trong thí điểm. AI chỉ ghi loại chai (PET trong hoặc màu) vào dữ liệu.'],
    image: { src: binSwap, alt: 'Ảnh dựng: nhân viên kéo thùng chứa ra khỏi trạm' },
  },
  sensors: {
    name: 'Cảm biến mức đầy và khay hứng nước',
    icon: 'sensor',
    summary: 'Hai cảm biến siêu âm đo mức đầy thùng. Khay ở đáy hứng phần nước còn sót trong chai.',
    facts: [
      ['Cảm biến', '2 cảm biến siêu âm'],
      ['Ngưỡng', 'Cảnh báo 80 %, dừng nhận 95 %'],
      ['Khay', 'Hứng nước thừa; trạm không dùng nước'],
    ],
    notes: ['Ở 80 %, RE Hub đưa trạm vào danh sách cần thu gom. Ở 95 %, trạm tự dừng nhận.'],
    image: { src: sensors, alt: 'Ảnh dựng: hai chùm cảm biến siêu âm chiếu xuống thùng, vạch 80 % và 95 %' },
  },
};

export const NAMES = Object.fromEntries(ZONES.map((z) => [z, ZONE_INFO[z].name])) as Record<ZoneId, string>;
export const CUTAWAY_ONLY: ZoneId[] = ['flatten', 'sensors'];

export function isZone(id: string | undefined): id is ZoneId {
  return !!id && (ZONES as string[]).includes(id);
}
