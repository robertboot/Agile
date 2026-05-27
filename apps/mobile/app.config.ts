import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
    name: IS_DEV ? "Agile (Dev)" : "Agile",
    slug: "agile-mobile",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "agile",
    userInterfaceStyle: "automatic",
    ios: {
        supportsTablet: true,
        bundleIdentifier: IS_DEV ? "com.agile.woundcare.dev" : "com.agile.woundcare",
        config: {
            usesNonExemptEncryption: false,
        },
        infoPlist: {
            NSCameraUsageDescription:
                "Agile uses the camera to capture wound photographs at the point of care for clinical documentation.",
            NSPhotoLibraryUsageDescription:
                "Agile may save wound photographs to your device for offline access.",
            NSFaceIDUsageDescription:
                "Agile uses Face ID to verify your identity before accessing patient records.",
            NSLocalNetworkUsageDescription:
                "Agile uses the local network only to communicate with development tools (no patient data leaves the device on the local network).",
            ITSAppUsesNonExemptEncryption: false,
            UIBackgroundModes: ["fetch", "processing"],
        },
        privacyManifests: {
            NSPrivacyTracking: false,
            NSPrivacyCollectedDataTypes: [
                {
                    NSPrivacyCollectedDataType: "Email Address",
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: ["Authentication"],
                },
                {
                    NSPrivacyCollectedDataType: "Photos or Videos",
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: ["AppFunctionality"],
                },
                {
                    NSPrivacyCollectedDataType: "Sensitive Info",
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: ["AppFunctionality"],
                },
            ],
        },
    },
    android: {
        package: IS_DEV ? "com.agile.woundcare.dev" : "com.agile.woundcare",
        permissions: ["CAMERA", "USE_BIOMETRIC", "USE_FINGERPRINT"],
        allowBackup: false,
        config: {
            // ARCore requirement metadata gets injected via the native module's AndroidManifest.
        },
    },
    plugins: [
        "expo-router",
        "expo-secure-store",
        [
            "expo-build-properties",
            {
                ios: {
                    deploymentTarget: "16.0",
                },
                android: {
                    minSdkVersion: 29,
                    compileSdkVersion: 34,
                    targetSdkVersion: 34,
                },
            },
        ],
    ],
    experiments: {
        typedRoutes: true,
    },
    extra: {
        eas: {
            projectId: "REPLACE_WITH_EAS_PROJECT_ID",
        },
    },
};

export default config;
