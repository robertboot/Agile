import XCTest
import simd
@testable import WoundMeasurementModule

final class WoundPlaneFitterTests: XCTestCase {

    func testFitsPerfectXYPlane() {
        // 9 points scattered on z=0 with tiny noise.
        let pts: [SIMD3<Float>] = (0..<9).map { i in
            let f = Float(i)
            return SIMD3<Float>(f.truncatingRemainder(dividingBy: 3), floor(f / 3), 0)
        }
        let fit = WoundPlaneFitter.fit(points: pts)
        XCTAssertNotNil(fit)
        XCTAssertGreaterThan(fit!.planarityScore, 0.99)
        let n = fit!.plane.normal
        // Normal should be ±z.
        XCTAssertEqual(abs(n.z), 1, accuracy: 1e-3)
        XCTAssertEqual(abs(n.x), 0, accuracy: 1e-3)
        XCTAssertEqual(abs(n.y), 0, accuracy: 1e-3)
    }

    func testReturnsNilForTooFewPoints() {
        XCTAssertNil(WoundPlaneFitter.fit(points: []))
        XCTAssertNil(WoundPlaneFitter.fit(points: [.init(0, 0, 0), .init(1, 0, 0)]))
    }

    func testTiltedPlaneNormalRecovered() {
        // A 30-degree tilt around the X axis.
        let angle: Float = .pi / 6
        let cosA = cos(angle), sinA = sin(angle)
        let pts: [SIMD3<Float>] = (0..<25).map { i in
            let u = Float(i % 5)
            let v = Float(i / 5)
            return SIMD3<Float>(u, v * cosA, v * sinA)
        }
        let fit = WoundPlaneFitter.fit(points: pts)
        XCTAssertNotNil(fit)
        let expectedNormal = SIMD3<Float>(0, -sinA, cosA)
        // Normal direction is ambiguous; compare absolute dot.
        let dot = abs(simd_dot(simd_normalize(fit!.plane.normal), simd_normalize(expectedNormal)))
        XCTAssertEqual(dot, 1, accuracy: 1e-3)
    }
}
