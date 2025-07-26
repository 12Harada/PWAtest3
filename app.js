class CustomerMapApp {
    constructor() {
        this.map = null;
        this.customers = [];
        this.markers = [];
        this.selectedCustomer = null;
        
        this.init();
    }

    async init() {
        this.initMap();
        this.bindEvents();
        this.setupNetworkListeners();
        await this.loadCustomers();
        this.registerServiceWorker();
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

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered successfully:', registration);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
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