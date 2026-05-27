import Foundation
import ARKit
import simd

/// Wraps the ARSession lifecycle and provides depth-aware unprojection used by
/// the view controller. Owned by `ARMeasurementViewController`.
///
/// The session is configured for:
///   - sceneReconstruction = .meshWithClassification (LiDAR mesh)
///   - frameSemantics = [.sceneDepth, .smoothedSceneDepth]
final class ARMeasurementSession: NSObject, ARSessionDelegate {

    enum SessionError: String {
        case configurationUnsupported = "AR_CONFIG_UNSUPPORTED"
        case trackingLost = "AR_TRACKING_LOST"
    }

    let session: ARSession
    private(set) var lastFrame: ARFrame?
    var onFrame: ((ARFrame) -> Void)?
    var onError: ((SessionError, String) -> Void)?

    override init() {
        session = ARSession()
        super.init()
        session.delegate = self
    }

    func start() {
        guard ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) else {
            onError?(.configurationUnsupported, "LiDAR required for accurate wound measurement.")
            return
        }
        let config = ARWorldTrackingConfiguration()
        config.sceneReconstruction = .meshWithClassification
        config.frameSemantics = [.sceneDepth, .smoothedSceneDepth]
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .none
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func pause() {
        session.pause()
    }

    // MARK: - Unprojection

    /// Convert a screen-space tap to a 3D world point using the latest depth map.
    /// Returns nil if no depth value is available at the given screen point.
    func worldPoint(forScreenPoint screenPoint: CGPoint, in viewportSize: CGSize) -> SIMD3<Float>? {
        guard let frame = lastFrame,
              let depth = frame.smoothedSceneDepth ?? frame.sceneDepth else { return nil }

        let depthMap = depth.depthMap
        let depthWidth = CVPixelBufferGetWidth(depthMap)
        let depthHeight = CVPixelBufferGetHeight(depthMap)

        // Map screen coordinates to depth-map coordinates (depth map is rotated
        // and lower resolution than the view).
        let u = Int((screenPoint.x / viewportSize.width) * CGFloat(depthWidth))
        let v = Int((screenPoint.y / viewportSize.height) * CGFloat(depthHeight))
        guard u >= 0, u < depthWidth, v >= 0, v < depthHeight else { return nil }

        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(depthMap) else { return nil }
        let rowBytes = CVPixelBufferGetBytesPerRow(depthMap)
        let depthMeters = base
            .advanced(by: v * rowBytes + u * MemoryLayout<Float32>.size)
            .assumingMemoryBound(to: Float32.self)
            .pointee

        guard depthMeters.isFinite, depthMeters > 0.05, depthMeters < 5.0 else { return nil }

        // Use ARKit's intrinsics + transform to unproject. We work in the camera
        // image coordinate system, then convert to world via the camera transform.
        let intrinsics = frame.camera.intrinsics
        let imageRes = frame.camera.imageResolution

        // Re-map screen → image coordinates.
        let pixelX = Float(screenPoint.x / viewportSize.width) * Float(imageRes.width)
        let pixelY = Float(screenPoint.y / viewportSize.height) * Float(imageRes.height)

        let x = (pixelX - intrinsics[2, 0]) * depthMeters / intrinsics[0, 0]
        let y = (pixelY - intrinsics[2, 1]) * depthMeters / intrinsics[1, 1]
        let cameraSpace = SIMD4<Float>(x, y, -depthMeters, 1)
        let worldSpace = frame.camera.transform * cameraSpace
        return SIMD3<Float>(worldSpace.x, worldSpace.y, worldSpace.z)
    }

    /// Sample a square ROI of the depth map and return the world-space points
    /// (in mm) — used by `WoundPlaneFitter` to fit the wound plane.
    func sampleDepthROI(
        centerScreen: CGPoint,
        radiusPx: CGFloat,
        viewportSize: CGSize,
        stride: Int = 4
    ) -> [SIMD3<Float>] {
        var samples: [SIMD3<Float>] = []
        let minX = max(0, Int(centerScreen.x - radiusPx))
        let maxX = min(Int(viewportSize.width), Int(centerScreen.x + radiusPx))
        let minY = max(0, Int(centerScreen.y - radiusPx))
        let maxY = min(Int(viewportSize.height), Int(centerScreen.y + radiusPx))

        var x = minX
        while x <= maxX {
            var y = minY
            while y <= maxY {
                if let p = worldPoint(forScreenPoint: CGPoint(x: x, y: y), in: viewportSize) {
                    samples.append(p * 1000) // meters → mm
                }
                y += stride
            }
            x += stride
        }
        return samples
    }

    /// Convenience: convert a session's tracking state to a stable string.
    func trackingStateString() -> String {
        guard let state = lastFrame?.camera.trackingState else { return "unknown" }
        switch state {
        case .normal: return "normal"
        case .notAvailable: return "not_available"
        case .limited(let reason):
            switch reason {
            case .initializing: return "limited_initializing"
            case .excessiveMotion: return "limited_excessive_motion"
            case .insufficientFeatures: return "limited_insufficient_features"
            case .relocalizing: return "limited_relocalizing"
            @unknown default: return "limited_unknown"
            }
        }
    }

    /// Mean per-frame confidence within an ROI. 0..1.
    func meanConfidence(centerScreen: CGPoint, radiusPx: CGFloat, viewportSize: CGSize) -> Float {
        guard let frame = lastFrame,
              let depth = frame.smoothedSceneDepth ?? frame.sceneDepth,
              let confidenceMap = depth.confidenceMap else { return 0 }

        let width = CVPixelBufferGetWidth(confidenceMap)
        let height = CVPixelBufferGetHeight(confidenceMap)
        CVPixelBufferLockBaseAddress(confidenceMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(confidenceMap) else { return 0 }
        let rowBytes = CVPixelBufferGetBytesPerRow(confidenceMap)

        let cx = Int((centerScreen.x / viewportSize.width) * CGFloat(width))
        let cy = Int((centerScreen.y / viewportSize.height) * CGFloat(height))
        let r = Int((radiusPx / viewportSize.width) * CGFloat(width))

        var total: Float = 0
        var count: Int = 0
        for dy in -r...r {
            for dx in -r...r {
                let x = cx + dx, y = cy + dy
                guard x >= 0, x < width, y >= 0, y < height else { continue }
                let value = base
                    .advanced(by: y * rowBytes + x)
                    .assumingMemoryBound(to: UInt8.self)
                    .pointee
                // ARConfidenceLevel: 0 low, 1 medium, 2 high
                total += Float(value) / 2
                count += 1
            }
        }
        return count > 0 ? total / Float(count) : 0
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        lastFrame = frame
        onFrame?(frame)
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        onError?(.trackingLost, error.localizedDescription)
    }
}
