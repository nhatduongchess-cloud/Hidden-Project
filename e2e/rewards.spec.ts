import { test, expect, Page } from '@playwright/test';

const password='REwards-password-2026';
async function register(page:Page){
  const email=`reward-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.getByRole('button',{name:'Chưa có tài khoản? Đăng ký'}).click();
  await page.getByLabel('Họ và tên',{exact:true}).fill('Minh Anh');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();
  await expect(page.getByText('Xin chào, Anh')).toBeVisible();
  return email;
}

test('register, redeem, persist wallet, logout and sign back in',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/'); const email=await register(page);
  await page.getByRole('tab',{name:'Đổi quà',exact:true}).click();
  await page.getByRole('button',{name:/Một ly cà phê, một ngày xanh, 450 điểm/}).click();
  await page.getByRole('button',{name:'Đổi quà · 450 điểm',exact:true}).click();
  await expect(page.getByText('Đổi quà thành công',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Mã đổi quà')).toHaveText(/^RE-[A-F0-9]{12}$/);
  await page.getByRole('button',{name:'Về Quà của tôi'}).click();
  await expect(page.getByRole('button',{name:/Xem mã quà Một ly/})).toBeVisible();
  await page.getByRole('tab',{name:'Điểm',exact:true}).click();
  await expect(page.getByText('800',{exact:true})).toBeVisible();
  await expect(page.getByText('-450',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('800',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Tài khoản',exact:true}).click();
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).last().click();
  await expect(page.getByText('Xin chào, Anh')).toBeVisible();
  await page.getByRole('tab',{name:'Quà của tôi',exact:true}).click();
  await expect(page.getByRole('button',{name:/Xem mã quà Một ly/})).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('catalog filters, insufficient points and profile editing on a phone',async({page})=>{
  await page.goto('/'); await register(page);
  await page.getByRole('tab',{name:'Đổi quà',exact:true}).click();
  await page.getByLabel('Tìm quà hoặc nhãn hàng').fill('binh nuoc');
  await expect(page.getByText('1 phần quà dành cho bạn')).toBeVisible();
  await page.getByRole('button',{name:/Bình nước đồng hành, 1.400 điểm/}).click();
  await expect(page.getByRole('button',{name:'Chưa đủ điểm'})).toBeDisabled();
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByRole('button',{name:'Xóa tìm kiếm',exact:true}).click();
  await expect(page.getByLabel('Tìm quà hoặc nhãn hàng')).toHaveValue('');
  await page.getByRole('button',{name:'Lá Studio',exact:true}).click();
  await expect(page.getByRole('button',{name:/Túi tote mang cả thế giới, 800 điểm/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Một ly cà phê, một ngày xanh, 450 điểm/})).toHaveCount(0);
  await page.getByRole('tab',{name:'Tài khoản',exact:true}).click();
  await page.getByRole('button',{name:'Thông tin cá nhân',exact:true}).click();
  await page.getByLabel('Họ và tên',{exact:true}).fill('An Nhiên');
  await page.getByLabel('Số điện thoại (không bắt buộc)').fill('0900000000');
  await page.getByRole('button',{name:'Lưu thông tin'}).click();
  await expect(page.getByText('An Nhiên',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('guest screens and recoverable connection errors',async({page})=>{
  await page.goto('/');
  await page.getByRole('tab',{name:'Quà của tôi',exact:true}).click();
  await expect(page.getByRole('button',{name:'Đăng nhập / Đăng ký'})).toBeVisible();
  await page.getByRole('tab',{name:'Trang chủ',exact:true}).click();
  await expect(page.getByText('Các tên nhãn hàng và ưu đãi hiện tại là mẫu, chưa đại diện cho đối tác đã ký kết.')).toBeVisible();
  await page.route('**/api/rewards/catalog',r=>r.abort());
  await page.reload();
  await expect(page.getByText('Không kết nối được dịch vụ RE. Kiểm tra mạng và thử lại.')).toBeVisible();
  await page.unroute('**/api/rewards/catalog');
  await page.getByRole('button',{name:'Tải lại dữ liệu'}).click();
  await expect(page.getByRole('button',{name:/Một ly cà phê, một ngày xanh, 450 điểm/})).toBeVisible();
});
