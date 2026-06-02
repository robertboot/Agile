import UIKit
import ARKit
import RealityKit
import AVFoundation
import simd

/// Full-screen view controller that hosts the ARKit measurement experience.
///
/// Two phases:
///   1. Capture — live ARView with a framing reticle and shutter button.
///      Tapping the shutter freezes the depth + intrinsics + pose alongside
///      a still photo of what the user just framed.
///   2. Review — the still photo is shown in a zoomable scroll view. The user
///      traces the wound boundary with a single finger (two-finger pan and
///      pinch handle zoom/scroll). On Save we unproject the trace through the
///      frozen depth map to get world-space points, fit a plane, and run
///      `PolygonMath` to produce measurements.
final class ARMeasurementViewController: UIViewController {

    // MARK: Phases

    enum Phase {
        case capture           // Live AR, waiting for shutter.
        case reviewEmpty       // Photo shown, no trace yet.
        case reviewTracing     // Mid-drag drawing trace.
        case reviewReady       // Trace closed and measurements computed.
    }

    var onComplete: ((MeasurementResult) -> Void)?
    var onCancel: (() -> Void)?
    var onError: ((String, String) -> Void)?

    // MARK: State

    private let arView = ARView(frame: .zero)
    private let arSession = ARMeasurementSession()
    private var phase: Phase = .capture { didSet { updateUIForPhase() } }

    private var frozenFrame: FrozenFrame?
    /// Trace samples in image-display coordinates (matching the UIImageView's
    /// internal coordinate system, which equals the underlying capture
    /// viewport since we size the image view to the captured image).
    private var tracePointsScreen: [CGPoint] = []
    private var traceWorldPoints: [SIMD3<Float>] = []
    private var lastMeasurements: PolygonMath.Measurements?
    private var lastConfidence: Float = 0
    private var photoUris: [String] = []

    // MARK: Capture-mode UI

    private let cancelButton = UIButton(type: .system)
    private let captureInstructionLabel = PaddingLabel()
    private let confidenceBadge = PaddingLabel()
    private let framingReticle = FramingReticleView()
    private let shutterButton = ShutterButton()

    // MARK: Review-mode UI

    private let reviewContainer = UIView()
    private let scrollView = UIScrollView()
    private let photoImageView = UIImageView()
    private let traceLayer = CAShapeLayer()
    private let reviewInstructionLabel = PaddingLabel()
    private let summaryCard = SummaryCardView()
    private let footerStack = UIStackView()
    private let rescanButton = UIButton(type: .system)
    private let redrawButton = UIButton(type: .system)
    private let saveButton = UIButton(type: .system)
    private var drawPan: UIPanGestureRecognizer?

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        setupARView()
        setupCaptureUI()
        setupReviewUI()
        wireSession()
        updateUIForPhase()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        arSession.pause()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Keep the trace layer's coordinate space in sync with the image view.
        traceLayer.frame = photoImageView.bounds
        redrawTracePath()
    }

    // MARK: Setup

    private func setupARView() {
        arView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(arView)
        NSLayoutConstraint.activate([
            arView.topAnchor.constraint(equalTo: view.topAnchor),
            arView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            arView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            arView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupCaptureUI() {
        configureIconButton(cancelButton, systemImage: "xmark")
        cancelButton.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)
        view.addSubview(cancelButton)

        configurePillLabel(captureInstructionLabel,
                           text: "Aim at the wound and tap the shutter.",
                           background: UIColor.black.withAlphaComponent(0.55))
        view.addSubview(captureInstructionLabel)

        configurePillLabel(confidenceBadge,
                           text: "Confidence: —",
                           background: UIColor.systemGray.withAlphaComponent(0.85))
        confidenceBadge.font = .systemFont(ofSize: 13, weight: .semibold)
        view.addSubview(confidenceBadge)

        framingReticle.translatesAutoresizingMaskIntoConstraints = false
        framingReticle.isUserInteractionEnabled = false
        view.addSubview(framingReticle)

        shutterButton.translatesAutoresizingMaskIntoConstraints = false
        shutterButton.addTarget(self, action: #selector(handleShutter), for: .touchUpInside)
        view.addSubview(shutterButton)

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            cancelButton.widthAnchor.constraint(equalToConstant: 40),
            cancelButton.heightAnchor.constraint(equalToConstant: 40),

            captureInstructionLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            captureInstructionLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureInstructionLabel.leadingAnchor.constraint(greaterThanOrEqualTo: cancelButton.trailingAnchor, constant: 12),

            confidenceBadge.topAnchor.constraint(equalTo: captureInstructionLabel.bottomAnchor, constant: 8),
            confidenceBadge.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            framingReticle.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            framingReticle.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            framingReticle.widthAnchor.constraint(equalToConstant: 220),
            framingReticle.heightAnchor.constraint(equalToConstant: 220),

            shutterButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -28),
            shutterButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterButton.widthAnchor.constraint(equalToConstant: 76),
            shutterButton.heightAnchor.constraint(equalToConstant: 76)
        ])
    }

    private func setupReviewUI() {
        reviewContainer.translatesAutoresizingMaskIntoConstraints = false
        reviewContainer.backgroundColor = .black
        view.addSubview(reviewContainer)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.delegate = self
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 4.0
        scrollView.bouncesZoom = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.showsHorizontalScrollIndicator = false
        // Two-finger pan to scroll so single-finger pans go to the draw recognizer.
        scrollView.panGestureRecognizer.minimumNumberOfTouches = 2
        reviewContainer.addSubview(scrollView)

        photoImageView.translatesAutoresizingMaskIntoConstraints = false
        photoImageView.contentMode = .scaleAspectFit
        photoImageView.isUserInteractionEnabled = true
        photoImageView.backgroundColor = .black
        scrollView.addSubview(photoImageView)

        traceLayer.strokeColor = UIColor.systemGreen.cgColor
        traceLayer.fillColor = UIColor.systemGreen.withAlphaComponent(0.22).cgColor
        traceLayer.lineWidth = 3
        traceLayer.lineJoin = .round
        traceLayer.lineCap = .round
        photoImageView.layer.addSublayer(traceLayer)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleDrawPan(_:)))
        pan.minimumNumberOfTouches = 1
        pan.maximumNumberOfTouches = 1
        pan.delegate = self
        photoImageView.addGestureRecognizer(pan)
        drawPan = pan

        configurePillLabel(reviewInstructionLabel,
                           text: "Trace the wound boundary with one finger. Pinch to zoom.",
                           background: UIColor.black.withAlphaComponent(0.55))
        reviewContainer.addSubview(reviewInstructionLabel)

        summaryCard.translatesAutoresizingMaskIntoConstraints = false
        reviewContainer.addSubview(summaryCard)

        configureOutlineActionButton(rescanButton, title: "Rescan", systemImage: "arrow.clockwise")
        configureOutlineActionButton(redrawButton, title: "Redraw", systemImage: "rectangle.dashed")
        configureFilledActionButton(saveButton, title: "Save Measurement", systemImage: "square.and.arrow.down.fill")

        rescanButton.addTarget(self, action: #selector(handleRescan), for: .touchUpInside)
        redrawButton.addTarget(self, action: #selector(handleRedraw), for: .touchUpInside)
        saveButton.addTarget(self, action: #selector(handleSave), for: .touchUpInside)

        let outlinedRow = UIStackView(arrangedSubviews: [rescanButton, redrawButton])
        outlinedRow.axis = .horizontal
        outlinedRow.distribution = .fillEqually
        outlinedRow.spacing = 12

        footerStack.translatesAutoresizingMaskIntoConstraints = false
        footerStack.axis = .horizontal
        footerStack.distribution = .fill
        footerStack.spacing = 12
        footerStack.addArrangedSubview(outlinedRow)
        footerStack.addArrangedSubview(saveButton)
        // Save is ~1.8× the outlined pair so it reads as the primary action.
        saveButton.widthAnchor.constraint(equalTo: outlinedRow.widthAnchor, multiplier: 0.9).isActive = true
        reviewContainer.addSubview(footerStack)

        NSLayoutConstraint.activate([
            reviewContainer.topAnchor.constraint(equalTo: view.topAnchor),
            reviewContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            reviewContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            reviewContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            reviewInstructionLabel.topAnchor.constraint(equalTo: reviewContainer.safeAreaLayoutGuide.topAnchor, constant: 16),
            reviewInstructionLabel.centerXAnchor.constraint(equalTo: reviewContainer.centerXAnchor),
            reviewInstructionLabel.leadingAnchor.constraint(greaterThanOrEqualTo: reviewContainer.leadingAnchor, constant: 64),
            reviewInstructionLabel.trailingAnchor.constraint(lessThanOrEqualTo: reviewContainer.trailingAnchor, constant: -16),

            scrollView.topAnchor.constraint(equalTo: reviewInstructionLabel.bottomAnchor, constant: 12),
            scrollView.leadingAnchor.constraint(equalTo: reviewContainer.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: reviewContainer.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: summaryCard.topAnchor, constant: -12),

            summaryCard.leadingAnchor.constraint(equalTo: reviewContainer.leadingAnchor, constant: 16),
            summaryCard.trailingAnchor.constraint(equalTo: reviewContainer.trailingAnchor, constant: -16),
            summaryCard.bottomAnchor.constraint(equalTo: footerStack.topAnchor, constant: -12),

            footerStack.leadingAnchor.constraint(equalTo: reviewContainer.leadingAnchor, constant: 16),
            footerStack.trailingAnchor.constraint(equalTo: reviewContainer.trailingAnchor, constant: -16),
            footerStack.bottomAnchor.constraint(equalTo: reviewContainer.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            footerStack.heightAnchor.constraint(equalToConstant: 52)
        ])
    }

    private func wireSession() {
        arSession.onFrame = { [weak self] _ in self?.refreshConfidenceBadge() }
        arSession.onError = { [weak self] code, message in
            self?.onError?(code.rawValue, message)
        }
        arSession.start()
        arView.session = arSession.session
    }

    // MARK: Phase transitions

    private func updateUIForPhase() {
        switch phase {
        case .capture:
            reviewContainer.isHidden = true
            arView.isHidden = false
            shutterButton.isHidden = false
            framingReticle.isHidden = false
            captureInstructionLabel.isHidden = false
            confidenceBadge.isHidden = false
            cancelButton.tintColor = .white

        case .reviewEmpty:
            reviewContainer.isHidden = false
            arView.isHidden = true
            shutterButton.isHidden = true
            framingReticle.isHidden = true
            captureInstructionLabel.isHidden = true
            confidenceBadge.isHidden = true
            reviewInstructionLabel.text = "Trace the wound boundary with one finger. Pinch to zoom."
            summaryCard.setEmpty()
            saveButton.isEnabled = false

        case .reviewTracing:
            reviewInstructionLabel.text = "Lift your finger to close the trace."
            saveButton.isEnabled = false

        case .reviewReady:
            reviewInstructionLabel.text = "Review the measurements, then save."
            if let m = lastMeasurements {
                summaryCard.setMeasurements(m, confidence: lastConfidence)
            }
            saveButton.isEnabled = true
        }
    }

    // MARK: Capture actions

    @objc private func handleShutter() {
        // Block the shutter if scene depth has clearly broken down — better
        // to ask the user to steady the device than to capture a noisy frame.
        let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        let confidence = arSession.meanConfidence(
            centerScreen: center, radiusPx: 80, viewportSize: arView.bounds.size
        )
        guard confidence >= 0.5 else {
            captureInstructionLabel.text = "Hold steady — depth confidence is too low."
            return
        }

        guard let frozen = arSession.freezeCurrentFrame(captureViewport: arView.bounds.size) else {
            captureInstructionLabel.text = "Couldn't grab a depth frame — try again."
            return
        }
        frozenFrame = frozen
        photoImageView.image = frozen.image
        sizeImageViewForContent()
        tracePointsScreen.removeAll()
        traceWorldPoints.removeAll()
        lastMeasurements = nil
        lastConfidence = 0
        redrawTracePath()
        phase = .reviewEmpty
    }

    @objc private func handleCancel() {
        onCancel?()
    }

    // MARK: Review actions

    @objc private func handleRescan() {
        frozenFrame = nil
        photoImageView.image = nil
        tracePointsScreen.removeAll()
        traceWorldPoints.removeAll()
        lastMeasurements = nil
        lastConfidence = 0
        scrollView.setZoomScale(1.0, animated: false)
        redrawTracePath()
        phase = .capture
        captureInstructionLabel.text = "Aim at the wound and tap the shutter."
    }

    @objc private func handleRedraw() {
        tracePointsScreen.removeAll()
        traceWorldPoints.removeAll()
        lastMeasurements = nil
        lastConfidence = 0
        redrawTracePath()
        phase = .reviewEmpty
    }

    @objc private func handleSave() {
        guard phase == .reviewReady,
              let m = lastMeasurements,
              traceWorldPoints.count >= 3 else { return }

        capturePhoto { [weak self] uri in
            guard let self = self else { return }
            if let uri = uri { self.photoUris.append(uri) }

            let result = MeasurementResult(
                lengthMm: m.lengthMm,
                widthMm: m.widthMm,
                depthMm: nil,
                areaMm2: m.areaMm2,
                perimeterMm: m.perimeterMm,
                polygonPoints: self.traceWorldPoints.map {
                    MeasurementResult.Point3D(x: $0.x, y: $0.y, z: $0.z)
                },
                measurementMethod: "ar_lidar_trace",
                confidenceScore: self.lastConfidence,
                photoUris: self.photoUris,
                deviceModel: UIDevice.current.model,
                osVersion: UIDevice.current.systemVersion,
                arTrackingState: self.frozenFrame?.trackingState ?? "unknown"
            )
            self.onComplete?(result)
        }
    }

    // MARK: Drawing

    @objc private func handleDrawPan(_ gesture: UIPanGestureRecognizer) {
        guard frozenFrame != nil else { return }
        let point = gesture.location(in: photoImageView)

        switch gesture.state {
        case .began:
            tracePointsScreen.removeAll()
            traceWorldPoints.removeAll()
            phase = .reviewTracing
            appendTracePoint(point)
        case .changed:
            appendTracePoint(point)
        case .ended:
            finalizeTrace()
        case .cancelled, .failed:
            // System cancelled the pan (likely because a second finger
            // landed and a pinch took over). Discard the partial trace and
            // let the user start over.
            tracePointsScreen.removeAll()
            traceWorldPoints.removeAll()
            redrawTracePath()
            phase = .reviewEmpty
        default:
            break
        }
    }

    private func appendTracePoint(_ pointInImageView: CGPoint) {
        // Clamp to image bounds; the pan can drift outside while a finger
        // hovers over the scroll view's edge.
        let bounds = photoImageView.bounds
        guard bounds.width > 0, bounds.height > 0 else { return }
        let clamped = CGPoint(
            x: min(max(pointInImageView.x, 0), bounds.width),
            y: min(max(pointInImageView.y, 0), bounds.height)
        )

        // Dedupe near-coincident screen samples so a slow drag doesn't bloat
        // the polygon. Threshold scales with the current zoom so it stays a
        // consistent finger-tip distance for the user.
        let zoom = max(scrollView.zoomScale, 0.0001)
        if let last = tracePointsScreen.last,
           hypot(last.x - clamped.x, last.y - clamped.y) < (4.0 / CGFloat(zoom)) {
            return
        }
        tracePointsScreen.append(clamped)
        redrawTracePath()
    }

    private func finalizeTrace() {
        guard tracePointsScreen.count >= 3, let frozen = frozenFrame else {
            phase = .reviewEmpty
            return
        }
        // Drop the trace through the frozen depth map. We tolerate gaps —
        // dropped points get skipped, but we keep the polygon shape on
        // screen for context.
        let viewport = photoImageView.bounds.size
        var worldPoints: [SIMD3<Float>] = []
        worldPoints.reserveCapacity(tracePointsScreen.count)
        for p in tracePointsScreen {
            if let w = ARMeasurementSession.worldPoint(
                forScreenPoint: p, in: viewport, using: frozen
            ) {
                worldPoints.append(w * 1000) // meters → mm
            }
        }

        guard worldPoints.count >= 3,
              let fit = WoundPlaneFitter.fit(points: worldPoints) else {
            reviewInstructionLabel.text = "Couldn't measure that trace — try redrawing."
            phase = .reviewEmpty
            return
        }

        let measurements = PolygonMath.measurements(points3D: worldPoints, plane: fit.plane)
        let confidence = ARMeasurementSession.meanConfidence(
            screenPoints: tracePointsScreen, in: viewport, using: frozen
        )

        traceWorldPoints = worldPoints
        lastMeasurements = measurements
        lastConfidence = confidence
        redrawTracePath(close: true)
        phase = .reviewReady
    }

    private func redrawTracePath(close: Bool = false) {
        guard !tracePointsScreen.isEmpty else {
            traceLayer.path = nil
            return
        }
        let path = UIBezierPath()
        for (i, p) in tracePointsScreen.enumerated() {
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        if close { path.close() }
        traceLayer.path = path.cgPath
    }

    private func sizeImageViewForContent() {
        guard let image = photoImageView.image else { return }
        // We size the image view to a fitted rectangle inside the scroll
        // view's bounds. This gives the trace layer a predictable coordinate
        // space (matching the captured photo) regardless of zoom.
        let bounds = scrollView.bounds
        guard bounds.width > 0, bounds.height > 0 else { return }
        let scale = min(bounds.width / image.size.width,
                        bounds.height / image.size.height)
        let fitted = CGSize(width: image.size.width * scale,
                            height: image.size.height * scale)
        photoImageView.frame = CGRect(origin: .zero, size: fitted)
        scrollView.contentSize = fitted
        scrollView.setZoomScale(1.0, animated: false)
        centerImageInScrollView()
    }

    private func centerImageInScrollView() {
        let bounds = scrollView.bounds
        let content = photoImageView.frame
        let insetX = max(0, (bounds.width - content.width) / 2)
        let insetY = max(0, (bounds.height - content.height) / 2)
        scrollView.contentInset = UIEdgeInsets(top: insetY, left: insetX, bottom: insetY, right: insetX)
    }

    // MARK: Confidence badge

    private func refreshConfidenceBadge() {
        guard phase == .capture else { return }
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
        confidenceBadge.backgroundColor = color.withAlphaComponent(0.9)
    }

    // MARK: Photo capture

    private func capturePhoto(completion: @escaping (String?) -> Void) {
        // TODO: write the frozen UIImage to the app's encrypted sandbox via
        // expo-file-system, returning a file:// URI. EXIF is stripped client
        // side via expo-image-manipulator on the JS side before upload.
        completion(nil)
    }

    // MARK: Styling helpers

    private func configureIconButton(_ button: UIButton, systemImage: String) {
        button.translatesAutoresizingMaskIntoConstraints = false
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        button.setImage(UIImage(systemName: systemImage, withConfiguration: config), for: .normal)
        button.tintColor = .white
        button.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        button.layer.cornerRadius = 20
        button.layer.masksToBounds = true
    }

    private func configurePillLabel(_ label: PaddingLabel, text: String, background: UIColor) {
        label.text = text
        label.textColor = .white
        label.font = .systemFont(ofSize: 14, weight: .semibold)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.backgroundColor = background
        label.layer.cornerRadius = 16
        label.layer.masksToBounds = true
        label.translatesAutoresizingMaskIntoConstraints = false
        label.edgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
    }

    private func configureOutlineActionButton(_ button: UIButton, title: String, systemImage: String) {
        var config = UIButton.Configuration.plain()
        config.title = title
        config.image = UIImage(systemName: systemImage)
        config.imagePadding = 8
        config.imagePlacement = .leading
        config.baseForegroundColor = .white
        config.background.strokeColor = UIColor.white.withAlphaComponent(0.6)
        config.background.strokeWidth = 1.5
        config.background.cornerRadius = 12
        config.cornerStyle = .fixed
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
        button.configuration = config
        button.translatesAutoresizingMaskIntoConstraints = false
        button.tintColor = .white
    }

    private func configureFilledActionButton(_ button: UIButton, title: String, systemImage: String) {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.image = UIImage(systemName: systemImage)
        config.imagePadding = 8
        config.imagePlacement = .leading
        config.baseBackgroundColor = .systemGreen
        config.baseForegroundColor = .white
        config.background.cornerRadius = 12
        config.cornerStyle = .fixed
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
        button.configuration = config
        button.translatesAutoresizingMaskIntoConstraints = false
        // Disabled appearance for when Save can't be tapped yet.
        button.configurationUpdateHandler = { btn in
            var updated = btn.configuration
            updated?.baseBackgroundColor = btn.isEnabled
                ? .systemGreen
                : UIColor.systemGreen.withAlphaComponent(0.35)
            btn.configuration = updated
        }
    }
}

// MARK: - UIScrollViewDelegate

extension ARMeasurementViewController: UIScrollViewDelegate {
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { photoImageView }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        centerImageInScrollView()
    }
}

// MARK: - UIGestureRecognizerDelegate

extension ARMeasurementViewController: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        // Let the scroll view's pinch run alongside our 1-finger draw if the
        // user happens to start a pinch mid-draw.
        return other === scrollView.pinchGestureRecognizer
    }
}

// MARK: - Small reusable UI bits

/// UILabel with content-edge insets so the pill background has breathing room.
final class PaddingLabel: UILabel {
    var edgeInsets: UIEdgeInsets = .zero {
        didSet { invalidateIntrinsicContentSize() }
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: edgeInsets))
    }

    override var intrinsicContentSize: CGSize {
        let base = super.intrinsicContentSize
        return CGSize(width: base.width + edgeInsets.left + edgeInsets.right,
                      height: base.height + edgeInsets.top + edgeInsets.bottom)
    }
}

/// Dashed-corner framing rectangle drawn over the live AR preview.
final class FramingReticleView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        translatesAutoresizingMaskIntoConstraints = false
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.7).cgColor)
        ctx.setLineWidth(2)
        ctx.setLineDash(phase: 0, lengths: [6, 4])
        let corner: CGFloat = 18
        // Top-left
        ctx.move(to: CGPoint(x: 0, y: corner));      ctx.addLine(to: .zero); ctx.addLine(to: CGPoint(x: corner, y: 0))
        // Top-right
        ctx.move(to: CGPoint(x: rect.width - corner, y: 0))
        ctx.addLine(to: CGPoint(x: rect.width, y: 0))
        ctx.addLine(to: CGPoint(x: rect.width, y: corner))
        // Bottom-right
        ctx.move(to: CGPoint(x: rect.width, y: rect.height - corner))
        ctx.addLine(to: CGPoint(x: rect.width, y: rect.height))
        ctx.addLine(to: CGPoint(x: rect.width - corner, y: rect.height))
        // Bottom-left
        ctx.move(to: CGPoint(x: corner, y: rect.height))
        ctx.addLine(to: CGPoint(x: 0, y: rect.height))
        ctx.addLine(to: CGPoint(x: 0, y: rect.height - corner))
        ctx.strokePath()
    }
}

/// Big round shutter button — white ring, white inner disc.
final class ShutterButton: UIButton {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        layer.borderColor = UIColor.white.cgColor
        layer.borderWidth = 4
        let inner = UIView()
        inner.translatesAutoresizingMaskIntoConstraints = false
        inner.backgroundColor = .white
        inner.isUserInteractionEnabled = false
        addSubview(inner)
        NSLayoutConstraint.activate([
            inner.centerXAnchor.constraint(equalTo: centerXAnchor),
            inner.centerYAnchor.constraint(equalTo: centerYAnchor),
            inner.widthAnchor.constraint(equalTo: widthAnchor, multiplier: 0.72),
            inner.heightAnchor.constraint(equalTo: heightAnchor, multiplier: 0.72)
        ])
        DispatchQueue.main.async {
            self.layer.cornerRadius = self.bounds.width / 2
            inner.layer.cornerRadius = inner.bounds.width / 2
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.width / 2
        if let inner = subviews.first {
            inner.layer.cornerRadius = inner.bounds.width / 2
        }
    }
}

/// Bottom card that surfaces length / width / area / perimeter and a
/// confidence pill once the polygon is closed.
final class SummaryCardView: UIView {
    private let titleLabel = UILabel()
    private let confidencePill = PaddingLabel()
    private let lengthValue = UILabel()
    private let widthValue = UILabel()
    private let areaValue = UILabel()
    private let perimeterValue = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(white: 0, alpha: 0.55)
        layer.cornerRadius = 16
        translatesAutoresizingMaskIntoConstraints = false

        titleLabel.text = "Measurements"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        confidencePill.textColor = .white
        confidencePill.font = .systemFont(ofSize: 11, weight: .semibold)
        confidencePill.textAlignment = .center
        confidencePill.backgroundColor = UIColor.systemGray.withAlphaComponent(0.85)
        confidencePill.layer.cornerRadius = 10
        confidencePill.layer.masksToBounds = true
        confidencePill.edgeInsets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        confidencePill.translatesAutoresizingMaskIntoConstraints = false

        let header = UIStackView(arrangedSubviews: [titleLabel, confidencePill])
        header.axis = .horizontal
        header.alignment = .center
        header.distribution = .equalSpacing
        header.translatesAutoresizingMaskIntoConstraints = false

        let lengthRow = labelledRow(title: "Length", value: lengthValue)
        let widthRow = labelledRow(title: "Width", value: widthValue)
        let areaRow = labelledRow(title: "Area", value: areaValue)
        let perimRow = labelledRow(title: "Perimeter", value: perimeterValue)

        let pairOne = UIStackView(arrangedSubviews: [lengthRow, widthRow])
        let pairTwo = UIStackView(arrangedSubviews: [areaRow, perimRow])
        [pairOne, pairTwo].forEach {
            $0.axis = .horizontal
            $0.distribution = .fillEqually
            $0.spacing = 12
        }

        let main = UIStackView(arrangedSubviews: [header, pairOne, pairTwo])
        main.axis = .vertical
        main.spacing = 10
        main.translatesAutoresizingMaskIntoConstraints = false
        addSubview(main)

        NSLayoutConstraint.activate([
            main.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            main.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            main.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            main.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])

        setEmpty()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    private func labelledRow(title: String, value: UILabel) -> UIView {
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.textColor = UIColor.white.withAlphaComponent(0.7)
        titleLabel.font = .systemFont(ofSize: 12, weight: .medium)

        value.textColor = .white
        value.font = .systemFont(ofSize: 18, weight: .semibold)
        value.text = "—"

        let stack = UIStackView(arrangedSubviews: [titleLabel, value])
        stack.axis = .vertical
        stack.spacing = 2
        return stack
    }

    func setEmpty() {
        [lengthValue, widthValue, areaValue, perimeterValue].forEach { $0.text = "—" }
        confidencePill.text = "Awaiting trace"
        confidencePill.backgroundColor = UIColor.systemGray.withAlphaComponent(0.85)
    }

    func setMeasurements(_ m: PolygonMath.Measurements, confidence: Float) {
        lengthValue.text = String(format: "%.1f mm", m.lengthMm)
        widthValue.text = String(format: "%.1f mm", m.widthMm)
        areaValue.text = String(format: "%.0f mm²", m.areaMm2)
        perimeterValue.text = String(format: "%.0f mm", m.perimeterMm)

        switch confidence {
        case 0.8...:
            confidencePill.text = String(format: "Confidence %.0f%%", confidence * 100)
            confidencePill.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.9)
        case 0.5..<0.8:
            confidencePill.text = String(format: "Confidence %.0f%%", confidence * 100)
            confidencePill.backgroundColor = UIColor.systemYellow.withAlphaComponent(0.9)
        default:
            confidencePill.text = String(format: "Confidence %.0f%%", confidence * 100)
            confidencePill.backgroundColor = UIColor.systemRed.withAlphaComponent(0.9)
        }
    }
}
