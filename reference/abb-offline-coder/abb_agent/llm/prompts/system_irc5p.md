## IRC5P (ABB Paint 选项) 额外约束

当前目标控制器是 **IRC5P**，必须使用 ABB Paint 工艺指令，禁止用 MoveL + SetDO 凑活实现喷涂。

### 必须遵守
1. **喷涂直线段**：用 `PaintL target, speed, brush, zone, tool\WObj:=wobj;`，不要用 `MoveL + SetDO`。
2. **喷涂圆弧段**：用 `PaintC pMid, pEnd, speed, brush, zone, tool\WObj:=wobj;`，不要用 `MoveC + SetDO`。
3. **工艺数据声明**：用 ABB 原生 `PERS brushdata bdXxx := [...]`，不要用 `PERS num` 替代。
4. **行间定位**：仍可使用 `MoveL` + `v500 fine`（不带 brushdata），用于「定位到下一段起点」而不喷漆。
5. **禁止 SetDO 切换喷涂主信号**：开关枪由 brushdata 内部时序（preOpen/postClose）自动管理。其他辅助 IO（如风机、雾化）可以保留 SetDO。

### brushdata 字段顺序（ABB RobotWare 5.x/6.x 通用）
```rapid
PERS brushdata bdMain := [
    80,         ! flow         流量 0-100
    300,        ! fan          扇幅 mm
    50,         ! atom         雾化压力 kPa
    50,         ! preOpen      喷枪提前开 ms
    50,         ! postClose    喷枪延迟关 ms
    0,          ! brushOnTime  保留
    FALSE,      ! accept_brush 保留
    "bdMain",   ! brush 名称
    0           ! brush_table_idx 控制器 Brush Table 索引
];
```

### IRC5P 输出范例
```rapid
MODULE PaintProgram
    PERS tooldata tSprayGun := [TRUE, [[12.5,0.3,287.6],[1,0,0,0]], [2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE, TRUE, "", [[100,0,0],[1,0,0,0]], [[0,0,0],[1,0,0,0]]];
    PERS brushdata bdMain := [80, 300, 50, 50, 50, 0, FALSE, "bdMain", 0];
    CONST speeddata vPaint := [200, 500, 5000, 1000];

    CONST robtarget pStart := [[500,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget pEnd := [[700,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        MoveL pStart, v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL pEnd, vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
    ENDPROC
ENDMODULE
```

### 现场标定提醒（务必在注释里给出）
- `tSprayGun` 的 TCP 需现场 4 点法标定，不能用占位值 [0,0,200]。
- `bdMain` 字段顺序可能因 RobotWare Paint 版本不同；上控制器前对照 RobotStudio Brush Table 校核。
