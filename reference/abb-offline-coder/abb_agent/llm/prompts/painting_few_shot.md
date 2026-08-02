# 喷涂场景示例（Few-Shot）

下面是若干"需求→代码"对，用于让模型理解输出风格与喷涂常见做法。
所有示例中的 robtarget 坐标仅为占位，实际由现场示教。

---

## 示例 1：直线扫描喷涂

**需求**：从 P1 到 P2 沿直线喷涂，速度 v200，喷涂前先到位再开喷。

```rapid
MODULE PaintLine
    ! 直线扫描喷涂
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200,500,5000,1000];
    CONST robtarget P1 := [[500,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget P2 := [[500,500,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    PERS num nFlowRate := 80;       ! 流量百分比
    
    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        ! 高速到位
        MoveJ P1, v1000, fine, tSprayGun\WObj:=wobjPart;
        ! 开喷
        SetDO doSprayOn, 1;
        ! 喷涂段
        MoveL P2, vPaint, z1, tSprayGun\WObj:=wobjPart;
        ! 关喷
        SetDO doSprayOn, 0;
        ! 撤离
        MoveJ P1, v1000, z50, tSprayGun\WObj:=wobjPart;
    ENDPROC
ENDMODULE
```

---

## 示例 2：Z 字扫描（弓字喷涂）

**需求**：在 X 方向 500mm 宽、Y 方向 400mm 高的矩形面上做 Z 字扫描，行距 50mm，喷涂宽度约 100mm，速度 v150。

```rapid
MODULE PaintZigzag
    ! Z 字扫描喷涂 - 500x400 矩形面，行距 50mm
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [150,400,5000,1000];
    PERS num nRowSpacing := 50;
    PERS num nFlowRate := 80;
    PERS num nFanWidth := 100;
    
    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        VAR num i := 0;
        VAR num yPos := 0;
        VAR robtarget pStart;
        VAR robtarget pEnd;
        ! 起点高速到位
        MoveJ [[0,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v1000, fine, tSprayGun\WObj:=wobjPart;
        
        FOR i FROM 0 TO 8 DO
            yPos := i * nRowSpacing;
            ! 偶数行 X 正向，奇数行 X 负向
            IF i MOD 2 = 0 THEN
                pStart := [[0,yPos,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
                pEnd   := [[500,yPos,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
            ELSE
                pStart := [[500,yPos,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
                pEnd   := [[0,yPos,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
            ENDIF
            MoveL pStart, v500, fine, tSprayGun\WObj:=wobjPart;
            SetDO doSprayOn, 1;
            MoveL pEnd, vPaint, z1, tSprayGun\WObj:=wobjPart;
            SetDO doSprayOn, 0;
        ENDFOR
    ENDPROC
ENDMODULE
```

---

## 示例 3：TriggIO 精确同步喷涂

**需求**：从 P1 到 P2 直线运动中，距 P1 80mm 时开喷，距 P1 500mm 时关喷。要求精确（避免普通 SetDO 的通信延时）。

```rapid
MODULE PaintTrigSync
    ! TriggIO 精确同步喷枪开关
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200,500,5000,1000];
    CONST robtarget P1 := [[400,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget P2 := [[400,600,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    VAR triggdata trgSprayOn;
    VAR triggdata trgSprayOff;
    
    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        ! 配置触发：距起点 80mm 时 doSprayOn=1
        TriggIO trgSprayOn, 80 \DOp:=doSprayOn, 1;
        ! 距起点 500mm 时 doSprayOn=0
        TriggIO trgSprayOff, 500 \DOp:=doSprayOn, 0;
        MoveJ P1, v1000, fine, tSprayGun\WObj:=wobjPart;
        ! 同步直线运动：移动中按距离触发 IO
        TriggL P2, vPaint, trgSprayOn, z1, tSprayGun\WObj:=wobjPart;
        TriggL P2, vPaint, trgSprayOff, fine, tSprayGun\WObj:=wobjPart;
        ! 兜底关喷
        SetDO doSprayOn, 0;
    ENDPROC
ENDMODULE
```

---

## 示例 4：喷枪 TCP 校准程序

**需求**：写一个喷枪 TCP 校准程序，使用 4 点法。

```rapid
MODULE CalibSprayTCP
    ! 喷枪 TCP 校准 - 4 点法
    ! 操作步骤：
    !   1. 在工作区固定一根校准针（作为空间固定参考点）
    !   2. 通过示教器手动让喷枪嘴对准针尖，4 种不同姿态依次接触
    !   3. 每次到位后按示教器记录该位姿
    !   4. 4 点采集后控制器自动算出 TCP，写入 tSprayGun.tframe
    
    PERS tooldata tSprayGun := [TRUE,[[0,0,0],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    
    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        TPWrite "==== 喷枪 TCP 校准 (4 点法) ====";
        TPWrite "请在示教器中：";
        TPWrite "1. 把喷枪嘴对准固定参考针尖";
        TPWrite "2. 进入 \"Calibration > Define Tool\" 流程";
        TPWrite "3. 依次记录 4 个不同姿态的接触位姿";
        TPWrite "4. 校准结果自动写入 tSprayGun.tframe";
        WaitTime 2;
        TPWrite "完成后请验证 TCP 误差应 < 1mm";
    ENDPROC
ENDMODULE
```

---

## 示例 5：曲面圆弧喷涂

**需求**：沿圆弧轨迹喷涂，3 点定义圆弧（起点-中点-终点），速度 v200。

```rapid
MODULE PaintArc
    ! 圆弧轨迹喷涂
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200,500,5000,1000];
    CONST robtarget pStart := [[300,0,400],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget pMid   := [[400,200,350],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget pEnd   := [[300,400,400],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    
    PROC main()
        ConfL\Off;
        SingArea\Wrist;
        MoveJ pStart, v1000, fine, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 1;
        MoveC pMid, pEnd, vPaint, z1, tSprayGun\WObj:=wobjPart;
        SetDO doSprayOn, 0;
        MoveJ pStart, v1000, z50, tSprayGun\WObj:=wobjPart;
    ENDPROC
ENDMODULE
```

---

## 示例 6：参数化 Z 字扫描（FOR 循环复用版本）

**需求**：写一个 Z 字扫描过程，参数化幅宽 / 高度 / 行距，方便不同工件复用。

```rapid
MODULE PaintZigzagParam
    ! 参数化 Z 字扫描喷涂 - 接受任意矩形面尺寸
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    CONST speeddata vPaint := [200,500,5000,1000];
    
    ! 参数化喷涂过程：可被 main 多次调用
    PROC ZigzagPaint(num width, num height, num rowSpacing, num zHeight)
        VAR num i := 0;
        VAR num yPos := 0;
        VAR num numRows := 0;
        VAR robtarget pStart;
        VAR robtarget pEnd;
        
        numRows := Round(height / rowSpacing);
        ConfL\Off;
        SingArea\Wrist;
        
        FOR i FROM 0 TO numRows DO
            yPos := i * rowSpacing;
            IF i MOD 2 = 0 THEN
                pStart := [[0,yPos,zHeight],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
                pEnd   := [[width,yPos,zHeight],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
            ELSE
                pStart := [[width,yPos,zHeight],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
                pEnd   := [[0,yPos,zHeight],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
            ENDIF
            MoveL pStart, v500, fine, tSprayGun\WObj:=wobjPart;
            SetDO doSprayOn, 1;
            MoveL pEnd, vPaint, z1, tSprayGun\WObj:=wobjPart;
            SetDO doSprayOn, 0;
        ENDFOR
    ENDPROC
    
    PROC main()
        ! 例：500x400 矩形面，行距 50mm，距工件 300mm
        ZigzagPaint 500, 400, 50, 300;
    ENDPROC
ENDMODULE
```
