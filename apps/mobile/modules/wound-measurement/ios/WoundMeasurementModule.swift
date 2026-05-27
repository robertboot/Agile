import ExpoModulesCore
import ARKit
import UIKit

/// Expo Modules bridge for the wound measurement screen.
///
/// JS contract (see ../index.ts):
///   - measureWound(): Promise<MeasurementResult>   - opens AR screen, resolves on save
///   - isDepthSupported(): bool                     - any depth API available?
///   - hasDedicatedDepthSensor(): bool              - LiDAR present?
public class WoundMeasurementModule: Module {
    private weak var pendingPromise: Promise?

    public func definition() -> ModuleDefinition {
        Name("WoundMeasurementModule")

        Function("isDepthSupported") { () -> Bool in
            ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
        }

        Function("hasDedicatedDepthSensor") { () -> Bool in
            ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
        }

        AsyncFunction("measureWound") { (promise: Promise) in
            guard ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) else {
                promise.reject("MEASUREMENT_DEPTH_UNSUPPORTED",
                               "Device lacks LiDAR; wound measurement requires an iPhone 12 Pro or later (Pro models) or an iPad Pro 2020+.")
                return
            }

            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.pendingPromise = promise
                self.presentMeasurementScreen()
            }
        }
    }

    private func presentMeasurementScreen() {
        guard let presenter = topViewController() else {
            pendingPromise?.reject("MEASUREMENT_NO_PRESENTER",
                                   "Could not find a view controller to present from.")
            pendingPromise = nil
            return
        }

        let vc = ARMeasurementViewController()
        vc.modalPresentationStyle = .fullScreen
        vc.onComplete = { [weak self] result in
            self?.pendingPromise?.resolve(result.toDictionary())
            self?.pendingPromise = nil
            presenter.dismiss(animated: true)
        }
        vc.onCancel = { [weak self] in
            self?.pendingPromise?.reject("MEASUREMENT_CANCELLED",
                                          "User cancelled the measurement.")
            self?.pendingPromise = nil
            presenter.dismiss(animated: true)
        }
        vc.onError = { [weak self] code, message in
            self?.pendingPromise?.reject(code, message)
            self?.pendingPromise = nil
            presenter.dismiss(animated: true)
        }
        presenter.present(vc, animated: true)
    }

    private func topViewController() -> UIViewController? {
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?
            .rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
