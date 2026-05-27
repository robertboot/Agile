import Foundation
import simd

/// Pure math for converting a polygon of 3D world-space points (from an ARKit
/// trace) into clinical measurements: area, perimeter, length, and width.
///
/// Deterministic and ARKit-free so it can be unit-tested on any Mac without a
/// LiDAR device. Identical math is duplicated in Kotlin for Android; the same
/// fixtures (packages/shared/src/test-fixtures/polygon-math.json) validate both.
public enum PolygonMath {

    public struct Measurements: Equatable {
        public let areaMm2: Float
        public let perimeterMm: Float
        public let lengthMm: Float
        public let widthMm: Float
    }

    /// Convenience: compute every measurement on a polygon given its best-fit plane.
    /// Input units are millimeters.
    public static func measurements(
        points3D: [SIMD3<Float>],
        plane: Plane3D
    ) -> Measurements {
        let a = area(points3D: points3D, plane: plane)
        let p = perimeter(points3D: points3D)
        let (l, w) = lengthAndWidth(points3D: points3D, plane: plane)
        return Measurements(areaMm2: a, perimeterMm: p, lengthMm: l, widthMm: w)
    }

    /// Area in mm² via shoelace on points projected onto their best-fit plane.
    public static func area(points3D: [SIMD3<Float>], plane: Plane3D) -> Float {
        guard points3D.count >= 3 else { return 0 }
        let projected = points3D.map { plane.project(point: $0) }
        return abs(shoelace2D(points: projected))
    }

    /// Perimeter in mm. Sum of 3D Euclidean distances between consecutive
    /// points — preserves curvature for wounds on non-flat surfaces (heel,
    /// sacrum) where planar projection would underestimate.
    public static func perimeter(points3D: [SIMD3<Float>]) -> Float {
        guard points3D.count >= 2 else { return 0 }
        var total: Float = 0
        for i in 0..<points3D.count {
            let next = points3D[(i + 1) % points3D.count]
            total += simd_distance(points3D[i], next)
        }
        return total
    }

    /// Length = extent along the principal axis of variance.
    /// Width = extent perpendicular to length. Both measured in mm.
    public static func lengthAndWidth(
        points3D: [SIMD3<Float>],
        plane: Plane3D
    ) -> (length: Float, width: Float) {
        guard points3D.count >= 3 else { return (0, 0) }
        let projected = points3D.map { plane.project(point: $0) }
        let (axis1, axis2) = pca2D(points: projected)
        let extent1 = extent(points: projected, axis: axis1)
        let extent2 = extent(points: projected, axis: axis2)
        // Largest extent wins length, even if PCA's first eigenvalue was tiny
        // (degenerate input). Guarantees length >= width.
        return extent1 >= extent2 ? (extent1, extent2) : (extent2, extent1)
    }

    // MARK: - Building blocks (internal, exposed for tests)

    /// Signed 2D shoelace area. Sign indicates winding order; callers usually
    /// take abs() since trace direction is user-driven.
    static func shoelace2D(points: [SIMD2<Float>]) -> Float {
        guard points.count >= 3 else { return 0 }
        var sum: Float = 0
        for i in 0..<points.count {
            let p = points[i]
            let q = points[(i + 1) % points.count]
            sum += p.x * q.y - q.x * p.y
        }
        return sum / 2
    }

    /// PCA on a set of 2D points. Returns the two orthonormal principal axes,
    /// largest variance first. Closed-form via the 2x2 covariance matrix.
    static func pca2D(points: [SIMD2<Float>]) -> (SIMD2<Float>, SIMD2<Float>) {
        let n = Float(points.count)
        var mean = SIMD2<Float>(repeating: 0)
        for p in points { mean += p }
        mean /= n

        var cxx: Float = 0, cxy: Float = 0, cyy: Float = 0
        for p in points {
            let d = p - mean
            cxx += d.x * d.x
            cxy += d.x * d.y
            cyy += d.y * d.y
        }
        cxx /= n; cxy /= n; cyy /= n

        let trace = cxx + cyy
        let det = cxx * cyy - cxy * cxy
        // disc = (trace/2)^2 - det = ((cxx-cyy)/2)^2 + cxy^2  -> always >= 0
        let disc = max(0, trace * trace / 4 - det)
        let sqrtDisc = sqrt(disc)
        let lambda1 = trace / 2 + sqrtDisc

        // Eigenvector for the larger eigenvalue.
        var v1: SIMD2<Float>
        if abs(cxy) > 1e-12 {
            v1 = SIMD2<Float>(lambda1 - cyy, cxy)
        } else if cxx >= cyy {
            v1 = SIMD2<Float>(1, 0)
        } else {
            v1 = SIMD2<Float>(0, 1)
        }
        v1 = simd_normalize(v1)
        let v2 = SIMD2<Float>(-v1.y, v1.x)
        return (v1, v2)
    }

    /// Range (max - min) of dot products of points onto a unit axis.
    static func extent(points: [SIMD2<Float>], axis: SIMD2<Float>) -> Float {
        guard !points.isEmpty else { return 0 }
        var lo = Float.infinity
        var hi = -Float.infinity
        for p in points {
            let d = simd_dot(p, axis)
            if d < lo { lo = d }
            if d > hi { hi = d }
        }
        return hi - lo
    }
}

/// A 3D plane defined by a unit normal and a point on the plane.
/// Provides a deterministic 2D embedding for projecting trace points.
public struct Plane3D: Equatable {
    public let normal: SIMD3<Float>
    public let pointOnPlane: SIMD3<Float>

    public init(normal: SIMD3<Float>, pointOnPlane: SIMD3<Float>) {
        self.normal = simd_normalize(normal)
        self.pointOnPlane = pointOnPlane
    }

    /// Drop the normal component, then express the remainder in a 2D basis on
    /// the plane. Basis is chosen deterministically (right-handed) so two
    /// platforms compute the same projection given the same inputs.
    public func project(point: SIMD3<Float>) -> SIMD2<Float> {
        let basis = orthonormalBasis()
        let v = point - pointOnPlane
        return SIMD2<Float>(simd_dot(v, basis.u), simd_dot(v, basis.v))
    }

    public func signedDistance(point: SIMD3<Float>) -> Float {
        simd_dot(point - pointOnPlane, normal)
    }

    /// Build a right-handed (u, v, normal) basis. Choice of seed avoids
    /// numerical collapse when normal aligns with the world up vector.
    func orthonormalBasis() -> (u: SIMD3<Float>, v: SIMD3<Float>) {
        let seed: SIMD3<Float> = abs(normal.x) < 0.9
            ? SIMD3<Float>(1, 0, 0)
            : SIMD3<Float>(0, 1, 0)
        let u = simd_normalize(simd_cross(normal, seed))
        let v = simd_cross(normal, u)
        return (u, v)
    }
}
