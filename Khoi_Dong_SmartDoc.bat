@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo                   SMARTDOC AUTOMATOR
echo ==============================================================
echo.

if not exist node_modules (
    echo [*] Lan dau tien khoi chay phan mem...
    echo [*] He thong dang tu dong tai cac thu vien can thiet. Vui long doi vai phut!
    call npm.cmd install
)

echo [*] Dang khoi dong he thong...
echo Xin DUNG dong cua so mau den nay trong suot qua trinh hien thi ung dung!
echo.

:: Tu dong mo trinh duyet 
start "" "http://localhost:5175"

:: Chay may chu
call npm.cmd run dev -- --port 5175

echo.
echo May chu da bi ngat ket noi!
pause
