# SmartDoc Automator

Ứng dụng web cục bộ giúp tự động hóa việc tạo hàng loạt file Word và xuất bản nháp Email (draft) bằng cách tích hợp trực tiếp dữ liệu từ Excel (.xlsx, .csv) vào các file mẫu (Template). 
Toàn bộ quy trình xử lý dữ liệu và tạo file đều diễn ra trên trình duyệt (Local), không gửi dữ liệu ra máy chủ bên ngoài, đảm bảo an toàn thông tin 100%.

## 🚀 Hướng Dẫn Cài Đặt và Chạy Ứng Dụng

Ứng dụng này được xây dựng trên nền tảng **React (Vite)** và **Node.js**. Để chạy phần mềm trên máy tính của bạn, vui lòng làm theo các bước sau:

### Bước 1: Yêu cầu hệ thống
Bạn cần cài đặt **Node.js** trước khi chạy ứng dụng.
- Tải và cài đặt Node.js tại trang chủ: [https://nodejs.org/](https://nodejs.org/) (Chọn bản LTS).
- Mở Terminal (Command Prompt hoặc PowerShell) và gõ lệnh sau để kiểm tra xem tải thành công chưa:
  ```bash
  node -v
  npm -v
  ```

### Bước 2: Tải các thư viện cần thiết
Tại thư mục gốc của dự án (thư mục chứa file `package.json`), mở Terminal/Command Prompt và chạy lệnh sau để tải các thư viện:
```bash
npm install
```

### Bước 3: Chạy ứng dụng (Chế độ phát triển)
Sau khi tải thư viện thành công, khởi động ứng dụng bằng lệnh:
```bash
npm run dev
```
Terminal sẽ hiển thị một đường dẫn cục bộ (ví dụ: `http://localhost:5173/`). Bạn hãy copy hoặc giữ phím `Ctrl` + Click vào đường dẫn đó để mở ứng dụng trên trình duyệt.

## 📦 Xuất Bản Ứng Dụng (Tùy chọn)

Nếu bạn muốn đóng gói ứng dụng lại cho môi trường production (tối ưu hóa tốc độ, đóng gói file), hãy dùng lệnh:
```bash
npm run build
```
Kết quả đóng gói sẽ nằm trong thư mục `dist/`. Bạn có thể chạy thử bản build bằng lệnh:
```bash
npm run preview
```

---
## ⚠️ Xử lý lỗi thường gặp (Đặc biệt trên máy Công ty)

**1. Lỗi: "npm.ps1 cannot be loaded because running scripts is disabled..."**
Lỗi này xảy ra do máy tính công ty bạn chặn chạy mã script trên PowerShell. Có 2 cách khắc phục cực nhanh:
- **Cách 1 (Khuyên dùng):** Không dùng PowerShell nữa. Hãy gõ chữ `cmd` vào thanh địa chỉ của thư mục dự án rồi nhấn Enter để mở **Command Prompt (CMD)**, sau đó gõ lệnh `npm run dev` như bình thường.
- **Cách 2:** Thay vì gõ `npm`, hãy gõ thêm đuôi `.cmd`. Cụ thể: 
  `npm.cmd install` 
  `npm.cmd run dev`

**2. Lỗi "ENOENT: no such file or directory, open '.../package.json'"**
Lỗi này là do bạn đang đứng sai thư mục (chưa vào trong thư mục `SmartDocAutomator`). 
Hãy gõ lệnh `cd SmartDocAutomator` để đi vào đúng thư mục dự án trước khi chạy lệnh `npm`.

---
**💡 Mẹo**:
- Để thoát ứng dụng đang chạy trong Terminal, nhấn `Ctrl + C` và chọn `Y` (Yes).
- Mỗi khi cần làm việc, chỉ cần mở Terminal tại thư mục này và gõ lại lệnh `npm run dev` (hoặc `npm.cmd run dev`).
