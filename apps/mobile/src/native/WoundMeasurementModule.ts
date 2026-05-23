// TypeScript bridge to the native AR measurement module.
// iOS implementation: apps/mobile/modules/ios/WoundMeasurementModule
// Android implementation: apps/mobile/modules/android/WoundMeasurementModule
//
// Both platforms return the same MeasurementResult shape so app code is
// platform-agnostic.

import { Platform } from "react-native";
import { MeasurementResult } from "@agile/shared";
import { NativeModules } from "react-native";

interface NativeBridge {
    measureWound(): Promise<MeasurementResult>;
    isDepthSupported(): Promise<boolean>;
    /**
     * iOS: returns true if device has LiDAR (iPhone 12 Pro+ / iPad Pro 2020+).
     * Android: returns true if device has ToF sensor (rare).
     */
    hasDedicatedDepthSensor(): Promise<boolean>;
}

const Native = NativeModules.WoundMeasurementModule as NativeBridge | undefined;

export const WoundMeasurement = {
    async measureWound(): Promise<MeasurementResult> {
        if (!Native) {
            throw new Error(
                `WoundMeasurementModule native module not linked. Run "pnpm expo prebuild" and rebuild the dev client.`,
            );
        }
        const raw = await Native.measureWound();
        return MeasurementResult.parse(raw);
    },

    async isDepthSupported(): Promise<boolean> {
        if (!Native) return false;
        return Native.isDepthSupported();
    },

    async hasDedicatedDepthSensor(): Promise<boolean> {
        if (!Native) return false;
        return Native.hasDedicatedDepthSensor();
    },

    platform: Platform.OS as "ios" | "android",
};
