// 模擬的なお客様データ
const mockCustomers = [
    {
        id: 1,
        name: "田中 太郎",
        address: "東京都渋谷区神宮前1-1-1",
        phone: "03-1234-5678",
        email: "tanaka@example.com",
        lat: 35.6762,
        lng: 139.7012
    },
    {
        id: 2,
        name: "佐藤 花子",
        address: "東京都新宿区新宿3-1-1",
        phone: "03-2345-6789",
        email: "sato@example.com",
        lat: 35.6910,
        lng: 139.7007
    },
    {
        id: 3,
        name: "鈴木 次郎",
        address: "東京都港区六本木6-1-1",
        phone: "03-3456-7890",
        email: "suzuki@example.com",
        lat: 35.6627,
        lng: 139.7312
    },
    {
        id: 4,
        name: "高橋 美咲",
        address: "東京都品川区大崎2-1-1",
        phone: "03-4567-8901",
        email: "takahashi@example.com",
        lat: 35.6197,
        lng: 139.7284
    },
    {
        id: 5,
        name: "伊藤 健一",
        address: "東京都中央区銀座4-1-1",
        phone: "03-5678-9012",
        email: "ito@example.com",
        lat: 35.6717,
        lng: 139.7674
    }
];

// APIシミュレーション関数
class CustomerAPI {
    static async getCustomers() {
        try {
            // オフライン時のキャッシュからデータを取得
            const cachedData = await this.getCachedCustomers();
            
            // ネットワーク接続を確認
            if (!navigator.onLine && cachedData) {
                console.log('オフラインモード: キャッシュからデータを取得');
                return cachedData;
            }
            
            // リアルなAPI呼び出しをシミュレート
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const result = {
                        success: true,
                        data: mockCustomers,
                        count: mockCustomers.length
                    };
                    
                    // データをキャッシュに保存
                    this.cacheCustomers(result);
                    resolve(result);
                }, 1000);
            });
        } catch (error) {
            // エラー時はキャッシュからデータを取得
            console.log('API エラー: キャッシュからデータを取得');
            const cachedData = await this.getCachedCustomers();
            if (cachedData) {
                return cachedData;
            }
            throw error;
        }
    }
    
    // データをlocalStorageにキャッシュ
    static async cacheCustomers(data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem('customerCache', JSON.stringify(cacheData));
        } catch (error) {
            console.warn('キャッシュの保存に失敗:', error);
        }
    }
    
    // キャッシュからデータを取得
    static async getCachedCustomers() {
        try {
            const cachedItem = localStorage.getItem('customerCache');
            if (!cachedItem) return null;
            
            const cacheData = JSON.parse(cachedItem);
            const now = Date.now();
            const cacheAge = now - cacheData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24時間
            
            // キャッシュが古すぎる場合は削除
            if (cacheAge > maxAge) {
                localStorage.removeItem('customerCache');
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            console.warn('キャッシュの読み込みに失敗:', error);
            return null;
        }
    }

    static async getCustomerById(id) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const customer = mockCustomers.find(c => c.id === parseInt(id));
                if (customer) {
                    resolve({
                        success: true,
                        data: customer
                    });
                } else {
                    reject({
                        success: false,
                        error: 'Customer not found'
                    });
                }
            }, 500);
        });
    }

    // 住所から緯度経度を取得する関数（実際のプロジェクトではGeocodingサービスを使用）
    static async geocodeAddress(address) {
        // OpenStreetMap Nominatim APIを使用した実際のジオコーディング
        const encodedAddress = encodeURIComponent(address);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=jp&limit=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.length > 0) {
                return {
                    success: true,
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            } else {
                throw new Error('Address not found');
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}