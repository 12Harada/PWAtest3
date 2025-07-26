const webpush = require('web-push');

// VAPID keys (実際のアプリケーションでは環境変数で管理)
const vapidKeys = {
    publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM-Wa-T-kTY3kYgBkmYHnS5mIzMHnPWW-WI-M7kKJSaHaPNH0k3kOc',
    privateKey: 'UzQnFLnDw6O9oy8dLkNHGfkh7bYhLI3nJWN_2YJVU7I'
};

// web-pushの設定
webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

class PushNotificationServer {
    constructor() {
        this.subscriptions = new Map(); // 実際のアプリではデータベースを使用
    }
    
    // 購読を保存
    saveSubscription(userId, subscription) {
        this.subscriptions.set(userId, subscription);
        console.log(`Subscription saved for user: ${userId}`);
    }
    
    // 購読を削除
    removeSubscription(userId) {
        this.subscriptions.delete(userId);
        console.log(`Subscription removed for user: ${userId}`);
    }
    
    // 特定のユーザーに通知を送信
    async sendNotificationToUser(userId, payload) {
        const subscription = this.subscriptions.get(userId);
        
        if (!subscription) {
            throw new Error(`No subscription found for user: ${userId}`);
        }
        
        try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
            console.log(`Notification sent to user: ${userId}`);
        } catch (error) {
            console.error(`Failed to send notification to user ${userId}:`, error);
            
            // 購読が無効になった場合は削除
            if (error.statusCode === 410) {
                this.removeSubscription(userId);
            }
            throw error;
        }
    }
    
    // 全ユーザーに通知を送信
    async broadcastNotification(payload) {
        const promises = [];
        
        for (const [userId, subscription] of this.subscriptions) {
            promises.push(
                webpush.sendNotification(subscription, JSON.stringify(payload))
                    .catch(error => {
                        console.error(`Failed to send notification to user ${userId}:`, error);
                        
                        // 購読が無効になった場合は削除
                        if (error.statusCode === 410) {
                            this.removeSubscription(userId);
                        }
                    })
            );
        }
        
        await Promise.all(promises);
        console.log('Broadcast notification sent to all users');
    }
    
    // 顧客情報更新の通知
    async notifyCustomerUpdate(customerId, customerName) {
        const payload = {
            title: 'Customer Map',
            body: `お客様情報が更新されました: ${customerName}`,
            data: {
                type: 'customer_update',
                customerId: customerId
            }
        };
        
        await this.broadcastNotification(payload);
    }
    
    // 新規顧客追加の通知
    async notifyNewCustomer(customerName, address) {
        const payload = {
            title: 'Customer Map',
            body: `新しいお客様が追加されました: ${customerName}`,
            data: {
                type: 'new_customer',
                customerName: customerName,
                address: address
            }
        };
        
        await this.broadcastNotification(payload);
    }
    
    // 定期的なリマインダー通知
    async sendReminderNotification() {
        const payload = {
            title: 'Customer Map',
            body: '本日の訪問予定をご確認ください',
            data: {
                type: 'reminder'
            }
        };
        
        await this.broadcastNotification(payload);
    }
}

// サーバーインスタンス作成
const pushServer = new PushNotificationServer();

// 使用例とテスト用関数
async function testNotifications() {
    // テスト用の購読情報（実際のアプリではクライアントから受信）
    const testSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/example',
        keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
        }
    };
    
    // テストユーザーの購読を保存
    pushServer.saveSubscription('test-user-1', testSubscription);
    
    // テスト通知を送信
    try {
        await pushServer.notifyNewCustomer('田中太郎', '東京都渋谷区');
        console.log('Test notification sent successfully');
    } catch (error) {
        console.error('Test notification failed:', error);
    }
}

// モジュールとしてエクスポート
module.exports = {
    PushNotificationServer,
    pushServer,
    testNotifications
};

// このファイルを直接実行した場合のテスト
if (require.main === module) {
    console.log('Push notification server started');
    console.log('VAPID Public Key:', vapidKeys.publicKey);
    
    // テスト実行（実際の購読があれば）
    // testNotifications();
}