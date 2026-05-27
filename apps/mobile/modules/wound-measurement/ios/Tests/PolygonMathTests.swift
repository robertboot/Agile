import XCTest
import simd
@testable import WoundMeasurementModule

final class PolygonMathTests: XCTestCase {

    // MARK: Hand-checked cases

    func testUnitSquareArea() {
        let pts: [SIMD3<Float>] = [
            .init(0, 0, 0), .init(10, 0, 0), .init(10, 10, 0), .init(0, 10, 0)
        ]
        let plane = Plane3D(normal: .init(0, 0, 1), pointOnPlane: .zero)
        XCTAssertEqual(PolygonMath.area(points3D: pts, plane: plane), 100, accuracy: 0.001)
    }

    func testPerimeterUsesThreeDimensions() {
        // A square that lifts in z so 3D distance > 2D projected distance.
        let pts: [SIMD3<Float>] = [
            .init(0, 0, 0), .init(10, 0, 5), .init(10, 10, 5), .init(0, 10, 0)
        ]
        let p = PolygonMath.perimeter(points3D: pts)
        // 2D projected perimeter would be 40; 3D is larger because two edges climb.
        XCTAssertGreaterThan(p, 40)
    }

    func testLengthAlwaysGreaterThanOrEqualToWidth() {
        let pts: [SIMD3<Float>] = [
            .init(0, 0, 0), .init(30, 0, 0), .init(30, 20, 0), .init(0, 20, 0)
        ]
        let plane = Plane3D(normal: .init(0, 0, 1), pointOnPlane: .zero)
        let (l, w) = PolygonMath.lengthAndWidth(points3D: pts, plane: plane)
        XCTAssertEqual(l, 30, accuracy: 0.001)
        XCTAssertEqual(w, 20, accuracy: 0.001)
    }

    func testDegenerateInputsReturnZero() {
        let two: [SIMD3<Float>] = [.init(0, 0, 0), .init(10, 0, 0)]
        let plane = Plane3D(normal: .init(0, 0, 1), pointOnPlane: .zero)
        XCTAssertEqual(PolygonMath.area(points3D: two, plane: plane), 0)
        let (l, w) = PolygonMath.lengthAndWidth(points3D: two, plane: plane)
        XCTAssertEqual(l, 0)
        XCTAssertEqual(w, 0)
    }

    func testTriangle345() {
        let pts: [SIMD3<Float>] = [.init(0, 0, 0), .init(30, 0, 0), .init(0, 40, 0)]
        let plane = Plane3D(normal: .init(0, 0, 1), pointOnPlane: .zero)
        XCTAssertEqual(PolygonMath.area(points3D: pts, plane: plane), 600, accuracy: 0.01)
        XCTAssertEqual(PolygonMath.perimeter(points3D: pts), 120, accuracy: 0.01)
    }

    // MARK: Shared fixtures

    /// Iterate the JSON fixtures shipped alongside the Android Kotlin tests.
    /// Both platforms must agree on every numeric output.
    func testSharedFixtures() throws {
        let url = try locateFixtures()
        let data = try Data(contentsOf: url)
        let fixtures = try JSONDecoder().decode(FixtureFile.self, from: data)

        for c in fixtures.cases {
            let pts = c.polygon.map { SIMD3<Float>($0.x, $0.y, $0.z) }
            let plane = Plane3D(
                normal: SIMD3<Float>(c.plane.normal.x, c.plane.normal.y, c.plane.normal.z),
                pointOnPlane: SIMD3<Float>(c.plane.pointOnPlane.x, c.plane.pointOnPlane.y, c.plane.pointOnPlane.z)
            )
            let m = PolygonMath.measurements(points3D: pts, plane: plane)

            let tol = c.tolerances ?? Tolerances(areaMm2: 0.01, perimeterMm: 0.01, lengthMm: 0.01, widthMm: 0.01)
            XCTAssertEqual(m.areaMm2, c.expected.areaMm2,
                           accuracy: tol.areaMm2 ?? 0.01, "area for \(c.name)")
            XCTAssertEqual(m.perimeterMm, c.expected.perimeterMm,
                           accuracy: tol.perimeterMm ?? 0.01, "perimeter for \(c.name)")
            XCTAssertEqual(m.lengthMm, c.expected.lengthMm,
                           accuracy: tol.lengthMm ?? 0.01, "length for \(c.name)")
            XCTAssertEqual(m.widthMm, c.expected.widthMm,
                           accuracy: tol.widthMm ?? 0.01, "width for \(c.name)")
        }
    }

    private func locateFixtures() throws -> URL {
        // Search upward from the test bundle to find the shared fixtures file.
        // In CI this should be configured as a resource of the test target.
        let candidates = [
            Bundle(for: type(of: self)).url(forResource: "polygon-math", withExtension: "json"),
            URL(fileURLWithPath: #file)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("packages/shared/src/test-fixtures/polygon-math.json")
        ]
        for url in candidates {
            if let url = url, FileManager.default.fileExists(atPath: url.path) {
                return url
            }
        }
        throw XCTSkip("polygon-math.json fixtures not bundled with test target")
    }

    // MARK: Fixture decoding

    struct FixtureFile: Decodable { let cases: [Case] }
    struct Case: Decodable {
        let name: String
        let polygon: [Pt]
        let plane: PlaneFixture
        let expected: Expected
        let tolerances: Tolerances?
    }
    struct Pt: Decodable { let x: Float; let y: Float; let z: Float }
    struct PlaneFixture: Decodable {
        let normal: Pt
        let pointOnPlane: Pt
    }
    struct Expected: Decodable {
        let areaMm2: Float
        let perimeterMm: Float
        let lengthMm: Float
        let widthMm: Float
    }
    struct Tolerances: Decodable {
        let areaMm2: Float?
        let perimeterMm: Float?
        let lengthMm: Float?
        let widthMm: Float?
    }
}
