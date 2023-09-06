import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, TranslateConfig } from '@aws-sdk/lib-dynamodb';

export const dynamoDbDocument = DynamoDBDocument.from(
    new DynamoDBClient({
        region: process.env.CDK_DEFAULT_REGION,
    }),
    { marshallOptions: { convertClassInstanceToMap: true, removeUndefinedValues: true } }
);
