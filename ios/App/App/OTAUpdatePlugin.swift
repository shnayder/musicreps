import Capacitor
import Foundation

/// Native OTA update plugin. On launch, decides whether to load from
/// the bundled web content or a previously downloaded update, with
/// crash protection via a health-check state machine.
///
/// Paths are stored as relative (e.g. "ota/current") and resolved
/// against the current Library directory at runtime, so they survive
/// app container UUID changes (Xcode reinstalls, iOS updates).
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
    private let kRelPath = "ota_rel_path"   // relative to Library/, e.g. "ota/current"
    private let kStatus = "ota_status"
    private let kVersion = "ota_version"
    private let kAttempts = "ota_attempts"
    private let maxAttempts = 2

    /// Resolve a relative path against the current Library directory.
    private func resolveAbsPath(_ relPath: String) -> String? {
        guard let libDir = FileManager.default.urls(
            for: .libraryDirectory, in: .userDomainMask
        ).first else { return nil }
        return libDir.appendingPathComponent(relPath).path
    }

    /// Get the absolute path for the stored update, if it exists.
    private func currentUpdatePath() -> String? {
        guard let relPath = defaults.string(forKey: kRelPath) else { return nil }
        guard let absPath = resolveAbsPath(relPath) else { return nil }
        guard FileManager.default.fileExists(atPath: absPath + "/index.html") else { return nil }
        return absPath
    }

    /// Parse a release version string like "#456" → 456.
    /// Returns nil for non-release strings (dev hashes, empty, etc.).
    private func parseReleaseNum(_ version: String) -> Int? {
        guard version.hasPrefix("#") else { return nil }
        return Int(version.dropFirst())
    }

    /// Read the bundled version from bundled-version.txt in the app's public/ dir.
    private func bundledVersion() -> String? {
        guard let path = Bundle.main.path(forResource: "bundled-version", ofType: "txt", inDirectory: "public") else {
            return nil
        }
        return try? String(contentsOfFile: path, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// True when the bundled app version is >= the cached OTA version,
    /// meaning the OTA cache is stale and should be discarded.
    private func bundledIsNewerThanOTA() -> Bool {
        guard let otaVersion = defaults.string(forKey: kVersion), !otaVersion.isEmpty else {
            return false // no OTA version stored
        }
        guard let bundled = bundledVersion() else {
            return false // can't read bundled version, keep OTA
        }
        guard let otaNum = parseReleaseNum(otaVersion) else {
            return true // OTA version is malformed, reset
        }
        guard let bundledNum = parseReleaseNum(bundled) else {
            return true // bundled is a dev build (hash), treat as newer
        }
        return bundledNum >= otaNum
    }

    override public func load() {
        let status = defaults.string(forKey: kStatus) ?? "none"
        let relPath = defaults.string(forKey: kRelPath)

        print("[OTA] load() status=\(status) relPath=\(relPath ?? "nil")")

        // If the bundled app has been updated (App Store / Xcode rebuild)
        // past the cached OTA version, discard the stale OTA and use bundled.
        if status != "none" && bundledIsNewerThanOTA() {
            let otaVer = defaults.string(forKey: kVersion) ?? "?"
            let bundledVer = bundledVersion() ?? "?"
            print("[OTA] bundled \(bundledVer) >= OTA \(otaVer), resetting to bundled")
            if let relPath = relPath, let absPath = resolveAbsPath(relPath) {
                cleanupUpdateFiles(absPath)
            }
            resetState()
            return
        }

        switch status {
        case "ready":
            guard let absPath = currentUpdatePath() else {
                print("[OTA] ready but update files missing, resetting")
                resetState()
                return
            }
            defaults.set("pending", forKey: kStatus)
            defaults.set(1, forKey: kAttempts)
            print("[OTA] switching to update at \(absPath)")
            bridge?.setServerBasePath(absPath)

        case "pending":
            let attempts = defaults.integer(forKey: kAttempts)
            guard let absPath = currentUpdatePath(), attempts < maxAttempts else {
                print("[OTA] update failed after \(attempts) attempts, reverting to bundled")
                if let relPath = relPath, let absPath = resolveAbsPath(relPath) {
                    cleanupUpdateFiles(absPath)
                }
                resetState()
                return
            }
            defaults.set(attempts + 1, forKey: kAttempts)
            print("[OTA] retry attempt \(attempts + 1) from \(absPath)")
            bridge?.setServerBasePath(absPath)

        case "healthy":
            guard let absPath = currentUpdatePath() else {
                print("[OTA] healthy but update files missing, resetting")
                resetState()
                return
            }
            defaults.set("pending", forKey: kStatus)
            defaults.set(1, forKey: kAttempts)
            bridge?.setServerBasePath(absPath)

        default:
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
    /// `path` is the relative path under Library/ (e.g. "ota/current").
    @objc func setUpdatePath(_ call: CAPPluginCall) {
        guard let relPath = call.getString("path") else {
            call.reject("Must provide path")
            return
        }
        guard let version = call.getString("version") else {
            call.reject("Must provide version")
            return
        }
        // Verify the file exists at the resolved path
        guard let absPath = resolveAbsPath(relPath),
              FileManager.default.fileExists(atPath: absPath + "/index.html") else {
            call.reject("No index.html at resolved path for: \(relPath)")
            return
        }
        defaults.set(relPath, forKey: kRelPath)
        defaults.set(version, forKey: kVersion)
        defaults.set("ready", forKey: kStatus)
        defaults.set(0, forKey: kAttempts)
        print("[OTA] update registered: v\(version) relPath=\(relPath) absPath=\(absPath)")
        call.resolve(["status": "ready", "version": version])
    }

    /// Returns current OTA state for the JS updater.
    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "status": defaults.string(forKey: kStatus) ?? "none",
            "version": defaults.string(forKey: kVersion) ?? "",
            "path": defaults.string(forKey: kRelPath) ?? "",
            "attempts": defaults.integer(forKey: kAttempts),
        ])
    }

    /// Clears all OTA state, reverts to bundled on next launch.
    @objc func reset(_ call: CAPPluginCall) {
        if let relPath = defaults.string(forKey: kRelPath),
           let absPath = resolveAbsPath(relPath) {
            cleanupUpdateFiles(absPath)
        }
        resetState()
        print("[OTA] reset to bundled")
        call.resolve(["status": "none"])
    }

    private func resetState() {
        defaults.removeObject(forKey: kRelPath)
        defaults.removeObject(forKey: kVersion)
        defaults.set("none", forKey: kStatus)
        defaults.set(0, forKey: kAttempts)
    }

    private func cleanupUpdateFiles(_ absPath: String) {
        try? FileManager.default.removeItem(atPath: absPath)
    }
}
