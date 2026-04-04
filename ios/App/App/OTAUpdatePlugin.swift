import Capacitor
import Foundation

/// Native OTA update plugin. On launch, decides whether to load from
/// the bundled web content or a previously downloaded update, with
/// crash protection via a health-check state machine.
///
/// State machine (UserDefaults):
///   none → ready      (JS calls setUpdatePath after downloading)
///   ready → pending   (load() switches to update, increments attempts)
///   pending → healthy (JS calls reportHealthy after successful boot)
///   pending → none    (attempts >= 2, load() resets to bundled)
@objc(OTAUpdatePlugin)
public class OTAUpdatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OTAUpdatePlugin"
    public let jsName = "OTAUpdate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "reportHealthy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUpdatePath", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise),
    ]

    private let defaults = UserDefaults.standard
    private let kPath = "ota_bundle_path"
    private let kStatus = "ota_status"
    private let kVersion = "ota_version"
    private let kAttempts = "ota_attempts"
    private let maxAttempts = 2

    override public func load() {
        let status = defaults.string(forKey: kStatus) ?? "none"
        let path = defaults.string(forKey: kPath)

        print("[OTA] load() status=\(status) path=\(path ?? "nil")")

        switch status {
        case "ready":
            // A new update is ready — try loading it
            guard let path = path, FileManager.default.fileExists(atPath: path + "/index.html") else {
                print("[OTA] ready but path missing, resetting")
                resetState()
                return
            }
            defaults.set("pending", forKey: kStatus)
            defaults.set(1, forKey: kAttempts)
            print("[OTA] switching to update at \(path)")
            bridge?.setServerBasePath(path)

        case "pending":
            // Previous boot from this update didn't call reportHealthy
            let attempts = defaults.integer(forKey: kAttempts)
            guard let path = path, attempts < maxAttempts,
                  FileManager.default.fileExists(atPath: path + "/index.html") else {
                print("[OTA] update failed after \(attempts) attempts, reverting to bundled")
                cleanupUpdateFiles(path)
                resetState()
                return
            }
            // Try again
            defaults.set(attempts + 1, forKey: kAttempts)
            print("[OTA] retry attempt \(attempts + 1) from \(path)")
            bridge?.setServerBasePath(path)

        case "healthy":
            // Previous update booted successfully — keep using it
            guard let path = path, FileManager.default.fileExists(atPath: path + "/index.html") else {
                print("[OTA] healthy but path missing, resetting")
                resetState()
                return
            }
            // Set pending for this boot (will be marked healthy again if boot succeeds)
            defaults.set("pending", forKey: kStatus)
            defaults.set(1, forKey: kAttempts)
            bridge?.setServerBasePath(path)

        default:
            // "none" or unknown — use bundled content (default behavior)
            print("[OTA] using bundled content")
        }
    }

    /// Called by JS after successful boot to confirm the update works.
    @objc func reportHealthy(_ call: CAPPluginCall) {
        let status = defaults.string(forKey: kStatus) ?? "none"
        if status == "pending" {
            defaults.set("healthy", forKey: kStatus)
            defaults.set(0, forKey: kAttempts)
            print("[OTA] marked healthy")
        }
        call.resolve(["status": "healthy"])
    }

    /// Called by JS after downloading a new update.
    /// `path` is the absolute filesystem path to the directory containing index.html.
    @objc func setUpdatePath(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("Must provide path")
            return
        }
        guard let version = call.getString("version") else {
            call.reject("Must provide version")
            return
        }
        guard FileManager.default.fileExists(atPath: path + "/index.html") else {
            call.reject("No index.html at path: \(path)")
            return
        }
        defaults.set(path, forKey: kPath)
        defaults.set(version, forKey: kVersion)
        defaults.set("ready", forKey: kStatus)
        defaults.set(0, forKey: kAttempts)
        print("[OTA] update registered: v\(version) at \(path)")
        call.resolve(["status": "ready", "version": version])
    }

    /// Returns current OTA state for the JS updater.
    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "status": defaults.string(forKey: kStatus) ?? "none",
            "version": defaults.string(forKey: kVersion) ?? "",
            "path": defaults.string(forKey: kPath) ?? "",
            "attempts": defaults.integer(forKey: kAttempts),
        ])
    }

    /// Clears all OTA state, reverts to bundled on next launch.
    @objc func reset(_ call: CAPPluginCall) {
        let path = defaults.string(forKey: kPath)
        cleanupUpdateFiles(path)
        resetState()
        print("[OTA] reset to bundled")
        call.resolve(["status": "none"])
    }

    private func resetState() {
        defaults.removeObject(forKey: kPath)
        defaults.removeObject(forKey: kVersion)
        defaults.set("none", forKey: kStatus)
        defaults.set(0, forKey: kAttempts)
    }

    private func cleanupUpdateFiles(_ path: String?) {
        guard let path = path else { return }
        try? FileManager.default.removeItem(atPath: path)
    }
}
