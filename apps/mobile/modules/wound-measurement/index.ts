// Expo Modules API bridge to the native wound-measurement implementations.
// iOS: modules/wound-measurement/ios/  (ARKit + LiDAR)
// Android: modules/wound-measurement/android/ (ARCore Depth API — next sprint)

import { requireNativeModule, NativeModulesProxy } from "expo-modules-core";
import { MeasurementResult } from "@agile/shared";
import { Platform } from "react-native";

interface WoundMeasurementNative {
    measureWound(): Promise<unknown>;
    isDepthSupported(): boolean;
    hasDedicatedDepthSensor(): boolean;
}

// `requireNativeModule` throws on web / Expo Go where the native side is absent.
// We resolve lazily so importing this file is safe in all environments.
let cached: WoundMeasurementNative | null | undefined;
function native(): WoundMeasurementNative | null {
    if (cached !== undefined) return cached;
    try {
        cached = requireNativeModule<WoundMeasurementNative>("WoundMeasurementModule");
    } catch {
        cached = (NativeModulesProxy as unknown as { WoundMeasurementModule?: WoundMeasurementNative })
            .WoundMeasurementModule ?? null;
    }
    return cached;
}

export class MeasurementUnavailableError extends Error {
    constructor(public readonly reason: string) {
        super(`Measurement unavailable: ${reason}`);
        this.name = "MeasurementUnavailableError";
    }
}

export const WoundMeasurement = {
    /** Open the AR measurement screen and resolve when the user saves a measurement. */
    async measureWound(): Promise<MeasurementResult> {
        const mod = native();
        if (!mod) {
            throw new MeasurementUnavailableError("native module not linked — rebuild the dev client");
        }
        const raw = await mod.measureWound();
        return MeasurementResult.parse(raw);
    },

    /** True if the platform exposes any usable depth API on this device. */
    isDepthSupported(): boolean {
        return native()?.isDepthSupported() ?? false;
    },

    /** iOS: LiDAR present. Android: ToF sensor present. */
    hasDedicatedDepthSensor(): boolean {
        return native()?.hasDedicatedDepthSensor() ?? false;
    },

    platform: Platform.OS as "ios" | "android",
};
