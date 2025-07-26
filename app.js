class CustomerMapApp {
    constructor() {
        this.map = null;
        this.customers = [];
        this.markers = [];
        this.selectedCustomer = null;
        this.pushSubscription = null;
        this.isNativeApp = this.detectNativeApp();
        
        this.init();
    }
    
    // ネイティブアプリ内での実行を検出
    detectNativeApp() {
        return (window.webkit && window.webkit.messageHandlers) || 
               navigator.userAgent.includes('CustomerMapApp');
    }

    async init() {
        this.initMap();
        this.bindEvents();
        this.setupNetworkListeners();
        await this.loadCustomers();
        this.registerServiceWorker();
        
        // ネイティブアプリとの連携設定
        if (this.isNativeApp) {
            this.setupNativeBridge();
            console.log('Native app bridge initialized');
        }
    }
    
    setupNetworkListeners() {
        // オンライン・オフライン状態の監視
        window.addEventListener('online', () => {
            console.log('ネットワークに接続しました');
            this.hideOfflineNotice();
            this.loadCustomers(); // データを再読み込み
        });
        
        window.addEventListener('offline', () => {
            console.log('ネットワークから切断されました');
            this.showOfflineNotice();
        });
    }

    initMap() {
        // 東京を中心とした地図を初期化
        this.map = L.map('map').setView([35.6762, 139.6503], 11);

        // OpenStreetMapタイルレイヤーを追加（無料）
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // マップクリックイベント
        this.map.on('click', () => {
            this.clearSelection();
        });
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => {
            this.loadCustomers();
        });
        
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.toggleNotifications();
            });
        }
    }

    async loadCustomers() {
        const customerList = document.getElementById('customerList');
        
        // オフライン状態表示
        if (!navigator.onLine) {
            customerList.innerHTML = '<div class="offline-notice">オフラインモード - キャッシュデータを使用中</div><div class="loading">お客様情報を読み込み中...</div>';
        } else {
            customerList.innerHTML = '<div class="loading">お客様情報を読み込み中...</div>';
        }

        try {
            const response = await CustomerAPI.getCustomers();
            
            if (response.success) {
                this.customers = response.data;
                this.renderCustomerList();
                this.renderMapMarkers();
                
                // オフライン時はデータソースを表示
                if (!navigator.onLine) {
                    this.showOfflineNotice();
                }
            }
        } catch (error) {
            customerList.innerHTML = '<div class="error">お客様情報の読み込みに失敗しました</div>';
            console.error('Error loading customers:', error);
        }
    }
    
    showOfflineNotice() {
        const existingNotice = document.querySelector('.offline-banner');
        if (!existingNotice) {
            const banner = document.createElement('div');
            banner.className = 'offline-banner';
            banner.innerHTML = '⚠️ オフラインモード - 保存されたデータを表示中';
            document.querySelector('.app-header').appendChild(banner);
        }
    }
    
    hideOfflineNotice() {
        const notice = document.querySelector('.offline-banner');
        if (notice) {
            notice.remove();
        }
    }

    renderCustomerList() {
        const customerList = document.getElementById('customerList');
        
        if (this.customers.length === 0) {
            customerList.innerHTML = '<div class="error">お客様データがありません</div>';
            return;
        }

        const html = this.customers.map(customer => `
            <div class="customer-item" data-customer-id="${customer.id}">
                <div class="customer-name">${customer.name}</div>
                <div class="customer-address">${customer.address}</div>
                <div class="customer-phone">${customer.phone}</div>
            </div>
        `).join('');

        customerList.innerHTML = html;

        // お客様アイテムクリックイベント
        customerList.querySelectorAll('.customer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const customerId = parseInt(e.currentTarget.dataset.customerId);
                this.selectCustomer(customerId);
            });
        });
    }

    renderMapMarkers() {
        // 既存のマーカーをクリア
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];

        // 新しいマーカーを追加
        this.customers.forEach(customer => {
            const marker = L.marker([customer.lat, customer.lng])
                .addTo(this.map)
                .bindPopup(`
                    <div>
                        <h3>${customer.name}</h3>
                        <p>${customer.address}</p>
                        <p>${customer.phone}</p>
                    </div>
                `);

            marker.customerId = customer.id;
            
            marker.on('click', () => {
                this.selectCustomer(customer.id);
            });

            this.markers.push(marker);
        });

        // 全てのマーカーが見えるようにズーム調整
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    selectCustomer(customerId) {
        // 以前の選択をクリア
        this.clearSelection();

        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        this.selectedCustomer = customer;

        // お客様リストでの選択表示
        const customerItem = document.querySelector(`[data-customer-id="${customerId}"]`);
        if (customerItem) {
            customerItem.classList.add('selected');
        }

        // マーカーの選択表示
        const marker = this.markers.find(m => m.customerId === customerId);
        if (marker) {
            // マーカーを赤色に変更
            marker.setIcon(L.divIcon({
                className: 'custom-marker selected-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }));

            // マーカー位置に地図を移動
            this.map.setView([customer.lat, customer.lng], 15);
            
            // ポップアップを開く
            marker.openPopup();
        }
    }

    clearSelection() {
        // お客様リストの選択をクリア
        document.querySelectorAll('.customer-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        // マーカーの選択をクリア
        this.markers.forEach(marker => {
            marker.setIcon(L.divIcon({
                className: 'custom-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }));
        });

        this.selectedCustomer = null;
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('ServiceWorker registered successfully:', registration);
                
                // プッシュ通知の初期設定
                await this.initializePushNotifications(registration);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    }
    
    async initializePushNotifications(registration) {
        if (!('PushManager' in window)) {
            console.log('Push messaging is not supported');
            return;
        }
        
        // 既存の購読状態を確認
        try {
            this.pushSubscription = await registration.pushManager.getSubscription();
            this.updateNotificationButtonState();
        } catch (error) {
            console.error('Failed to get push subscription:', error);
        }
    }
    
    async toggleNotifications() {
        try {
            if (this.pushSubscription) {
                // 通知を無効にする
                this.pushSubscription = null;
                console.log('Notifications disabled');
            } else {
                // 通知許可を要求
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    // ローカル通知のみ有効化（プッシュサービスは使用しない）
                    this.pushSubscription = { endpoint: 'local-notification-only', type: 'local' };
                    console.log('Local notifications enabled');
                    
                    // テスト通知を送信
                    await this.sendTestNotification();
                } else {
                    alert('通知の許可が必要です');
                    return;
                }
            }
            
            this.updateNotificationButtonState();
        } catch (error) {
            console.error('Failed to toggle notifications:', error);
            alert('通知設定の変更に失敗しました: ' + error.message);
        }
    }
    
    updateNotificationButtonState() {
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            if (this.pushSubscription) {
                notificationBtn.textContent = '通知無効';
                notificationBtn.classList.add('active');
            } else {
                notificationBtn.textContent = '通知有効';
                notificationBtn.classList.remove('active');
            }
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    async sendTestNotification() {
        if (this.pushSubscription) {
            try {
                // ネイティブアプリ内の場合はSwift側に通知を委譲
                if (this.isNativeApp && this.sendNativeNotification) {
                    this.sendNativeNotification({
                        title: 'Customer Map',
                        body: 'プッシュ通知が有効になりました！',
                        tag: 'customer-map-test'
                    });
                } else {
                    // Web環境では従来の通知
                    const notification = new Notification('Customer Map', {
                        body: 'プッシュ通知が有効になりました！',
                        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%232196F3"/%3E%3Ctext x="96" y="96" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle"%3ECM%3C/text%3E%3C/svg%3E',
                        tag: 'customer-map-test'
                    });
                    
                    notification.onclick = function() {
                        window.focus();
                        notification.close();
                    };
                    
                    setTimeout(() => {
                        notification.close();
                    }, 5000);
                }
                
                console.log('Test notification sent successfully');
            } catch (error) {
                console.error('Failed to send notification:', error);
                if (!this.isNativeApp) {
                    alert('通知の表示に失敗しました: ' + error.message);
                }
            }
        }
    }
    
    // ネイティブアプリとの通信用メソッド
    sendNativeNotification(data) {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notification) {
            window.webkit.messageHandlers.notification.postMessage(data);
        }
    }
    
    // Swift側からの呼び出し用のグローバル関数を設定
    setupNativeBridge() {
        window.CustomerMapApp = this;
        
        // Swift側から呼び出し可能な関数
        window.refreshCustomers = () => this.loadCustomers();
        window.selectCustomer = (id) => this.selectCustomer(id);
        window.getSelectedCustomer = () => this.selectedCustomer;
        window.getAllCustomers = () => this.customers;
    }
    
    // カスタマー更新時の通知
    async sendCustomerNotification(message) {
        if (this.pushSubscription && Notification.permission === 'granted') {
            try {
                const notification = new Notification('Customer Map - 更新通知', {
                    body: message,
                    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%232196F3"/%3E%3Ctext x="96" y="96" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle"%3ECM%3C/text%3E%3C/svg%3E',
                    tag: 'customer-update'
                });
                
                notification.onclick = function() {
                    window.focus();
                    notification.close();
                };
                
                setTimeout(() => {
                    notification.close();
                }, 8000);
                
            } catch (error) {
                console.error('Failed to send customer notification:', error);
            }
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new CustomerMapApp();
});

// PWA インストールプロンプト
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // インストールボタンを表示（必要に応じて）
    console.log('PWA install prompt ready');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
});