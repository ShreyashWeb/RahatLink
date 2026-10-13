import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

/**
 * y-webrtc signaling server implementation.
 * Compatible with y-webrtc WebrtcProvider.
 */

const topics = new Map<string, Set<WebSocket>>();

const send = (conn: WebSocket, message: object) => {
  if (conn.readyState !== WebSocket.CONNECTING && conn.readyState !== WebSocket.OPEN) {
    conn.close();
    return;
  }
  try {
    conn.send(JSON.stringify(message));
  } catch {
    conn.close();
  }
};

export function setupSignaling(wss: WebSocketServer) {
  wss.on('connection', (conn: WebSocket) => {
    const subscribedTopics = new Set<string>();
    let closed = false;
    let pongReceived = true;

    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        conn.close();
        clearInterval(pingInterval);
      } else {
        pongReceived = false;
        try {
          conn.ping();
        } catch {
          conn.close();
        }
      }
    }, 30000);

    conn.on('pong', () => {
      pongReceived = true;
    });

    conn.on('close', () => {
      clearInterval(pingInterval);
      subscribedTopics.forEach((topicName) => {
        const subs = topics.get(topicName);
        if (subs) {
          subs.delete(conn);
          if (subs.size === 0) {
            topics.delete(topicName);
          }
        }
      });
      subscribedTopics.clear();
      closed = true;
    });

    conn.on('message', (rawData) => {
      let message: any;
      try {
        const text = rawData.toString();
        message = JSON.parse(text);
      } catch {
        // Not a JSON text message
        return;
      }

      if (message && message.type && !closed) {
        switch (message.type) {
          case 'subscribe':
            if (Array.isArray(message.topics)) {
              for (const topicName of message.topics) {
                if (typeof topicName === 'string') {
                  let topic = topics.get(topicName);
                  if (!topic) {
                    topic = new Set<WebSocket>();
                    topics.set(topicName, topic);
                  }
                  topic.add(conn);
                  subscribedTopics.add(topicName);
                }
              }
            }
            break;

          case 'unsubscribe':
            if (Array.isArray(message.topics)) {
              for (const topicName of message.topics) {
                const subs = topics.get(topicName);
                if (subs) {
                  subs.delete(conn);
                }
                subscribedTopics.delete(topicName);
              }
            }
            break;

          case 'publish':
            if (message.topic && typeof message.topic === 'string') {
              const receivers = topics.get(message.topic);
              if (receivers) {
                message.clients = receivers.size;
                for (const receiver of receivers) {
                  send(receiver, message);
                }
              }
            }
            break;

          case 'ping':
            send(conn, { type: 'pong' });
            break;
        }
      }
    });
  });
}
