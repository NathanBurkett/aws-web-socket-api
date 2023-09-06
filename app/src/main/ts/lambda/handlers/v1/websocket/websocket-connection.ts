export type WebSocketConnection = {
    connectionId: string;
    connectedAt: number;

    // Ex: NEO#1234:1#
    practiceRowKey: string;

    // Ex: CAMPAIGNS_WEB#NOTIFICATION_CENTER#APPOINTMENT_AUDIT
    subscriberContextRowKey: string;
};
