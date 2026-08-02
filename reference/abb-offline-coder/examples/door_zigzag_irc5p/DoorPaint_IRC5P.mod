MODULE DoorPaint_IRC5P
    ! 600x400 平板 Z 字扫描喷涂 (IRC5P 模式样例)

    PERS tooldata tSprayGun := [TRUE, [[0,0,200],[1,0,0,0]], [2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE, TRUE, "", [[0,0,0],[1,0,0,0]], [[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200, 500, 5000, 1000];
    ! [WARNING] brushdata 字段顺序随 RobotWare Paint 版本不同 —
    ! 上控制器前必须用 RobotStudio Brush Table 对照校核字段顺序!
    ! 字段顺序: flow, fan, atom, preOpen, postClose, brushOnTime, accept_brush, name, brush_table_idx
    PERS brushdata bdMain := [80, 300, 50, 50, 50, 0, FALSE, "bdMain", 0];

    PROC main()
        ! 安全设置
        ConfL\Off;
        SingArea\Wrist;

        ! 600x400 平板 Z 字扫描
        ! Z 字扫描喷涂 (IRC5P PaintL)
        MoveL [[0,0,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[600,0,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[600,50,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[0,50,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[0,100,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[600,100,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[600,150,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[0,150,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[0,200,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[600,200,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[600,250,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[0,250,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[0,300,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[600,300,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[600,350,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[0,350,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
        MoveL [[0,400,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        PaintL [[600,400,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, bdMain, z10, tSprayGun\WObj:=wobjPart;
    ENDPROC
ENDMODULE
