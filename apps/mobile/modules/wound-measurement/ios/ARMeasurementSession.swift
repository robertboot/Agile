import Foundation
import ARKit
import simd
import UIKit

/// Snapshot of an ARFrame at the moment the user tapped the shutter.
///
/// We deep-copy the depth + confidence pixel buffers because ARKit reclaims
/// them as new frames arrive. With this in hand the view controller can keep
/// unprojecting screen taps on the still image to world coordinates without
/// the live AR session.
struct FrozenFrame {
    let image: UIImage
    let depthMap: CVPixelBuffer
    let confidenceMap: CVPixelBuffer?
    let intrinsics: simd_float3x3
    let cameraTransform: simd_float4x4
    let imageResolution: CGSize
    let captureViewport: CGSize
    let trackingState: String
}

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

    // MARK: - Frozen-frame capture

    /// Capture the latest ARFrame's depth, confidence, intrinsics, and pose,
    /// pairing them with a UIImage rendered from the same frame. The depth and
    /// confidence pixel buffers are deep-copied so the live session is free to
    /// reuse its own pool.
    ///
    /// `captureViewport` is the pixel size of the view the user composed the
    /// shot through — we need it to map screen taps on the still photo back
    /// to AR camera image coordinates exactly like we did during the live
    /// capture phase.
    func freezeCurrentFrame(captureViewport: CGSize) -> FrozenFrame? {
        guard let frame = lastFrame else { return nil }
        guard let depth = frame.smoothedSceneDepth ?? frame.sceneDepth else { return nil }
        guard let depthCopy = Self.copyPixelBuffer(depth.depthMap) else { return nil }
        let confidenceCopy = depth.confidenceMap.flatMap { Self.copyPixelBuffer($0) }

        let ciImage = CIImage(cvPixelBuffer: frame.capturedImage)
        // The captured image is in landscape sensor orientation; rotate to
        // match a portrait-held device. ARKit cameras are landscape-right,
        // so we rotate 90° clockwise (`right`) into portrait.
        let oriented = ciImage.oriented(.right)
        let context = CIContext(options: [.useSoftwareRenderer: false])
        guard let cgImage = context.createCGImage(oriented, from: oriented.extent) else { return nil }
        let uiImage = UIImage(cgImage: cgImage)

        return FrozenFrame(
            image: uiImage,
            depthMap: depthCopy,
            confidenceMap: confidenceCopy,
            intrinsics: frame.camera.intrinsics,
            cameraTransform: frame.camera.transform,
            imageResolution: frame.camera.imageResolution,
            captureViewport: captureViewport,
            trackingState: trackingStateString()
        )
    }

    /// Unproject a screen point on the *frozen* still image to a world-space
    /// point. Uses the frozen frame's depth + intrinsics + pose.
    static func worldPoint(
        forScreenPoint screenPoint: CGPoint,
        in viewportSize: CGSize,
        using frame: FrozenFrame
    ) -> SIMD3<Float>? {
        let depthMap = frame.depthMap
        let depthWidth = CVPixelBufferGetWidth(depthMap)
        let depthHeight = CVPixelBufferGetHeight(depthMap)
        guard viewportSize.width > 0, viewportSize.height > 0 else { return nil }

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

        let intrinsics = frame.intrinsics
        let imageRes = frame.imageResolution
        let pixelX = Float(screenPoint.x / viewportSize.width) * Float(imageRes.width)
        let pixelY = Float(screenPoint.y / viewportSize.height) * Float(imageRes.height)
        let x = (pixelX - intrinsics[2, 0]) * depthMeters / intrinsics[0, 0]
        let y = (pixelY - intrinsics[2, 1]) * depthMeters / intrinsics[1, 1]
        let cameraSpace = SIMD4<Float>(x, y, -depthMeters, 1)
        let worldSpace = frame.cameraTransform * cameraSpace
        return SIMD3<Float>(worldSpace.x, worldSpace.y, worldSpace.z)
    }

    /// Mean confidence (0..1) of all polygon samples in the frozen frame.
    static func meanConfidence(
        screenPoints: [CGPoint],
        in viewportSize: CGSize,
        using frame: FrozenFrame
    ) -> Float {
        guard let confidenceMap = frame.confidenceMap else { return 0 }
        let width = CVPixelBufferGetWidth(confidenceMap)
        let height = CVPixelBufferGetHeight(confidenceMap)
        CVPixelBufferLockBaseAddress(confidenceMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(confidenceMap) else { return 0 }
        let rowBytes = CVPixelBufferGetBytesPerRow(confidenceMap)

        var total: Float = 0
        var count: Int = 0
        for p in screenPoints {
            let x = Int((p.x / viewportSize.width) * CGFloat(width))
            let y = Int((p.y / viewportSize.height) * CGFloat(height))
            guard x >= 0, x < width, y >= 0, y < height else { continue }
            let value = base
                .advanced(by: y * rowBytes + x)
                .assumingMemoryBound(to: UInt8.self)
                .pointee
            total += Float(value) / 2
            count += 1
        }
        return count > 0 ? total / Float(count) : 0
    }

    private static func copyPixelBuffer(_ source: CVPixelBuffer) -> CVPixelBuffer? {
        let width = CVPixelBufferGetWidth(source)
        let height = CVPixelBufferGetHeight(source)
        let format = CVPixelBufferGetPixelFormatType(source)
        var copy: CVPixelBuffer?
        let attrs: [CFString: Any] = [kCVPixelBufferIOSurfacePropertiesKey: [:]]
        CVPixelBufferCreate(kCFAllocatorDefault, width, height, format, attrs as CFDictionary, &copy)
        guard let dst = copy else { return nil }

        CVPixelBufferLockBaseAddress(source, .readOnly)
        CVPixelBufferLockBaseAddress(dst, [])
        defer {
            CVPixelBufferUnlockBaseAddress(source, .readOnly)
            CVPixelBufferUnlockBaseAddress(dst, [])
        }
        guard let srcAddr = CVPixelBufferGetBaseAddress(source),
              let dstAddr = CVPixelBufferGetBaseAddress(dst) else { return nil }
        let srcRow = CVPixelBufferGetBytesPerRow(source)
        let dstRow = CVPixelBufferGetBytesPerRow(dst)
        let copyBytes = min(srcRow, dstRow)
        for row in 0..<height {
            memcpy(dstAddr.advanced(by: row * dstRow),
                   srcAddr.advanced(by: row * srcRow),
                   copyBytes)
        }
        return dst
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
