import { z } from "zod";

export const MeasurementMethod = z.enum([
    "ar_lidar_trace",
    "ar_lidar_auto",
    "ar_arcore_depth",
    "ar_arcore_tof",
    "reference_object",
    "manual",
]);
export type MeasurementMethod = z.infer<typeof MeasurementMethod>;

export const PolygonPoint = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
});
export type PolygonPoint = z.infer<typeof PolygonPoint>;

export const MeasurementInput = z.object({
    visit_id: z.string().uuid(),
    length_mm: z.number().min(0).max(2000),
    width_mm: z.number().min(0).max(2000),
    depth_mm: z.number().min(0).max(500).optional(),
    area_mm2: z.number().min(0),
    perimeter_mm: z.number().min(0),
    polygon_points: z.array(PolygonPoint).min(3),
    measurement_method: MeasurementMethod,
    confidence_score: z.number().min(0).max(1).optional(),
    device_model: z.string().optional(),
    os_version: z.string().optional(),
    ar_tracking_state: z.string().optional(),
});
export type MeasurementInput = z.infer<typeof MeasurementInput>;

// What the native AR module returns to React Native.
export const MeasurementResult = z.object({
    lengthMm: z.number(),
    widthMm: z.number(),
    depthMm: z.number().optional(),
    areaMm2: z.number(),
    perimeterMm: z.number(),
    polygonPoints: z.array(PolygonPoint),
    measurementMethod: MeasurementMethod,
    confidenceScore: z.number().min(0).max(1),
    photoUris: z.array(z.string()),
    deviceModel: z.string(),
    osVersion: z.string(),
    arTrackingState: z.string(),
});
export type MeasurementResult = z.infer<typeof MeasurementResult>;
