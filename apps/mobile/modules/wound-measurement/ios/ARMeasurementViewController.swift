import UIKit
import ARKit
import RealityKit
import AVFoundation
import simd

/// Full-screen view controller that hosts the ARKit measurement experience.
///
/// Flow:
///   1. User aims at the wound; ARKit acquires LiDAR mesh + scene depth.
///   2. User taps to "set" the wound center → we fit a plane.
///   3. User drags a finger around the perimeter → world points captured.
///   4. User taps Save → measurements + photos returned.
final class ARMeasurementViewController: UIViewController {

    enum Phase { case acquiring, planeSet, tracing, ready }

    var onComplete: ((MeasurementResult) -> Void)?
    var onCancel: (() -> Void)?
    var onError: ((String, String) -> Void)?

    private let arView = ARView(frame: .zero)
    private let arSession = ARMeasurementSession()
    private var phase: Phase = .acquiring { didSet { updateOverlayForPhase() } }

    private var fittedPlane: Plane3D?
    private var traceWorldPoints: [SIMD3<Float>] = []
    private var photoUris: [String] = []

    // MARK: Overlay
    private let instructionLabel = UILabel()
    private let confidenceBadge = UILabel()
    private let traceLayer = CAShapeLayer()
    private let saveButton = UIButton(type: .system)
    private let resetTraceButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupARView()
        setupOverlay()
        setupGestures()

        arSession.onFrame = { [weak self] _ in self?.refreshConfidenceBadge() }
        arSession.onError = { [weak self] code, message in
            self?.onError?(code.rawValue, message)
        }
        arSession.start()
        // Bridge our session into ARView's renderer.
        arView.session = arSession.session
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        arSession.pause()
    }

    // MARK: - Setup

    private func setupARView() {
        arView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(arView)
        NSLayoutConstraint.activate([
            arView.topAnchor.constraint(equalTo: view.topAnchor),
            arView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            arView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            arView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        traceLayer.strokeColor = UIColor.systemGreen.cgColor
        traceLayer.fillColor = UIColor.systemGreen.withAlphaComponent(0.2).cgColor
        traceLayer.lineWidth = 3
        arView.layer.addSublayer(traceLayer)
    }

    private func setupOverlay() {
        instructionLabel.text = "Aim at the wound and tap to set the wound plane."
        instructionLabel.textColor = .white
        instructionLabel.font = .systemFont(ofSize: 16, weight: .medium)
        instructionLabel.textAlignment = .center
        instructionLabel.numberOfLines = 0
        instructionLabel.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        instructionLabel.layer.cornerRadius = 8
        instructionLabel.layer.masksToBounds = true
        instructionLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(instructionLabel)

        confidenceBadge.text = "Confidence: —"
        confidenceBadge.textColor = .white
        confidenceBadge.font = .systemFont(ofSize: 13, weight: .semibold)
        confidenceBadge.textAlignment = .center
        confidenceBadge.backgroundColor = UIColor.systemGray.withAlphaComponent(0.8)
        confidenceBadge.layer.cornerRadius = 8
        confidenceBadge.layer.masksToBounds = true
        confidenceBadge.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(confidenceBadge)

        configureButton(saveButton, title: "Save", color: .systemGreen)
        configureButton(resetTraceButton, title: "Retrace", color: .systemOrange)
        configureButton(cancelButton, title: "Cancel", color: .systemRed)

        saveButton.addTarget(self, action: #selector(handleSave), for: .touchUpInside)
        resetTraceButton.addTarget(self, action: #selector(handleResetTrace), for: .touchUpInside)
        cancelButton.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)

        let buttonRow = UIStackView(arrangedSubviews: [cancelButton, resetTraceButton, saveButton])
        buttonRow.axis = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing = 8
        buttonRow.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(buttonRow)

        NSLayoutConstraint.activate([
            instructionLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            instructionLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            instructionLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),

            confidenceBadge.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 8),
            confidenceBadge.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            confidenceBadge.widthAnchor.constraint(equalToConstant: 160),
            confidenceBadge.heightAnchor.constraint(equalToConstant: 28),

            buttonRow.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            buttonRow.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            buttonRow.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            buttonRow.heightAnchor.constraint(equalToConstant: 50)
        ])
    }

    private func configureButton(_ button: UIButton, title: String, color: UIColor) {
        button.setTitle(title, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.backgroundColor = color
        button.layer.cornerRadius = 10
    }

    private func setupGestures() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        arView.addGestureRecognizer(tap)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        arView.addGestureRecognizer(pan)
    }

    // MARK: - Gestures

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        guard phase == .acquiring else { return }
        let screenPoint = gesture.location(in: arView)
        let samples = arSession.sampleDepthROI(
            centerScreen: screenPoint,
            radiusPx: 60,
            viewportSize: arView.bounds.size
        )
        guard let fit = WoundPlaneFitter.fit(points: samples), fit.planarityScore > 0.95 else {
            instructionLabel.text = "Couldn't find a flat enough surface — hold steady and try again."
            return
        }
        fittedPlane = fit.plane
        phase = .planeSet
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard phase == .planeSet || phase == .tracing else { return }
        let screenPoint = gesture.location(in: arView)

        switch gesture.state {
        case .began:
            phase = .tracing
            traceWorldPoints.removeAll()
            appendTracePoint(at: screenPoint)
        case .changed:
            appendTracePoint(at: screenPoint)
        case .ended:
            phase = .ready
            redrawTraceLayer(close: true)
        default:
            break
        }
    }

    private func appendTracePoint(at screenPoint: CGPoint) {
        guard let world = arSession.worldPoint(forScreenPoint: screenPoint, in: arView.bounds.size) else { return }
        let mm = world * 1000
        // Dedupe near-coincident samples so high-rate pan events don't bloat the polygon.
        if let last = traceWorldPoints.last, simd_distance(last, mm) < 1.5 { return }
        traceWorldPoints.append(mm)
        redrawTraceLayer(close: false)
    }

    private func redrawTraceLayer(close: Bool) {
        guard let plane = fittedPlane else { return }
        let path = UIBezierPath()
        for (i, world) in traceWorldPoints.enumerated() {
            // Project back to screen for the overlay only; measurements use 3D math.
            let projected = plane.project(point: world)
            // Cheap viz: use plane-local coords offset to the screen center.
            let p = CGPoint(
                x: arView.bounds.midX + CGFloat(projected.x),
                y: arView.bounds.midY + CGFloat(projected.y)
            )
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        if close { path.close() }
        traceLayer.path = path.cgPath
    }

    // MARK: - Save

    @objc private func handleSave() {
        guard phase == .ready, let plane = fittedPlane, traceWorldPoints.count >= 3 else { return }
        let m = PolygonMath.measurements(points3D: traceWorldPoints, plane: plane)

        let centerScreen = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        let confidence = arSession.meanConfidence(
            centerScreen: centerScreen, radiusPx: 80, viewportSize: arView.bounds.size
        )

        capturePhoto { [weak self] uri in
            guard let self = self else { return }
            if let uri = uri { self.photoUris.append(uri) }

            let result = MeasurementResult(
                lengthMm: m.lengthMm,
                widthMm: m.widthMm,
                depthMm: nil, // depth entered manually in the visit form
                areaMm2: m.areaMm2,
                perimeterMm: m.perimeterMm,
                polygonPoints: self.traceWorldPoints.map {
                    MeasurementResult.Point3D(x: $0.x, y: $0.y, z: $0.z)
                },
                measurementMethod: "ar_lidar_trace",
                confidenceScore: confidence,
                photoUris: self.photoUris,
                deviceModel: UIDevice.current.model,
                osVersion: UIDevice.current.systemVersion,
                arTrackingState: self.arSession.trackingStateString()
            )
            self.onComplete?(result)
        }
    }

    @objc private func handleResetTrace() {
        traceWorldPoints.removeAll()
        traceLayer.path = nil
        phase = fittedPlane == nil ? .acquiring : .planeSet
    }

    @objc private func handleCancel() {
        onCancel?()
    }

    // MARK: - Photo capture

    private func capturePhoto(completion: @escaping (String?) -> Void) {
        // TODO: replace placeholder with AVCaptureSession capture into the app's
        // encrypted sandbox; EXIF stripped via expo-image-manipulator on JS side.
        completion(nil)
    }

    // MARK: - Overlay updates

    private func updateOverlayForPhase() {
        switch phase {
        case .acquiring:
            instructionLabel.text = "Aim at the wound and tap to set the wound plane."
            saveButton.isEnabled = false
        case .planeSet:
            instructionLabel.text = "Drag a finger around the wound perimeter to trace."
            saveButton.isEnabled = false
        case .tracing:
            instructionLabel.text = "Tracing… lift to close the polygon."
            saveButton.isEnabled = false
        case .ready:
            instructionLabel.text = "Tap Save to record, or Retrace to redo."
            saveButton.isEnabled = true
        }
    }

    private func refreshConfidenceBadge() {
        let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        let c = arSession.meanConfidence(centerScreen: center, radiusPx: 80, viewportSize: arView.bounds.size)
        let label: String
        let color: UIColor
        switch c {
        case 0.8...:
            label = String(format: "Confidence: %.0f%% (high)", c * 100)
            color = .systemGreen
        case 0.5..<0.8:
            label = String(format: "Confidence: %.0f%% (med)", c * 100)
            color = .systemYellow
        default:
            label = String(format: "Confidence: %.0f%% (low)", c * 100)
            color = .systemRed
        }
        confidenceBadge.text = label
        confidenceBadge.backgroundColor = color.withAlphaComponent(0.85)
    }
}
