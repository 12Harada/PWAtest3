# Swift ネイティブアプリ統合ガイド

## 必要な実装

### 1. WKWebView設定 (ViewController.swift)

```swift
import WebKit
import UserNotifications

class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    
    @IBOutlet weak var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        requestNotificationPermission()
    }
    
    func setupWebView() {
        let config = WKWebViewConfiguration()
        let userController = WKUserContentController()
        
        // JavaScript -> Swift メッセージハンドラーを追加
        userController.add(self, name: "notification")
        config.userContentController = userController
        
        // WKWebViewの設定
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        view.addSubview(webView)
        
        // PWAアプリをロード
        if let url = URL(string: "http://localhost:8000") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }
    
    // 通知許可を要求
    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("Notification permission granted")
            }
        }
    }
    
    // JavaScript からのメッセージを受信
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "notification":
            if let data = message.body as? [String: Any] {
                sendLocalNotification(data: data)
            }
        default:
            break
        }
    }
    
    // ローカル通知を送信
    func sendLocalNotification(data: [String: Any]) {
        let content = UNMutableNotificationContent()
        content.title = data["title"] as? String ?? "Customer Map"
        content.body = data["body"] as? String ?? ""
        content.sound = .default
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Notification error: \(error)")
            }
        }
    }
    
    // Swift -> JavaScript 通信用のメソッド
    func callJavaScriptFunction(functionName: String, parameters: [Any] = []) {
        let paramString = parameters.map { "\($0)" }.joined(separator: ",")
        let script = "\(functionName)(\(paramString))"
        
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("JavaScript execution error: \(error)")
            }
        }
    }
    
    // 例：カスタマーデータをリフレッシュ
    @IBAction func refreshCustomers(_ sender: Any) {
        callJavaScriptFunction(functionName: "refreshCustomers")
    }
}
```

### 2. Info.plist 設定

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>

<key>NSLocationWhenInUseUsageDescription</key>
<string>顧客の位置情報を地図に表示するために使用します</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>顧客の位置情報を地図に表示するために使用します</string>
```

### 3. プッシュ通知の設定 (AppDelegate.swift)

```swift
import UserNotifications

class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        UNUserNotificationCenter.current().delegate = self
        
        return true
    }
    
    // 通知がタップされた時の処理
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        
        // PWAアプリを開く処理
        if let window = UIApplication.shared.windows.first,
           let webViewController = window.rootViewController as? WebViewController {
            webViewController.callJavaScriptFunction(functionName: "window.focus")
        }
        
        completionHandler()
    }
    
    // アプリがフォアグラウンドにある時の通知処理
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .sound])
    }
}
```

## 使用方法

1. **WebViewでPWAをロード**: localhost:8000 または本番URLを指定
2. **通知連携**: JavaScript側の通知がネイティブ通知として表示
3. **データ連携**: Swift側からJavaScript関数を呼び出し可能
4. **双方向通信**: WKScriptMessageHandler でJavaScript→Swift通信

## 注意事項

- **セキュリティ**: 本番環境では適切なCSP設定が必要
- **HTTPS**: 本番環境ではHTTPS必須
- **パフォーマンス**: 大量データの場合はネイティブでの処理を検討
- **オフライン**: Service Workerがネイティブアプリでも動作することを確認