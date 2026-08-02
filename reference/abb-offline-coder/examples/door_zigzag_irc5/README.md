# 加载到 IRC5 控制器的三种方式

本目录包含以下文件，需要全部传到控制器：
- `DoorPaint_IRC5.mod` — 主程序模块
- `BASE.sys` — 系统模块（Home 位 + 错误处理）
- `T_ROB1.pgf` — 任务程序清单，控制器据此加载模块

---

## 方式 1：RobotStudio（推荐）
1. RobotStudio → File → New → Solution with Empty Station
2. Add Controller → Virtual Controller → 选含 IRC5 对应 RobotWare 的系统
3. 把整个本目录拖入 Controller → T_ROB1 → Modules
4. 右键 `T_ROB1` → Load Program → 选 `T_ROB1.pgf`
5. 验证编译通过后，**Pack & Go**：File → Pack & Go → 选目标文件夹
6. 把生成的 `.rspag` 文件拷到 U 盘，在真实控制器 FlexPendant → Backup and Restore → Restore from .rspag

## 方式 2：FlexPendant 直接加载
1. 把本目录拷到 U 盘根目录
2. 控制器插入 U 盘
3. FlexPendant → Program Editor → File → Open → 选 USB:/T_ROB1.pgf
4. 提示「替换当前程序」时确认

## 方式 3：FTP / 网络共享
1. 控制器 IP 通常是 192.168.125.1（默认）
2. `ftp 192.168.125.1` 登入（用户 / 密码见控制器铭牌）
3. `cd /HOME` → `put DoorPaint_IRC5.mod` → `put BASE.sys` → `put T_ROB1.pgf`
4. 在 FlexPendant 上 Reload

---

## 上线前必做的 4 件事
1. **TCP 标定**：用 4 点法重新标定 `tSprayGun`，把结果填到 `DoorPaint_IRC5.mod` 顶部
2. **工件坐标系**：把 `wobjPart` 改成实际工件位姿
3. **IO 名称对齐**：用 RobotStudio 打开 EIO.cfg，把代码中的 `doSprayOn` 等改成实际信号名
4. **手动 T1 慢速验证**：示教器切手动模式 250mm/s，单步执行 main()，目视确认每点不撞机
