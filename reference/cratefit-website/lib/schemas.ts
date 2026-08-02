import { z } from "zod";

// Common dimension constraints
const DIMENSION_MIN = 0.001;
const DIMENSION_MAX = 100000;
const WEIGHT_MAX = 1000000;
const QUANTITY_MAX = 10000;
const ARRAY_MAX_LENGTH = 1000;

// Dimension schema (positive number with reasonable bounds)
const dimension = z.number().min(DIMENSION_MIN).max(DIMENSION_MAX);
const weight = z.number().min(0).max(WEIGHT_MAX).optional();
const quantity = z.number().int().min(1).max(QUANTITY_MAX).optional();

// Bin type enum (matches ContainerType from @cratefit/pack)
const binType = z
  .enum(["box", "pallet", "container", "truck", "shelf", "custom"])
  .default("box");

// AABB (Axis-Aligned Bounding Box) for exclude zones
const aabbSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minY: z.number(),
  maxY: z.number(),
  minZ: z.number(),
  maxZ: z.number(),
});

// Scenario constraints for specific container types
const scenarioConstraintsSchema = z.object({
  // Pallet constraints
  maxStackHeight: z.number().positive().optional(),
  overhangAllowed: z.boolean().optional(),
  palletPattern: z.enum(["column", "interlock"]).optional(),
  // Truck/container constraints
  axleWeights: z.object({
    front: z.number().min(0),
    rear: z.number().min(0),
  }).optional(),
  loadingDirection: z.enum(["rear", "side"]).optional(),
  // Shelf constraints
  shelfLevels: z.array(z.number().positive()).optional(),
  accessibility: z.enum(["fifo", "lifo", "random"]).optional(),
  // Logistics constraints
  maxGirth: z.number().positive().optional(),
  maxLinearDim: z.number().positive().optional(),
  volumetricDivisor: z.number().positive().optional(),
}).optional();

// Bin specification schema (enhanced)
export const binSpecSchema = z.object({
  id: z.string().min(1).max(256),
  type: binType,
  width: dimension,
  height: dimension,
  depth: dimension,
  maxWeight: weight,
  cost: z.number().min(0).optional(),
  quantity: quantity,
  excludeZones: z.array(aabbSchema).optional(),
  constraints: scenarioConstraintsSchema,
});

// Rotation mode for items
const rotationModeSchema = z.enum(["all", "horizontal", "fixed"]);

// Rotation type values (0-5 representing different orientations)
const rotationTypeValue = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

// Item specification schema (enhanced)
export const itemSpecSchema = z.object({
  id: z.string().min(1).max(256),
  width: dimension,
  height: dimension,
  depth: dimension,
  weight: weight,
  quantity: quantity,
  // Rotation settings
  rotationType: rotationModeSchema.optional(),
  allowedRotations: z.array(rotationTypeValue).optional(),
  // Stacking constraints
  maxStackWeight: weight,
  requiresFloor: z.boolean().optional(),
  requiresSupport: z.number().min(0).max(1).optional(),
  // Grouping and compatibility
  groupId: z.string().max(256).optional(),
  incompatibleWith: z.array(z.string().max(256)).optional(),
  // Delivery/priority
  deliveryOrder: z.number().int().min(0).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  // Metadata
  color: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Features configuration
const featuresSchema = z.object({
  supportCheck: z.boolean().optional(),
  weightBalance: z.boolean().optional(),
  stackingLimit: z.boolean().optional(),
}).optional();

// Constraints configuration
const constraintsSchema = z.object({
  respectDeliveryOrder: z.boolean().optional(),
  keepGroupsTogether: z.boolean().optional(),
  enforceIncompatibility: z.boolean().optional(),
}).optional();

// Optimization target
const optimizeSchema = z.object({
  target: z.enum(["space", "cost", "balanced"]).optional(),
}).optional();

// Pack options schema (enhanced to match full SDK)
export const packOptionsSchema = z
  .object({
    // Algorithm selection
    algorithm: z
      .enum(["extreme-point", "layer-building", "wall-building", "eb-afit"])
      .optional(),
    // Preprocessing and post-processing
    preprocessor: z.enum(["block-building", "none"]).optional(),
    enhancer: z.enum(["genetic", "simulated-annealing", "tabu-search", "none"]).optional(),
    // Bin selection strategy
    binSelection: z.enum(["first-fit", "best-fit", "spread"]).optional(),
    // Performance settings
    spatialIndex: z.enum(["naive", "octree"]).optional(),
    timeBudgetMs: z.number().int().min(100).max(60000).optional(),
    // Feature toggles
    features: featuresSchema,
    // Constraint enforcement
    constraints: constraintsSchema,
    // Optimization settings
    optimize: optimizeSchema,
    // Legacy options (kept for backwards compatibility)
    sortItems: z.boolean().optional(),
    sortBins: z.boolean().optional(),
    timeout: z.number().int().min(100).max(60000).optional(),
    maxIterations: z.number().int().min(1).max(100000).optional(),
  })
  .optional();

// Main pack request schema
export const packRequestSchema = z.object({
  bins: z.array(binSpecSchema).min(1).max(ARRAY_MAX_LENGTH),
  items: z.array(itemSpecSchema).min(1).max(ARRAY_MAX_LENGTH),
  options: packOptionsSchema,
});

// Online packing schemas
export const startRequestSchema = z.object({
  bin: binSpecSchema,
});

export const placeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  item: itemSpecSchema,
});

export const resetRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export const stateQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

// Type exports
export type PackRequest = z.infer<typeof packRequestSchema>;
export type StartRequest = z.infer<typeof startRequestSchema>;
export type PlaceRequest = z.infer<typeof placeRequestSchema>;
export type ResetRequest = z.infer<typeof resetRequestSchema>;
export type StateQuery = z.infer<typeof stateQuerySchema>;
