import Capacitor

/// Custom bridge view controller that registers local plugins.
/// Referenced from Main.storyboard instead of CAPBridgeViewController.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OTAUpdatePlugin())
    }
}
