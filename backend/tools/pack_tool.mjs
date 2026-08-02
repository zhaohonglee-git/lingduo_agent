#!/usr/bin/env node
/**
 * 灵垛 Pack Tool — @cratefit/pack CLI 封装
 *
 * 用法: echo '<JSON>' | node pack_tool.mjs
 * 输入: JSON (stdin) — { action, ...params }
 * 输出: JSON (stdout) — 装箱结果
 *
 * 支持的操作:
 *   pack          — 通用装箱 (bins + items + options)
 *   packPallet    — 托盘码垛
 *   packContainer — 集装箱装载
 *   packTruck     — 卡车装载
 *   validate      — 验证装箱结果
 *   generateInstructions — 生成装箱指导
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// 找到 @cratefit/pack 的安装路径
function resolvePackModule() {
  const tries = [
    // 与 pack_tool.mjs 同目录的 pack-service/node_modules
    new URL("./pack-service/node_modules/@cratefit/pack/dist/index.js", import.meta.url).pathname,
    // 前端 node_modules
    new URL("../../../frontend/node_modules/@cratefit/pack/dist/index.js", import.meta.url).pathname,
  ];

  for (const path of tries) {
    try {
      readFileSync(path);
      return path;
    } catch {
      // 继续尝试
    }
  }
  throw new Error(
    "找不到 @cratefit/pack 模块。请先在 backend/tools/pack-service/ 下执行 npm install"
  );
}

const packModulePath = resolvePackModule();
const require_ = createRequire(import.meta.url);
// 动态加载 CJS 模块
const packModule = await import("node:module");
const mod = await import(packModulePath.replace("/dist/index.js", "/dist/index.cjs").replace(/\\/g, "/"));

// 使用 Node.js 的 CJS 兼容方式加载
const fsPath = await import("node:path");
const urlPath = await import("node:url");

// 直接用 createRequire 加载 @cratefit/pack 的 CJS 版本
const packRequire = createRequire(
  urlPath.pathToFileURL(
    fsPath.dirname(packModulePath)
  ).href + "/"
);

const {
  pack,
  packPallet,
  packContainer,
  packTruck,
  Packer,
  OnlinePacker,
  validatePackingResult,
  generateInstructions,
  PALLET_STANDARDS,
  CONTAINER_STANDARDS,
} = packRequire("@cratefit/pack");

/**
 * 读取 stdin 中的所有数据
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);

    // 处理管道关闭的情况
    if (process.stdin.isTTY) {
      resolve(data);
    }
  });
}

/**
 * 输出 JSON 结果
 */
function output(result) {
  process.stdout.write(JSON.stringify(result) + "\n");
}

function outputError(message, details) {
  process.stderr.write(JSON.stringify({ error: message, details }) + "\n");
  process.stdout.write(
    JSON.stringify({ success: false, error: message, details }) + "\n"
  );
}

/**
 * 将 DemoItem 风格（带 quantity）展开为 ItemSpec[]
 */
function expandItems(items) {
  const expanded = [];
  for (const item of items) {
    const qty = item.quantity || 1;
    for (let i = 0; i < qty; i++) {
      const { quantity, color, ...rest } = item;
      expanded.push({
        ...rest,
        id: qty > 1 ? `${item.id}-${i + 1}` : item.id,
      });
    }
  }
  return expanded;
}

// === 主逻辑 ===
try {
  const rawInput = await readStdin();

  if (!rawInput || rawInput.trim() === "") {
    outputError("没有输入数据");
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(rawInput);
  } catch {
    outputError("输入不是有效的 JSON");
    process.exit(1);
  }

  const { action, ...params } = input;
  let result;

  switch (action) {
    // === 通用装箱 ===
    case "pack": {
      const { bins, items, options } = params;

      if (!bins || !Array.isArray(bins) || bins.length === 0) {
        outputError("缺少 bins 参数（容器列表）");
        process.exit(1);
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        outputError("缺少 items 参数（物品列表）");
        process.exit(1);
      }

      // 检查 items 中是否有 quantity 字段，展开
      const hasQuantity = items.some((i) => typeof i.quantity === "number");
      const expandedItems = hasQuantity ? expandItems(items) : items;

      try {
        result = pack({ bins, items: expandedItems, options: options || {} });
        output({ success: true, data: result });
      } catch (err) {
        outputError("pack() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 托盘码垛 ===
    case "packPallet": {
      const {
        items: palletItems,
        palletSize,
        maxHeight,
        maxWeight,
        algorithm,
        packOptions,
        options: legacyOptions,
      } = params;

      if (!palletItems || !Array.isArray(palletItems) || palletItems.length === 0) {
        outputError("缺少 items 参数");
        process.exit(1);
      }

      const hasQuantity = palletItems.some((i) => typeof i.quantity === "number");
      const expandedItems = hasQuantity ? expandItems(palletItems) : palletItems;

      // 构建 PalletOptions
      const palletOpts = {};
      if (palletSize) palletOpts.palletSize = palletSize;
      if (maxHeight) palletOpts.maxHeight = maxHeight;
      if (maxWeight) palletOpts.maxWeight = maxWeight;
      if (algorithm) palletOpts.algorithm = algorithm;
      if (packOptions) palletOpts.packOptions = packOptions;

      // 兼容旧的 options 字段
      if (legacyOptions) {
        Object.assign(palletOpts, {
          maxHeight: legacyOptions.maxHeight || palletOpts.maxHeight,
          algorithm: legacyOptions.algorithm || palletOpts.algorithm,
        });
      }

      try {
        result = packPallet(expandedItems, palletOpts);
        output({ success: true, data: result });
      } catch (err) {
        outputError("packPallet() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 集装箱装载 ===
    case "packContainer": {
      const {
        items: containerItems,
        containerSize,
        maxWeight,
        loadingDirection,
        respectDeliveryOrder,
        algorithm,
        packOptions,
      } = params;

      if (!containerItems || !Array.isArray(containerItems) || containerItems.length === 0) {
        outputError("缺少 items 参数");
        process.exit(1);
      }

      const hasQuantity = containerItems.some((i) => typeof i.quantity === "number");
      const expandedItems = hasQuantity ? expandItems(containerItems) : containerItems;

      const containerOpts = {};
      if (containerSize) containerOpts.containerSize = containerSize;
      if (maxWeight !== undefined) containerOpts.maxWeight = maxWeight;
      if (loadingDirection) containerOpts.loadingDirection = loadingDirection;
      if (respectDeliveryOrder !== undefined) containerOpts.respectDeliveryOrder = respectDeliveryOrder;
      if (algorithm) containerOpts.algorithm = algorithm;
      if (packOptions) containerOpts.packOptions = packOptions;

      try {
        result = packContainer(expandedItems, containerOpts);
        output({ success: true, data: result });
      } catch (err) {
        outputError("packContainer() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 卡车装载 ===
    case "packTruck": {
      const {
        items: truckItems,
        truckSize,
        maxWeight,
        axleWeights,
        wheelbase,
        frontAxleOffset,
        algorithm,
        packOptions,
      } = params;

      if (!truckItems || !Array.isArray(truckItems) || truckItems.length === 0) {
        outputError("缺少 items 参数");
        process.exit(1);
      }
      if (!truckSize) {
        outputError("缺少 truckSize 参数");
        process.exit(1);
      }

      const hasQuantity = truckItems.some((i) => typeof i.quantity === "number");
      const expandedItems = hasQuantity ? expandItems(truckItems) : truckItems;

      const truckOpts = { truckSize };
      if (maxWeight !== undefined) truckOpts.maxWeight = maxWeight;
      if (axleWeights) truckOpts.axleWeights = axleWeights;
      if (wheelbase !== undefined) truckOpts.wheelbase = wheelbase;
      if (frontAxleOffset !== undefined) truckOpts.frontAxleOffset = frontAxleOffset;
      if (algorithm) truckOpts.algorithm = algorithm;
      if (packOptions) truckOpts.packOptions = packOptions;

      try {
        result = packTruck(expandedItems, truckOpts);
        output({ success: true, data: result });
      } catch (err) {
        outputError("packTruck() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 验证装箱结果 ===
    case "validate": {
      const { bin, packed, unpacked, originalItems, validationOptions } = params;

      if (!bin) {
        outputError("缺少 bin 参数");
        process.exit(1);
      }

      try {
        result = validatePackingResult(
          bin,
          packed || [],
          unpacked || [],
          originalItems || [],
          validationOptions
        );
        output({ success: true, data: result });
      } catch (err) {
        outputError("validatePackingResult() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 生成装箱指导 ===
    case "generateInstructions": {
      const { packResult, format, language, detailLevel, includeCoordinates, includeWeight } = params;

      if (!packResult) {
        outputError("缺少 packResult 参数");
        process.exit(1);
      }

      try {
        result = generateInstructions(packResult, {
          format: format || "markdown",
          language: language || "zh-TW",
          detailLevel: detailLevel || "detailed",
          includeCoordinates: includeCoordinates !== false,
          includeWeight: includeWeight !== false,
        });
        output({ success: true, data: result });
      } catch (err) {
        outputError("generateInstructions() 执行失败", err.message);
        process.exit(1);
      }
      break;
    }

    // === 获取托盘标准 ===
    case "palletStandards": {
      output({ success: true, data: PALLET_STANDARDS });
      break;
    }

    // === 获取集装箱标准 ===
    case "containerStandards": {
      output({ success: true, data: CONTAINER_STANDARDS });
      break;
    }

    default:
      outputError(`未知操作: ${action}。支持的操作: pack, packPallet, packContainer, packTruck, validate, generateInstructions, palletStandards, containerStandards`);
      process.exit(1);
  }
} catch (err) {
  outputError("未预期的错误", err.message);
  process.exit(1);
}
