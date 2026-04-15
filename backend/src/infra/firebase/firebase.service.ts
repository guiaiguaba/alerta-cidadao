import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? admin.credential.cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
        )
      : admin.credential.applicationDefault();

    this.app = admin.initializeApp({
      credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    this.logger.log('Firebase Admin SDK initialised');
  }

  get auth() {
    return this.app.auth();
  }

  get messaging() {
    return this.app.messaging();
  }

  async sendToToken(token: string, title: string, body: string, data?: Record<string, string>) {
    return this.messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { contentAvailable: true } } },
    });
  }

  async sendToTopic(topic: string, title: string, body: string, data?: Record<string, string>) {
    return this.messaging.send({
      topic,
      notification: { title, body },
      data,
    });
  }
}
