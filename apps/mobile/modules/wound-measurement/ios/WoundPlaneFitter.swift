import Foundation
import simd

/// Fit a 3D plane to a cloud of depth-sampled points via principal component
/// analysis. The smallest principal axis is the plane normal; the plane passes
/// through the centroid.
///
/// Used at capture time to define a "wound plane" from LiDAR scene depth in
/// the user's region of interest. Once we have a plane, trace points are
/// projected onto it for area / length / width math.
public enum WoundPlaneFitter {

    public struct FitResult: Equatable {
        public let plane: Plane3D
        /// Eigenvalues, largest first. Ratio between smallest and second-smallest
        /// is a quality signal: if the plane is well-defined the smallest
        /// eigenvalue is dwarfed by the others.
        public let eigenvalues: (Float, Float, Float)
        public let planarityScore: Float
    }

    /// Returns nil if fewer than 3 points or if the points are collinear/degenerate.
    public static func fit(points: [SIMD3<Float>]) -> FitResult? {
        guard points.count >= 3 else { return nil }

        let n = Float(points.count)
        var centroid = SIMD3<Float>(repeating: 0)
        for p in points { centroid += p }
        centroid /= n

        // 3x3 covariance matrix.
        var cov = simd_float3x3(0)
        for p in points {
            let d = p - centroid
            cov[0, 0] += d.x * d.x
            cov[0, 1] += d.x * d.y
            cov[0, 2] += d.x * d.z
            cov[1, 1] += d.y * d.y
            cov[1, 2] += d.y * d.z
            cov[2, 2] += d.z * d.z
        }
        cov[1, 0] = cov[0, 1]
        cov[2, 0] = cov[0, 2]
        cov[2, 1] = cov[1, 2]
        cov *= (1.0 / n)

        guard let eig = symmetricEigen3x3(matrix: cov) else { return nil }

        // Smallest eigenvalue's eigenvector = plane normal.
        let normal = eig.vectors.2
        let plane = Plane3D(normal: normal, pointOnPlane: centroid)

        // Planarity: 1 - (smallest / sum). 1 = perfectly planar, 0 = isotropic blob.
        let sum = eig.values.0 + eig.values.1 + eig.values.2
        let planarity = sum > 0 ? 1 - eig.values.2 / sum : 0

        return FitResult(plane: plane, eigenvalues: eig.values, planarityScore: planarity)
    }

    // MARK: - 3x3 symmetric eigen decomposition

    /// Jacobi rotation. Fine for our 3x3 case; converges in a handful of sweeps.
    /// Returns eigenvalues + eigenvectors sorted largest-first.
    static func symmetricEigen3x3(
        matrix: simd_float3x3
    ) -> (values: (Float, Float, Float), vectors: (SIMD3<Float>, SIMD3<Float>, SIMD3<Float>))? {
        var a = matrix
        var v = matrix_identity_float3x3

        let maxSweeps = 64
        let tolerance: Float = 1e-9

        for _ in 0..<maxSweeps {
            // Find largest off-diagonal absolute value.
            var p = 0, q = 1
            var maxOff: Float = abs(a[1, 0])
            if abs(a[2, 0]) > maxOff { p = 0; q = 2; maxOff = abs(a[2, 0]) }
            if abs(a[2, 1]) > maxOff { p = 1; q = 2; maxOff = abs(a[2, 1]) }

            if maxOff < tolerance { break }

            let apq = a[q, p]
            let app = a[p, p]
            let aqq = a[q, q]
            let theta = (aqq - app) / (2 * apq)
            let t: Float = theta >= 0
                ? 1 / (theta + sqrt(theta * theta + 1))
                : 1 / (theta - sqrt(theta * theta + 1))
            let c = 1 / sqrt(t * t + 1)
            let s = t * c

            // Rotate a in (p, q) plane.
            for i in 0..<3 {
                let aip = a[p, i]
                let aiq = a[q, i]
                a[p, i] = c * aip - s * aiq
                a[q, i] = s * aip + c * aiq
            }
            for i in 0..<3 {
                let api = a[i, p]
                let aqi = a[i, q]
                a[i, p] = c * api - s * aqi
                a[i, q] = s * api + c * aqi
            }
            // Accumulate eigenvectors.
            for i in 0..<3 {
                let vip = v[p, i]
                let viq = v[q, i]
                v[p, i] = c * vip - s * viq
                v[q, i] = s * vip + c * viq
            }
        }

        // Extract sorted (value, vector) pairs largest-first.
        let pairs: [(Float, SIMD3<Float>)] = (0..<3).map { i in
            (a[i, i], SIMD3<Float>(v[i, 0], v[i, 1], v[i, 2]))
        }
        let sorted = pairs.sorted { $0.0 > $1.0 }

        return (
            values: (sorted[0].0, sorted[1].0, sorted[2].0),
            vectors: (
                simd_normalize(sorted[0].1),
                simd_normalize(sorted[1].1),
                simd_normalize(sorted[2].1)
            )
        )
    }
}
