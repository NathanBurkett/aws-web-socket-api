import { DynamoDBStreamEvent } from 'aws-lambda';
import {
    DynamoDBBatchItemFailure,
    DynamoDBBatchResponse,
    DynamoDBStreamHandler
} from 'aws-lambda/trigger/dynamodb-stream';
import { dynamoDbDocument } from '../../../../dynamo/dynamo-db-document';
import { DynamoDbService } from '../../../../dynamo/dynamo-service';
import {
    QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

type Message = {
    messageId: string;
    sender: string;
    message: string;
    practiceRowKey: string;
};

const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
    const batchItemFailures: DynamoDBBatchItemFailure[] = [];

    for (const record of event.Records) {
        try {
            if (record.eventName !== 'INSERT') {
                continue;
            }

            const message = DynamoDbService.unmarshalDynamoDBRecordImage(record.dynamodb.NewImage) as Message;
            const queryParams: QueryCommandInput = {
                IndexName: 'practiceRowKey',
                KeyConditionExpression: 'practiceRowKey = :practiceRowKey',
                ExpressionAttributeValues: {
                    ':practiceRowKey': message.practiceRowKey,
                },
                TableName: process.env.CONNECTION_TABLE_NAME,
            };

            console.log({ API_ENDPOINT: process.env.API_ENDPOINT });

            const apigwManagementApi = new ApiGatewayManagementApiClient({
                endpoint: process.env.API_ENDPOINT,
            });

            const queryResult = await dynamoDbDocument.query(queryParams);
            for (const connection of queryResult.Items) {
                const params = { ConnectionId: connection.connectionId, Data: JSON.stringify(message) };
                console.log(`Posting: ${JSON.stringify(params)}`);
                const command = new PostToConnectionCommand(params);
                await apigwManagementApi.send(command);
                console.log(`Success`);
            }
        } catch (e) {
            console.error(e);
            batchItemFailures.push({ itemIdentifier: record.eventID });
        }
    }

    // extract practice id from message
    // get connections by practice id
    // put message + connectionId on queue

    return { batchItemFailures };
};

exports.handler = handler;
