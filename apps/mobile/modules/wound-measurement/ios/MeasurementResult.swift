import Foundation

/// Result returned to JavaScript. Keys match the Zod schema in
/// packages/shared/src/schemas/measurement.ts so the JS side parses without
/// transformation.
public struct MeasurementResult: Codable {
    public let lengthMm: Float
    public let widthMm: Float
    public let depthMm: Float?
    public let areaMm2: Float
    public let perimeterMm: Float
    public let polygonPoints: [Point3D]
    public let measurementMethod: String
    public let confidenceScore: Float
    public let photoUris: [String]
    public let deviceModel: String
    public let osVersion: String
    public let arTrackingState: String

    public struct Point3D: Codable {
        public let x: Float
        public let y: Float
        public let z: Float
    }

    /// Convert to a JSON-compatible dictionary for the Expo Module promise.
    public func toDictionary() -> [String: Any] {
        return [
            "lengthMm": lengthMm,
            "widthMm": widthMm,
            "depthMm": depthMm as Any,
            "areaMm2": areaMm2,
            "perimeterMm": perimeterMm,
            "polygonPoints": polygonPoints.map { ["x": $0.x, "y": $0.y, "z": $0.z] },
            "measurementMethod": measurementMethod,
            "confidenceScore": confidenceScore,
            "photoUris": photoUris,
            "deviceModel": deviceModel,
            "osVersion": osVersion,
            "arTrackingState": arTrackingState
        ]
    }
}
