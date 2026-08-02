MODULE DoorPaint_IRC5
    ! 600x400 平板 Z 字扫描喷涂 (IRC5 模式样例)

    PERS tooldata tSprayGun := [TRUE, [[0,0,200],[1,0,0,0]], [2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE, TRUE, "", [[0,0,0],[1,0,0,0]], [[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200, 500, 5000, 1000];

    PROC main()
        ! 安全设置
        ConfL\Off;
        SingArea\Wrist;

        ! 600x400 平板 Z 字扫描
        ! Z 字扫描喷涂
        MoveL [[0,0,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[600,0,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[600,50,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[0,50,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[0,100,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[600,100,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[600,150,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[0,150,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[0,200,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[600,200,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[600,250,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[0,250,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[0,300,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[600,300,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[600,350,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[0,350,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveL [[0,400,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v500, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveL [[600,400,300],[1.0,0.0,0.0,0.0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], vPaint, z10, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
    ENDPROC
ENDMODULE
